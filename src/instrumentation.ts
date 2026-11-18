/**
 * Хук Next 16 (docs/01-app/03-api-reference/03-file-conventions/instrumentation.md):
 * register() вызывается один раз при старте сервер-инстанса — dev и standalone-prod,
 * до готовности принимать запросы. Стартует фоновые циклы этапа 10 (аутбокс-флушер,
 * автоджоба статусов); env-схема парсится транзитивно через их импорт-граф
 * (flusher → db → env) — fail-fast до старта любых циклов.
 * Гварды:
 * - NEXT_RUNTIME=nodejs: register компилируется и для Edge-бандла — без него
 *   Turbopack затягивает туда цепочку auto-status → env/logger (node:stream в
 *   Edge запрещён, этап 11). Статические импорты node-only модулей сюда НЕ
 *   добавлять — только динамические внутри Node-ветки (IS_BUILD-импорт
 *   тянул env.ts в Edge и сыпал «Ecmascript file had an error»);
 * - NEXT_PHASE=phase-production-build: register может вызваться на `next build`
 *   (пререндер) — живой БД при сборке нет (§5.3), циклы не стартуют
 *   (литерал, не IS_BUILD из env — см. выше про статические импорты);
 * - globalThis: страховка от повторного register (HMR/перезагрузка модуля).
 * Вызовы интервалов не блокируют старт: register завершается после старта таймеров.
 */
export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME !== 'nodejs') return
	if (process.env.NEXT_PHASE === 'phase-production-build') return

	const g = globalThis as { __foodBackgroundStarted?: boolean }
	if (g.__foodBackgroundStarted) return
	g.__foodBackgroundStarted = true

	// Force-trace (этап 11, Q11): scripts/migrate.mjs зовёт drizzle-мигратор из
	// standalone-runner'а, но file-tracing не видит динамический импорт из .mjs —
	// без этой строки «Cannot find module drizzle-orm/postgres-js/migrator» при
	// старте контейнера. Литеральный import анализируется @vercel/nft.
	await import('drizzle-orm/postgres-js/migrator')

	const { startFlusher } = await import('@/lib/notifications/flusher')
	const { startAutoStatusJob } = await import('@/lib/jobs/auto-status')
	startFlusher()
	startAutoStatusJob()
}
