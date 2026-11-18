import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Юнит-тесты чистых функций lib (этап 12, тикет 01) — ко-локация рядом с
// модулями; alias `@` зеркалит tsconfig. e2e — отдельный раннер @playwright/test.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
})
