import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { sql } from 'drizzle-orm'
import { connection } from 'next/server'
import { db } from '@/db'
import { logger } from '@/lib/logger'
import { getRequestId } from '@/lib/request-id'
import { S3_BUCKET, s3Client } from '@/lib/s3'

/**
 * GET /api/health (этап 11, Q4/GLOSSARY): проверка живости инфраструктуры —
 * SELECT 1 (Postgres) + headBucket (MinIO), обе под таймаутом 2 с (health не
 * имеет права висеть). Ответ 200|503 + { status, checks }, `no-store`:
 * MinIO лежит → 503, даже если витрина жива на emoji-фолбэке — health это
 * строгий сигнал «инфраструктура цела», не UX-индикатор. Миграции НЕ
 * проверяются — их провал валит контейнер на старте (entrypoint, тикет 04).
 * Деградация пишет warn (Q13 → попадает в error_events с requestId) —
 * естественный путь проверки DB-sink на приёмке.
 *
 * `connection()` — Route Handler динамический: без него пререндер на build
 * попытался бы сходить в БД/MinIO при сборке (их нет, §5.3) и заморозил бы
 * ответ. Docker HEALTHCHECK бьёт wget'ом по этому роуту (Dockerfile).
 */

const CHECK_TIMEOUT_MS = 2000
const MESSAGE_CAP = 200

/**
 * Короткая причина без секретов. Сети-ошибки Node бывают скупыми: у S3-ошибок
 * message пуст (AggregateError — под-ошибки в `.errors`), у fetch — cause
 * (ECONNREFUSED). Идём вглубь, пока не найдём человеческий текст.
 */
function shortError(error: unknown): string {
	if (error instanceof Error) {
		const parts = [error.message || error.name]
		const aggregate = (error as { errors?: unknown[] }).errors
		if (Array.isArray(aggregate)) {
			for (const sub of aggregate) {
				if (sub instanceof Error && sub.message) parts.push(sub.message)
			}
		}
		if (error.cause instanceof Error) parts.push(error.cause.message)
		else if (error.cause != null) parts.push(String(error.cause))
		return (parts.filter(Boolean).join(': ') || error.name).slice(0, MESSAGE_CAP)
	}
	return (String(error) || 'unknown').slice(0, MESSAGE_CAP)
}

async function checkDb(): Promise<void> {
	// У drizzle/postgres-js нет abort-signal на запросе — кап 2 с достигается
	// Promise.race (спека Q4: «обе проверки под таймаутом 2 с»; «висящий»
	// SELECT дорабатывает в фоне, health его не ждёт)
	await Promise.race([
		db.execute(sql`SELECT 1`),
		new Promise<never>((_, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`нет ответа за ${CHECK_TIMEOUT_MS} мс`)),
				CHECK_TIMEOUT_MS,
			)
			timer.unref?.()
		}),
	])
}

async function checkS3(): Promise<void> {
	await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }), {
		abortSignal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
	})
}

export async function GET(): Promise<Response> {
	await connection()

	const [dbResult, s3Result] = await Promise.allSettled([checkDb(), checkS3()])
	const checks = {
		db: dbResult.status === 'fulfilled' ? 'ok' : `error: ${shortError(dbResult.reason)}`,
		s3: s3Result.status === 'fulfilled' ? 'ok' : `error: ${shortError(s3Result.reason)}`,
	}
	const healthy = dbResult.status === 'fulfilled' && s3Result.status === 'fulfilled'

	if (!healthy) {
		logger.warn({ checks, requestId: await getRequestId() }, 'health: деградация инфраструктуры')
	}

	return Response.json(
		{ status: healthy ? 'ok' : 'error', checks },
		{ status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
	)
}
