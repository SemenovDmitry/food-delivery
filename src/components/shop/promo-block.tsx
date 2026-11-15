'use client'

import { X } from 'lucide-react'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { applyPromoCode, removePromoCode } from '@/lib/actions/orders'
import type { CartLineData, CartPromoData } from '@/lib/cart-types'
import { formatPrice } from '@/lib/format'
import { calcDiscount } from '@/lib/promo'

type PromoBlockProps = {
	/** активный промо корзины (может быть невалиден — показываем причину) */
	activePromo: CartPromoData | null
	/** доступные акции: активные в окне, у всех есть код (безкодовые отфильтрованы) */
	availablePromos: CartPromoData[]
	/** текущие строки корзины — eligibility пересчитывается на клиенте при смене qty */
	lines: CartLineData[]
	/** предзаполнение поля кода из `?promo=` (спека этапа 1) */
	promoQuery: string
}

/**
 * Промо-блок /cart (тикет 04): доступные акции сверху (Применить / disabled+причина),
 * активная ниже с суммой скидки и ✕, поле ввода кода. Акции не складываются:
 * применение другой заменяет активную (гриллинг 2026-11-15, Q14).
 */
export function PromoBlock({ activePromo, availablePromos, lines, promoQuery }: PromoBlockProps) {
	const [isPending, startTransition] = useTransition()
	/** ошибка поля кода живёт здесь: успех карточки/снятия сбрасывает её (не залипает) */
	const [codeError, setCodeError] = useState<string | null>(null)

	function apply(code: string) {
		startTransition(async () => {
			const result = await applyPromoCode(code)
			if (result.data !== null) {
				toast.success(`Акция «${result.data.name}» применена`)
				setCodeError(null)
			} else {
				toast.error(result.error)
			}
		})
	}

	function remove() {
		startTransition(async () => {
			const result = await removePromoCode()
			if (result.data !== null) {
				toast.success('Промокод снят')
				setCodeError(null)
			}
		})
	}

	// CartLineData структурно = CalcLine — передаём напрямую (ревью S7)
	const qtyDiscount = activePromo ? calcDiscount(lines, activePromo) : null
	// невалидность активной акции: по состоянию (isActive/окно — сервер, готовая формулировка)
	// либо по составу корзины (qty — причина из calcDiscount)
	const notUsableReason = activePromo?.stateReason
		? activePromo.stateReason
		: qtyDiscount && !qtyDiscount.applicable
			? `Промокод больше не действует: ${qtyDiscount.reason}`
			: null

	return (
		<section aria-labelledby='cart-promos-heading' className='space-y-3'>
			<h2 id='cart-promos-heading' className='text-lg font-semibold'>
				Акции
			</h2>

			<ul className='grid gap-2 sm:grid-cols-2'>
				{availablePromos.map((promo) => {
					const discount = calcDiscount(lines, promo)
					const isActive = activePromo?.id === promo.id
					const reasonId = `promo-reason-${promo.id}`
					return (
						<li key={promo.id} className='rounded-lg border p-3'>
							<p className='font-medium'>{promo.name}</p>
							<p className='text-sm text-muted-foreground'>{promo.conditionLabel}</p>
							<div className='mt-2 flex items-center justify-between gap-2'>
								{discount.applicable ? (
									<span className='text-sm text-primary'>
										скидка −{formatPrice(discount.amount)}
									</span>
								) : (
									<span id={reasonId} className='text-sm text-muted-foreground'>
										{discount.reason}
									</span>
								)}
								<Button
									size='sm'
									variant='outline'
									disabled={isPending || isActive || !discount.applicable}
									aria-describedby={!discount.applicable ? reasonId : undefined}
									onClick={() => apply(promo.code ?? '')}
								>
									{isActive ? 'Применена' : 'Применить'}
								</Button>
							</div>
						</li>
					)
				})}
			</ul>

			{activePromo && (
				<div className='flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2'>
					<div className='min-w-0'>
						<p className='font-medium'>
							{activePromo.name}{' '}
							{activePromo.code && (
								<span className='text-muted-foreground'>({activePromo.code})</span>
							)}
						</p>
						{!notUsableReason && qtyDiscount?.applicable ? (
							<p className='text-sm text-primary'>Скидка: −{formatPrice(qtyDiscount.amount)}</p>
						) : (
							<p className='text-sm text-destructive'>
								{notUsableReason ?? 'Промокод больше не действует'}
							</p>
						)}
					</div>
					<Button
						variant='ghost'
						size='icon'
						className='shrink-0 text-muted-foreground hover:text-destructive'
						aria-label='Снять промокод'
						disabled={isPending}
						onClick={remove}
					>
						<X aria-hidden className='size-4' />
					</Button>
				</div>
			)}

			<PromoCodeForm initialCode={promoQuery} error={codeError} onErrorChange={setCodeError} />
		</section>
	)
}

type PromoCodeFormProps = {
	initialCode: string
	/** ошибка принадлежит PromoBlock — сбрасывается при успехе карточек/снятия */
	error: string | null
	onErrorChange: (error: string | null) => void
}

/**
 * Поле ввода кода: ОК disabled при пустом поле (ошибка «Введите промокод» не
 * возникает вовсе), правка ввода сбрасывает устаревшую ошибку — иначе она
 * переживает уход/возврат на страницу (bfcache восстанавливает JS-состояние).
 */
function PromoCodeForm({ initialCode, error, onErrorChange }: PromoCodeFormProps) {
	const [code, setCode] = useState(initialCode)
	const [isPending, startTransition] = useTransition()
	const errorId = useId()

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const trimmed = code.trim()
		if (!trimmed) return // ОК уже disabled — гвард на Enter с пустым полем
		startTransition(async () => {
			const result = await applyPromoCode(trimmed)
			if (result.data !== null) {
				toast.success(`Акция «${result.data.name}» применена`)
				onErrorChange(null)
			} else {
				onErrorChange(result.error)
			}
		})
	}

	return (
		<form onSubmit={submit} className='rounded-lg border p-3'>
			<Label htmlFor='promo-code'>Промокод</Label>
			<div className='mt-1.5 flex gap-2'>
				<Input
					id='promo-code'
					value={code}
					onChange={(event) => {
						setCode(event.target.value)
						if (error) onErrorChange(null)
					}}
					placeholder='SHAWARMA20'
					autoCapitalize='characters'
					className='max-w-48'
					aria-invalid={error !== null}
					aria-describedby={error ? errorId : undefined}
				/>
				<Button type='submit' disabled={isPending || code.trim().length === 0}>
					ОК
				</Button>
			</div>
			{error && (
				<p id={errorId} className='mt-1.5 text-sm text-destructive'>
					{error}
				</p>
			)}
		</form>
	)
}
