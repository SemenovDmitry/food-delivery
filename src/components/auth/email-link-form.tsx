'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { otpErrorText } from '@/components/auth/otp-error-text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { linkEmail } from '@/lib/actions/auth'
import { authClient } from '@/lib/auth-client'
import {
	type EmailCodeFormValues,
	emailCodeFormSchema,
	type LinkEmailFormValues,
	linkEmailFormSchema,
} from '@/lib/schemas/auth'

type EmailLinkFormProps = {
	/** уже введённый ранее настоящий email (префилл при возобновлении потока) */
	initialEmail: string
}

/**
 * Привязка email (этап 3, Q1/Q5): email → linkEmail (уникальность + UPDATE +
 * запрос кода у emailOTP → Mailpit) → код из письма → emailVerified → /orders.
 * Поток возобновляемый: повторный вход шлёт новый код.
 */
export function EmailLinkForm({ initialEmail }: EmailLinkFormProps) {
	const router = useRouter()
	const [step, setStep] = useState<'email' | 'code'>('email')
	const [email, setEmail] = useState('')
	const [actionError, setActionError] = useState<string | null>(null)
	const codeInputRef = useRef<HTMLInputElement>(null)

	const emailForm = useForm<LinkEmailFormValues>({
		resolver: zodResolver(linkEmailFormSchema),
		defaultValues: { email: initialEmail },
	})
	const codeForm = useForm<EmailCodeFormValues>({
		resolver: zodResolver(emailCodeFormSchema),
		defaultValues: { code: '' },
	})

	useEffect(() => {
		if (step === 'code') codeInputRef.current?.focus()
	}, [step])

	const submitEmail = emailForm.handleSubmit(async (values) => {
		setActionError(null)
		const res = await linkEmail(values.email)
		// data — дискриминант: в ветке успеха error гарантированно null
		if (res.data) {
			setEmail(res.data.email)
			setStep('code')
			return
		}
		setActionError(res.error ?? 'Не удалось отправить письмо')
	})

	async function resendCode() {
		setActionError(null)
		const res = await linkEmail(email)
		if (res.error) setActionError(res.error)
	}

	const submitCode = codeForm.handleSubmit(async (values) => {
		setActionError(null)
		const { error } = await authClient.emailOtp.verifyEmail({ email, otp: values.code })
		if (error) {
			setActionError(otpErrorText(error.code))
			return
		}
		router.push('/orders')
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
					Код отправлен на <span className='font-medium text-foreground'>{email}</span>.
					<span aria-hidden> </span>В демо письмо падает в Mailpit (localhost:8025).
				</p>

				<div className='space-y-2'>
					<Label htmlFor='email-code'>Код из письма</Label>
					<Input
						id='email-code'
						ref={(el) => {
							codeRef(el)
							codeInputRef.current = el
						}}
						inputMode='numeric'
						autoComplete='one-time-code'
						placeholder='000000'
						maxLength={6}
						aria-invalid={codeError ? true : undefined}
						aria-describedby={codeError ? 'email-code-error' : undefined}
						{...codeRest}
					/>
					{codeError && (
						<p id='email-code-error' className='text-sm text-destructive'>
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
							setStep('email')
						}}
					>
						Изменить email
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
	} = emailForm
	const emailError = errors.email?.message

	return (
		<form onSubmit={submitEmail} className='space-y-4' noValidate>
			<div className='space-y-2'>
				<Label htmlFor='link-email'>Email</Label>
				<Input
					id='link-email'
					type='email'
					autoComplete='email'
					placeholder='you@example.com'
					aria-invalid={emailError ? true : undefined}
					aria-describedby={emailError ? 'link-email-error' : undefined}
					{...register('email')}
				/>
				{emailError && (
					<p id='link-email-error' className='text-sm text-destructive'>
						{emailError}
					</p>
				)}
			</div>

			{actionError && (
				<p role='alert' className='text-sm text-destructive'>
					{actionError}
				</p>
			)}

			<Button type='submit' className='w-full' disabled={isSubmitting}>
				{isSubmitting ? 'Отправляем письмо…' : 'Привязать email'}
			</Button>
		</form>
	)
}
