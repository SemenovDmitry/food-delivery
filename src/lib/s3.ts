// Без 'server-only': модуль импортирует сидер (tsx = plain Node, где
// server-only кидает). Клиентом файл не импортируется — env не утекает.
import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/lib/env'

/**
 * S3-совместимое хранилище (MinIO в compose; managed S3/R2 — замена через env).
 * forcePathStyle — MinIO работает по path-style URL (endpoint/bucket/key).
 * Креды/endpoint — из env-схемы (этап 11): lenient-фолбэки dev, strict — prod.
 */
export const S3_ENDPOINT = env.S3_ENDPOINT
export const S3_BUCKET = env.S3_BUCKET

export const s3Client = new S3Client({
	endpoint: S3_ENDPOINT,
	region: 'us-east-1',
	forcePathStyle: true,
	credentials: {
		accessKeyId: env.S3_KEY,
		secretAccessKey: env.S3_SECRET,
	},
})

/**
 * Полный URL картинки из ключа (этап 5, Q7). В БД хранится ТОЛЬКО ключ
 * (products/<productId>/<hash>.webp) — URL строится при рендере из env
 * текущего окружения и переживает переключение dev↔prod компоузов (§5.26:
 * общие volume'ы, в prod MinIO — http://minio:9000, в dev — localhost:9000).
 * server-only: env не утекает в клиент — браузер получает только /_next/image.
 */
export function imageUrlFor(key: string | null): string | null {
	if (!key) return null
	return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
}
