import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { AdminNav } from './admin-nav'

/**
 * Навигация админки по роли (этап 5): preview пинит pathname='/' — активный
 * пункт задаётся per-story декоратором поверх PathnameContext (те же реальные
 * контексты Next, что в appRouterDecorator preview).
 */
const meta = {
	title: 'Admin/AdminNav',
	component: AdminNav,
} satisfies Meta<typeof AdminNav>
export default meta
type Story = StoryObj<typeof meta>

function pathnameDecorator(pathname: string): Decorator {
	return (Story) => (
		<PathnameContext.Provider value={pathname}>
			<Story />
		</PathnameContext.Provider>
	)
}

/** Admin: 8 ссылок, активная «Заказы» (aria-current='page') */
export const Admin: Story = {
	args: { role: 'admin' },
	decorators: [pathnameDecorator('/admin/orders')],
}

/** Manager: 2 ссылки (Заказы, Чаты) — adminOnly отфильтрованы */
export const Manager: Story = { args: { role: 'manager' } }
