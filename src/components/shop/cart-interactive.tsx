'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { removeFromCart, setQty } from '@/lib/actions/cart'
import { computeTotals } from '@/lib/cart-totals'
import type { CartLineData, CartPromoData, DeliverySettingsData } from '@/lib/cart-types'
import { MAX_QTY } from '@/lib/constants'
import type { Fulfillment } from '@/lib/delivery'
import { formatPrice } from '@/lib/format'
import { OrderTotals } from './order-totals'
import { PromoBlock } from './promo-block'

type CartInteractiveProps = {
	lines: CartLineData[]
	activePromo: CartPromoData | null
	availablePromos: CartPromoData[]
	delivery: DeliverySettingsData
	promoQuery: string
}

/**
 * Интерактив /cart (тикеты 03–04): optimistic-степперы и удаление,
 * Tabs «Доставка / Самовывоз» (локальное состояние, в БД не пишется — Q19),
 * полные тоталы с подсказкой бесплатной доставки, переход к оформлению
 * с ?fulfillment=. Итог считает сервер (createOrder) — клиентский расчёт
 * только для мгновенной реакции.
 */
export function CartInteractive({
	lines,
	activePromo,
	availablePromos,
	delivery,
	promoQuery,
}: CartInteractiveProps) {
	const [isPending, startTransition] = useTransition()
	const [qtyMap, applyQty] = useOptimistic(
		Object.fromEntries(lines.map((line) => [line.productId, line.qty])),
		(state, update: { productId: string; qty: number }) => ({
			...state,
			[update.productId]: update.qty,
		}),
	)
	const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery')

	const visibleLines = lines
		.map((line) => ({ ...line, qty: qtyMap[line.productId] ?? line.qty }))
		.filter((line) => line.qty > 0)

	// Тоталы из optimistic-количеств — computeTotals, та же формула, что и на сервере
	const totals = computeTotals(visibleLines, activePromo, fulfillment, delivery)
	const isPickup = fulfillment === 'pickup'
	const empty = visibleLines.length === 0

	function updateQty(productId: string, qty: number) {
		startTransition(async () => {
			applyQty({ productId, qty })
			const result = await setQty(productId, qty)
			if (result.data === null) {
				toast.error(result.error)
			}
		})
	}

	function removeLine(productId: string) {
		startTransition(async () => {
			applyQty({ productId, qty: 0 })
			const result = await removeFromCart(productId)
			if (result.data === null) {
				toast.error(result.error)
			}
		})
	}

	return (
		<div className='mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
			<div className='min-w-0 space-y-6'>
				<PromoBlock
					activePromo={activePromo}
					availablePromos={availablePromos}
					lines={visibleLines}
					promoQuery={promoQuery}
				/>

				<section aria-label='Товары в корзине'>
					<h2 className='sr-only'>Товары в корзине</h2>
					<ul className='grid gap-3'>
						{visibleLines.map((line) => (
							<li key={line.productId} className='flex items-center gap-3 rounded-lg border p-3'>
								<span
									aria-hidden
									className='grid size-12 shrink-0 place-items-center rounded-md bg-muted text-2xl'
								>
									{line.emoji}
								</span>
								<div className='min-w-0 flex-1'>
									<p className='truncate font-medium'>{line.name}</p>
									<p className='text-sm text-muted-foreground'>{formatPrice(line.price)}</p>
								</div>
								<div className='flex items-center gap-1'>
									<Button
										variant='outline'
										size='icon'
										className='size-8'
										disabled={isPending || line.qty <= 1}
										aria-label={`Убрать одну «${line.name}»`}
										onClick={() => updateQty(line.productId, line.qty - 1)}
									>
										<Minus aria-hidden className='size-4' />
									</Button>
									<span className='w-8 text-center tabular-nums'>{line.qty}</span>
									<Button
										variant='outline'
										size='icon'
										className='size-8'
										disabled={isPending || line.qty >= MAX_QTY}
										aria-label={`Добавить одну «${line.name}»`}
										onClick={() => updateQty(line.productId, line.qty + 1)}
									>
										<Plus aria-hidden className='size-4' />
									</Button>
									<Button
										variant='ghost'
										size='icon'
										className='size-8 text-muted-foreground hover:text-destructive'
										disabled={isPending}
										aria-label={`Удалить «${line.name}»`}
										onClick={() => removeLine(line.productId)}
									>
										<Trash2 aria-hidden className='size-4' />
									</Button>
								</div>
								<span className='w-20 shrink-0 text-right font-semibold tabular-nums'>
									{formatPrice(line.price * line.qty)}
								</span>
							</li>
						))}
					</ul>
				</section>
			</div>

			<aside aria-label='Итоги корзины' className='lg:sticky lg:top-24'>
				<Card>
					<CardHeader>
						<CardTitle>Ваш заказ</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						{/* Выбор fulfillment — локальный, в заказ попадает из payload чекаута (Q19) */}
						<Tabs
							value={fulfillment}
							onValueChange={(value) => setFulfillment(value as Fulfillment)}
						>
							<TabsList className='w-full'>
								<TabsTrigger value='delivery'>Доставка</TabsTrigger>
								<TabsTrigger value='pickup'>Самовывоз</TabsTrigger>
							</TabsList>
						</Tabs>

						<OrderTotals
							subtotal={totals.subtotal}
							discountAmount={totals.discountAmount}
							discountLabel={activePromo?.name ?? null}
							deliveryCost={totals.deliveryCost}
							isPickup={isPickup}
						/>

						{!isPickup && (
							<p className='text-sm text-muted-foreground'>
								{totals.deliveryFree
									? 'Доставка бесплатная — порог пройден'
									: `Добавьте товаров на ${formatPrice(delivery.freeDeliveryThreshold - totals.subtotal)} до бесплатной доставки`}
							</p>
						)}

						{empty ? (
							<Button className='w-full' disabled>
								Перейти к оформлению
							</Button>
						) : (
							<Button className='w-full' asChild>
								<Link href={`/checkout?fulfillment=${fulfillment}`}>Перейти к оформлению</Link>
							</Button>
						)}
					</CardContent>
				</Card>
			</aside>
		</div>
	)
}
