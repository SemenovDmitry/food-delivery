import type { StorybookConfig } from '@storybook/nextjs-vite'
import tailwindcss from '@tailwindcss/vite'

/**
 * Storybook 10 + nextjs-vite (этап 13, тикет 01, Q7): единственный актуальный
 * фреймворк для Next 16 (webpack-вариант legacy). Tailwind v4 — нативный
 * vite-плагин, globals.css подключается в preview. Стори — ко-локация
 * `*.stories.tsx` рядом с компонентами (Q12).
 */
const config: StorybookConfig = {
	framework: '@storybook/nextjs-vite',
	stories: ['../src/**/*.stories.@(ts|tsx)'],
	// SB 9/10: essentials discontinued — controls/toolbars/viewport в ядре; a11y отдельно
	addons: ['@storybook/addon-a11y'],
	viteFinal: async (vite) => {
		vite.plugins = vite.plugins ?? []
		vite.plugins.push(tailwindcss())
		return vite
	},
}

export default config
