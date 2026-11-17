/**
 * Хром «сайта провайдера» (этап 9, Q10): pay-страница должна выглядеть как
 * внешний сервис оплаты — шапка магазина, футер и чат-виджет сюда не попадают
 * (они живут в (shop)/layout). Тема — общая (ThemeProvider в корне, §7).
 */
export default function ProviderLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex min-h-svh flex-col bg-muted/40'>
			<header className='border-b bg-background'>
				<div className='mx-auto flex h-14 max-w-md items-center justify-center gap-2'>
					<span aria-hidden className='text-xl'>
						💳
					</span>
					<span className='font-semibold tracking-tight'>ШаурмаPay</span>
					<span className='text-sm text-muted-foreground'>— платёжный сервис</span>
				</div>
			</header>
			<main id='main-content' className='flex flex-1 justify-center px-4 py-8'>
				<div className='w-full max-w-md'>{children}</div>
			</main>
			<footer className='py-4 text-center text-xs text-muted-foreground'>
				Демонстрационная среда оплаты — реальные списания не производятся
			</footer>
		</div>
	)
}
