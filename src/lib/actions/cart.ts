'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { cartItems, products } from '@/db/schema'
import { findCartItem, getOrCreateCart } from '@/lib/cart'
import { MAX_QTY } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

/** Мутация корзины инвалидирует текущий маршрут (§11) */
function invalidateShop() {
	revalidatePath('/')
}

export async function addToCart(
	productId: string,
	qty = 1,
): Promise<ActionResult<{ productId: string; qty: number }>> {
	if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
		return { ok: false, error: 'Недопустимое количество' }
	}

	const [product] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.id, productId))
	if (!product) return { ok: false, error: 'Товар не найден' }

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
	return { ok: true, data: { productId, qty } }
}

export async function setQty(
	productId: string,
	qty: number,
): Promise<ActionResult<{ productId: string; qty: number }>> {
	if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
		return { ok: false, error: 'Недопустимое количество' }
	}

	const cart = await getOrCreateCart()
	const existing = await findCartItem(cart.id, productId)
	if (!existing) return { ok: false, error: 'Товара нет в корзине' }

	if (qty === 0) {
		await db.delete(cartItems).where(eq(cartItems.id, existing.id))
	} else {
		await db.update(cartItems).set({ qty }).where(eq(cartItems.id, existing.id))
	}

	invalidateShop()
	return { ok: true, data: { productId, qty } }
}

export async function removeFromCart(
	productId: string,
): Promise<ActionResult<{ productId: string }>> {
	const cart = await getOrCreateCart()
	const existing = await findCartItem(cart.id, productId)
	if (!existing) return { ok: false, error: 'Товара нет в корзине' }

	await db.delete(cartItems).where(eq(cartItems.id, existing.id))
	invalidateShop()
	return { ok: true, data: { productId } }
}
