import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { type FormCategory, type FormPromotion, PromotionForm } from './promotion-form'

/**
 * Форма акции (этап 5, Q9): тип/размер скидки, скоуп, minTotal, окно дат,
 * isActive/isPublic. Actions замоканы алиасами (.storybook/mocks/*, тикет 05).
 * Две стори покрывают обе ветки скидки: percent (создание) и fixed
 * (редактирование скрытого промокода). Диалог удаления — интеракция.
 */
const meta = {
	title: 'Admin/PromotionForm',
	component: PromotionForm,
	args: {
		categories: [
			{ id: 1, name: 'Пицца' },
			{ id: 2, name: 'Шаурма' },
			{ id: 3, name: 'Сеты' },
		] satisfies FormCategory[],
	},
} satisfies Meta<typeof PromotionForm>
export default meta
type Story = StoryObj<typeof meta>

/** Создание: дефолт percent-ветки («Процент»), скоуп «Весь заказ», без окна */
export const Create: Story = {}

/** Редактирование скрытого промокода: fixed-сумма (input ₽ вместо процента),
 * код, скоуп-категория, minTotal (подпись «сейчас: от 1 000 ₽»), окно дат,
 * isPublic=false — «иначе только ввод кода» */
export const EditHiddenFixed: Story = {
	args: {
		promotion: {
			id: 'aaaaaaaa-0000-0000-0000-000000000005',
			name: '−300 ₽ на пиццу от 1 000 ₽',
			code: 'PIZZA300',
			discountType: 'fixed',
			discountValue: 30000,
			categoryId: 1,
			minTotal: 100000,
			startsAt: null,
			endsAt: new Date('2026-12-31T23:59:00Z'),
			isActive: true,
			isPublic: false,
		} satisfies FormPromotion,
	},
}
