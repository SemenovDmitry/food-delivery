'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { OrderTotals } from '@/components/shop/order-totals'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { createOrder } from '@/lib/actions/orders'
import { computeTotals } from '@/lib/cart-totals'
import type { CartLineData, CartPromoData, DeliverySettingsData } from '@/lib/cart-types'
import { formatPrice } from '@/lib/format'
import { type CheckoutFormValues, checkoutFormSchema } from '@/lib/schemas/checkout'

type CheckoutFormProps = {
	lines: CartLineData[]
	activePromo: CartPromoData | null
	delivery: DeliverySettingsData
	initialFulfillment: CheckoutFormValues['fulfillment']
	/** prefill из сессии (гость — пустые) */
	initialName: string
	initialPhone: string
	/** ≥1 активного провайдера (этап 9, Q20): false → radio онлайн скрыт */
	hasActiveProviders: boolean
}

/**
 * Чекаут (тикет 05): товары read-only, контакты/адрес/комментарий, финальные
 * тоталы, createOrder. Форма — react-hook-form + zod: правила в
 * checkoutFormSchema (тип = z.infer), сервер парсит той же схемой.
 * Серверные ошибки — Dialog-модалка: промо-ошибка уже сняла промо с корзины,
 * повторное «Оформить» проходит без скидки (гриллинг 2026-11-15, Q12).
 * Оплата (этап 9, Q16/Q3): radio «Онлайн-оплата / При получении», дефолт —
 * при получении; онлайн ведёт на страницу провайдера (payUrl из action).
 */
