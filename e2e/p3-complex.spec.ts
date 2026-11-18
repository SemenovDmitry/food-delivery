import { expect, type Page, test } from '@playwright/test'
import { DEMO, menuCard, phoneSessionCookies, randomEmail, randomPhone } from './helpers'

/**
 * P3 сложные интеграции (этап 12, тикет 04, Q10): онлайн-оплата loopback,
 * регистрация + привязка email через Mailpit API, чат через реальный WS-шлюз.
 * §5.39: role-локаторы / visibleMain; после мутаций — ждать серверный коммит.
 */

const visibleMain = (page: Page) => page.locator('main:visible')

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
