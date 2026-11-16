import { type NextRequest, NextResponse } from 'next/server'

/**
 * Fast-fail для /admin (этап 5, Q21 — §5.9): нет сессионной cookie → /login
 * без запуска RSC. Это ТОЛЬКО optimistic-проверка (доки v16: proxy — не место
 * для авторизации и медленных чтений): живую проверку роли/бана делает
 * requireAdmin в admin-layout на каждом запросе (lib/session.ts, Q14).
 */
export function proxy(request: NextRequest) {
	// имя = `${prefix}.${name}` | `${prefix}-${name}` (secure/non-secure) — проверяем суффикс,
	// чтобы не зависеть от конфигурации префикса better-auth
	const hasSession = request.cookies
		.getAll()
		.some(({ name }) => name.endsWith('session_token') || name.endsWith('session_data'))
	if (!hasSession) {
		return NextResponse.redirect(new URL('/login', request.url))
	}
	return NextResponse.next()
}

export const config = {
	matcher: '/admin/:path*',
}
