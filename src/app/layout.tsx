import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
	variable: '--font-sans',
	subsets: ['latin', 'cyrillic'],
})

const geistMono = Geist_Mono({
	variable: '--font-mono',
	subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
	title: {
		default: 'Food Delivery — шаурма и пицца',
		template: '%s — Food Delivery',
	},
	description: 'Доставка шаурмы и пиццы: сеты со скидкой, напитки, десерты.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
	return (
		<html
			lang='ru'
			data-scroll-behavior='smooth'
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
			suppressHydrationWarning
		>
			<body className='flex min-h-full flex-col'>
				<a
					href='#main-content'
					className='sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2'
				>
					Перейти к содержимому
				</a>
				<ThemeProvider
					attribute='class'
					defaultTheme='system'
					enableSystem
					disableTransitionOnChange
				>
					{children}
					<Toaster position='bottom-right' />
				</ThemeProvider>
			</body>
		</html>
	)
}
