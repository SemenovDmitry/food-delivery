import { expect, type Page, test } from '@playwright/test'
import { createGuestOrder, DEMO, menuCard, phoneSessionCookies } from './helpers'

/**
 * P2 ядро регрессии (этап 12, тикет 03, Q10): вход OTP, админ-статус → живой
 * трекинг, скоуп-скидка SHAWARMA20, скрытый SECRET15, отмена клиентом.
 * §5.39: текстовые ассерты — role-локаторы или скоуп к видимому main
 * (Next 16 держит скрытые деревья прошлых маршрутов в DOM).
 */

/** Видимый main текущего маршрута — отсекает скрытые Activity-деревья */
const visibleMain = (page: Page) => page.locator('main:visible')

test('P2-1 вход демо-клиента через UI — OTP 1111, нормализация 8→+7', async ({ page }) => {
	await page.goto('/login')
	await page.getByLabel('Телефон').fill('89990000003')
	await page.getByRole('button', { name: 'Войти' }).click()

	// шаг 2: схема нормализовала 8-форму в канон (+7 999 000-00-03, lib/phone)
	await expect(page.getByRole('status')).toContainText('+7 999 000-00-03')
	await page.getByLabel('Код из SMS').fill(DEMO.smsCode)
	await page.getByRole('button', { name: 'Подтвердить' }).click()

	await expect(page).toHaveURL(/\/orders/)
	await expect(page.getByRole('button', { name: 'Профиль' })).toBeVisible()
})

test('P2-2 админ меняет статус → трекинг клиента обновляется живьём ≤35 с', async ({ browser }) => {
	// гость оформляет заказ и остаётся на трекинге
	const guestCtx = await browser.newContext()
	const guestPage = await guestCtx.newPage()
	const orderId = await createGuestOrder(guestPage)
	const shortId = orderId.slice(0, 8)

	// маркер «без перезагрузки»: переживает только клиентский поллинг (§5.37-стайл)
	await guestPage.evaluate(() => {
		;(window as unknown as { __e2eMarker?: string }).__e2eMarker = 'alive'
	})

	// админ в отдельном контексте (API-логин) меняет статус created → preparing
	const adminCtx = await browser.newContext({
		storageState: { cookies: await phoneSessionCookies(DEMO.admin), origins: [] },
	})
	const adminPage = await adminCtx.newPage()
	await adminPage.goto('/admin/orders')
	const row = adminPage.locator('tr').filter({ hasText: `№ ${shortId}` })
	await expect(row).toBeVisible()

	const trigger = row.getByLabel(`Сменить статус заказа № ${shortId}`)
	await trigger.click()
	await adminPage.getByRole('option', { name: 'Готовится' }).click()

	// трекинг гостя: бейдж сменился поллингом 25 с (Q5 — таймаут 35 с, прод-код не трогаем)
	await expect(guestPage.getByText('Готовится', { exact: true }).first()).toBeVisible({
		timeout: 35_000,
	})

	// перезагрузки не было — маркер жив
	const marker = await guestPage.evaluate(
		() => (window as unknown as { __e2eMarker?: string }).__e2eMarker,
	)
	expect(marker).toBe('alive')

	await guestCtx.close()
	await adminCtx.close()
})

