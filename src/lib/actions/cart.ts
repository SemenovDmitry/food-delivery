'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { cartItems, products } from '@/db/schema'
import { findCartItem, getOrCreateCart } from '@/lib/cart'
import { MAX_QTY } from '@/lib/constants'
import { isUuid } from '@/lib/id'
import { enforceNotBlocked } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/** Мутация корзины инвалидирует текущий маршрут (§11) */
function invalidateShop() {
	revalidatePath('/')
}

export async function addToCart(
	productId: string,
	qty = 1,
): Promise<ActionResult<{ productId: string; qty: number }>> {
	await enforceNotBlocked() // бан/архив режут мутации (этап 5, Q14); гость проходит
	if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
		return { data: null, error: 'Недопустимое количество' }
	}
	if (!isUuid(productId)) return { data: null, error: 'Товар не найден' }

	const [product] = await db
		.select({ id: products.id })
		.from(products)
		.where(and(eq(products.id, productId), eq(products.isActive, true)))
	// isActive: деактивированный (скрытый из каталога, Q16) не добавляется заново;
	// уже лежащий в корзине — остаётся и заказывается (деактивация корзину не трогает)
	if (!product) return { data: null, error: 'Товар не найден' }

	const cart = await getOrCreateCart()
	const existing = await findCartItem(cart.id, productId)

	if (existing) {
		await db
			.update(cartItems)
			.set({ qty: Math.min(MAX_QTY, existing.qty + qty) })
			.where(eq(cartItems.id, existing.id))
	} else {
		await db.insert(cartItems).values({ cartId: cart.id, productId, qty })
	}

	invalidateShop()
	return { data: { productId, qty }, error: null }
}

export async function setQty(
	productId: string,
	qty: number,
): Promise<ActionResult<{ productId: string; qty: number }>> {
	await enforceNotBlocked()
	if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
		return { data: null, error: 'Недопустимое количество' }
	}
	if (!isUuid(productId)) return { data: null, error: 'Товара нет в корзине' }

	const cart = await getOrCreateCart()
	const existing = await findCartItem(cart.id, productId)
	if (!existing) return { data: null, error: 'Товара нет в корзине' }

	if (qty === 0) {
		await db.delete(cartItems).where(eq(cartItems.id, existing.id))
	} else {
		await db.update(cartItems).set({ qty }).where(eq(cartItems.id, existing.id))
	}

	invalidateShop()
	return { data: { productId, qty }, error: null }
}

export async function removeFromCart(
	productId: string,
): Promise<ActionResult<{ productId: string }>> {
	await enforceNotBlocked()
	if (!isUuid(productId)) return { data: null, error: 'Товара нет в корзине' }

	const cart = await getOrCreateCart()
	const existing = await findCartItem(cart.id, productId)
	if (!existing) return { data: null, error: 'Товара нет в корзине' }

	await db.delete(cartItems).where(eq(cartItems.id, existing.id))
	invalidateShop()
	return { data: { productId }, error: null }
}
