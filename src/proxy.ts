import { type NextRequest, NextResponse } from 'next/server'

/**
 * Fast-fail для /admin (этап 5, Q21 — §5.9): нет сессионной cookie → /login
 * без запуска RSC. Это ТОЛЬКО optimistic-проверка (доки v16: proxy — не место
 * для авторизации и медленных чтений): живую проверку роли/бана делает
 * requireAdmin в admin-layout на каждом запросе (lib/session.ts, Q14).
 *
 * Этап 11 (Q7): каждый запрос получает `x-request-id` (uuid) — в request-заголовки
 * (даунстрим: `getRequestId()` в Route Handlers/Actions/error-границах, НЕ в
 * 'use cache') и в ответ `X-Request-Id` (клиент может процитировать id в чате
 * поддержки). Matcher — все пути кроме статики: Server Actions (POST страниц)
 * тоже получают id. Access-логов здесь НЕТ (proxy не логирует — только id).
 */
export function proxy(request: NextRequest) {
	const requestId = crypto.randomUUID()
	const requestHeaders = new Headers(request.headers)
	requestHeaders.set('x-request-id', requestId)

	// имя = `${prefix}.${name}` | `${prefix}-${name}` (secure/non-secure) — проверяем суффикс,
	// чтобы не зависеть от конфигурации префикса better-auth
	const hasSession = request.cookies
		.getAll()
		.some(({ name }) => name.endsWith('session_token') || name.endsWith('session_data'))

	// Редирект — ТОЛЬКО для /admin (этап 5): matcher теперь покрывает ВСЕ пути
	// (request-id, этап 11) — без этой проверки гость получал бы /login на
	// витрине и /api/health (найдено на dev-смоуке)
	const isAdminPath =
		request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')

	const response =
		hasSession || !isAdminPath
			? NextResponse.next({ request: { headers: requestHeaders } })
			: NextResponse.redirect(new URL('/login', request.url))
	response.headers.set('X-Request-Id', requestId)
	return response
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt).*)'],
}
