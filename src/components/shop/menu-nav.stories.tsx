import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { menuCategories } from './fixtures'
import { MenuNav } from './menu-nav'

/** Sticky-навигация по категориям: якорный скролл + scrollspy (этап 0) */
const meta = {
	title: 'Shop/MenuNav',
	component: MenuNav,
	args: { categories: menuCategories },
} satisfies Meta<typeof MenuNav>
export default meta
type Story = StoryObj<typeof meta>

export const FiveCategories: Story = {}
