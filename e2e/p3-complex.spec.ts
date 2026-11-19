import { expect, type Page, test } from '@playwright/test'
import { DEMO, menuCard, phoneSessionCookies, randomEmail, randomPhone } from './helpers'

/**
 * P3 сложные интеграции (этап 12, тикет 04, Q10): онлайн-оплата loopback,
 * регистрация + привязка email через Mailpit API, чат через реальный WS-шлюз.
 * §5.39: role-локаторы / visibleMain; после мутаций — ждать серверный коммит.
 */

const visibleMain = (page: Page) => page.locator('main:visible')

/** Онлайн-заказ с оплатой до «Оплачено» (P3-1-паттерн) → uuid заказа */
async function payOnline(page: Page): Promise<string> {
	await page.goto('/')
	await menuCard(page, 'Маргарита').getByRole('button', { name: 'В корзину' }).click()
	await expect(page.getByText('В корзине 1 товар', { exact: true })).toBeVisible()

	await page.goto('/cart')
	await page.getByRole('link', { name: 'Перейти к оформлению' }).click()
	await expect(page).toHaveURL(/\/checkout/)
	await page.getByLabel('Онлайн-оплата').check()
	await page.getByLabel('Имя').fill('Е2Е Гость')
	await page.getByLabel('Телефон').fill('89991234567')
	await page.getByLabel('Адрес доставки').fill('ул. Тестовая, д. 1')
	await page.getByRole('button', { name: 'Оформить заказ' }).click()

	await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}\/pay/, { timeout: 20_000 })
	await page.getByLabel('Сбербанк').check()
	await page.getByRole('button', { name: 'Продолжить' }).click()
	await expect(page.getByText('Оплата через Сбербанк')).toBeVisible()
	await page.getByRole('button', { name: 'Оплатить', exact: true }).click()
	await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 20_000 })
	await expect(visibleMain(page).getByText('Оплачено', { exact: true })).toBeVisible({
		timeout: 35_000,
	})
	return page.url().split('/').pop() ?? ''
}

test('P3-1 онлайн-оплата: чекаут → банк → заглушка → «Оплачено» ≤35 с', async ({ page }) => {
	await page.goto('/')
	await menuCard(page, 'Маргарита').getByRole('button', { name: 'В корзину' }).click()
	await expect(page.getByText('В корзине 1 товар', { exact: true })).toBeVisible()

	await page.goto('/cart')
	await page.getByRole('link', { name: 'Перейти к оформлению' }).click()
	await expect(page).toHaveURL(/\/checkout/)

	// способ оплаты: онлайн (Сбербанк активен из сидера)
	await page.getByLabel('Онлайн-оплата').check()
	await page.getByLabel('Имя').fill('Е2Е Гость')
	await page.getByLabel('Телефон').fill('89991234567')
	await page.getByLabel('Адрес доставки').fill('ул. Тестовая, д. 1')
	await page.getByRole('button', { name: 'Оформить заказ' }).click()

	// createOrder → initiate → redirect на pay-страницу провайдера (route group без шапки)
	await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}\/pay/, { timeout: 20_000 })
	await expect(page.getByRole('heading', { name: /Оплата заказа № / })).toBeVisible()

	// шаг 1 — банк; шаг 2 — заглушка банка; «Оплатить» → confirm → loopback-webhook (HMAC)
	await page.getByLabel('Сбербанк').check()
	await page.getByRole('button', { name: 'Продолжить' }).click()
	await expect(page.getByText('Оплата через Сбербанк')).toBeVisible()
	await page.getByRole('button', { name: 'Оплатить', exact: true }).click()

	// redirect на трекинг → платёжный чип доезжает поллингом 25 с (Q5: таймаут 35 с)
	await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 20_000 })
	await expect(visibleMain(page).getByText('Оплачено', { exact: true })).toBeVisible({
		timeout: 35_000,
	})
})

test('P3-2 регистрация нового телефона + привязка email (код из Mailpit API)', async ({ page }) => {
	const phone = randomPhone()
	const email = randomEmail()

	await page.goto('/register')
	await page.getByLabel('Телефон').fill(phone)
	await page.getByRole('button', { name: 'Создать аккаунт' }).click()
	await expect(page.getByRole('status')).toContainText(phone)
	await page.getByLabel('Код из SMS').fill(DEMO.smsCode)
	await page.getByRole('button', { name: 'Подтвердить' }).click()
	await expect(page).toHaveURL(/\/orders/)

	// привязка email (возобновляемый поток /email): linkEmail → письмо в Mailpit
	await page.goto('/email')
	await page.getByLabel('Email').fill(email)
	await page.getByRole('button', { name: 'Привязать email' }).click()
	await expect(page.getByRole('status')).toContainText(email)

	// случайный 6-значный код достаём из Mailpit (:8025) — 1111 тут не по адресу
	const mailResponse = await fetch('http://localhost:8025/api/v1/messages')
	const mailList = (await mailResponse.json()) as {
		messages: { ID: string; To: { Address: string }[] }[]
	}
	const sent = mailList.messages.find((m) => m.To.some((to) => to.Address === email))
	if (!sent) throw new Error('письмо верификации не найдено в Mailpit')

	const mailText = await fetch(`http://localhost:8025/api/v1/message/${sent.ID}`)
	const mailBody = (await mailText.json()) as { Text?: string; Snippet?: string }
	const code = (mailBody.Text ?? mailBody.Snippet ?? '').match(/\b\d{6}\b/)?.[0]
	if (!code) throw new Error('6-значный код не найден в письме')

	await page.getByLabel('Код из письма').fill(code)
	await page.getByRole('button', { name: 'Подтвердить' }).click()
	await expect(page).toHaveURL(/\/orders/)
})

