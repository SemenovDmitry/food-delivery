'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { otpErrorText } from '@/components/auth/otp-error-text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mergeGuestCartOnAuth, sendLoginOtp, sendRegisterOtp } from '@/lib/actions/auth'
import { authClient } from '@/lib/auth-client'
import {
	type AuthPhoneFormValues,
	authPhoneFormSchema,
	type SmsCodeFormValues,
	smsCodeFormSchema,
} from '@/lib/schemas/auth'

type AuthPhoneWizardProps = {
	/** login — телефон должен существовать; register — должен быть свободен (§5.15) */
	mode: 'login' | 'register'
	redirectTo: string
}

/**
 * Визард «телефон → SMS-код» для /login и /register (этап 3): страницы-близнеца
 * различаются только гардом send-действия и текстами (спека, Q2). После успешного
 * verify — слияние гостевой корзины (ошибка merge вход не блокирует) → redirect.
 */
export function AuthPhoneWizard({ mode, redirectTo }: AuthPhoneWizardProps) {
	const router = useRouter()
	const [step, setStep] = useState<'phone' | 'code'>('phone')
	const [phone, setPhone] = useState('')
	const [actionError, setActionError] = useState<string | null>(null)
	const codeInputRef = useRef<HTMLInputElement>(null)

	const phoneForm = useForm<AuthPhoneFormValues>({
		resolver: zodResolver(authPhoneFormSchema),
		defaultValues: { phone: '' },
	})
	const codeForm = useForm<SmsCodeFormValues>({
		resolver: zodResolver(smsCodeFormSchema),
		defaultValues: { code: '' },
	})

	useEffect(() => {
		if (step === 'code') codeInputRef.current?.focus()
	}, [step])

	const submitPhone = phoneForm.handleSubmit(async (values) => {
		setActionError(null)
		const res =
			mode === 'login' ? await sendLoginOtp(values.phone) : await sendRegisterOtp(values.phone)
		if (res.error) {
			setActionError(res.error)
			return
		}
		setPhone(values.phone)
		setStep('code')
	})

	async function resendCode() {
		setActionError(null)
		const res = mode === 'login' ? await sendLoginOtp(phone) : await sendRegisterOtp(phone)
		if (res.error) setActionError(res.error)
	}

	const submitCode = codeForm.handleSubmit(async (values) => {
		setActionError(null)
		const { error } = await authClient.phoneNumber.verify({ phoneNumber: phone, code: values.code })
		if (error) {
			setActionError(otpErrorText(error.code))
			return
		}
		await mergeGuestCartOnAuth()
		router.push(redirectTo)
		router.refresh()
	})

	if (step === 'code') {
		const {
			formState: { errors, isSubmitting },
			register,
		} = codeForm
		const { ref: codeRef, ...codeRest } = register('code')
		const codeError = errors.code?.message

		return (
			<form onSubmit={submitCode} className='space-y-4' noValidate>
				<p role='status' className='text-sm text-muted-foreground'>
					SMS отправлено на <span className='font-medium text-foreground'>{phone}</span>.
					<span aria-hidden> </span>Демо-код — <code className='font-mono'>1111</code>.
				</p>

				<div className='space-y-2'>
					<Label htmlFor='sms-code'>Код из SMS</Label>
					<Input
						id='sms-code'
						ref={(el) => {
							// ref RHF (для значений) + свой ref (фокус при переходе шага)
							codeRef(el)
							codeInputRef.current = el
						}}
						inputMode='numeric'
						autoComplete='one-time-code'
						placeholder='0000'
						maxLength={4}
						aria-invalid={codeError ? true : undefined}
						aria-describedby={codeError ? 'sms-code-error' : undefined}
						{...codeRest}
					/>
					{codeError && (
						<p id='sms-code-error' className='text-sm text-destructive'>
							{codeError}
						</p>
					)}
				</div>

				{actionError && (
					<p role='alert' className='text-sm text-destructive'>
						{actionError}
					</p>
				)}

				<Button type='submit' className='w-full' disabled={isSubmitting}>
					{isSubmitting ? 'Проверяем…' : 'Подтвердить'}
				</Button>

				<div className='flex justify-between text-sm'>
					<Button
						type='button'
						variant='ghost'
						size='sm'
						className='h-auto p-0 text-muted-foreground'
						onClick={() => {
							setActionError(null)
							setStep('phone')
						}}
					>
						Изменить номер
					</Button>
					<Button
						type='button'
						variant='ghost'
						size='sm'
						className='h-auto p-0 text-muted-foreground'
						onClick={resendCode}
					>
						Отправить ещё раз
					</Button>
				</div>
			</form>
		)
	}

	const {
		formState: { errors, isSubmitting },
		register,
	} = phoneForm
	const phoneError = errors.phone?.message

	return (
		<form onSubmit={submitPhone} className='space-y-4' noValidate>
			<div className='space-y-2'>
				<Label htmlFor='phone'>Телефон</Label>
				<Input
					id='phone'
					inputMode='tel'
					autoComplete='tel'
					placeholder='+7 999 000-00-01'
					aria-invalid={phoneError ? true : undefined}
					aria-describedby={phoneError ? 'phone-error' : undefined}
					{...register('phone')}
				/>
				{phoneError && (
					<p id='phone-error' className='text-sm text-destructive'>
						{phoneError}
					</p>
				)}
			</div>

			{actionError && (
				<p role='alert' className='text-sm text-destructive'>
					{actionError}
				</p>
			)}

			<Button type='submit' className='w-full' disabled={isSubmitting}>
				{isSubmitting ? 'Отправляем SMS…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
			</Button>

			<p className='text-center text-sm text-muted-foreground'>
				{mode === 'login' ? (
					<>
						Нет аккаунта?{' '}
						<Link href='/register' className='text-primary hover:underline'>
							Зарегистрируйтесь
						</Link>
					</>
				) : (
					<>
						Уже есть аккаунт?{' '}
						<Link href='/login' className='text-primary hover:underline'>
							Войдите
						</Link>
					</>
				)}
			</p>
		</form>
	)
}
