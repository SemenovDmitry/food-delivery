import { asc } from 'drizzle-orm'
import type { Metadata } from 'next'
import { PaymentMethodsForm } from '@/components/admin/payment-methods-form'
import { db } from '@/db'
import { paymentMethods } from '@/db/schema'
import { requireAdminOnly } from '@/lib/session'

export const metadata: Metadata = { title: 'Способы оплаты' }

/**
 * /admin/payments (этап 9, Q14): тумблеры провайдеров-банков. Гард — как у
 * /admin/settings (влияет на чекаут всего магазина — admin only).
 */
export default async function AdminPaymentsPage() {
	await requireAdminOnly()
	const providers = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.position))

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Способы оплаты</h2>
			<p className='text-sm text-muted-foreground'>
				Онлайн-провайдеры, доступные покупателям при выборе «Онлайн-оплата». Выключение последнего
				убирает онлайн-оплату из чекаута; созданные заказы продолжают оплачиваться.
			</p>
			<PaymentMethodsForm
				providers={providers.map((p) => ({
					code: p.code,
					label: p.label,
					isActive: p.isActive,
				}))}
			/>
		</div>
	)
}
