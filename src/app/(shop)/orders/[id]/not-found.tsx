import Link from 'next/link'

/** 404 в каркасе магазина: неверный uuid заказа (тикет 06) */
export default function OrderNotFound() {
	return (
		<main
			id='main-content'
			className='flex flex-col items-center justify-center gap-4 py-24 text-center'
		>
			<p aria-hidden className='text-6xl'>
				🧾
			</p>
			<h1 className='text-2xl font-bold'>Заказ не найден</h1>
			<p className='text-muted-foreground'>
				Проверьте ссылку — она должна быть из квитанции заказа.
			</p>
			<Link href='/' className='rounded-md border px-4 py-2 transition-colors hover:bg-muted'>
				Вернуться в меню
			</Link>
		</main>
	)
}
