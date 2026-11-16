'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Сбой рендера квитанции/трекинга (этап 4): перехват на границе сегмента,
 * layout магазина не ломается. digest — для сопоставления с серверным логом.
 */
export default function OrderError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error(error)
	}, [error])

	return (
		<main
			id='main-content'
			className='flex flex-col items-center justify-center gap-4 py-24 text-center'
		>
			<p aria-hidden className='text-6xl'>
				🍽️
			</p>
			<h1 className='text-2xl font-bold'>Не удалось загрузить заказ</h1>
			<p className='text-muted-foreground'>Попробуйте ещё раз — возможно, проблема временная.</p>
			<Button onClick={reset}>Попробовать снова</Button>
		</main>
	)
}
