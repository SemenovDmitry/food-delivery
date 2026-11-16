import { headers } from 'next/headers'
import { connection } from 'next/server'
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

/** Сессия с ролью admin|manager — гард закрытых зон /admin/* */
export async function getAdminSession() {
	const session = await getSession()
	if (!session) return null
	const role = session.user.role
	if (role !== 'admin' && role !== 'manager') return null
	return session
}
