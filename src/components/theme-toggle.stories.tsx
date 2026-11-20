import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ThemeToggle } from './theme-toggle'

/**
 * Переключатель темы (§5.8): обе иконки в DOM, видимость через dark: классы —
 * toolbar light/dark показывает рабочую, setTheme пишет на html стори-iframe.
 */
const meta = {
	title: 'Theme/ThemeToggle',
	component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>
export default meta
type Story = StoryObj<typeof meta>

/** Светлая: Sun виден, Moon скрыт (в тёмной — наоборот) */
export const Toggle: Story = {}
