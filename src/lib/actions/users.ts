'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { user } from '@/db/schema'
import { requireAdminOnly } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const UUID_RE = /^[0-9a-f-]{36}$/i

/**
 * Бан/архив пользователей (этап 5, Q14/Q24): два НЕЗАВИСИМЫХ флага —
 * banned_at (наказание, «Аккаунт заблокирован») и deleted_at (софт-удаление,
 * «Аккаунт удалён»); restore-UI нет (Q24). Self-guard: нельзя себя (Q15).
 * Живая проверка в гардах (lib/session.ts) режет доступ забаненному на
 * следующем guarded-запросе; вход — гарды до OTP (actions/auth.ts).
 */
async function withTarget(userId: string, selfId: string): Promise<{ error: string | null }> {
	if (!UUID_RE.test(userId)) return { error: 'Пользователь не найден' }
	if (userId === selfId) return { error: 'Нельзя применить действие к себе' }
	return { error: null }
}

export async function banUser(userId: string): Promise<ActionResult<{ banned: true }>> {
	const { userId: selfId } = await requireAdminOnly()
	const guard = await withTarget(userId, selfId)
	if (guard.error) return { data: null, error: guard.error }

	await db
		.update(user)
		.set({ bannedAt: new Date(), updatedAt: new Date() })
		.where(eq(user.id, userId))

	revalidatePath('/admin/users')
	return { data: { banned: true }, error: null }
}

export async function unbanUser(userId: string): Promise<ActionResult<{ unbanned: true }>> {
	const { userId: selfId } = await requireAdminOnly()
	const guard = await withTarget(userId, selfId)
	if (guard.error) return { data: null, error: guard.error }

	await db.update(user).set({ bannedAt: null, updatedAt: new Date() }).where(eq(user.id, userId))

	revalidatePath('/admin/users')
	return { data: { unbanned: true }, error: null }
}

export async function archiveUser(userId: string): Promise<ActionResult<{ archived: true }>> {
	const { userId: selfId } = await requireAdminOnly()
	const guard = await withTarget(userId, selfId)
	if (guard.error) return { data: null, error: guard.error }

	// софт-удаление (Q15→Q24): orders.userId не трогаем — история остаётся
	// атрибутированной; вход режут гарды до OTP, guarded-запросы — session.ts
	await db
		.update(user)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(user.id, userId))

	revalidatePath('/admin/users')
	return { data: { archived: true }, error: null }
}
