/**
 * Мок server actions юзеров для Storybook (слайс 3, тикет 05): бан/архив
 * успешны (self-guard — прод-гард, сторя показывает disabled-кнопки через
 * currentUserId-фикстуру). Сигнатуры — typeof прод-модуля (tsc ловит
 * расхождение).
 */
import type * as UsersActions from '@/lib/actions/users'

export const banUser: typeof UsersActions.banUser = async () => ({
	data: { banned: true },
	error: null,
})

export const unbanUser: typeof UsersActions.unbanUser = async () => ({
	data: { unbanned: true },
	error: null,
})

export const archiveUser: typeof UsersActions.archiveUser = async () => ({
	data: { archived: true },
	error: null,
})
