import { defineConfig, type PlaywrightTestConfig } from '@playwright/test'

/**
 * e2e-конфиг (этап 12, тикет 02). Серверы поднимает webServer-массив:
 * app (`next start`, прод-режим — lib/env.ts strict требует полный env;
 * значения — process.env оркестратора e2e-run.mjs: локальный .env или
 * dev-дефолты в CI) + gateway (:3001, тот же INTERNAL_API_SECRET).
 * chromium-only, workers: 1 — детерминированность на общей e2e-БД (Q10/Q17).
 */
const E2E_DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5560/food_delivery_e2e'

// webServer.env — Record<string, string>: фильтруем undefined из process.env
// (Node-тип ProcessEnv даёт string | undefined, Playwright требует строку)
const envOf = (overrides: Record<string, string>): Record<string, string> => ({
	...Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	),
	...overrides,
})

const appEnv = envOf({
	DATABASE_URL: E2E_DATABASE_URL,
	DEMO_AUTO_STATUS: 'false',
})

const gatewayEnv = envOf({
	DATABASE_URL: E2E_DATABASE_URL,
	INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET ?? 'e2e-internal-secret',
	WS_ALLOWED_ORIGINS: 'http://localhost:3000',
	LOG_LEVEL: 'info',
})

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	// Общая e2e-БД + админ-флоу: серийный прогон (Q10)
	fullyParallel: false,
	workers: 1,
	timeout: 60_000, // полл-ассерты трекинга до 35 с (Q5)
	expect: { timeout: 10_000 },
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' },
		},
	],
	webServer: [
		{
			command: 'pnpm exec next start',
			port: 3000,
			reuseExistingServer: !process.env.CI,
			env: appEnv,
			timeout: 60_000,
		},
		{
			command: 'pnpm exec tsx ws-gateway/src/index.ts',
			port: 3001,
			reuseExistingServer: !process.env.CI,
			env: gatewayEnv,
			timeout: 30_000,
		},
	],
} satisfies PlaywrightTestConfig)
