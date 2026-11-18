import type { Promotion } from '@/db/schema'
import type { MenuProduct } from '@/queries/menu'

/**
 * Мок-фикстуры сторей (этап 13, тикет 02) — сериализуемые данные без
 * server-цепочек: type-only импорты вычищаются при сборке, рантайм-модуль
 * безопасен для браузера (в отличие от '@/lib/actions/*', которые в
 * Storybook замещают Vite-алиасы на .storybook/mocks/*).
 */

export const margherita: MenuProduct = {
	id: '11111111-1111-1111-1111-111111111111',
	categoryId: 1,
	name: 'Маргарита',
	description: 'Классика на томатном соусе',
	price: 59000,
	type: 'single',
	emoji: '🍕',
	imageUrl: null,
	imageSrc: null,
	isActive: true,
	position: 1,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
	setComponents: [],
	setOldPrice: null,
}

export const shawarmaForTwo: MenuProduct = {
	id: '22222222-2222-2222-2222-222222222222',
	categoryId: 3,
	name: 'Шаурма для двоих',
	description: 'Сет из двух шаурм и напитка',
	price: 69000,
	type: 'set',
	emoji: '🌯',
	imageUrl: null,
	imageSrc: null,
	isActive: true,
	position: 1,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
	setComponents: [
		{
			productId: '33333333-3333-3333-3333-333333333331',
			name: 'Классическая',
			price: 34000,
			emoji: '🌯',
			qty: 2,
		},
		{
			productId: '33333333-3333-3333-3333-333333333332',
			name: 'Кола 0.5',
			price: 15000,
			emoji: '🥤',
			qty: 1,
		},
	],
	// 34000 × 2 + 15000 = 83000 — зачёркнутая старая цена против 69000
	setOldPrice: 83000,
}

export const promoShawarma: Promotion = {
	id: 'aaaaaaaa-0000-0000-0000-000000000001',
	name: '−20% на всю шаурму',
	code: 'SHAWARMA20',
	discountType: 'percent',
	discountValue: 20,
	categoryId: 2,
	minTotal: 0,
	startsAt: null,
	endsAt: new Date('2026-12-31T23:59:00Z'),
	isActive: true,
	isPublic: true,
	createdAt: new Date('2026-01-01T00:00:00Z'),
}

export const promoNoCode: Promotion = {
	id: 'aaaaaaaa-0000-0000-0000-000000000002',
	name: 'Счастливые часы',
	code: null,
	discountType: 'fixed',
	discountValue: 15000,
	categoryId: null,
	minTotal: 0,
	startsAt: null,
	endsAt: new Date('2026-12-31T23:59:00Z'),
	isActive: true,
	isPublic: true,
	createdAt: new Date('2026-01-01T00:00:00Z'),
}

export const promoUnlimited: Promotion = {
	id: 'aaaaaaaa-0000-0000-0000-000000000003',
	name: 'Бессрочная скидка',
	code: 'ALWAYS5',
	discountType: 'percent',
	discountValue: 5,
	categoryId: null,
	minTotal: 0,
	startsAt: null,
	endsAt: null,
	isActive: true,
	isPublic: true,
	createdAt: new Date('2026-01-01T00:00:00Z'),
}

/** Категории сидера (§4) — для menu-nav */
export const menuCategories = [
	{ slug: 'pizza', name: 'Пицца' },
	{ slug: 'shawarma', name: 'Шаурма' },
	{ slug: 'sets', name: 'Сеты' },
	{ slug: 'drinks', name: 'Напитки' },
	{ slug: 'desserts', name: 'Десерты' },
]
