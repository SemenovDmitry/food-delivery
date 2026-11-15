import { Separator } from '@/components/ui/separator'
import { formatPrice } from '@/lib/format'

type OrderTotalsProps = {
	subtotal: number
	discountAmount: number
	/** имя промо для строки «Скидка (…)» */
	discountLabel?: string | null
	deliveryCost: number
	isPickup: boolean
}

/**
 * Единый блок тоталов заказа: Товары / Скидка / Доставка / Итого (ревью S3 —
 * одна раскладка для /cart, /checkout и квитанции). aria-live на всём блоке;
 * итог считает компонент: товары − скидка + доставка.
 */
export function OrderTotals({
	subtotal,
	discountAmount,
	discountLabel,
	deliveryCost,
	isPickup,
}: OrderTotalsProps) {
	return (
		<div aria-live='polite'>
			<dl className='space-y-1.5 text-sm'>
				<div className='flex justify-between'>
					<dt>Товары</dt>
					<dd className='tabular-nums'>{formatPrice(subtotal)}</dd>
				</div>
				{discountAmount > 0 && discountLabel && (
					<div className='flex justify-between text-primary'>
						<dt>Скидка ({discountLabel})</dt>
						<dd className='tabular-nums'>−{formatPrice(discountAmount)}</dd>
					</div>
				)}
				<div className='flex justify-between'>
					<dt>Доставка</dt>
					<dd className='tabular-nums'>
						{isPickup ? '—' : deliveryCost === 0 ? 'бесплатно' : formatPrice(deliveryCost)}
					</dd>
				</div>
			</dl>
			<Separator className='my-3' />
			<div className='flex justify-between font-semibold'>
				<span>Итого</span>
				<span className='tabular-nums'>
					{formatPrice(subtotal - discountAmount + deliveryCost)}
				</span>
			</div>
		</div>
	)
}
