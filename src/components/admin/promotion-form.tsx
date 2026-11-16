'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createPromotion, deletePromotion, updatePromotion } from '@/lib/actions/promotions'
import { formatPrice } from '@/lib/format'
import {
	type PromotionFormInput,
	type PromotionFormValues,
	promotionFormSchema,
} from '@/lib/schemas/promotion'

export type FormCategory = { id: number; name: string }
export type FormPromotion = {
	id: string
	name: string
	code: string | null
	discountType: 'percent' | 'fixed'
	discountValue: number // percent: 1–99; fixed: копейки
	categoryId: number | null
	minTotal: number // копейки
	startsAt: Date | string | null
	endsAt: Date | string | null
	isActive: boolean
	isPublic: boolean
}

/** Date → значение для <input type='datetime-local'> (локальное время, Q9) */
function toLocalInput(value: Date | string | null): string {
	if (!value) return ''
	const date = new Date(value)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Форма акции (этап 5, Q9): условия из гриллинга этапа 1 — тип/размер скидки,
 * скоуп-категория (null = весь заказ), minTotal, окно дат, isActive, isPublic
 * (переключатель публичности — задел этапа 2). RHF+zod, transform'ы схемы
 * делают рубли→копейки и ''→null.
 */
export function PromotionForm({
	categories,
	promotion,
}: {
	categories: FormCategory[]
	promotion?: FormPromotion | null
}) {
	const router = useRouter()
	const isEdit = promotion != null
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [isPending, startTransition] = useTransition()
	const {
		register,
		handleSubmit,
		watch,
		control,
		formState: { errors },
	} = useForm<PromotionFormInput, unknown, PromotionFormValues>({
		resolver: zodResolver(promotionFormSchema),
		mode: 'onTouched',
		defaultValues: {
			name: promotion?.name ?? '',
			code: promotion?.code ?? '',
			discountType: promotion?.discountType ?? 'percent',
			discountPercent:
				promotion && promotion.discountType === 'percent' ? promotion.discountValue : undefined,
			discountRubles:
				promotion && promotion.discountType === 'fixed' ? promotion.discountValue / 100 : undefined,
			categoryId: promotion?.categoryId ?? undefined,
			minTotalRubles: promotion ? promotion.minTotal / 100 : 0,
			startsAt: toLocalInput(promotion?.startsAt ?? null),
			endsAt: toLocalInput(promotion?.endsAt ?? null),
			isActive: promotion?.isActive ?? true,
			isPublic: promotion?.isPublic ?? true,
		},
	})
	const discountType = watch('discountType')
	const minTotal = Number(watch('minTotalRubles')) || 0

	function onSubmit(values: PromotionFormValues) {
		if (!isEdit) {
			startTransition(async () => {
				const result = await createPromotion(values)
				if (result.data === null) {
					toast.error(result.error)
					return
				}
				toast.success('Акция создана')
				router.push('/admin/promotions')
			})
			return
		}
		const id = promotion.id
		startTransition(async () => {
			const result = await updatePromotion(id, values)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success('Акция сохранена')
			router.push('/admin/promotions')
		})
	}

	function onDelete() {
		if (!isEdit) return
		const id = promotion.id
		startTransition(async () => {
			const result = await deletePromotion(id)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success('Акция удалена (старые заказы сохранят сумму скидки)')
			router.push('/admin/promotions')
		})
	}

	return (
		<>
			<Card>
				<CardContent>
					<form onSubmit={handleSubmit(onSubmit)} className='space-y-5' noValidate>
						<div className='grid gap-5 sm:grid-cols-2'>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='promo-name'>Название</Label>
								<Input
									id='promo-name'
									placeholder='−20% на всю шаурму'
									aria-invalid={errors.name ? true : undefined}
									{...register('name')}
								/>
								<FieldError message={errors.name?.message} />
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='promo-code'>Промокод (пусто — акция без кода)</Label>
								<Input
									id='promo-code'
									placeholder='SHAWARMA20'
									className='font-mono'
									aria-invalid={errors.code ? true : undefined}
									{...register('code')}
								/>
								<FieldError message={errors.code?.message} />
							</div>
							<Controller
								control={control}
								name='discountType'
								render={({ field }) => (
									<div className='flex flex-col gap-1.5'>
										<Label htmlFor='promo-discount-type'>Тип скидки</Label>
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id='promo-discount-type'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='percent'>Процент</SelectItem>
												<SelectItem value='fixed'>Фиксированная сумма</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							/>
							{discountType === 'percent' ? (
								<div className='flex flex-col gap-1.5'>
									<Label htmlFor='promo-discount-percent'>Процент скидки (1–99)</Label>
									<Input
										id='promo-discount-percent'
										type='number'
										min='1'
										max='99'
										aria-invalid={errors.discountPercent ? true : undefined}
										{...register('discountPercent')}
									/>
									<FieldError message={errors.discountPercent?.message} />
								</div>
							) : (
								<div className='flex flex-col gap-1.5'>
									<Label htmlFor='promo-discount-rubles'>Сумма скидки, ₽</Label>
									<Input
										id='promo-discount-rubles'
										type='number'
										step='0.01'
										min='0.01'
										aria-invalid={errors.discountRubles ? true : undefined}
										{...register('discountRubles')}
									/>
									<FieldError message={errors.discountRubles?.message} />
								</div>
							)}
							<Controller
								control={control}
								name='categoryId'
								render={({ field }) => (
									<div className='flex flex-col gap-1.5'>
										<Label htmlFor='promo-category'>Скоуп скидки</Label>
										<Select
											value={field.value ? String(field.value) : 'all'}
											onValueChange={(v) => field.onChange(v === 'all' ? undefined : Number(v))}
										>
											<SelectTrigger id='promo-category'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='all'>Весь заказ</SelectItem>
												{categories.map((category) => (
													<SelectItem key={category.id} value={String(category.id)}>
														{category.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							/>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='promo-min-total'>Минимальная сумма корзины, ₽</Label>
								<Input
									id='promo-min-total'
									type='number'
									step='0.01'
									min='0'
									aria-invalid={errors.minTotalRubles ? true : undefined}
									{...register('minTotalRubles')}
								/>
								<p className='text-xs text-muted-foreground'>
									Условие сравнивается с полной суммой товаров (до скидки); 0 — без условия
									{minTotal > 0 && ` · сейчас: от ${formatPrice(Math.round(minTotal * 100))}`}
								</p>
								<FieldError message={errors.minTotalRubles?.message} />
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='promo-starts'>Начало окна (пусто — без окна)</Label>
								<Input id='promo-starts' type='datetime-local' {...register('startsAt')} />
								<FieldError message={errors.startsAt?.message} />
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='promo-ends'>Конец окна</Label>
								<Input id='promo-ends' type='datetime-local' {...register('endsAt')} />
								<FieldError message={errors.endsAt?.message} />
							</div>
							<Controller
								control={control}
								name='isActive'
								render={({ field }) => (
									<div className='flex items-center gap-3 pt-6'>
										<Switch
											id='promo-active'
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										<Label htmlFor='promo-active' className='text-sm font-normal'>
											Активна
										</Label>
									</div>
								)}
							/>
							<Controller
								control={control}
								name='isPublic'
								render={({ field }) => (
									<div className='flex items-center gap-3 pt-6'>
										<Switch
											id='promo-public'
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										<Label htmlFor='promo-public' className='text-sm font-normal'>
											Публичная (в лентах; иначе только ввод кода — GLOSSARY)
										</Label>
									</div>
								)}
							/>
						</div>
						<div className='flex justify-between gap-2'>
							{isEdit ? (
								<Button
									type='button'
									variant='destructive'
									onClick={() => setDeleteOpen(true)}
									disabled={isPending}
								>
									Удалить акцию
								</Button>
							) : (
								<span />
							)}
							<div className='flex gap-2'>
								<Button
									type='button'
									variant='outline'
									onClick={() => router.push('/admin/promotions')}
								>
									Отмена
								</Button>
								<Button type='submit' disabled={isPending}>
									{isEdit ? 'Сохранить' : 'Создать'}
								</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>

			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Удалить акцию?</DialogTitle>
						<DialogDescription>
							«{promotion?.name}» исчезнет из витрины и не применится по коду. Прошлые заказы
							сохранят сумму скидки, но подпись станет безымянной (Q23).
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDeleteOpen(false)}>
							Вернуться
						</Button>
						<Button variant='destructive' onClick={onDelete} disabled={isPending}>
							Удалить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

function FieldError({ message }: { message?: string }) {
	if (!message) return null
	return <p className='text-sm text-destructive'>{message}</p>
}
