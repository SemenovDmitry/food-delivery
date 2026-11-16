'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { cartItems, carts, user } from '@/db/schema'
import { auth } from '@/lib/auth'
import { CART_COOKIE, getCartLines } from '@/lib/cart'
import { MAX_QTY } from '@/lib/constants'
import { authPhoneSchema, linkEmailSchema } from '@/lib/schemas/auth'
import { getSession } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/** Мутация корзины инвалидирует текущий маршрут (как в cart-actions) */
function invalidateShop() {
	revalidatePath('/')
}

/**
 * SMS-OTP через better-auth (server-to-server). Проверки существования номера —
 * ВЫШЕ по стеку (§5.15): сам sendOTP шлёт код кому угодно.
 * Ошибки API (в т.ч. rate limit в prod) — текст UI, не 500.
 */
async function sendPhoneOtp(phoneNumber: string): Promise<ActionResult<null>> {
	try {
		await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } })
		return { data: null, error: null }
	} catch {
		return { data: null, error: 'Не удалось отправить SMS. Попробуйте ещё раз' }
	}
}

/** Вход: телефон должен быть зарегистрирован — иначе «зарегистрируйтесь» (§5.15) */
export async function sendLoginOtp(phoneRaw: string): Promise<ActionResult<null>> {
	const parsed = authPhoneSchema.safeParse(phoneRaw)
	if (!parsed.success) {
		return { data: null, error: parsed.error.issues[0]?.message ?? 'Введите корректный телефон' }
	}

	const [found] = await db
		.select({ id: user.id, bannedAt: user.bannedAt, deletedAt: user.deletedAt })
		.from(user)
		.where(eq(user.phoneNumber, parsed.data))
	if (!found) return { data: null, error: 'Номер не зарегистрирован — зарегистрируйтесь' }
	// бан/архив (этап 5, Q14/Q24): SMS не уходит, до better-auth не доходит
	if (found.deletedAt) return { data: null, error: 'Аккаунт удалён' }
	if (found.bannedAt) return { data: null, error: 'Аккаунт заблокирован' }

	return sendPhoneOtp(parsed.data)
}

/** Регистрация: телефон должен быть свободен — занятый уводит на вход */
export async function sendRegisterOtp(phoneRaw: string): Promise<ActionResult<null>> {
	const parsed = authPhoneSchema.safeParse(phoneRaw)
	if (!parsed.success) {
		return { data: null, error: parsed.error.issues[0]?.message ?? 'Введите корректный телефон' }
	}

	const [found] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.phoneNumber, parsed.data))
	if (found) return { data: null, error: 'Этот номер уже зарегистрирован — войдите' }

	return sendPhoneOtp(parsed.data)
}

/**
 * Привязка email (этап 3, Q1/Q5): настоящий email на юзера ДО запроса кода —
 * sendVerificationOtp молча не шлёт письмо для несуществующего email
 * (анти-энумерация). Уникальность — явной ошибкой (changeEmail молчит).
 */
export async function linkEmail(emailRaw: string): Promise<ActionResult<{ email: string }>> {
	const session = await getSession()
	if (!session) return { data: null, error: 'Войдите, чтобы привязать email' }

	const parsed = linkEmailSchema.safeParse(emailRaw)
	if (!parsed.success) {
		return { data: null, error: parsed.error.issues[0]?.message ?? 'Введите корректный email' }
	}
	const email = parsed.data

	if (session.user.emailVerified) return { data: null, error: 'Email уже привязан' }

	// повторная привязка своего же email допустима (возобновление потока — новый код)
	const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
	if (taken && taken.id !== session.user.id) {
		return { data: null, error: 'Этот email уже используется' }
	}

	await db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.id, session.user.id))

	try {
		await auth.api.sendVerificationOTP({ body: { email, type: 'email-verification' } })
	} catch {
		return { data: null, error: 'Не удалось отправить письмо. Попробуйте ещё раз' }
	}
	return { data: { email }, error: null }
}

/**
 * Слияние гостевой корзины с пользовательской при входе (этап 3, Q4).
 * Вызывается клиентом после успешного verify в обоих потоках. Ошибка merge
 * вход не блокирует (возврат null/null — тихий no-op допустим).
 */
export async function mergeGuestCartOnAuth(): Promise<ActionResult<null>> {
	const session = await getSession()
	if (!session) return { data: null, error: null }

	const cookieStore = await cookies()
	const guestCartId = cookieStore.get(CART_COOKIE)?.value
	if (!guestCartId) return { data: null, error: null }

	const [guestCart] = await db.select().from(carts).where(eq(carts.id, guestCartId))
	if (!guestCart) {
		// протухшая cookie — снимаем, корзины нет
		cookieStore.delete(CART_COOKIE)
		return { data: null, error: null }
	}

	const [userCart] = await db.select().from(carts).where(eq(carts.userId, session.user.id))

	if (userCart && userCart.id === guestCart.id) {
		// корзина уже одна (повторный вход) — cookie лишняя
		cookieStore.delete(CART_COOKIE)
		return { data: null, error: null }
	}

	if (!userCart) {
		// у юзера корзины нет — усыновление гостевой
		await db
			.update(carts)
			.set({ userId: session.user.id, updatedAt: new Date() })
			.where(eq(carts.id, guestCart.id))
		cookieStore.delete(CART_COOKIE)
		invalidateShop()
		return { data: null, error: null }
	}

	const guestItems = await getCartLines(guestCart.id)

	// слияние в транзакции (§5.10): qty суммируются с капом, промо юзера иначе гостя
	await db.transaction(async (tx) => {
		for (const line of guestItems) {
			const [existing] = await tx
				.select()
				.from(cartItems)
				.where(and(eq(cartItems.cartId, userCart.id), eq(cartItems.productId, line.product.id)))
			if (existing) {
				await tx
					.update(cartItems)
					.set({ qty: Math.min(MAX_QTY, existing.qty + line.qty) })
					.where(eq(cartItems.id, existing.id))
			} else {
				await tx
					.insert(cartItems)
					.values({ cartId: userCart.id, productId: line.product.id, qty: line.qty })
			}
		}

		const promoId = userCart.promoId ?? guestCart.promoId
		await tx.update(carts).set({ promoId, updatedAt: new Date() }).where(eq(carts.id, userCart.id))

		// гостевая корзина целиком — позиции уйдут по onDelete: cascade
		await tx.delete(carts).where(eq(carts.id, guestCart.id))
	})

	cookieStore.delete(CART_COOKIE)
	invalidateShop()
	return { data: null, error: null }
}
