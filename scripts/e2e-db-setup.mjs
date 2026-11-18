// Идемпотентный setup БД для e2e (этап 12, тикет 02): food_delivery_e2e в том же
// postgres-контейнере (:5560) — createdb если нет → drizzle-kit migrate → сидер.
// Dev-БД (food_delivery) не трогаем (Q17). Вызывается из e2e-run.mjs или руками:
//   node scripts/e2e-db-setup.mjs
import { spawnSync } from 'node:child_process'
import postgres from 'postgres'

const E2E_DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5560/food_delivery_e2e'
const dbName = E2E_DATABASE_URL.split('/').pop()
const adminUrl = E2E_DATABASE_URL.replace(/\/[^/]+$/, '/postgres')

function run(cmd, args) {
	// shell: true — pnpm на Windows не запускается напрямую из spawnSync
	const result = spawnSync(cmd, args, {
		stdio: 'inherit',
		shell: true,
		env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
	})
	if (result.status !== 0) {
		console.error(`[e2e-db-setup] команда провалилась: ${cmd} ${args.join(' ')}`)
		process.exit(result.status ?? 1)
	}
}

// 1) CREATE DATABASE если нет (pg не умеет IF NOT EXISTS — смотрим pg_database)
const sql = postgres(adminUrl, { max: 1, connect_timeout: 5 })
try {
	const rows = await sql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`
	if (rows.length === 0) {
		await sql.unsafe(`CREATE DATABASE "${dbName}"`)
		console.log(`[e2e-db-setup] БД ${dbName} создана`)
	} else {
		console.log(`[e2e-db-setup] БД ${dbName} уже есть`)
	}
} finally {
	await sql.end()
}

// 2) Миграции (drizzle.config.ts читает DATABASE_URL из process.env)
run('pnpm', ['exec', 'drizzle-kit', 'migrate'])

// 3) Сидер — идемпотентен, заодно создаёт бакет MinIO (minio должен быть поднят)
run('pnpm', ['exec', 'tsx', 'src/db/seed.ts'])

console.log('[e2e-db-setup] готово')
