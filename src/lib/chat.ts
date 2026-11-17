import 'server-only'

import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import type { ChatDirection, ChatThread } from '@/db/schema'
import { chatMessages, chatThreads, user } from '@/db/schema'
import { isUuid } from '@/lib/id'
import type { ChatBroadcastMessage, ChatIdentity, ChatNotifyPayload } from '@/lib/ws-protocol'

/** httpOnly-кука идентичности гостя чата (прецедент cart_id, Q2) */
export const CHAT_COOKIE = 'chat_token'
export const CHAT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 дней

/** Объём истории в init и ленты операторской (Q4) */
export const CHAT_HISTORY_LIMIT = 50
export const CHAT_THREADS_LIMIT = 50

const OPERATOR_ROLES = ['admin', 'manager'] as const

// ─── Резолв тредов ───────────────────────────────────────────────────────────

/** Гостевой тред по токену (без создания; кривой токен режется до запроса — §5.24) */
export async function findGuestThread(token: string): Promise<ChatThread | null> {
	if (!isUuid(token)) return null
	const [found] = await db.select().from(chatThreads).where(eq(chatThreads.guestToken, token))
	return found ?? null
}

/** Тред клиента по userId (без создания) */
export async function findUserThread(userId: string): Promise<ChatThread | null> {
	const [found] = await db.select().from(chatThreads).where(eq(chatThreads.userId, userId))
	return found ?? null
}

/**
 * Резолв треда для клиента/гостя с созданием (Q2). Усиновление гостевого
 * треда при логине — ТОЛЬКО пока у юзера нет своего; потоки сообщений
 * не мержатся, осиротевший гостевой тред принят. Гонки параллельных init:
 * onConflictDoNothing + повторный select; усиновление — conditional UPDATE
 * по userId IS NULL (паттерн cancelOrder).
 */
export async function resolveCustomerThread(params: {
	userId?: string
	guestToken?: string
}): Promise<ChatThread> {
	const { userId, guestToken } = params

	if (userId) {
		const own = await findUserThread(userId)
		if (own) return own

		// Токен может быть кривым — усиновление только по валидному uuid (§5.24);
		// guest_token освобождаем: старая кука не должна давать доступ к треду
		if (guestToken && isUuid(guestToken)) {
			try {
				const [adopted] = await db
					.update(chatThreads)
					.set({ userId, guestToken: null, updatedAt: new Date() })
					.where(and(eq(chatThreads.guestToken, guestToken), isNull(chatThreads.userId)))
					.returning()
				if (adopted) return adopted
			} catch {
				// unique(user_id) от параллельного init — тред уже создан, читаем ниже
			}
			const raced = await findUserThread(userId)
			if (raced) return raced
			// fallthrough: своего нет — создаём ниже
		}

		const [created] = await db
			.insert(chatThreads)
			.values({ userId })
			.onConflictDoNothing()
			.returning()
		if (created) return created
		const [afterRace] = await db.select().from(chatThreads).where(eq(chatThreads.userId, userId))
		if (!afterRace) throw new Error('chat: тред клиента не создался')
		return afterRace
	}

	if (guestToken) {
		const existing = await findGuestThread(guestToken)
		if (existing) return existing
		const [created] = await db
			.insert(chatThreads)
			.values({ guestToken })
			.onConflictDoNothing()
			.returning()
		if (created) return created
		const afterRace = await findGuestThread(guestToken)
		if (!afterRace) throw new Error('chat: гостевой тред не создался')
		return afterRace
	}

	throw new Error('chat: нет идентичности для резолва треда')
}

// ─── Запись ──────────────────────────────────────────────────────────────────

/** Строка chat_messages → сообщение эфира (единый маппинг: insert/init/action) */
export function toBroadcastMessage(row: typeof chatMessages.$inferSelect): ChatBroadcastMessage {
	return {
		id: row.id,
		direction: row.direction as ChatDirection,
		text: row.text,
		createdAt: row.createdAt.toISOString(),
		senderId: row.senderId,
	}
}

/**
 * Вставка сообщения + NOTIFY в одной транзакции (§5.22): телефон владельца
 * треда джойнится в момент вставки и кладётся в payload (заголовок таба
 * оператора; «unknown» у гостя — null). NOTIFY фанаутит шлюз, Next сам WS
 * не держит.
 */
export async function insertMessage(params: {
	threadId: string
	direction: ChatDirection
	senderId: string | null
	text: string
}): Promise<ChatBroadcastMessage> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(chatMessages)
			.values({
				threadId: params.threadId,
				direction: params.direction,
				senderId: params.senderId,
				text: params.text,
			})
			.returning()
		if (!row) throw new Error('chat: сообщение не вставилось')

		const [owner] = await tx
			.select({ phone: user.phoneNumber })
			.from(chatThreads)
			.innerJoin(user, eq(chatThreads.userId, user.id))
			.where(eq(chatThreads.id, params.threadId))

		const message = toBroadcastMessage(row)
		const payload: ChatNotifyPayload = {
			threadId: params.threadId,
			phone: owner?.phone ?? null,
			message,
		}
		await tx.execute(sql`select pg_notify('chat', ${JSON.stringify(payload)})`)
		return message
	})
}

