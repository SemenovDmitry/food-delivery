import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import type { Cart, Product } from '@/db/schema'
import { cartItems, carts, products } from '@/db/schema'
import { getSession } from '@/lib/session'

export const CART_COOKIE = 'cart_id'
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 дней

export type CartLine = { product: Product; qty: number }

/**
 * Серверная корзина (§5.10): авторизованному — корзина по userId,
 * гостю — httpOnly-cookie `cart_id` (uuid, неугадываемый).
 * Вызывается только из server actions (request scope).
 */
export async function getOrCreateCart(): Promise<Cart> {
	const session = await getSession()
	const cookieStore = await cookies()

	if (session) {
		const [userCart] = await db.select().from(carts).where(eq(carts.userId, session.user.id))
		if (userCart) return userCart
		const [created] = await db.insert(carts).values({ userId: session.user.id }).returning()
		return created
	}

	const existingId = cookieStore.get(CART_COOKIE)?.value
	if (existingId) {
		const [found] = await db.select().from(carts).where(eq(carts.id, existingId))
		if (found) return found
	}

	const [created] = await db.insert(carts).values({}).returning()
	cookieStore.set(CART_COOKIE, created.id, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		maxAge: CART_COOKIE_MAX_AGE,
	})
	return created
}

/** Строки корзины с актуальными данными товаров из БД (клиентским спискам не доверять) */
export async function getCartLines(cartId: string): Promise<CartLine[]> {
	const rows = await db
		.select({ product: products, qty: cartItems.qty })
		.from(cartItems)
		.innerJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.cartId, cartId))
		.orderBy(asc(cartItems.id))
	return rows
}

/** Корзина текущего контекста с составом (для чтений вне actions — этап 1) */
export async function findCartItem(cartId: string, productId: string) {
	const [found] = await db
		.select()
		.from(cartItems)
		.where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
	return found ?? null
}