export function CheckoutForm({
	lines,
	activePromo,
	delivery,
	initialFulfillment,
	initialName,
	initialPhone,
	hasActiveProviders,
}: CheckoutFormProps) {
	const router = useRouter()
	const [serverError, setServerError] = useState<string | null>(null)

	const {
		control,
		formState: { errors, isSubmitting },
		handleSubmit,
		register,
		watch,
	} = useForm<CheckoutFormValues>({
		resolver: zodResolver(checkoutFormSchema),
		mode: 'onTouched', // ошибка после первого blur, дальше — на каждое изменение
		defaultValues: {
			customerName: initialName,
			phone: initialPhone,
			fulfillment: initialFulfillment,
			paymentMethod: 'on_receipt', // дефолт — при получении (Q3)
			address: '',
			comment: '',
		},
	})

	const fulfillment = watch('fulfillment')
	const isPickup = fulfillment === 'pickup'
	const totals = computeTotals(lines, activePromo, fulfillment, delivery)
	const empty = lines.length === 0

	const onSubmit = handleSubmit(async (values) => {
		setServerError(null)
		const result = await createOrder(values)
		if (result.data !== null) {
			// онлайн → payUrl (страница провайдера), иначе трекинг (return_url-семантика)
			router.push(result.data.payUrl ?? `/orders/${result.data.orderId}`)
		} else {
			// промо-ошибка: createOrder уже снял promoId — корзина под модалкой обновится
			setServerError(result.error)
		}
	})

	return (
		<div className='mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
			<form id='checkout-form' onSubmit={onSubmit} noValidate className='min-w-0 space-y-6'>
				<section aria-labelledby='checkout-order-heading'>
					<h2 id='checkout-order-heading' className='text-lg font-semibold'>
						Ваш заказ
					</h2>
					<ul className='mt-3 grid gap-2'>
						{lines.map((line) => (
							<li key={line.productId} className='flex items-center gap-3 rounded-lg border p-3'>
								<span
									aria-hidden
									className='grid size-10 shrink-0 place-items-center rounded-md bg-muted text-xl'
								>
									{line.emoji}
								</span>
								<span className='min-w-0 flex-1 truncate'>
									{line.name} <span className='text-muted-foreground'>×{line.qty}</span>
								</span>
								<span className='shrink-0 tabular-nums'>{formatPrice(line.price * line.qty)}</span>
							</li>
						))}
					</ul>
					<p className='mt-2 text-sm text-muted-foreground'>
						Изменить состав можно в{' '}
						{/* underline: ссылка внутри текста различается не только цветом
						    (axe: link-in-text-block, WCAG 1.4.1) */}
						<Link
							href='/cart'
							className='text-primary underline underline-offset-2 hover:no-underline'
						>
							корзине
						</Link>
					</p>
				</section>

				<section aria-labelledby='checkout-details-heading' className='space-y-4'>
					<h2 id='checkout-details-heading' className='text-lg font-semibold'>
						Контакты и получение
					</h2>

					<Controller
						control={control}
						name='fulfillment'
						render={({ field }) => (
							<Tabs value={field.value} onValueChange={field.onChange}>
								<TabsList>
									<TabsTrigger value='delivery'>Доставка</TabsTrigger>
									<TabsTrigger value='pickup'>Самовывоз</TabsTrigger>
								</TabsList>
								{/* панели-заглушки: aria-controls таба должен указывать на существующие
								    id (axe: aria-valid-attr-value, аудит сторей этапа 13) */}
								<TabsContent value='delivery' />
								<TabsContent value='pickup' />
							</Tabs>
						)}
					/>

					<fieldset className='space-y-2'>
						<legend className='text-sm font-medium'>Способ оплаты</legend>
						{/* radio из активных провайдеров (Q15/Q20): онлайн виден при ≥1 банке;
						    дефолт — при получении. Нативные radio — клавиатура из коробки (§7) */}
						{hasActiveProviders && (
							<div className='flex items-start gap-2.5 rounded-lg border p-3 has-[input:checked]:border-primary'>
								<input
									id='checkout-payment-online'
									type='radio'
									value='online'
									className='mt-1 accent-primary'
									aria-describedby='checkout-payment-online-hint'
									{...register('paymentMethod')}
								/>
								<div className='min-w-0'>
									<Label
										htmlFor='checkout-payment-online'
										className='text-sm font-medium leading-none'
									>
										Онлайн-оплата
									</Label>
									<p
										id='checkout-payment-online-hint'
										className='mt-1 text-sm text-muted-foreground'
									>
										СБП или карта — выбор банка после оформления заказа
									</p>
								</div>
							</div>
						)}
						<div className='flex items-start gap-2.5 rounded-lg border p-3 has-[input:checked]:border-primary'>
							<input
								id='checkout-payment-on-receipt'
								type='radio'
								value='on_receipt'
								className='mt-1 accent-primary'
								aria-describedby='checkout-payment-on-receipt-hint'
								{...register('paymentMethod')}
							/>
							<div className='min-w-0'>
								<Label
									htmlFor='checkout-payment-on-receipt'
									className='text-sm font-medium leading-none'
								>
									При получении
								</Label>
								<p
									id='checkout-payment-on-receipt-hint'
									className='mt-1 text-sm text-muted-foreground'
								>
									Наличными или картой курьеру / кассиру
								</p>
							</div>
						</div>
					</fieldset>

					<div className='grid gap-4 sm:grid-cols-2'>
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='checkout-name'>Имя</Label>
							<Input
								id='checkout-name'
								placeholder='Как к вам обращаться'
								autoComplete='name'
								aria-invalid={errors.customerName !== undefined}
								aria-describedby={errors.customerName ? 'checkout-name-error' : undefined}
								{...register('customerName')}
							/>
							{errors.customerName && (
								<p id='checkout-name-error' className='text-sm text-destructive'>
									{errors.customerName.message}
								</p>
							)}
						</div>
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='checkout-phone'>Телефон</Label>
							<Input
								id='checkout-phone'
								type='tel'
								placeholder='+7 999 123-45-67'
								autoComplete='tel'
								aria-invalid={errors.phone !== undefined}
								aria-describedby={errors.phone ? 'checkout-phone-error' : undefined}
								{...register('phone')}
							/>
							{errors.phone && (
								<p id='checkout-phone-error' className='text-sm text-destructive'>
									{errors.phone.message}
								</p>
							)}
						</div>
					</div>

					{!isPickup && (
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='checkout-address'>Адрес доставки</Label>
							<Textarea
								id='checkout-address'
								placeholder='Улица, дом, квартира'
								rows={2}
								aria-invalid={errors.address !== undefined}
								aria-describedby={errors.address ? 'checkout-address-error' : undefined}
								{...register('address')}
							/>
							{errors.address && (
								<p id='checkout-address-error' className='text-sm text-destructive'>
									{errors.address.message}
								</p>
							)}
						</div>
					)}

					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='checkout-comment'>Комментарий к заказу (необязательно)</Label>
						<Textarea
							id='checkout-comment'
							placeholder='Домофон, пожелания к заказу…'
							rows={2}
							aria-invalid={errors.comment !== undefined}
							aria-describedby={errors.comment ? 'checkout-comment-error' : undefined}
							{...register('comment')}
						/>
						{errors.comment && (
							<p id='checkout-comment-error' className='text-sm text-destructive'>
								{errors.comment.message}
							</p>
						)}
					</div>
				</section>
			</form>

			<aside aria-label='Итоги заказа' className='lg:sticky lg:top-24'>
				<Card>
					<CardHeader>
						<CardTitle>Итог</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<OrderTotals
							subtotal={totals.subtotal}
							discountAmount={totals.discountAmount}
							discountLabel={activePromo?.name ?? null}
							deliveryCost={totals.deliveryCost}
							isPickup={isPickup}
						/>

						<Button
							type='submit'
							form='checkout-form'
							className='w-full'
							disabled={isSubmitting || empty}
						>
							{isSubmitting ? 'Оформляем…' : 'Оформить заказ'}
						</Button>
					</CardContent>
				</Card>
			</aside>

			<Dialog
				open={serverError !== null}
				onOpenChange={(open) => {
					if (!open) setServerError(null)
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Не получилось оформить заказ</DialogTitle>
						<DialogDescription>{serverError}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={() => setServerError(null)}>Понятно</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
