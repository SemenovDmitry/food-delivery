import { expect, test } from '@playwright/test'

/**
 * P1 смоук (этап 12, тикет 02, Q10): главная / корзина / чекаут гостя /
 * квитанция+трекинг. Каждый тест — свой браузер-контекст (чистые куки),
 * гостевая корзина изолирована кукой cart_id. Прогон серийный (workers: 1).
 */

test('P1-1 главная: «Акции недели», 5 категорий, карточки меню', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Акции недели' })).toBeVisible()
	for (const name of ['Пицца', 'Шаурма', 'Сеты', 'Напитки', 'Десерты']) {
		await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
	}
	await expect(page.getByRole('button', { name: 'В корзину' }).first()).toBeVisible()
})

test('P1-2 корзина: добавить → qty переживает перезагрузку → удалить', async ({ page }) => {
	await page.goto('/')
	const card = page.locator('article').filter({ hasText: 'Маргарита' }).first()
	await card.getByRole('button', { name: 'В корзину' }).click()
	await expect(page.getByText('В корзине 1 товар', { exact: true })).toBeVisible()

	await page.goto('/cart')
	const section = page.getByRole('region', { name: 'Товары в корзине' })
	const line = section.locator('li').filter({ hasText: 'Маргарита' }).first()
	await expect(line).toBeVisible()

	// степпер: +1 → optimistic-цифра 2 (Counter: increaseLabel контекстный)
	await line.getByRole('button', { name: 'Добавить одну «Маргарита»' }).click()
	await expect(line.getByText('2', { exact: true })).toBeVisible()

	// серверная корзина: перезагрузка сохраняет состав (кука cart_id, §5.10)
	await page.reload()
	await expect(
		page
			.getByRole('region', { name: 'Товары в корзине' })
			.locator('li')
			.filter({ hasText: 'Маргарита' }),
	).toBeVisible()
	await expect(page.getByText('В корзине 2 товара', { exact: true })).toBeVisible()

	// удалить → строка исчезла, кнопка оформления дизейблится
	const reloaded = page
		.getByRole('region', { name: 'Товары в корзине' })
		.locator('li')
		.filter({ hasText: 'Маргарита' })
		.first()
	await reloaded.getByRole('button', { name: 'Удалить «Маргарита»' }).click()
	await expect(page.getByRole('region', { name: 'Товары в корзине' }).locator('li')).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Перейти к оформлению' })).toBeDisabled()
})

test('P1-3 чекаут гостя → заказ создан → квитанция и трекинг на месте', async ({ page }) => {
	await page.goto('/')
	const card = page.locator('article').filter({ hasText: 'Маргарита' }).first()
	await card.getByRole('button', { name: 'В корзину' }).click()
	await expect(page.getByText('В корзине 1 товар', { exact: true })).toBeVisible()

	await page.goto('/cart')
	await page.getByRole('link', { name: 'Перейти к оформлению' }).click()
	await expect(page).toHaveURL(/\/checkout/)

	// форма гостя: имя/телефон/адрес; способ оплаты — дефолт «При получении» (Q9)
	await page.getByLabel('Имя').fill('Е2Е Гость')
	await page.getByLabel('Телефон').fill('89991234567')
	await page.getByLabel('Адрес доставки').fill('ул. Тестовая, д. 1')
	await page.getByRole('button', { name: 'Оформить заказ' }).click()

	// createOrder → redirect на трекинг по неугадываемому uuid (id заказа = uuid)
	await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 20_000 })
	await expect(page.getByRole('heading', { name: /Заказ № / })).toBeVisible()
	await expect(page.getByText('Создан', { exact: true })).toBeVisible()
	// Next 16 держит предыдущие деревья маршрутов скрытыми в DOM (Activity-ресторация):
	// getByText матчит скрытые /cart//checkout — role-локаторы скрытые деревья фильтруют
	await expect(page.getByRole('listitem').filter({ hasText: 'Маргарита' })).toBeVisible()

	// корзина очищена после заказа (снапшот в order_items)
	await page.goto('/cart')
	await expect(page.getByRole('region', { name: 'Товары в корзине' }).locator('li')).toHaveCount(0)
})
