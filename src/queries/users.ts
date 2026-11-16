import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { orders, user } from '@/db/schema'

export type AdminUserRow = {
	id: string
	name: string
	email: string
	role: string
	phoneNumber: string | null
	createdAt: Date
	bannedAt: Date | null
	orderCount: number
}

/**
 * Список пользователей для /admin/users (этап 5, Q12/Q24): архивированные
 * (deleted_at IS NOT NULL) скрыты; поиск ?q= — ilike по email/телефону/имени;
 * Σзаказов left join'ом (без N+1). Пагинация (Q19). Без кеша: админские данные.
 */
export async function getUsersList({
	q,
	page,
	perPage,
}: {
	q: string
	page: number
	perPage: number
}): Promise<{
	rows: AdminUserRow[]
	total: number
}> {
	const search = q.trim()
	const where = search
		? and(
				isNull(user.deletedAt),
				or(
					ilike(user.email, `%${search}%`),
					ilike(user.phoneNumber, `%${search}%`),
					ilike(user.name, `%${search}%`),
				),
			)
		: isNull(user.deletedAt)

	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			phoneNumber: user.phoneNumber,
			createdAt: user.createdAt,
			bannedAt: user.bannedAt,
			orderCount: count(orders.id),
		})
		.from(user)
		.leftJoin(orders, eq(orders.userId, user.id))
		.where(where)
		.groupBy(user.id)
		.orderBy(asc(user.createdAt))
		.limit(perPage)
		.offset((page - 1) * perPage)

	const [{ value: total }] = await db.select({ value: count() }).from(user).where(where)

	return { rows, total }
}
