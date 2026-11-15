'use client'

import { cn } from 'cn'
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
 * Промо-блок /cart (тикет 04, вёрстка — компактные карточки по просьбе
 * пользователя): применённая из списка акция подсвечивается классом на своей
 * карточке (border-primary), промокод, введённый вручную (его нет в списке),
 * — отдельной плашкой с ✕. Акции не складываются: применение другой
 * заменяет активную (гриллинг 2026-11-15, Q14).
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

	/** активная акция есть в списке → подсветка её карточки; нет → плашка (кастомный ввод) */
	const activeInList = activePromo ? availablePromos.some((p) => p.id === activePromo.id) : false
	// причины плашки кастомного промо: по состоянию (isActive/окно, сервер) либо по составу (qty)
	const customQtyDiscount = activePromo && !activeInList ? calcDiscount(lines, activePromo) : null
	const plateReason = activePromo?.stateReason
		? activePromo.stateReason
		: customQtyDiscount && !customQtyDiscount.applicable
			? `Промокод больше не действует: ${customQtyDiscount.reason}`
			: null

	return (
		<section aria-labelledby='cart-promos-heading' className='space-y-2.5'>
			<h2 id='cart-promos-heading' className='text-base font-semibold'>
				Акции
			</h2>

			<ul className='grid gap-2 sm:grid-cols-2'>
				{availablePromos.map((promo) => {
					const discount = calcDiscount(lines, promo)
					return (
						<PromoOptionCard
							key={promo.id}
							promo={promo}
							isActive={activePromo?.id === promo.id}
							applicable={discount.applicable}
							discountAmount={discount.applicable ? discount.amount : null}
							reason={!discount.applicable ? discount.reason : null}
							pending={isPending}
							onApply={() => apply(promo.code ?? '')}
							onRemove={remove}
						/>
					)
				})}
			</ul>

			{activePromo && !activeInList && (
				<div className='flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-2'>
					<div className='min-w-0'>
						<p className='truncate text-sm font-medium'>
							{activePromo.name}{' '}
							{activePromo.code && (
								<span className='text-muted-foreground'>({activePromo.code})</span>
							)}
						</p>
						{!plateReason && customQtyDiscount?.applicable ? (
							<p className='text-xs text-primary'>
								Скидка: −{formatPrice(customQtyDiscount.amount)}
							</p>
						) : (
							<p className='text-xs text-destructive'>
								{plateReason ?? 'Промокод больше не действует'}
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

type PromoOptionCardProps = {
	promo: CartPromoData
	/** промо применён — карточка подсвечивается, кнопка заменяется на ✕ */
	isActive: boolean
	applicable: boolean
	discountAmount: number | null
	reason: string | null
	pending: boolean
	onApply: () => void
	onRemove: () => void
}

/** Карточка доступной акции (компактная вёрстка): имя+условие, кнопка, скидка/причина */
function PromoOptionCard({
	promo,
	isActive,
	applicable,
	discountAmount,
	reason,
	pending,
	onApply,
	onRemove,
}: PromoOptionCardProps) {
	const reasonId = `promo-option-reason-${promo.id}`
	return (
		<li className={cn('rounded-lg border p-2.5', isActive && 'border-primary bg-primary/5')}>
			<div className='flex items-center justify-between gap-2'>
				<div className='min-w-0'>
					<p className={cn('truncate text-sm font-medium', isActive && 'text-primary')}>
						{promo.name}
					</p>
					<p className='truncate text-xs text-muted-foreground'>{promo.conditionLabel}</p>
				</div>
				{isActive ? (
					<Button
						variant='ghost'
						size='icon'
						className='size-7 shrink-0 text-muted-foreground hover:text-destructive'
						aria-label={`Снять промокод «${promo.name}»`}
						disabled={pending}
						onClick={onRemove}
					>
						<X aria-hidden className='size-4' />
					</Button>
				) : (
					<Button
						size='sm'
						variant='outline'
						className='shrink-0'
						disabled={pending || !applicable}
						aria-describedby={reason ? reasonId : undefined}
						onClick={onApply}
					>
						Применить
					</Button>
				)}
			</div>
			{reason ? (
				<p id={reasonId} className='mt-1 truncate text-xs text-muted-foreground'>
					{reason}
				</p>
			) : discountAmount !== null ? (
				<p className='mt-1 text-xs text-primary'>скидка −{formatPrice(discountAmount)}</p>
			) : null}
		</li>
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
		<form onSubmit={submit} className='rounded-lg border p-2.5'>
			<Label htmlFor='promo-code' className='text-sm'>
				Промокод
			</Label>
			<div className='mt-1 flex gap-2'>
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
				<p id={errorId} className='mt-1 text-xs text-destructive'>
					{error}
				</p>
			)}
		</form>
	)
}
