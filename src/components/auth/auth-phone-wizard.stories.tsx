import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AuthPhoneWizard } from './auth-phone-wizard'

/**
 * Визард «телефон → SMS-код» (этап 3, страницы-близнеца /login и /register):
 * sendLoginOtp/sendRegisterOtp/mergeGuestCartOnAuth замоканы алиасами
 * (.storybook/mocks/auth-actions), authClient — алиас-моком (.storybook/mocks/
 * auth-client, verify — всегда успех). Шаг «SMS-код» — внутренняя степ-машина,
 * НЕ сторифицируем (Q5 слайса 3; живой путь покрыт e2e P1-auth).
 */
const meta = {
	title: 'Auth/AuthPhoneWizard',
	component: AuthPhoneWizard,
	args: { redirectTo: '/orders' },
} satisfies Meta<typeof AuthPhoneWizard>
export default meta
type Story = StoryObj<typeof meta>

/** Вход: кнопка «Войти», ссылка «Зарегистрируйтесь» (гард — телефон существует) */
export const Login: Story = { args: { mode: 'login' } }

/** Регистрация: кнопка «Создать аккаунт», ссылка «Войдите» (гард — телефон свободен) */
export const Register: Story = { args: { mode: 'register' } }
