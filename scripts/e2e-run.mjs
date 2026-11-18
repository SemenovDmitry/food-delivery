// Оркестратор e2e (этап 12, тикет 02) — pnpm test:e2e. Node-скрипт, а не
// shell-склейка: pnpm-скрипты на Windows идут через cmd, `VAR=x cmd` не работает.
// Шаги: (1) env — .env (локально) или dev-дефолты .env.example (CI) + e2e-оверрайды;
// (2) проверка postgres :5560; (3) setup e2e-БД (createdb → migrate → seed);
// (4) next build (DATABASE_URL=e2e, NEXT_PUBLIC_WS_URL пекётся, DEMO_AUTO_STATUS=false);
// (5) playwright test — webServer-массив в playwright.config.ts.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const E2E_DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5560/food_delivery_e2e'

// Dev-дефолты = .env.example (для CI, где локального .env нет). Локальный .env
// перекрывает их, e2e-оверрайды перекрывают всё.
const DEV_DEFAULTS = {
	AUTH_SECRET: 'e2e-auth-secret',
	INTERNAL_API_SECRET: 'e2e-internal-secret',
	PAYMENTS_WEBHOOK_SECRET: 'e2e-payments-secret',
	S3_ENDPOINT: 'http://localhost:9000',
	S3_KEY: 'minioadmin',
	S3_SECRET: 'minioadmin',
	S3_BUCKET: 'food-delivery',
	BETTER_AUTH_URL: 'http://localhost:3000',
	SMTP_HOST: 'localhost',
	SMTP_PORT: '1025',
	PAYMENT_PROVIDER: 'mock',
	PAYMENT_WINDOW_MINUTES: '5',
	LOG_LEVEL: 'info',
}

function loadDotEnv() {
	try {
		const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
		for (const lineRaw of raw.split(/\r?\n/)) {
			const line = lineRaw.trim()
			if (line === '' || line.startsWith('#')) continue
			const eq = line.indexOf('=')
			if (eq <= 0) continue
			const key = line.slice(0, eq)
			const value = line.slice(eq + 1).replace(/^["']|["']$/g, '')
			if (!(key in process.env)) process.env[key] = value
		}
	} catch {
		console.log('[e2e-run] локального .env нет — dev-дефолты (CI-режим)')
	}
	for (const [key, value] of Object.entries(DEV_DEFAULTS)) {
		if (!process.env[key]) process.env[key] = value
	}
	// Оверрайды e2e: отдельная БД, автоджоба off, WS-URL на тестовый шлюз (пекётся)
	process.env.E2E_DATABASE_URL = E2E_DATABASE_URL
	process.env.DATABASE_URL = E2E_DATABASE_URL
	process.env.DEMO_AUTO_STATUS = 'false'
	process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3001'
}

async function checkInfra() {
	// Postgres и MinIO — dev-compose; без них нет ни сборки (пререндер §5.3),
	// ни сидера (бакет). Mailpit нужен с P3 (email-код), шлюз стартует сам.
	const adminUrl = E2E_DATABASE_URL.replace(/\/[^/]+$/, '/postgres')
	const sql = postgres(adminUrl, { max: 1, connect_timeout: 3 })
	try {
		await sql`SELECT 1`
	} catch {
		console.error(
			'[e2e-run] postgres :5560 недоступен. Подними dev-инфраструктуру:\n' +
				'  docker compose -f docker-compose.dev.yml up -d',
		)
		process.exit(1)
	} finally {
		await sql.end()
	}
}

function run(cmd, args, env = process.env) {
	const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env })
	if (result.status !== 0) process.exit(result.status ?? 1)
}

loadDotEnv()
await checkInfra()

run('node', ['scripts/e2e-db-setup.mjs'])
// Сборка ДО playwright: пререндер 'use cache' исполняет запросы (§5.3) —
// e2e-БД уже засеяна; NEXT_PUBLIC_WS_URL инлайнится только на build (§5.32-г)
run('pnpm', ['exec', 'next', 'build'])
run('pnpm', ['exec', 'playwright', 'test'])
