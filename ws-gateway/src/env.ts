import { z } from 'zod'

/**
 * Env шлюза — zod fail-fast (Q12): кривые переменные роняют процесс на старте,
 * а не на первом WS-соединении. `NEXT_PUBLIC_WS_URL` — клиентская переменная
 * Next (печётся на build, §5.32-г); шлюз её не читает.
 */
const envSchema = z.object({
	/** Фолбэк — dev-компоуз на :5560 (§5.20), как в db/index.ts (Q7) */
	DATABASE_URL: z
		.string()
		.min(1)
		.default('postgresql://postgres:postgres@localhost:5560/food_delivery'),
	/** Куда шлюз ходит за get-session и релеем записей (prod: http://app:3000) */
	NEXT_INTERNAL_URL: z.string().min(1).default('http://localhost:3000'),
	PORT: z.coerce.number().int().min(1).max(65535).default(3001),
	INTERNAL_API_SECRET: z.string().min(1),
	/** Origin'ы браузера через запятую (prod: http://localhost:3000 или домен за TLS) */
	WS_ALLOWED_ORIGINS: z.string().min(1).default('http://localhost:3000'),
	/** Уровень структурных логов pino (этап 11, Q9); дефолт info — как в app */
	LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
	console.error(
		'[ws-gateway] env invalid:',
		parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
	)
	process.exit(1)
}

export const env = parsed.data
