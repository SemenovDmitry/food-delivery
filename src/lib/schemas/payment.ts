import { z } from 'zod'

/**
 * Подтверждение платежа с pay-страницы (этап 9, Q1-Б/Q19): POST /api/payments/mock/confirm
 * — «бэкенд провайдера». RHF здесь нет (не форма с transform'ами, §5.31 не касается);
 * сервер парсит схему, клиент повторяет те же поля.
 */
export const paymentConfirmSchema = z.object({
	orderId: z.uuid('Некорректный идентификатор заказа'),
	/** code банка из payment_methods — обязателен для pay, не нужен для cancel */
	providerCode: z.string().trim().max(50).optional(),
	action: z.enum(['pay', 'cancel']),
})

export type PaymentConfirmValues = z.infer<typeof paymentConfirmSchema>
