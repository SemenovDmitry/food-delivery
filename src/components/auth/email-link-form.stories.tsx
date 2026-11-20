import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { EmailLinkForm } from './email-link-form'

/**
 * Привязка email (этап 3, Q1/Q5): linkEmail замокан алиасом
 * (.storybook/mocks/auth-actions), authClient.emailOtp.verifyEmail —
 * алиас-моком (.storybook/mocks/auth-client). Шаг «код из письма» —
 * степ-машина, НЕ сторифицируем (Q5; живой путь — Mailpit, приёмка этапа 3).
 */
const meta = {
	title: 'Auth/EmailLinkForm',
	component: EmailLinkForm,
} satisfies Meta<typeof EmailLinkForm>
export default meta
type Story = StoryObj<typeof meta>

/** Возобновлённый поток: префилл ранее введённого email */
export const Prefilled: Story = { args: { initialEmail: 'client@food.local' } }
