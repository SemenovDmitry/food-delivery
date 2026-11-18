import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CopyLinkButton } from './copy-link-button'

/** «Скопировать ссылку отслеживания» — единственный доступ гостя к заказу */
const meta = {
	title: 'Shop/CopyLinkButton',
	component: CopyLinkButton,
} satisfies Meta<typeof CopyLinkButton>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** С отступом сверху — как в квитанции (className прокидывается) */
export const WithMargin: Story = { args: { className: 'mt-2' } }
