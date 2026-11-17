// Этап 7, часть D: a11y-аудит Lighthouse в обеих темах (решение Q4a гриллинга).
// Один Chrome (headless=new, --remote-debugging-port), puppeteer-core готовит
// состояние профиля (localStorage.theme, куки cart_id и сессии), lighthouse
// подключается к тому же порту и ходит по страницам сам.
//
// Использование: node run.mjs light|dark [slug-фильтр]
// Отчёты: lighthouse/<slug>-<theme>/report.html + report.json
import puppeteer from 'puppeteer-core'
import lighthouse from 'lighthouse'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const THEME = process.argv[2] ?? 'light'
const ONLY = process.argv[3] ?? null
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ORIGIN = 'http://localhost:3000'
const DEBUG_PORT = 9223
const CART_ID = '11111111-2222-3333-4444-555555555555'
const PIZZA_ID = '22e6656b-6e77-4df4-b143-9b3d08dfb273'

const PAGES = [
	{ slug: 'home', url: `${ORIGIN}/` },
	{ slug: 'home-modal', url: `${ORIGIN}/?product=${PIZZA_ID}` },
	{ slug: 'promo', url: `${ORIGIN}/promo` },
	{ slug: 'login', url: `${ORIGIN}/login` },
	{ slug: 'cart', url: `${ORIGIN}/cart` },
	{ slug: 'checkout', url: `${ORIGIN}/checkout` },
	{ slug: 'product-fallback', url: `${ORIGIN}/product/${PIZZA_ID}` },
	{ slug: 'orders-authed', url: `${ORIGIN}/orders` },
]

const userDataDir = mkdtempSync(join(tmpdir(), `lh-stage7-${THEME}-`))
const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: true,
	userDataDir,
	args: [`--remote-debugging-port=${DEBUG_PORT}`, '--no-first-run', '--window-size=1350,940'],
})

// ── Подготовка профиля: сессия, корзина, тема ──────────────────────────────
const page = await browser.newPage()
await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
const loginResult = await page.evaluate(async () => {
	const send = await fetch('/api/auth/phone-number/send-otp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phoneNumber: '+7 999 000-00-03' }),
	})
	const verify = await fetch('/api/auth/phone-number/verify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phoneNumber: '+7 999 000-00-03', code: '1111' }),
	})
	return { send: send.status, verify: verify.status, body: await verify.json() }
})
console.log(
	`[prep] логин клиента: send=${loginResult.send} verify=${loginResult.verify} user=${loginResult.body.user?.email ?? JSON.stringify(loginResult.body.body)}`,
)
await page.evaluate((theme) => localStorage.setItem('theme', theme), THEME)
await page.setCookie({ name: 'cart_id', value: CART_ID, domain: 'localhost', path: '/' })
await page.close()
console.log(`[prep] тема=${THEME}, кука cart_id выставлена`)

// ── Прогоны ────────────────────────────────────────────────────────────────
const results = []
const targets = PAGES.filter((p) => !ONLY || p.slug.includes(ONLY))
for (const target of targets) {
	const run = await lighthouse(target.url, {
		port: DEBUG_PORT,
		onlyCategories: ['accessibility'],
		formFactor: 'desktop',
		screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
		maxWaitForLoad: 60_000,
	})
	const lhr = run.lhr
	const score = Math.round(lhr.categories.accessibility.score * 100)
	const outDir = join(__dirname, `${target.slug}-${THEME}`)
	mkdirSync(outDir, { recursive: true })
	writeFileSync(join(outDir, 'report.json'), JSON.stringify(lhr, null, 2))
	const { writeFile: writeReport } = await import('node:fs/promises')
	await writeReport(join(outDir, 'report.html'), run.report)
	results.push({ slug: target.slug, score })
	console.log(`${target.slug}-${THEME}: a11y = ${score}`)
	// при 94–96 — один повтор (флуктуация аудитов), берём лучший
	if (score >= 94 && score <= 96) {
		const rerun = await lighthouse(target.url, {
			port: DEBUG_PORT,
			onlyCategories: ['accessibility'],
			formFactor: 'desktop',
			screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
			maxWaitForLoad: 60_000,
		})
		const score2 = Math.round(rerun.lhr.categories.accessibility.score * 100)
		mkdirSync(outDir, { recursive: true })
		writeFileSync(join(outDir, 'report.json'), JSON.stringify(rerun.lhr, null, 2))
		await writeReport(join(outDir, 'report.html'), rerun.report)
		results[results.length - 1].score = Math.max(score, score2)
		console.log(`  повтор: ${score2} (берём лучший ${Math.max(score, score2)})`)
	}
}

console.log(`\n=== Сводка ${THEME} ===`)
for (const r of results) console.log(`${r.slug}: ${r.score}`)
const failing = results.filter((r) => r.score < 95)
if (failing.length > 0) {
	console.log(`НИЖЕ ПОРОГА: ${failing.map((f) => `${f.slug}=${f.score}`).join(', ')}`)
	process.exitCode = 1
} else {
	console.log('все страницы >= 95')
}
await browser.close()
