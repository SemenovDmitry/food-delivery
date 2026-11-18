import type { Decorator, Preview } from '@storybook/nextjs-vite'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import {
	PathnameContext,
	ReadonlyURLSearchParams,
	SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import '../src/app/globals.css'

/**
 * Шрифт: Geist подкладывает layout через next/font (`--font-sans`, §2) —
 * в стори-iframe layout не рендерится, подставляем системный фолбэк.
 * Тосты sonner — как в проде (мок-действия слайса 2 показывают успех/ошибку).
 */
const shellDecorator: Decorator = (Story) => {
	document.documentElement.style.setProperty('--font-sans', 'ui-sans-serif, system-ui, sans-serif')
	return (
		<>
			<Toaster position='bottom-right' />
			<Story />
		</>
	)
}

/**
 * App Router-контексты (найдено на axe-аудите): useRouter/useSearchParams из
 * 'next/navigation' бросают «invariant expected app router to be mounted» без
 * провайдера — подставляем мок-роутер в РЕАЛЬНЫЕ контексты Next (alias-подход
 * не пробился сквозь бандл SB). query — из реального URL стори-iframe.
 */
const appRouterDecorator: Decorator = (Story) => {
	const router = {
		push: (href: string) => {
			console.log(`[sb-router] push ${href}`)
		},
		replace: (href: string) => {
			console.log(`[sb-router] replace ${href}`)
		},
		back: () => {
			console.log('[sb-router] back')
		},
		forward: () => {
			console.log('[sb-router] forward')
		},
		refresh: () => {
			console.log('[sb-router] refresh')
		},
		prefetch: () => {},
	}
	const searchParams = new ReadonlyURLSearchParams(new URLSearchParams(window.location.search))
	return (
		<AppRouterContext.Provider value={router as never}>
			<PathnameContext.Provider value='/'>
				<SearchParamsContext.Provider value={searchParams}>
					<Story />
				</SearchParamsContext.Provider>
			</PathnameContext.Provider>
		</AppRouterContext.Provider>
	)
}

/**
 * Тема (Q8, §1 — обе равнозначны): toolbar меняет глобал, ThemeProvider с
 * forcedTheme пишет класс на html стори-iframe — dark:-варианты токенов
 * (`@custom-variant dark` в globals.css) подхватываются сами.
 */
const themeDecorator: Decorator = (Story, context) => {
	const theme = (context.globals.theme as 'light' | 'dark') ?? 'light'
	return (
		<ThemeProvider attribute='class' forcedTheme={theme} enableSystem={false}>
			<Story />
		</ThemeProvider>
	)
}

const preview: Preview = {
	initialGlobals: { theme: 'light' },
	globalTypes: {
		theme: {
			title: 'Тема',
			description: 'Светлая/тёмная — обе равнозначны (§1)',
			toolbar: {
				items: [
					{ value: 'light', title: 'Светлая', icon: 'circlehollow' },
					{ value: 'dark', title: 'Тёмная', icon: 'circle' },
				],
				dynamicTitle: true,
			},
		},
	},
	decorators: [shellDecorator, appRouterDecorator, themeDecorator],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
	},
}

export default preview
