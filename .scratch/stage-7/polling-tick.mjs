// Этап 7, часть D: живой тик OrderTracker в headful Chrome (IAB всегда document.hidden=true —
// тик по дизайну пропускается, поэтому поллинг-тест делается отдельным браузером).
// Сценарий: открыть трекинг заказа в статусе ready -> SQL-сдвиг в in_delivery ->
// дождаться обновления бейджа <= 30 c без перезагрузки (performance.timeOrigin неизменен).

import { execSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const ORDER_ID = process.argv[2] ?? '68dbbfbd-a01c-4d72-8c53-4d6821842ae3'
const URL = `http://localhost:3000/orders/${ORDER_ID}`
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const sql = (q) =>
	execSync(
		`docker exec food-delivery-postgres-1 psql -U postgres -d food_delivery -t -A -c "${q.replaceAll('"', '\\"')}"`,
		{ encoding: 'utf8' },
	).trim()

const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: false,
	args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,800'],
})
try {
	const page = await browser.newPage()
	await page.setViewport({ width: 1280, height: 800 })
	await page.goto(URL, { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => document.querySelector('main')?.textContent.includes('Готов'), {
		timeout: 15000,
	})
	const t0 = await page.evaluate(() => performance.timeOrigin)
	console.log('страница открыта, статус «Готов», timeOrigin =', t0)

	sql(`update orders set status='in_delivery' where id='${ORDER_ID}'`)
	console.log('SQL-сдвиг в in_delivery выполнен, ждём тик поллинга (<=30 c)...')

	const start = Date.now()
	let tickedAt = null
	while (Date.now() - start < 30_000) {
		await new Promise((r) => setTimeout(r, 1000))
		const txt = await page.evaluate(() => document.querySelector('main')?.textContent ?? '')
		if (txt.includes('В доставке')) {
			tickedAt = Date.now() - start
			break
		}
	}
	const t1 = await page.evaluate(() => performance.timeOrigin)
	if (tickedAt === null) {
		console.log('РЕЗУЛЬТАТ: FAIL — за 30 c бейдж не обновился; timeOrigin =', t1)
		process.exitCode = 1
	} else {
		console.log(
			`РЕЗУЛЬТАТ: PASS — «В доставке» появился через ${tickedAt / 1000} c; перезагрузки не было: ${t0 === t1}`,
		)
	}
} finally {
	await browser.close()
}
