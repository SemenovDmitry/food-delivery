import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite'
import {
	__setSession,
	type SbSessionState,
	type SbSessionUser,
} from '../../../.storybook/mocks/auth-client'
import { Header } from './header'

/**
 * Шапка магазина (этап 0): навигация, GET-поиск, ThemeToggle, AuthArea.
 * Сессия — через мок auth-client (алиас, тикет 05): __setSession из
 * per-story декоратора. cartSlot — статичный эквивалент серверного
 * CartBadge (Suspense-слот рендерится сервером layout'а, в iframe
 * невоспроизводим — спека слайса 3).
 */
const meta = {
	title: 'Shop/Header',
	component: Header,
	args: {
		// точное зеркало прод-вывода CartBadge (Σ3): видимая точка + sr-only
		// текст — без него ссылка корзины безымянна (axe link-name, находка
		// аудита слайса 3; прод не затронут — CartBadge sr-only всегда рендерит)
		cartSlot: (
			<>
				<span
					aria-hidden
					className='absolute -right-1.5 -top-1.5 grid size-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground'
				>
					3
				</span>
				<span className='sr-only'>В корзине 3 товара</span>
			</>
		),
	},
} satisfies Meta<typeof Header>
export default meta
type Story = StoryObj<typeof meta>

function sessionDecorator(state: SbSessionState): Decorator {
	return (Story) => {
		__setSession(state)
		return <Story />
	}
}

const clientUser: SbSessionUser = {
	id: 'user-client',
	name: null,
	email: 'client@food.local',
	emailVerified: true,
	role: 'customer',
	phoneNumber: '+7 999 000-00-03',
}

/** Гость: кнопка «Войти» */
export const Guest: Story = { decorators: [sessionDecorator('guest')] }

/** Авторизованный (emailVerified=true): иконка «Профиль», dropdown закрыт */
export const Authorized: Story = { decorators: [sessionDecorator(clientUser)] }

/** Загрузка сессии: pulse-скелетон вместо AuthArea */
export const SessionPending: Story = { decorators: [sessionDecorator('pending')] }
