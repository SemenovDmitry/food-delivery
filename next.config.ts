import type { NextConfig } from 'next'

/**
 * Картинки MinIO (этап 5, Q7/Q8): браузер MinIO не фетчит — только /_next/image
 * (оптимизатор на сервере), поэтому remotePatterns описывает хост из S3_ENDPOINT
 * (в dev localhost:9000, в prod minio:9000 — env читается при загрузке конфига).
 * minimumCacheTTL: кеш оптимизатора/браузера — объекты кладутся с immutable
 * (хэш-ключ), длинный TTL безопасен.
 */
// next.config печётся на build (§5.3): в Dockerfile задан S3_ENDPOINT_BUILD_FALLBACK
// (prod-хост compose), в dev/рантайме берётся настоящий S3_ENDPOINT
const s3Endpoint =
	process.env.S3_ENDPOINT ?? process.env.S3_ENDPOINT_BUILD_FALLBACK ?? 'http://localhost:9000'
const s3Hostname = new URL(s3Endpoint).hostname

const nextConfig: NextConfig = {
	cacheComponents: true,
	partialPrefetching: true,
	reactCompiler: true,
	output: 'standalone',
	images: {
		remotePatterns: [
			{ protocol: s3Endpoint.startsWith('https') ? 'https' : 'http', hostname: s3Hostname },
		],
		minimumCacheTTL: 60 * 60 * 24 * 30, // 30 дней
		// Next 16 режет оптимизацию приватных IP (SSRF-гард): наш MinIO — всегда
		// приватный (localhost в dev, docker-сеть в prod). URL приходит не от
		// пользователя, а из нашего env — риск SSRF неприменим.
		dangerouslyAllowLocalIP: true,
	},
	turbopack: {
		rules: {
			'*.css': {
				loaders: ['@tailwindcss/turbopack'],
				as: '*.css',
			},
		},
	},
}

export default nextConfig
