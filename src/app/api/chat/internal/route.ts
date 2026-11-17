import { z } from 'zod'

import { checkThreadAccess, insertMessage, markRead } from '@/lib/chat'
import { chatMessageTextSchema } from '@/lib/schemas/chat'
import type { ChatInternalRequest, ChatInternalResponse } from '@/lib/ws-protocol'

/**
 * Служебный релей-приёмник WS-шлюза (§5.22, Q9): только шлюз — по общему
 * секрету. Fail-fast по отсутствию `INTERNAL_API_SECRET` — ВНУТРИ хендлера,
 * не на импорте модуля: next build импортирует роут-модули без секретов,
 * module-level throw уронил бы сборку (семья §5.3).
 */
function requireInternalSecret(): string {
	const secret = process.env.INTERNAL_API_SECRET
	if (!secret) {
		throw new Error('INTERNAL_API_SECRET не задан — служебный роут чата отключён')
	}
	return secret
}

const identitySchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('customer'), userId: z.string().min(1) }),
	z.object({ kind: z.literal('guest'), token: z.string().min(1) }),
	z.object({
		kind: z.literal('operator'),
		userId: z.string().min(1),
		role: z.enum(['admin', 'manager']),
	}),
])

const internalRequestSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('send'),
		identity: identitySchema,
		threadId: z.uuid(),
		text: chatMessageTextSchema,
	}),
	z.object({ action: z.literal('read'), identity: identitySchema, threadId: z.uuid() }),
	z.object({ action: z.literal('join'), identity: identitySchema, threadId: z.uuid() }),
])

const denied = (code: 'validation' | 'forbidden' | 'banned', status: 400 | 403): Response =>
	Response.json({ ok: false, code } satisfies ChatInternalResponse, { status })

export async function POST(request: Request): Promise<Response> {
	try {
		requireInternalSecret()
	} catch (error) {
		console.error('chat/internal:', error)
		return denied('forbidden', 403)
	}

	if (request.headers.get('x-internal-secret') !== process.env.INTERNAL_API_SECRET) {
		return denied('forbidden', 403)
	}

	const parsed = internalRequestSchema.safeParse(await request.json().catch(() => null))
	if (!parsed.success) return denied('validation', 400)
	const body: ChatInternalRequest = parsed.data

	// Живая перевалидация identity на КАЖДОЕ действие (гвард-стиль этапа 5)
	const access = await checkThreadAccess(body.identity, body.threadId)
	if (!access.ok) return denied(access.code, 403)

	if (body.action === 'join') {
		return Response.json({ ok: true } satisfies ChatInternalResponse)
	}

	// Сторона read и направление send выводятся из identity
	if (body.action === 'read') {
		await markRead(body.threadId, body.identity.kind === 'operator' ? 'operator' : 'customer')
		return Response.json({ ok: true } satisfies ChatInternalResponse)
	}

	const message = await insertMessage({
		threadId: body.threadId,
		direction: body.identity.kind === 'operator' ? 'operator' : 'customer',
		senderId: body.identity.kind === 'guest' ? null : body.identity.userId,
		text: body.text,
	})
	return Response.json({ ok: true, message } satisfies ChatInternalResponse)
}