test('P3-3 чат гость↔оператор через реальный WS-шлюз (:3001)', async ({ browser }) => {
	// клиент (сессия → тред привязан к userId, таб с телефоном) — тред ещё не
	// создан: консоль оператора показывает пустое состояние до первого сообщения
	const clientCtx = await browser.newContext({
		storageState: { cookies: await phoneSessionCookies(DEMO.client), origins: [] },
	})
	const clientPage = await clientCtx.newPage()
	await clientPage.goto('/')
	await clientPage.getByRole('button', { name: /Открыть чат поддержки/ }).click()
	const chatLog = clientPage.getByRole('log', { name: 'Лента сообщений чата' })

	const guestText = `Привет, это e2e — ${Date.now()}`
	const input = clientPage.getByLabel('Сообщение оператору')
	await expect(input).toBeEnabled({ timeout: 10_000 }) // WS-коннект шлюза
	await input.fill(guestText)
	await clientPage.getByRole('button', { name: 'Отправить сообщение' }).click()
	await expect(chatLog.getByText(guestText)).toBeVisible({ timeout: 10_000 })

	// операторская: таб демо-клиента появился (тред создан первым сообщением);
	// в имени таба «+» — квантор regex, матчу по уникальным цифрам демо-клиента
	const adminCtx = await browser.newContext({
		storageState: { cookies: await phoneSessionCookies(DEMO.admin), origins: [] },
	})
	const adminPage = await adminCtx.newPage()
	await adminPage.goto('/admin/chats')
	const tab = adminPage.getByRole('tab', { name: /999 000-00-03/ })
	await expect(tab).toBeVisible({ timeout: 15_000 })
	await tab.click()
	// лента в консоли — сам tabpanel (aria-label треда), role="log" только в виджете
	const threadLog = adminPage.getByRole('tabpanel')
	await expect(threadLog.getByText(guestText)).toBeVisible({ timeout: 10_000 })

	const replyText = `Ответ оператора — ${Date.now()}`
	await adminPage.getByLabel('Ответ клиенту').fill(replyText)
	await adminPage.getByRole('button', { name: 'Отправить ответ' }).click()

	// WS-фанаут: ответ виден гостю без перезагрузки (≤5 c по спеке, даём 10 с)
	await expect(chatLog.getByText(replyText)).toBeVisible({ timeout: 10_000 })

	await clientCtx.close()
	await adminCtx.close()
})

test('P3-4 refund: клиент отменяет оплаченный онлайн-заказ', async ({ page }) => {
	const orderId = await payOnline(page)

	// отмена оплаченного: Dialog с обещанием возврата (этап 14)
	await page.getByRole('button', { name: 'Отменить заказ' }).click()
	await expect(page.getByRole('alertdialog')).toBeVisible()
	await expect(page.getByRole('alertdialog')).toContainText('Средства вернутся на счёт')
	await page.getByRole('button', { name: 'Да, отменить' }).click()

	// живой setState: баннер с обещанием возврата (мок-возврат мгновенный, но
	// поллинг замолкает на терминальном — refunded доезжает RSC-снапшотом, спека #8)
	await expect(visibleMain(page).getByText('— средства вернутся на счёт')).toBeVisible()
	await expect(visibleMain(page).getByText('Отменён клиентом', { exact: true })).toBeVisible()

	// перезаход: RSC-снапшот refunded → баннер «возврат выполнен» + чип «Возвращено»
	await page.reload()
	await expect(visibleMain(page).getByText('— возврат выполнен')).toBeVisible()
	await expect(visibleMain(page).getByText('Возвращено', { exact: true })).toBeVisible()
	expect(orderId).toMatch(/[0-9a-f-]{36}/)
})

test('P3-5 refund: админ отклоняет оплаченный онлайн-заказ', async ({ browser }) => {
	const guestCtx = await browser.newContext()
	const guestPage = await guestCtx.newPage()
	const orderId = await payOnline(guestPage)
	const shortId = orderId.slice(0, 8)

	const adminCtx = await browser.newContext({
		storageState: { cookies: await phoneSessionCookies(DEMO.admin), origins: [] },
	})
	const adminPage = await adminCtx.newPage()
	await adminPage.goto('/admin/orders')
	const row = adminPage.locator('tr').filter({ hasText: `№ ${shortId}` })
	await expect(row).toBeVisible()

	// refund-ветка ядра: гвард «Оплаченный заказ отменить нельзя» пропускает
	// оплаченный онлайн (этап 14), возврат выполняется автоматически
	const trigger = row.getByLabel(`Сменить статус заказа № ${shortId}`)
	await trigger.click()
	await adminPage.getByRole('option', { name: 'Отменён заведением (не принят)' }).click()
	await expect(row).toContainText('Отменён заведением')

	await guestPage.goto(`/orders/${orderId}`)
	await expect(visibleMain(guestPage).getByText('— возврат выполнен')).toBeVisible()
	await expect(visibleMain(guestPage).getByText('Возвращено', { exact: true })).toBeVisible()

	await guestCtx.close()
	await adminCtx.close()
})
