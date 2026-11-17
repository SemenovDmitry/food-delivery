'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/format'

export type PayClientProps = {
	orderId: string
	/** копейки — сумма к оплате (снапшот createOrder) */
	amount: number
	/** ISO — момент создания заказа, база отсчёта окна оплаты (Q13) */
	createdAtIso: string
	/** минуты окна из env (серверное чтение PAYMENT_WINDOW_MINUTES) */
	windowMinutes: number
	/** failed → повтор доступен до конца окна (Q7/Q19) */
	paymentStatus: string
	/** активные банки (position-порядок, Q12) */
	providers: { code: string; label: string }[]
}

type ConfirmResponse = {
	outcome?: string
	redirectUrl?: string | null
	error?: string
}

function formatCountdown(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Клиент pay-страницы (этап 9): шаг 1 — выбор банка, шаг 2 — заглушка банка
 * («Оплатить» / «Отмена» → /api/payments/mock/confirm → loopback-webhook, Q1-Б/Q19).
 * Обратный отсчёт от orders.createdAt + PAYMENT_WINDOW_MINUTES: на нуле кнопки
 * дизейблятся (ленивый TTL-гард сервера — вторая линия, Q17).
 */
export function PayClient({
	orderId,
	amount,
	createdAtIso,
	windowMinutes,
	paymentStatus,
	providers,
}: PayClientProps) {
	const router = useRouter()
	const [providerCode, setProviderCode] = useState<string | null>(null)
	const [step, setStep] = useState<'bank' | 'confirm'>('bank')
	const [pendingAction, setPendingAction] = useState<'pay' | 'cancel' | null>(null)

	// deadline стабилен (props не меняются) — единый для отсчёта и гардов
	const deadline = useMemo(
		() => new Date(createdAtIso).getTime() + windowMinutes * 60 * 1000,
		[createdAtIso, windowMinutes],
	)
	// remaining рендерится только после mount — hydration-мисматча нет
	const [remainingMs, setRemainingMs] = useState<number | null>(null)
	const expired = remainingMs !== null && remainingMs <= 0

	useEffect(() => {
		const tick = () => setRemainingMs(deadline - Date.now())
		tick()
		const timer = setInterval(tick, 1000)
		return () => clearInterval(timer)
	}, [deadline])

	const selectedProvider = providers.find((p) => p.code === providerCode) ?? null

	async function confirm(action: 'pay' | 'cancel') {
		setPendingAction(action)
		try {
			const response = await fetch('/api/payments/mock/confirm', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ orderId, providerCode: providerCode ?? undefined, action }),
			})
			const body = (await response.json().catch(() => null)) as ConfirmResponse | null

			if (response.ok) {
				if (action === 'pay' && body?.redirectUrl) {
					router.push(body.redirectUrl)
					return
				}
				// cancel applied — назад к выбору банка (Q19), повтор до конца окна
				setStep('bank')
				return
			}

			// просрочка/конфликт — resolve на трекинге (баннер TTL / статус оплаты)
			if (response.status === 409) {
				router.push(body?.redirectUrl ?? `/orders/${orderId}`)
				return
			}
			setStep('bank')
			toast.error(body?.error ?? 'Платёж не прошёл — попробуйте ещё раз')
		} catch {
			setStep('bank')
			toast.error('Платёжный провайдер недоступен — попробуйте позже')
		} finally {
			setPendingAction(null)
		}
	}

	if (providers.length === 0) {
		// оба провайдера выключены админом (Q20): мягкая деградация
		return (
			<div className='space-y-4'>
				<h1 className='text-lg font-semibold'>Оплата заказа № {orderId.slice(0, 8)}</h1>
				<Card>
					<CardHeader>
						<CardTitle>Онлайн-оплата недоступна</CardTitle>
						<CardDescription>
							Сейчас нет доступных способов онлайн-оплаты. Заказ можно оплатить при получении.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild variant='outline' className='w-full'>
							<Link href={`/orders/${orderId}`}>К статусу заказа</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	const cardDisabled = expired || pendingAction !== null

	return (
		<div className='space-y-4'>
			{/* один h1 на страницу (a11y §7); сумма и шаги — ниже, h2-семантика CardTitle */}
			<h1 className='text-lg font-semibold'>Оплата заказа № {orderId.slice(0, 8)}</h1>

			<Card>
				<CardHeader className='pb-3'>
					<CardDescription>Заказ № {orderId.slice(0, 8)}</CardDescription>
					<CardTitle className='text-2xl tabular-nums'>{formatPrice(amount)}</CardTitle>
				</CardHeader>
				<CardContent className='flex items-center justify-between text-sm'>
					<span className='text-muted-foreground'>Окно оплаты</span>
					<span
						className={`tabular-nums font-medium ${expired ? 'text-destructive' : ''}`}
						aria-live={expired ? 'polite' : undefined}
					>
						{remainingMs === null
							? formatCountdown(windowMinutes * 60 * 1000)
							: formatCountdown(remainingMs)}
					</span>
				</CardContent>
			</Card>

			{expired ? (
				<Card>
					<CardContent className='space-y-3 py-6 text-center'>
						<p className='font-medium text-destructive'>Время оплаты истекло</p>
						<p className='text-sm text-muted-foreground'>
							Заказ будет отменён автоматически. Оформить новый можно из корзины.
						</p>
						<Button asChild variant='outline' className='w-full'>
							<Link href={`/orders/${orderId}`}>К статусу заказа</Link>
						</Button>
					</CardContent>
				</Card>
			) : step === 'bank' ? (
				<fieldset className='space-y-2' disabled={cardDisabled}>
					<legend className='text-sm font-medium'>Выберите банк для оплаты</legend>
					{providers.map((provider) => (
						<div
							key={provider.code}
							className='flex items-center gap-2.5 rounded-lg border bg-background p-3 has-[input:checked]:border-primary'
						>
							<input
								id={`bank-${provider.code}`}
								type='radio'
								name='payment-bank'
								value={provider.code}
								checked={providerCode === provider.code}
								onChange={() => setProviderCode(provider.code)}
								className='accent-primary'
							/>
							<Label
								htmlFor={`bank-${provider.code}`}
								className='flex-1 cursor-pointer font-normal'
							>
								{provider.label}
							</Label>
						</div>
					))}
					<Button
						className='w-full'
						disabled={providerCode === null || cardDisabled}
						onClick={() => setStep('confirm')}
					>
						Продолжить
					</Button>
				</fieldset>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Оплата через {selectedProvider?.label}</CardTitle>
						<CardDescription>Подтвердите платёж на сумму {formatPrice(amount)}</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						{/* реквизиты-заглушка (Q7): сервер карту не смотрит, списаний нет */}
						<div className='grid gap-3'>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='pay-card-number'>Номер карты</Label>
								<Input
									id='pay-card-number'
									inputMode='numeric'
									placeholder='0000 0000 0000 0000'
									disabled={cardDisabled}
								/>
							</div>
							<div className='grid grid-cols-2 gap-3'>
								<div className='flex flex-col gap-1.5'>
									<Label htmlFor='pay-card-expiry'>Срок</Label>
									<Input id='pay-card-expiry' placeholder='ММ/ГГ' disabled={cardDisabled} />
								</div>
								<div className='flex flex-col gap-1.5'>
									<Label htmlFor='pay-card-cvc'>CVC</Label>
									<Input
										id='pay-card-cvc'
										type='password'
										placeholder='•••'
										disabled={cardDisabled}
									/>
								</div>
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='pay-card-holder'>Имя владельца</Label>
								<Input id='pay-card-holder' autoComplete='cc-name' disabled={cardDisabled} />
							</div>
						</div>
						{paymentStatus === 'failed' && (
							<p className='text-sm text-muted-foreground'>
								Предыдущая попытка не завершена — можно повторить до конца окна.
							</p>
						)}
						<div className='grid gap-2'>
							<Button disabled={cardDisabled} onClick={() => confirm('pay')}>
								{pendingAction === 'pay' ? 'Проводим платёж…' : 'Оплатить'}
							</Button>
							<Button variant='outline' disabled={cardDisabled} onClick={() => confirm('cancel')}>
								{pendingAction === 'cancel' ? 'Отменяем…' : 'Отмена'}
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
