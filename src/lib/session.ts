import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { auth } from './auth'

/**
 * Сессия текущего пользователя (или null для гостя).
 * connection() ПЕРЕД better-auth (§5.3, как для new Date()): с живой сессией
 * cookieCache-hit внутри auth.api.getSession читает Date.now() (сравнение expiry)
 * — нестабильное текущее время; без явного dynamic-гейта dev-пререндер
 * soft-навигации падает «Blocking Route» (этап 3, 2026-11-16 — до этапа 3 никто
 * не был залогинен и ветка не исполнялась). В server actions connection() — no-op.
 */
export async function getSession() {
	await connection()
	return await auth.api.getSession({ headers: await headers() })
}

/**
 * Живая проверка прав (этап 5, Q14): cookieCache (5 мин) не доверяем в гардах —
 * смена роли/бан должны резать доступ на СЛЕДУЮЩЕМ запросе, а не через 5 минут.
 * Один PK-lookup на guarded-запрос; у гостя запроса нет вовсе.
 */
type LiveAccess = { id: string; role: string; bannedAt: Date | null; deletedAt: Date | null }

async function getLiveAccess(userId: string): Promise<LiveAccess | null> {
	const [row] = await db
		.select({
			id: user.id,
			role: user.role,
			bannedAt: user.bannedAt,
			deletedAt: user.deletedAt,
		})
		.from(user)
		.where(eq(user.id, userId))
	return row ?? null
}

function isBlocked(live: LiveAccess): boolean {
	return live.bannedAt !== null || live.deletedAt !== null
}

/**
 * Срез сессии с редиректом. signOut мутирует cookie → легален только в Server
 * Actions; из RSC (layout-гарды) cookies только для чтения — в этом случае
 * сессия переживает до экспирации, но живой гвард режет КАЖДЫЙ guarded-запрос,
 * фактического доступа у заблокированного нет.
 */
async function cutAccess(notice: 'banned' | 'deleted' | 'role'): Promise<never> {
	try {
		await auth.api.signOut({ headers: await headers() })
	} catch {
		// RSC: cookie-мутация недоступна — см. комментарий выше
	}
	redirect(`/login?notice=${notice}`)
}

/**
 * Гард мутаций и закрытых зон магазина (Q14): сессия есть, но юзер забанен или
 * архивирован → signOut + /login. Гость (без сессии) проходит — публичное
 * viewing бан не режет.
 */
export async function enforceNotBlocked(): Promise<void> {
	const session = await getSession()
	if (!session) return
	const live = await getLiveAccess(session.user.id)
	if (live && isBlocked(live)) {
		return cutAccess(live.deletedAt ? 'deleted' : 'banned')
	}
}

/** Гард /admin/* (Q14): живая роль admin|manager, иначе срез + /login */
export async function requireAdmin(): Promise<{ role: 'admin' | 'manager'; userId: string }> {
	const session = await getSession()
	if (!session) redirect('/login')
	const live = await getLiveAccess(session.user.id)
	if (!live) return cutAccess('role') // cookie жива, юзера в БД нет
	if (isBlocked(live)) return cutAccess(live.deletedAt ? 'deleted' : 'banned')
	if (live.role !== 'admin' && live.role !== 'manager') return cutAccess('role')
	return { role: live.role, userId: live.id }
}

/** Гард admin-only страниц: manager → тихий redirect на заказы, без 403 (Q2) */
export async function requireAdminOnly(): Promise<{ role: 'admin'; userId: string }> {
	const { role, userId } = await requireAdmin()
	if (role !== 'admin') redirect('/admin/orders')
	return { role, userId }
}
