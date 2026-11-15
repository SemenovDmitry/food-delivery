import { createHash } from 'node:crypto'
import type { Promotion } from '@/db/schema'
import { filterPromosInWindow } from '@/lib/promo'
import { getCachedActivePromotions } from '@/queries/promotions'

/**
 * GET /api/promotions (этап 2): публичные акции из активного окна — для внешних
 * потребителей. Скрытые промокоды (GLOSSARY) через API не отдаются — гарантируется
 * кеш-фильтром isPublic в getCachedActivePromotions, здесь своего фильтра нет.
 */

/**
 * s-maxage=60: CDN в проекте нет — заголовок демонстративный. Оговорка доков
 * (cdn-caching): CDN не слышит revalidateTag и досидит до конца TTL. Окно всё
 * равно точное: Next не кеширует динамический handler, фильтр окна — на каждом чтении.
 */
const CACHE_CONTROL = 'public, s-maxage=60'

/** Контракт API не повторяет схему БД: isActive (всегда true), isPublic (выдача
 * публичная по определению), createdAt — наружу не идут; даты — ISO-строки. */
type PublicPromotionDto = {
	id: string
	name: string
	code: string | null
	discountType: Promotion['discountType']
	discountValue: number
	categoryId: number | null
	minTotal: number
	startsAt: string | null
	endsAt: string | null
}

function toDto(promo: Promotion): PublicPromotionDto {
	return {
		id: promo.id,
		name: promo.name,
		code: promo.code,
		discountType: promo.discountType,
		discountValue: promo.discountValue,
		categoryId: promo.categoryId,
		minTotal: promo.minTotal,
		startsAt: promo.startsAt?.toISOString() ?? null,
		endsAt: promo.endsAt?.toISOString() ?? null,
	}
}

export async function GET(request: Request): Promise<Response> {
	// Чтение заголовков делает роут динамическим (v15+: GET динамические по
	// умолчанию) — пререндера с живой БД на docker build нет (§5.3)
	const ifNoneMatch = request.headers.get('if-none-match')

	// окно акции — фильтр на чтении ВНЕ кеша: исчезает ровно в конце окна
	const promos = filterPromosInWindow(await getCachedActivePromotions(), new Date())
	const body = JSON.stringify(promos.map(toDto))

	// Ручной ETag: авто-ETag Next для динамических роутов не считается
	// (sendRenderResult: isDynamic → payload = null). Strong ETag от тела.
	const etag = `"${createHash('sha256').update(body).digest('hex')}"`

	// Точное сравнение: ETag ставим сами себе, учебный проект — без парсинга
	// списков и W/-префикса (они допускаются RFC 9110, но не нужны здесь)
	if (ifNoneMatch === etag) {
		// RFC 9110 §13.1.2: 304 повторяет заголовки 200 (ETag, Cache-Control)
		return new Response(null, {
			status: 304,
			headers: { ETag: etag, 'Cache-Control': CACHE_CONTROL },
		})
	}

	return new Response(body, {
		status: 200,
		headers: {
			ETag: etag,
			'Cache-Control': CACHE_CONTROL,
			'Content-Type': 'application/json; charset=utf-8',
		},
	})
}
