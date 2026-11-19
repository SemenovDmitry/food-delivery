/**
 * Шов платёжных провайдеров (этап 9, Q6): реальный провайдер = новый файл,
 * реализующий PaymentProvider, + значение PAYMENT_PROVIDER в env — UI и схема
 * не трогаются. GLOSSARY «Мок-провайдер».
 */

/** Браузер pay-страницы подтверждает или отменяет платеж (Q19: обе ветки — webhook) */
export type PaymentAction = 'pay' | 'cancel'

/** Событие webhook'а провайдера — единственный источник смены статуса оплаты. refunded — этап 14 */
export type WebhookEvent = {
	paymentId: string
	status: 'paid' | 'failed' | 'refunded'
}

/** Точка входа initiate: сумма в копейках, заказ уже создан (внешние вызовы вне транзакций) */
export type InitiateInput = {
	orderId: string
	amount: number
}

export type InitiateResult = {
	externalId: string
	/** Куда вести пользователя (мок — страница «сайта провайдера», реальный — хостинг провайдера) */
	redirectUrl: string
}

/**
 * Контракт провайдера:
 * — initiate создаёт платёж у провайдера и возвращает externalId + redirectUrl
 *   (БД приложения не трогает — строку payments вставляет вызывающий action);
 * — verifyWebhook проверяет подпись по СЫРОМУ телу (байты, не перепарсенный
 *   JSON) и возвращает событие; любой прокол (кривая подпись/JSON) → null —
 *   роут отвечает 400;
 * — refund (этап 14, опционально): провайдер, не умеющий возвраты, не
 *   реализует метод — ядро отвечает ошибкой. Настоящий провайдер подтверждает
 *   возврат webhook'ом refunded (мок — синхронный мгновенный).
 */
export interface PaymentProvider {
	initiate(input: InitiateInput): Promise<InitiateResult>
	verifyWebhook(headers: Headers, rawBody: string): Promise<WebhookEvent | null>
	refund?(input: { externalId: string; amount: number }): Promise<{ refundId: string }>
}
