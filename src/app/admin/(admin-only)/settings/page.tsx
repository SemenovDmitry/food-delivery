import type { Metadata } from 'next'
import { DeliverySettingsForm } from '@/components/admin/delivery-settings-form'
import { requireAdminOnly } from '@/lib/session'
import { getDeliverySettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Настройки доставки' }

export default async function AdminSettingsPage() {
	await requireAdminOnly() // влияет на ценообразование — admin only (Q13)
	const delivery = await getDeliverySettings()

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Настройки доставки</h2>
			<DeliverySettingsForm
				initialFeeRubles={delivery.deliveryFee / 100}
				initialThresholdRubles={delivery.freeDeliveryThreshold / 100}
			/>
		</div>
	)
}
