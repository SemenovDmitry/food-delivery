import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
	type FormCategory,
	type FormProduct,
	type FormProductOption,
	ProductForm,
} from './product-form'

/**
 * Форма товара (этап 5, Q16): RHF+zod, состав сета — useFieldArray.
 * Actions createProduct/updateProduct/deleteProduct/uploadProductImage/
 * removeProductImage замоканы алиасами (.storybook/mocks/*, тикет 05).
 * imageSrc=null во всех сторях — next/image remote в iframe не конфигурим;
 * фото-филдсет виден только в edit (спека слайса 3). Диалог удаления —
 * интеракция, inline-валидация/тосты — прод-пути приёмки этапа 5.
 */
const meta = {
	title: 'Admin/ProductForm',
	component: ProductForm,
	args: {
		categories: [
			{ id: 1, name: 'Пицца' },
			{ id: 2, name: 'Шаурма' },
			{ id: 3, name: 'Сеты' },
		] satisfies FormCategory[],
		productOptions: [
			{ id: '11111111-1111-1111-1111-111111111111', name: 'Маргарита' },
			{ id: '44444444-4444-4444-4444-444444444444', name: 'Классическая' },
			{ id: '55555555-5555-5555-5555-555555555555', name: 'Кола 0.5' },
		] satisfies FormProductOption[],
	},
} satisfies Meta<typeof ProductForm>
export default meta
type Story = StoryObj<typeof meta>

/** Создание: пустые дефолты, emoji-заглушка 🍽️, без фото-филдсета и delete */
export const Create: Story = {}

/** Редактирование: префилл Маргариты + delete-кнопка + поле фото («Фото нет») */
export const Edit: Story = {
	args: {
		product: {
			id: '11111111-1111-1111-1111-111111111111',
			name: 'Маргарита',
			description: 'Классика на томатном соусе',
			price: 59000,
			type: 'single',
			emoji: '🍕',
			categoryId: 1,
			isActive: true,
			components: [],
		} satisfies FormProduct,
	},
}

/** Сет-состав: fieldset useFieldArray с 2 позициями (Select товара + Counter qty) */
export const SetComposition: Story = {
	args: {
		product: {
			id: '22222222-2222-2222-2222-222222222222',
			name: 'Шаурма для двоих',
			description: 'Сет из двух шаурм и напитка',
			price: 69000,
			type: 'set',
			emoji: '🌯',
			categoryId: 3,
			isActive: true,
			components: [
				{ productId: '44444444-4444-4444-4444-444444444444', qty: 2 },
				{ productId: '55555555-5555-5555-5555-555555555555', qty: 1 },
			],
		} satisfies FormProduct,
	},
}