test('P2-3 SHAWARMA20 — скоуп-скидка только от шаурмы, суммы на квитанции', async ({ page }) => {
	await page.goto('/')
	await menuCard(page, 'Маргарита').getByRole('button', { name: 'В корзину' }).click()
	await menuCard(page, 'Классическая').getByRole('button', { name: 'В корзину' }).click()
	await expect(page.getByText('В корзине 2 товара', { exact: true })).toBeVisible()

	await page.goto('/cart')
	// ×2 Классическая (340 ₽ ×2 = 680 ₽): optimistic-степпер
	const shawarmaLine = page
		.getByRole('region', { name: 'Товары в корзине' })
		.locator('li')
		.filter({ hasText: 'Классическая' })
	await shawarmaLine.getByRole('button', { name: 'Добавить одну «Классическая»' }).click()
	await expect(shawarmaLine.getByText('2', { exact: true })).toBeVisible()
	// дождаться СЕРВЕРНОГО коммита setQty (Σqty = 3 в бейдже): промо считается по
	// БД-корзине — применение до коммита посчитало бы скидку по qty=1
	await expect(page.getByText('В корзине 3 товара', { exact: true })).toBeVisible()

	// применить SHAWARMA20 кнопкой из блока акций (карточка показывает имя, не код)
	const promoCard = page.getByRole('listitem').filter({ hasText: '−20% на всю шаурму' })
	await promoCard.getByRole('button', { name: 'Применить' }).click()

	// скоуп-расчёт (calcDiscount, та же формула что и сервер): −20% от 680 ₽ = 136 ₽
	// (прецедент приёмки этапа 1 — «2×Классическая → −136 ₽»), не от полной
	// корзины 1270 ₽; доставка бесплатная (1270 ≥ 1000);
	// строка тоталов — «Скидка (имя промо)», не код
	const cartTotals = visibleMain(page)
	await expect(cartTotals.getByText('Скидка (−20% на всю шаурму)')).toBeVisible()
	// exact — в карточке промо есть плашка «скидка −136 ₽» (та же подстрока)
	await expect(cartTotals.getByText('−136 ₽', { exact: true })).toBeVisible()

	// квитанция: снапшот createOrder = calcDiscount по построению
	await page.getByRole('link', { name: 'Перейти к оформлению' }).click()
	await expect(page).toHaveURL(/\/checkout/)
	await page.getByLabel('Имя').fill('Е2Е Гость')
	await page.getByLabel('Телефон').fill('89991234567')
	await page.getByLabel('Адрес доставки').fill('ул. Тестовая, д. 1')
	await page.getByRole('button', { name: 'Оформить заказ' }).click()
	await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 20_000 })

	const receipt = visibleMain(page)
	await expect(receipt.getByText('Скидка (−20% на всю шаурму)')).toBeVisible()
	await expect(receipt.getByText('−136 ₽', { exact: true })).toBeVisible()
	await expect(receipt.getByText('1\u00A0134 ₽')).toBeVisible() // Итого: 1270 − 136
})

test('P2-4 SECRET15 — скрыт от витрины и API, применяется вводом кода', async ({
	page,
	request,
}) => {
	// API публичных акций: скрытого кода и его имени нет
	const apiResponse = await request.get('/api/promotions')
	expect(apiResponse.ok()).toBeTruthy()
	const apiBody = await apiResponse.text()
	expect(apiBody).not.toContain('SECRET15')
	// имя сидера — «−15% на весь заказ» (типографский минус U+2212)
	expect(apiBody).not.toContain('15% на весь заказ')

	// витрина /promo — нет; блок акций /cart — нет (только 3 публичные)
	await page.goto('/promo')
	await expect(page.getByText('SECRET15')).toHaveCount(0)

	await page.goto('/')
	await menuCard(page, 'Маргарита').getByRole('button', { name: 'В корзину' }).click()
	// дождаться server action — иначе goto('/cart') гоняется с созданием корзины
	await expect(page.getByText('В корзине 1 товар', { exact: true })).toBeVisible()
	await page.goto('/cart')
	await expect(page.getByText('SECRET15')).toHaveCount(0)

	// ввод кода — единственный путь применения (GLOSSARY «Скрытый промокод»)
	await page.getByLabel('Промокод').fill('SECRET15')
	await page.getByRole('button', { name: 'ОК' }).click()

	// плашка кастомного промо (нет в списке) + скидка 15%: 590 ₽ → floor(88.5) = 88,50 ₽;
	// exact — плашка «Скидка: −88,50 ₽» и dd тоталов матчатся одной подстрокой
	await expect(visibleMain(page).getByText('(SECRET15)')).toBeVisible()
	await expect(visibleMain(page).getByText('−88,50 ₽', { exact: true })).toBeVisible()
})

test('P2-5 отмена клиентом — alertdialog → баннер вместо таймлайна', async ({ page }) => {
	const orderId = await createGuestOrder(page)
	const shortId = orderId.slice(0, 8)

	await page.getByRole('button', { name: 'Отменить заказ' }).click()

	// Dialog с ролью alertdialog (этап 4): заголовок + destructive-подтверждение
	await expect(page.getByRole('alertdialog')).toBeVisible()
	await expect(page.getByRole('alertdialog').getByText(`Заказ № ${shortId}`)).toBeVisible()
	await page.getByRole('button', { name: 'Да, отменить' }).click()

	// мгновенный setState: баннер ВМЕСТО таймлайна (4-бис) + бейдж статуса;
	// exact — рядом sr-only live-регион «Текущий статус: …»
	await expect(visibleMain(page).getByText('Вы отменили этот заказ')).toBeVisible()
	await expect(visibleMain(page).getByText('Отменён клиентом', { exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Отменить заказ' })).toHaveCount(0)
})
