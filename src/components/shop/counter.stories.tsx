import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Counter } from './counter'

/** Общий степпер [−][значение][+] — границы дизейблят кнопки сами (§11) */
const meta = {
	title: 'Shop/Counter',
	component: Counter,
	args: {
		decreaseLabel: 'Убрать одну «Пепперони»',
		increaseLabel: 'Добавить одну «Пепперони»',
		// управляемый компонент: колбэки обязательны, для статичных сторий — no-op
		onDecrease: () => {},
		onIncrease: () => {},
	},
} satisfies Meta<typeof Counter>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { value: 2 } }

/** value = min: «−» дизейблится */
export const AtMin: Story = { args: { value: 1 } }

/** value = max: «+» дизейблится */
export const AtMax: Story = { args: { value: 5, max: 5 } }

/** Компактный вариант — в строках корзины */
export const Small: Story = { args: { value: 3, size: 'sm' } }

/** aria-live на значении — в деталях товара */
export const AnnounceValue: Story = { args: { value: 2, announceValue: true } }
