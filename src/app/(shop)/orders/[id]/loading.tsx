import { Skeleton } from '@/components/ui/skeleton'

/** Мгновенная оболочка при хард-навигации на /orders/[id] (этап 4) */
export default function Loading() {
	return (
		<main id='main-content' className='mx-auto max-w-2xl px-4 pb-16'>
			<div className='pt-6' aria-hidden>
				<Skeleton className='h-9 w-56 rounded-md' />
				<Skeleton className='mt-4 h-64 w-full rounded-xl' />
				<Skeleton className='mt-4 h-80 w-full rounded-xl' />
			</div>
		</main>
	)
}
