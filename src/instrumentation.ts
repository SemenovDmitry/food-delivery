/**
 * Хук Next 16 (docs/01-app/03-api-reference/03-file-conventions/instrumentation.md):
 * register() вызывается один раз при старте сервер-инстанса — dev и standalone-prod,
 * до готовности принимать запросы. Стартует фоновые циклы этапа 10 (аутбокс-флушер,
 * автоджоба статусов). Гварды:
 * - NEXT_PHASE=phase-production-build: register может вызваться на `next build`
 *   (пререндер) — живой БД при сборке нет (§5.3), циклы не стартуют;
 * - globalThis: страховка от повторного register (HMR/перезагрузка модуля).
 * Вызовы интервалов не блокируют старт: register завершается после старта таймеров.
 */
export async function register(): Promise<void> {
	if (process.env.NEXT_PHASE === 'phase-production-build') return

	const g = globalThis as { __foodBackgroundStarted?: boolean }
	if (g.__foodBackgroundStarted) return
	g.__foodBackgroundStarted = true

	const { startFlusher } = await import('@/lib/notifications/flusher')
	const { startAutoStatusJob } = await import('@/lib/jobs/auto-status')
	startFlusher()
	startAutoStatusJob()
}
