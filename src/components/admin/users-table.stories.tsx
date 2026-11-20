import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { AdminUserRow } from '@/queries/users'
import { UsersTable } from './users-table'

/**
 * Таблица пользователей (этап 5, Q12/Q24): ban/unban/archiveUser замоканы
 * алиасами (.storybook/mocks/users-actions — успех). Строки: self-ряд (кнопки
 * disabled — self-guard) и забаненный (бейдж + «Разбанить»). Диалог архивации —
 * интеракция; бан/архив живьём покрыт приёмкой этапа 5.
 */
const meta = {
	title: 'Admin/UsersTable',
	component: UsersTable,
	args: { currentUserId: 'user-admin' },
} satisfies Meta<typeof UsersTable>
export default meta
type Story = StoryObj<typeof meta>

/** 4 строки: admin (self, кнопки disabled), manager, клиент (забанен), клиент */
export const Table: Story = {
	args: {
		rows: [
			{
				id: 'user-admin',
				name: 'Админ',
				email: 'admin@food.local',
				role: 'admin',
				phoneNumber: '+7 999 000-00-01',
				createdAt: new Date('2026-01-01T00:00:00Z'),
				bannedAt: null,
				orderCount: 0,
			},
			{
				id: 'user-manager',
				name: 'Менеджер',
				email: 'manager@food.local',
				role: 'manager',
				phoneNumber: '+7 999 000-00-02',
				createdAt: new Date('2026-01-01T00:00:00Z'),
				bannedAt: null,
				orderCount: 0,
			},
			{
				id: 'user-banned',
				name: 'Бунтарский Клиент',
				email: 'banned@food.local',
				role: 'customer',
				phoneNumber: '+7 999 555-00-01',
				createdAt: new Date('2026-03-15T12:00:00Z'),
				bannedAt: new Date('2026-11-01T10:00:00Z'),
				orderCount: 7,
			},
			{
				id: 'user-client',
				name: 'Клиент',
				email: 'client@food.local',
				role: 'customer',
				phoneNumber: '+7 999 000-00-03',
				createdAt: new Date('2026-01-02T00:00:00Z'),
				bannedAt: null,
				orderCount: 12,
			},
		] satisfies AdminUserRow[],
	},
}

/** Пустой результат поиска */
export const Empty: Story = { args: { rows: [] } }
