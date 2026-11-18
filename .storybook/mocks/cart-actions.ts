/**
 * Мок server actions корзины для Storybook (этап 13, тикеты 02–03): настоящий
 * модуль — 'use server' с drizzle/env-цепочкой, в браузере стори-iframe он
 * неподняем; Vite-алиас в main.ts подставляет этот файл. Сигнатуры
 * контролируются typeof — расхождение с прод-модулем ловит tsc.
 */
import type * as CartActions from '@/lib/actions/cart'

/** Успех: тост «Добавлено в корзину» и optimistic-стейт работают как в проде */
export const addToCart: typeof CartActions.addToCart = async () => ({ data: null, error: null })

export const setQty: typeof CartActions.setQty = async () => ({ data: null, error: null })

export const removeFromCart: typeof CartActions.removeFromCart = async () => ({
	data: null,
	error: null,
})
