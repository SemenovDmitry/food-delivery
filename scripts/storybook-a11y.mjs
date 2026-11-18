// Axe-аудит сторей Storybook в обеих темах (этап 13, тикет 04) — продолжение
// WCAG-линии §7; прецедент запуска Chrome — .scratch/stage-7/lighthouse/run.mjs.
//   node scripts/storybook-a11y.mjs
// Сначала билдит стори-фреймворк, раздаёт storybook-static локальным http,
// прогоняет axe-core (node_modules) на каждой стори в light/dark, снимает
// скриншоты характерных сторей в .scratch/stage-13/screenshots/.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import puppeteer from 'puppeteer-core'

const PORT = 6262
const BASE = `http://localhost:${PORT}`
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const THEMES = ['light', 'dark']
// Скриншоты характерных сторей (id из index.json) в обеих темах
const SHOTS = [
	'shop-statusbadge--cancelled-by-customer',
	'shop-counter--at-max',
	'shop-productcard--set-with-components',
	'shop-promoblock--custom-code-plate',
	'shop-checkoutform--empty-guest-form',
	'shop-ordertracker--unpaid-online',
]

const sbBuild = spawnSync('pnpm', ['exec', 'storybook', 'build'], { stdio: 'inherit', shell: true })
if (sbBuild.status !== 0) process.exit(sbBuild.status ?? 1)

const index = JSON.parse(readFileSync('storybook-static/index.json', 'utf8'))
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const storyIds = Object.values(index.entries)
	.filter((e) => e.type === 'story')
	.map((e) => e.id)
	.filter((id) => (only ? id.includes(only) : true))
console.log(
	`[a11y] сторей: ${storyIds.length} × тем ${THEMES.length} = ${storyIds.length * THEMES.length} прогонов`,
)

const MIME = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
}
const server = createServer((req, res) => {
	const path = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]
	try {
		const body = readFileSync(`storybook-static${path}`)
		res.writeHead(200, {
			'content-type': MIME[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream',
		})
		res.end(body)
	} catch {
		res.writeHead(404)
		res.end('not found')
	}
})
await new Promise((resolve) => server.listen(PORT, resolve))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
page.on('pageerror', (err) => console.log(`  [pageerror] ${String(err).slice(0, 300)}`))
page.on('console', (msg) => {
	if (msg.type() === 'error' || msg.type() === 'warning') {
		console.log(`  [console.${msg.type()}] ${msg.text().slice(0, 250)}`)
	}
})

mkdirSync('.scratch/stage-13/screenshots', { recursive: true })
const report = []
const failed = []
let screenshots = 0

for (const theme of THEMES) {
	for (const id of storyIds) {
		try {
			await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`, {
				waitUntil: 'networkidle0',
				timeout: 30_000,
			})
			await page.waitForSelector('#storybook-root > *', { timeout: 15_000 })
			await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
			const violations = await page.evaluate(async () => {
				const result = await window.axe.run(document, {
					runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
				})
				return result.violations.map((v) => ({
					id: v.id,
					impact: v.impact,
					nodes: v.nodes.length,
					hint: v.help,
					html: v.nodes[0]?.html?.slice(0, 160) ?? '',
				}))
			})
			report.push({ id, theme, violations })
			if (SHOTS.includes(id)) {
				await page.screenshot({
					path: `.scratch/stage-13/screenshots/${id}-${theme}.png`,
					fullPage: true,
				})
				screenshots++
			}
		} catch (err) {
			console.log(`  [fail] ${id} (${theme}): ${String(err).slice(0, 120)}`)
			failed.push({ id, theme, error: String(err).slice(0, 300) })
		}
	}
}

await browser.close()
server.close()

const flagged = report.filter((r) => r.violations.length > 0)
console.log(
	`\n[a11y] прогонов: ${report.length}, с нарушениями: ${flagged.length}, упало: ${failed.length}, скриншотов: ${screenshots}`,
)
for (const r of flagged) {
	for (const v of r.violations) {
		console.log(`  [${v.impact}] ${r.id} (${r.theme}): ${v.id} ×${v.nodes} — ${v.hint}`)
		if (v.html) console.log(`        node: ${v.html}`)
	}
}
writeFileSync('.scratch/stage-13/a11y-report.json', JSON.stringify(report, null, '\t'))
console.log('[a11y] отчёт — .scratch/stage-13/a11y-report.json')
