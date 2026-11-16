import { createHash } from 'node:crypto'
import type { OrderPaymentStatus, OrderStatus } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { getOrderById } from '@/queries/orders'

/**
 * GET /api/orders/[id] (этап 4): минимальный статус заказа для поллинга трекинга —
 * клиент обновляет только таймлайн (состав/итоги снапшотные и уже отрендерены RSC).
 * Доступ — существование uuid: неугадываемый id сам себе пропуск (как страница,
 * гриллинг Q11a); сессия не читается — DTO личных полей не содержит.
 */

const CACHE_CONTROL = 'private, no-store'

/** Контракт API ≠ схема БД: даты наружу — ISO-строки, остальное лишнее не идёт */
type OrderStatusDto = {
	status: OrderStatus | string
	paymentStatus: OrderPaymentStatus | string
	updatedAt: string
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
): Promise<Response> {
	// Чтение request/params делает роут динамическим — connection() не нужен (§5.3)
	const { id } = await params
	const ifNoneMatch = request.headers.get('if-none-match')

	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(id)) return new Response(null, { status: 404 })

	const details = await getOrderById(id)
	if (!details) return new Response(null, { status: 404 })

	const body = JSON.stringify({
		status: details.order.status,
		paymentStatus: details.order.paymentStatus,
		updatedAt: details.order.updatedAt.toISOString(),
	} satisfies OrderStatusDto)

	// Ручной ETag — паттерн GET /api/promotions (этап 2): авто-ETag Next для
	// динамических роутов не считается (sendRenderResult: isDynamic → payload = null)
	const etag = `"${createHash('sha256').update(body).digest('hex')}"`

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
