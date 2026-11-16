'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveDeliverySettings } from '@/lib/actions/settings'
import { formatPrice } from '@/lib/format'
import {
	type DeliverySettingsFormInput,
	type DeliverySettingsFormValues,
	deliverySettingsSchema,
} from '@/lib/schemas/settings'

/**
 * Форма «Настройки доставки» (этап 5, Q13): рубли на входе → копейки в
 * settings (transform схемы). Живое превью подсказки бесплатной доставки.
 */
export function DeliverySettingsForm({
	initialFeeRubles,
	initialThresholdRubles,
}: {
	initialFeeRubles: number
	initialThresholdRubles: number
}) {
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<DeliverySettingsFormInput, unknown, DeliverySettingsFormValues>({
		resolver: zodResolver(deliverySettingsSchema),
		mode: 'onTouched',
		defaultValues: {
			deliveryFeeRubles: initialFeeRubles,
			freeDeliveryThresholdRubles: initialThresholdRubles,
		},
	})

	const fee = Number(watch('deliveryFeeRubles'))
	const threshold = Number(watch('freeDeliveryThresholdRubles'))

	function onSubmit(values: DeliverySettingsFormValues) {
		startTransition(async () => {
			const result = await saveDeliverySettings(values)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success('Настройки доставки сохранены')
			router.refresh()
		})
	}

	return (
		<Card>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className='space-y-5' noValidate>
					<div className='grid max-w-lg gap-5 sm:grid-cols-2'>
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='settings-fee'>Стоимость доставки, ₽</Label>
							<Input
								id='settings-fee'
								type='number'
								step='0.01'
								min='0'
								inputMode='decimal'
								aria-invalid={errors.deliveryFeeRubles ? true : undefined}
								aria-describedby={errors.deliveryFeeRubles ? 'settings-fee-error' : undefined}
								{...register('deliveryFeeRubles')}
							/>
							{errors.deliveryFeeRubles && (
								<p id='settings-fee-error' className='text-sm text-destructive'>
									{errors.deliveryFeeRubles.message}
								</p>
							)}
						</div>
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='settings-threshold'>Бесплатная доставка от, ₽</Label>
							<Input
								id='settings-threshold'
								type='number'
								step='0.01'
								min='0'
								inputMode='decimal'
								aria-invalid={errors.freeDeliveryThresholdRubles ? true : undefined}
								aria-describedby={
									errors.freeDeliveryThresholdRubles ? 'settings-threshold-error' : undefined
								}
								{...register('freeDeliveryThresholdRubles')}
							/>
							{errors.freeDeliveryThresholdRubles && (
								<p id='settings-threshold-error' className='text-sm text-destructive'>
									{errors.freeDeliveryThresholdRubles.message}
								</p>
							)}
						</div>
					</div>
					<p className='text-sm text-muted-foreground'>
						Превью: доставка{' '}
						<span className='font-medium text-foreground tabular-nums'>
							{formatPrice(Math.round((Number.isFinite(fee) ? fee : 0) * 100))}
						</span>
						{Number.isFinite(threshold) && threshold > 0 && (
							<>
								{' '}
								· бесплатно от{' '}
								<span className='font-medium text-foreground tabular-nums'>
									{formatPrice(Math.round(threshold * 100))}
								</span>
							</>
						)}{' '}
						(порог — от суммы товаров до скидки; самовывоз всегда бесплатный)
					</p>
					<Button type='submit' disabled={isPending}>
						Сохранить
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
