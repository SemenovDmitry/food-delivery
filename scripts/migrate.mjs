import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Entrypoint-миграции (этап 11, Q11, GLOSSARY «Fresh-migrate»): выполняются
 * Dockerfile-CMD ПЕРЕД `node server.js`. Plain ESM (не TS): standalone-runner
 * не имеет tsx/next — только node. drizzle-kit (devDep) не нужен — migrator
 * из drizzle-orm (prodDep), его путь в standalone node_modules протрассирован
 * force-trace'ом в src/instrumentation.ts. Идемпотентно по __drizzle_migrations.
 * Падение → exit(1) → контейнер умер → restart: unless-stopped повторит.
 * Dev-поток не меняется: `pnpm db:migrate` запускается вручную как раньше.
 */

// Fail-fast без фолбэка (философия Env-схемы этапа 11): внутри контейнера
// DATABASE_URL всегда приходит из compose; молчаливая подстановка :5560
// уводила бы диагностику в ECONNREFUSED вместо читаемой ошибки
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
	console.error('[migrate] DATABASE_URL не задан — некуда применять миграции')
	process.exit(1)
}

const RETRIES = 3
const PAUSE_MS = 2000

// migrator требует пул с max: 1 (доки drizzle)
const client = postgres(connectionString, { max: 1 })
const db = drizzle(client)

for (let attempt = 1; attempt <= RETRIES; attempt++) {
	try {
		await migrate(db, { migrationsFolder: './drizzle' })
		console.log('[migrate] миграции применены')
		await client.end()
		process.exit(0)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`[migrate] попытка ${attempt}/${RETRIES} упала: ${message}`)
		if (attempt === RETRIES) {
			await client.end().catch(() => {})
			process.exit(1)
		}
		await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
	}
}
