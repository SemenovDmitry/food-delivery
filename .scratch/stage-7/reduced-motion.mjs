// Этап 7, часть E: prefers-reduced-motion — скролл-поведение и анимации модалки.
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = 'http://localhost:3000/?product=22e6656b-6e77-4df4-b143-9b3d08dfb273'

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
async function probe(reduce) {
	const page = await browser.newPage()
	if (reduce) {
		await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
	} else {
		await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
	}
	await page.setViewport({ width: 1280, height: 800 })
	await page.goto(URL, { waitUntil: 'domcontentloaded' })
	await page.waitForSelector('[role="dialog"]', { timeout: 15000 })
	const state = await page.evaluate(() => {
		const dialog = document.querySelector('[role="dialog"]')
		const anims = dialog
			? dialog.getAnimations({ subtree: true }).map((a) => ({
					name: a.animationName ?? a.transitionProperty,
					duration: a.effect?.getTiming().duration ?? 0,
					state: a.playState,
				}))
			: []
		return {
			scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
			dialogOpen: !!dialog,
			animations: anims,
		}
	})
	await page.screenshot({
		path: `E:/repositories/food-delivery/.scratch/stage-7/screenshots/e_reduced_motion_${reduce ? 'reduce' : 'no_pref'}.png`,
	})
	await page.close()
	return state
}
const withMotion = await probe(false)
const withReduce = await probe(true)
console.log('no-preference:', JSON.stringify(withMotion, null, 1))
console.log('reduce:        ', JSON.stringify(withReduce, null, 1))
console.log(
	withReduce.scrollBehavior === 'auto'
		? 'РЕЗУЛЬТАТ: PASS — при reduce скролл мгновенный (auto), smooth отключён'
		: 'РЕЗУЛЬТАТ: FAIL — smooth активен при reduce',
)
await browser.close()
