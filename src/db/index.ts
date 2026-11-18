import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

/**
 * postgres-js без mkdir/WAL — это было для SQLite (§5.5).
 * Строка подключения — из env-схемы (этап 11): lenient-фолбэк dev-компоуза
 * :5560 живёт в lib/env.ts (§5.20), strict в prod требует DATABASE_URL.
 */
const client = postgres(env.DATABASE_URL, { max: 10 })

export const db = drizzle(client, { schema })
