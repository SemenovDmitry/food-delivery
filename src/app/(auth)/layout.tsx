import Link from 'next/link'

/**
 * Каркас auth-страниц (этап 3): минимальный центрированный, без шапки магазина.
 * Свой landmark main — skip-link корневого layout ведёт сюда с /login, /register, /email.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<main
			id='main-content'
			className='flex min-h-svh flex-col items-center justify-center px-4 py-10'
		>
			<div className='w-full max-w-sm space-y-6'>
				<Link href='/' className='block text-center text-lg font-bold'>
					<span aria-hidden>🌯</span> Food Delivery
				</Link>
				{children}
			</div>
		</main>
	)
}
