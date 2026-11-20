import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DeliverySettingsForm } from './delivery-settings-form'

/**
 * Настройки доставки (этап 5, Q13): saveDeliverySettings замокан алиасом
 * (.storybook/mocks/settings-actions — успех). Рубли на входе → копейки
 * (transform схемы); превью-строка живёт на watch — интеракция.
 */
const meta = {
	title: 'Admin/DeliverySettingsForm',
	component: DeliverySettingsForm,
} satisfies Meta<typeof DeliverySettingsForm>
export default meta
type Story = StoryObj<typeof meta>

/** Канон сидера: 199 ₽, бесплатно от 1 000 ₽ */
export const Prefilled: Story = {
	args: { initialFeeRubles: 199, initialThresholdRubles: 1000 },
}
