'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { setPaymentMethodActive } from '@/lib/actions/payments'

type ProviderRow = { code: string; label: string; isActive: boolean }

/**
 * Тумблеры провайдеров оплаты (этап 9, Q14): Switch по position-порядку,
 * оптимистика через useOptimistic (паттерн order-status-cell), toast-откат.
 * Выключение ПОСЛЕДНЕГО активного — не блок, но предупреждение (Q20: чекаут
 * мягко остаётся без «Онлайн-оплаты»).
 */
export function PaymentMethodsForm({ providers }: { providers: ProviderRow[] }) {
	const [isPending, startTransition] = useTransition()
	const [optimisticProviders, applyToggle] = useOptimistic(
		providers,
		(current, toggled: { code: string; isActive: boolean }) =>
			current.map((p) => (p.code === toggled.code ? { ...p, isActive: toggled.isActive } : p)),
	)

	function toggle(code: string, next: boolean) {
		startTransition(async () => {
			const activeCount = optimisticProviders.filter((p) => p.isActive).length
			if (!next && activeCount === 1) {
				toast.warning('Онлайн-оплата станет недоступна покупателям')
			}
			applyToggle({ code, isActive: next })
			const result = await setPaymentMethodActive(code, next)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success(next ? 'Способ оплаты включён' : 'Способ оплаты выключен')
		})
	}

	return (
		<ul className='max-w-lg divide-y rounded-lg border bg-card'>
			{optimisticProviders.map((provider) => (
				<li key={provider.code} className='flex items-center justify-between gap-4 p-4'>
					<div className='min-w-0'>
						<p className='text-sm font-medium'>{provider.label}</p>
						<p className='text-xs text-muted-foreground'>
							{provider.isActive ? 'Доступен в чекауте' : 'Выключен'}
						</p>
					</div>
					<Switch
						checked={provider.isActive}
						disabled={isPending}
						onCheckedChange={(checked) => toggle(provider.code, checked)}
						aria-label={`Онлайн-провайдер ${provider.label}`}
					/>
				</li>
			))}
		</ul>
	)
}