// ─── Чтения ──────────────────────────────────────────────────────────────────

/** Последние 50 сообщений треда в порядке отображения (Q4) */
export async function getThreadHistory(threadId: string, limit = CHAT_HISTORY_LIMIT) {
	const rows = await db
		.select()
		.from(chatMessages)
		.where(eq(chatMessages.threadId, threadId))
		.orderBy(desc(chatMessages.id))
		.limit(limit)
	return rows.reverse()
}

/**
 * Лента операторской (Q6/Q4): ≤50 тредов, только с ≥1 customer-сообщением
 * (init-пустышки табов не создают), порядок по последнему сообщению,
 * телефон из JOIN («unknown» — null у гостя), unread для бейджа таба.
 */
export async function getOperatorThreads(limit = CHAT_THREADS_LIMIT) {
	return db
		.select({
			id: chatThreads.id,
			userId: chatThreads.userId,
			phone: user.phoneNumber,
			lastReadAt: chatThreads.operatorLastReadAt,
			lastMessageAt: sql<Date | null>`(select max(m.created_at) from chat_messages m where m.thread_id = ${chatThreads.id})`,
			unread: sql<number>`(select count(*)::int from chat_messages m where m.thread_id = ${chatThreads.id} and m.direction = 'customer' and (${chatThreads.operatorLastReadAt} is null or m.created_at > ${chatThreads.operatorLastReadAt}))`,
		})
		.from(chatThreads)
		.leftJoin(user, eq(chatThreads.userId, user.id))
		.where(
			sql`exists (select 1 from chat_messages m where m.thread_id = ${chatThreads.id} and m.direction = 'customer')`,
		)
		.orderBy(
			desc(sql`(select max(m.id) from chat_messages m where m.thread_id = ${chatThreads.id})`),
		)
		.limit(limit)
}

/** Непрочитанные для бейджа: сообщения НАВСТРЕЧУ стороне после её last_read_at */
async function countUnread(
	threadId: string,
	side: 'customer' | 'operator',
	lastReadAt: Date | null,
): Promise<number> {
	const incoming = side === 'customer' ? 'operator' : 'customer'
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(chatMessages)
		.where(
			and(
				eq(chatMessages.threadId, threadId),
				eq(chatMessages.direction, incoming),
				lastReadAt === null ? sql`true` : gt(chatMessages.createdAt, lastReadAt),
			),
		)
	return row?.n ?? 0
}

/** Бейдж закрытого виджета (Q3): тред по идентичности БЕЗ создания, иначе 0 */
export async function getUnreadForCustomer(params: {
	userId?: string
	guestToken?: string
}): Promise<number> {
	const thread = params.userId
		? await findUserThread(params.userId)
		: params.guestToken
			? await findGuestThread(params.guestToken)
			: null
	if (!thread) return 0
	return countUnread(thread.id, 'customer', thread.customerLastReadAt)
}

/** Непрочитанные треда для стороны (операторская пересчитывает по NOTIFY) */
export async function getOperatorUnread(
	threadId: string,
	lastReadAt: Date | null,
): Promise<number> {
	return countUnread(threadId, 'operator', lastReadAt)
}

/** Открыл окно/таб или получил живьём → last_read_at = now (Q5; NOTIFY не нужен) */
export async function markRead(threadId: string, side: 'customer' | 'operator'): Promise<void> {
	await db
		.update(chatThreads)
		.set(
			side === 'customer' ? { customerLastReadAt: new Date() } : { operatorLastReadAt: new Date() },
		)
		.where(eq(chatThreads.id, threadId))
}

// ─── Живая валидация доступа (вызывает internal-роут, тикет 04) ──────────────

export type ThreadAccessResult =
	| { ok: true; thread: ChatThread }
	| { ok: false; code: 'forbidden' | 'banned' }

/**
 * Перевалидация identity против треда на КАЖДЫЙ send (гвард-стиль этапа 5,
 * cookieCache не доверяем): владение для клиента/гостя, свежий срез
 * роль/бан/архив для оператора. Несуществующий тред не отличаем от чужого
 * (анти-энумерация) — forbidden.
 */
export async function checkThreadAccess(
	identity: ChatIdentity,
	threadId: string,
): Promise<ThreadAccessResult> {
	const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId))
	if (!thread) return { ok: false, code: 'forbidden' }

	switch (identity.kind) {
		case 'customer':
			return thread.userId === identity.userId
				? { ok: true, thread }
				: { ok: false, code: 'forbidden' }
		case 'guest':
			return thread.guestToken === identity.token
				? { ok: true, thread }
				: { ok: false, code: 'forbidden' }
		case 'operator': {
			const [operator] = await db
				.select({ role: user.role, bannedAt: user.bannedAt, deletedAt: user.deletedAt })
				.from(user)
				.where(eq(user.id, identity.userId))
			const roleOk = operator
				? (OPERATOR_ROLES as readonly string[]).includes(operator.role)
				: false
			if (!operator || !roleOk || operator.bannedAt || operator.deletedAt) {
				return { ok: false, code: 'banned' }
			}
			return { ok: true, thread }
		}
	}
}
