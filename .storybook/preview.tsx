import type { Decorator, Preview } from '@storybook/nextjs-vite'
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
	decorators: [shellDecorator, themeDecorator],
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
