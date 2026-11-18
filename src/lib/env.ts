import { z } from 'zod'

/**
 * Env-схема (этап 11, Q1–Q3, GLOSSARY «Env-схема») — единственный серверный
 * источник переменных окружения. Два режима:
 * - **lenient** — build (`NEXT_PHASE=phase-production-build`) и dev: обязательные
 *   в проде поля получают фолбэки (текущие цепочки сохранены:
 *   `AUTH_SECRET_BUILD_FALLBACK`, dev-БД :5560, §5.20) — `next build` импортирует
 *   серверные модули без секретов, strict уронил бы сборку (§5.3, урок этапа 6);
 * - **strict** — рантайм контейнера (`NODE_ENV=production`, NEXT_PHASE не задан):
 *   любая ошибка схемы → читаемый список проблем → `process.exit(1)` на старте
 *   («готово-когда»: env с опечаткой роняет контейнер). Старт = загрузка
 *   instrumentation.ts (этап 10) — её статический импорт-граф (db → env) парсит
 *   env до старта любых фоновых циклов.
 *
 * Конвенции:
 * - НЕ импортировать из клиентских файлов: `NEXT_PUBLIC_*` инлайнятся в бандл на
 *   build (§5.32-г) — клиент читает `process.env` напрямую (support-chat.tsx,
 *   chat-console.tsx);
 * - `server-only`-маркера НЕТ: модуль импортируется seed'ом через tsx (прецедент
 *   s3.ts);
 * - coercion с ЖЁСТКИМИ границами: `DEMO_AUTO_STATUS_INTERVAL=3000` — не
 *   молчаливый кламп, а падение с читаемой ошибкой (Q3);
 * - пустая строка = «не задано» для опциональных полей (`SMTP_HOST=''` →
 *   консоль-фолбэк, шов этапа 10);
 * - `DEMO_AUTO_STATUS` дефолт **false** (unset → off): prod-compose флаг не
 *   задаёт — продвижение в prod выключено (решение этапа 10), .env.example
 *   держит `true` для dev.
 */

/** Пустая строка и отсутствие ключа = «не задано» (для optional/default полей) */
const emptyToUndefined = (value: unknown) => (value === '' || value == null ? undefined : value)

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

const envSchema = z.object({
	// ── prod-required: strict без дефолтов; в lenient подставляются фолбэки ──
	DATABASE_URL: z.string().min(1),
	AUTH_SECRET: z.string().min(1),
	INTERNAL_API_SECRET: z.string().min(1),
	PAYMENTS_WEBHOOK_SECRET: z.string().min(1),
	S3_ENDPOINT: z.url(),
	S3_KEY: z.string().min(1),
	S3_SECRET: z.string().min(1),
	S3_BUCKET: z.string().min(1),
	BETTER_AUTH_URL: z.url(),

	// ── опциональные с дефолтами (dev и prod) ──
	/** Пусто → undefined → консоль-фолбэк sendEmail (шов этапа 10) */
	SMTP_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
	SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
	DEMO_SMS_OTP_CODE: z.preprocess(emptyToUndefined, z.string().min(1).default('1111')),
	DEMO_AUTO_STATUS: z
		.preprocess(emptyToUndefined, z.enum(['true', 'false', '1', '0']).default('false'))
		.transform((value) => value === 'true' || value === '1'),
	/** Жёсткий минимум 5000 (был молчаливый кламп — Q3): меньше = падение на старте */
	DEMO_AUTO_STATUS_INTERVAL: z.preprocess(
		emptyToUndefined,
		z.coerce.number().int().min(5000).default(60_000),
	),
	DEMO_AUTO_CANCEL_RATE: z.preprocess(
		emptyToUndefined,
		z.coerce.number().min(0).max(1).default(0.1),
	),
	/** Неизвестное значение ловит фабрика провайдера ВНУТРИ вызова (урок этапа 6) */
	PAYMENT_PROVIDER: z.preprocess(emptyToUndefined, z.string().min(1).default('mock')),
	/** Окно оплаты 1..60 минут (было без верхней границы — Q3) */
	PAYMENT_WINDOW_MINUTES: z.preprocess(
		emptyToUndefined,
		z.coerce.number().int().min(1).max(60).default(5),
	),
	LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
})

/**
 * Фолбэки lenient-режима: только поля prod-required, ровно текущие значения
 * dev-фолбэков читателей (до миграции на env). AUTH_SECRET собирает прежнюю
 * цепочку `AUTH_SECRET ?? AUTH_SECRET_BUILD_FALLBACK` (better-auth валидирует
 * секрет при инициализации модуля; длина ≥ 32 — его требование).
 */
const LENIENT_FALLBACKS: Record<string, string> = {
	DATABASE_URL: 'postgresql://postgres:postgres@localhost:5560/food_delivery', // §5.20
	AUTH_SECRET: process.env.AUTH_SECRET_BUILD_FALLBACK ?? 'dev-insecure-secret-0123456789abcdef',
	INTERNAL_API_SECRET: 'dev-insecure-secret-0123456789abcdef',
	PAYMENTS_WEBHOOK_SECRET: 'dev-insecure-secret-0123456789abcdef',
	// Цепочка прежнего s3.ts: build-фолбэк на prod-хост compose (§5.32-б), затем dev
	S3_ENDPOINT: process.env.S3_ENDPOINT_BUILD_FALLBACK ?? 'http://localhost:9000',
	S3_KEY: 'minioadmin',
	S3_SECRET: 'minioadmin',
	S3_BUCKET: 'food-delivery',
	BETTER_AUTH_URL: 'http://localhost:3000',
}

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const STRICT = process.env.NODE_ENV === 'production' && !isBuild

/** Build-фаза (docker build/пререндер) — общий флаг; литерал NEXT_PHASE в одном месте */
export const IS_BUILD = isBuild

function parseEnv(): z.infer<typeof envSchema> {
	const input: Record<string, unknown> = { ...process.env }
	if (!STRICT) {
		for (const [key, fallback] of Object.entries(LENIENT_FALLBACKS)) {
			const current = input[key]
			if (current == null || current === '') input[key] = fallback
		}
	}

	const result = envSchema.safeParse(input)
	if (!result.success) {
		const details = result.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ')
		console.error(
			`[env] конфигурация невалидна${STRICT ? ' (strict, prod-runtime)' : ''}: ${details}`,
		)
		process.exit(1)
	}
	return result.data
}

export const env = parseEnv()
