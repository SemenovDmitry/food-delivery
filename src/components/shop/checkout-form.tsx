'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { CartLineData, CartPromoData, DeliverySettingsData } from '@/lib/cart-types'
import { computeTotals } from '@/lib/cart-totals'
import { createOrder } from '@/lib/actions/orders'
import { formatPrice } from '@/lib/format'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Fulfillment = 'delivery' | 'pickup'

type CheckoutFormProps = {
	lines: CartLineData[]
	activePromo: CartPromoData | null
	delivery: DeliverySettingsData
	initialFulfillment: Fulfillment
	/** prefill из сессии (гость — пустые) */
	initialName: string
	initialPhone: string
}

/**
 * Чекаут (тикет 05): товары read-only, контакты/адрес/комментарий с inline-
 * валидацией, финальные тоталы, createOrder. Серверные ошибки — Dialog-модалка:
 * промо-ошибка уже сняла промо с корзины, повторное «Оформить» проходит без
 * скидки (гриллинг 2026-11-15, Q12).
 */
export function CheckoutForm({
	lines,
	activePromo,
	delivery,
	initialFulfillment,
	initialName,
	initialPhone,
}: CheckoutFormProps) {
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const [fulfillment, setFulfillment] = useState<Fulfillment>(initialFulfillment)
	const [name, setName] = useState(initialName)
	const [phone, setPhone] = useState(initialPhone)
	const [address, setAddress] = useState('')
	const [comment, setComment] = useState('')
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [serverError, setServerError] = useState<string | null>(null)

	const isPickup = fulfillment === 'pickup'
	const totals = computeTotals(lines, activePromo, fulfillment, delivery)
	const empty = lines.length === 0

	function validate(): boolean {
		const next: Record<string, string> = {}
		if (name.trim().length < 2) next.name = 'Укажите имя (минимум 2 символа)'
		if (phone.replace(/\D/g, '').length < 10) next.phone = 'Укажите корректный телефон'
		if (!isPickup && address.trim().length < 5) next.address = 'Укажите адрес доставки'
		setErrors(next)
		return Object.keys(next).length === 0
	}

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setServerError(null)
		if (!validate()) return

		startTransition(async () => {
			const result = await createOrder({
				customerName: name,
				phone,
				fulfillment,
				address: isPickup ? undefined : address,
				comment: comment || undefined,
			})
			if (result.data !== null) {
				router.push(`/orders/${result.data.orderId}`)
			} else {
				// промо-ошибка: createOrder уже снял promoId — корзина под модалкой обновится
				setServerError(result.error)
			}
		})
	}

	return (
		<div className='mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
			<form id='checkout-form' onSubmit={submit} noValidate className='min-w-0 space-y-6'>
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
						<Link href='/cart' className='text-primary hover:underline'>
							корзине
						</Link>
					</p>
				</section>

				<section aria-labelledby='checkout-details-heading' className='space-y-4'>
					<h2 id='checkout-details-heading' className='text-lg font-semibold'>
						Контакты и получение
					</h2>

					<Tabs value={fulfillment} onValueChange={(value) => setFulfillment(value as Fulfillment)}>
						<TabsList>
							<TabsTrigger value='delivery'>Доставка</TabsTrigger>
							<TabsTrigger value='pickup'>Самовывоз</TabsTrigger>
						</TabsList>
					</Tabs>

					<div className='grid gap-4 sm:grid-cols-2'>
						<div className='grid gap-1.5'>
							<Label htmlFor='checkout-name'>Имя</Label>
							<Input
								id='checkout-name'
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder='Как к вам обращаться'
								autoComplete='name'
								aria-invalid={errors.name !== undefined}
								aria-describedby={errors.name ? 'checkout-name-error' : undefined}
							/>
							{errors.name && (
								<p id='checkout-name-error' className='text-sm text-destructive'>
									{errors.name}
								</p>
							)}
						</div>
						<div className='grid gap-1.5'>
							<Label htmlFor='checkout-phone'>Телефон</Label>
							<Input
								id='checkout-phone'
								type='tel'
								value={phone}
								onChange={(event) => setPhone(event.target.value)}
								placeholder='+7 999 123-45-67'
								autoComplete='tel'
								aria-invalid={errors.phone !== undefined}
								aria-describedby={errors.phone ? 'checkout-phone-error' : undefined}
							/>
							{errors.phone && (
								<p id='checkout-phone-error' className='text-sm text-destructive'>
									{errors.phone}
								</p>
							)}
						</div>
					</div>

					{!isPickup && (
						<div className='grid gap-1.5'>
							<Label htmlFor='checkout-address'>Адрес доставки</Label>
							<Textarea
								id='checkout-address'
								value={address}
								onChange={(event) => setAddress(event.target.value)}
								placeholder='Улица, дом, квартира'
								rows={2}
								aria-invalid={errors.address !== undefined}
								aria-describedby={errors.address ? 'checkout-address-error' : undefined}
							/>
							{errors.address && (
								<p id='checkout-address-error' className='text-sm text-destructive'>
									{errors.address}
								</p>
							)}
						</div>
					)}

					<div className='grid gap-1.5'>
						<Label htmlFor='checkout-comment'>Комментарий к заказу (необязательно)</Label>
						<Textarea
							id='checkout-comment'
							value={comment}
							onChange={(event) => setComment(event.target.value)}
							placeholder='Домофон, пожелания к заказу…'
							rows={2}
						/>
					</div>
				</section>
			</form>

			<aside aria-label='Итоги заказа' className='lg:sticky lg:top-24'>
				<Card>
					<CardHeader>
						<CardTitle>Итог</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div aria-live='polite'>
							<dl className='space-y-1.5 text-sm'>
								<div className='flex justify-between'>
									<dt>Товары</dt>
									<dd className='tabular-nums'>{formatPrice(totals.subtotal)}</dd>
								</div>
								{totals.discountAmount > 0 && activePromo && (
									<div className='flex justify-between text-primary'>
										<dt>Скидка ({activePromo.name})</dt>
										<dd className='tabular-nums'>−{formatPrice(totals.discountAmount)}</dd>
									</div>
								)}
								<div className='flex justify-between'>
									<dt>Доставка</dt>
									<dd className='tabular-nums'>
										{isPickup
											? '—'
											: totals.deliveryCost === 0
												? 'бесплатно'
												: formatPrice(totals.deliveryCost)}
									</dd>
								</div>
							</dl>
							<Separator className='my-3' />
							<div className='flex justify-between font-semibold'>
								<span>Итого</span>
								<span className='tabular-nums'>{formatPrice(totals.total)}</span>
							</div>
						</div>

						<Button
							type='submit'
							form='checkout-form'
							className='w-full'
							disabled={isPending || empty}
						>
							{isPending ? 'Оформляем…' : 'Оформить заказ'}
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
