// KuhAI frontend happy path protiv produkcijskog backenda, headless Chromium.
// Pokretanje: node scripts/e2e.mjs <app-url> <fridge.jpg> <out-dir>
//   app-url: staticki build (cd web; VITE_API_URL=... npx vite build; npx vite preview --port 4174)
//   fridge.jpg: bilo koja fotka otvorenog frizidera (npr. Wikimedia Inside_of_double_sided_refrigerator.jpg)
// Playwright se uzima iz KuhAI/video/node_modules (tamo je instaliran s Chromiumom).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire('C:/Users/leonk/Documents/KuhAI/video/package.json')
const { chromium } = require('playwright')

const [APP = 'http://localhost:5174', PHOTO, OUT = '.'] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })

const t0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

// Svaki API poziv: metoda, ruta, status, trajanje
const started = new Map()
page.on('request', (r) => { if (r.url().includes('/api/')) started.set(r, Date.now()) })
page.on('response', async (res) => {
  const r = res.request()
  if (!r.url().includes('/api/')) return
  const ms = Date.now() - (started.get(r) ?? Date.now())
  const path = new URL(r.url()).pathname
  let note = ''
  if (!res.ok()) { try { note = ' ' + (await res.text()).slice(0, 200) } catch {} }
  log(`API ${r.method()} ${path} -> ${res.status()} (${ms} ms)${note}`)
})
page.on('requestfailed', (r) => { if (r.url().includes('/api/')) log(`API FAILED ${r.method()} ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`) })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log(`console.${m.type()}: ${m.text().slice(0, 300)}`) })
page.on('pageerror', (e) => log('PAGE ERROR:', e.message))

const fallbackBadge = async (where) => {
  const n = await page.getByText('Demo podaci', { exact: true }).count()
  const m = await page.getByText('Demo način', { exact: true }).count()
  if (n || m) log(`!!! ${where}: vidljiva oznaka ${n ? 'Demo podaci (fallback na mock)' : 'Demo način (nema VITE_API_URL)'}`)
}

try {
  // 1. Landing
  await page.goto(APP)
  await page.evaluate(() => localStorage.clear())
  await page.goto(APP)
  await shot(page, '01-landing')
  await page.getByRole('button', { name: 'Kreni kuhati' }).click()

  // 2. Onboarding (8 tapova)
  await page.getByRole('button', { name: /^3\s/ }).first().click()          // 3 obroka
  await page.getByRole('button', { name: '2', exact: true }).click()          // 2 osobe
  await page.getByRole('button', { name: /Meal prep/ }).click()
  await page.getByRole('button', { name: '30 min' }).click()
  await page.getByRole('button', { name: 'Jedem sve' }).click()
  await page.getByRole('button', { name: 'Nemam alergija' }).click()
  await page.getByRole('button', { name: 'Domaća' }).click()
  await page.getByRole('button', { name: 'Talijanska' }).click()
  await page.getByRole('button', { name: 'Dalje' }).click()
  await shot(page, '02-onboarding-budget')
  await page.getByRole('button', { name: 'To je to' }).click()
  log('profil poslan, cekam AI pitanja')

  // 3. AI pitanja: cekaj da se pojavi prvo pitanje (Preskoči) ili odmah summary
  await page.getByRole('button', { name: /Preskoči|Slikaj frižider/ }).first().waitFor({ timeout: 45_000 })
  await fallbackBadge('nakon pitanja')
  let qCount = 0
  while (await page.getByRole('button', { name: 'Preskoči' }).count()) {
    if (qCount === 0) await shot(page, '03-ai-question')
    const q = await page.locator('main').innerText().then((t) => t.split('\n').filter(Boolean).at(-3))
    log(`pitanje ${++qCount}: ${q?.slice(0, 90)}`)
    await page.getByRole('button', { name: 'Preskoči' }).click()
    await page.waitForTimeout(300)
    if (qCount > 8) break
  }
  log(`AI pitanja: ${qCount}`)
  await shot(page, '04-summary')
  await page.getByRole('button', { name: 'Slikaj frižider' }).click()
  await page.waitForURL(/\/frizider/, { timeout: 20_000 })

  // 4. Frižider: fotka -> vision
  await shot(page, '05-fridge-pick')
  if (PHOTO) {
    await page.locator('input[type=file]').setInputFiles(PHOTO)
    log('fotka poslana, cekam vision')
    await page.getByRole('button', { name: 'Složi mi tjedan' }).waitFor({ timeout: 60_000 })
    await fallbackBadge('nakon scana')
    const txt = await page.locator('main').innerText()
    const dying = (txt.match(/Treba potrošiti odmah/) ? 'da' : 'ne')
    log(`vision gotov; grupa "Treba potrošiti odmah" prisutna: ${dying}`)
    await shot(page, '06-fridge-review')
    await page.getByRole('button', { name: 'Složi mi tjedan' }).click()
  } else {
    await page.getByRole('button', { name: /Preskoči, kreni od nule/ }).click()
  }
  await page.waitForURL(/\/plan/, { timeout: 20_000 })

  // 5. Plan generate (60-90 s)
  log('plan/generate krenuo')
  await shot(page, '07-plan-generating')
  await page.getByRole('button', { name: 'Pogledaj košaricu' }).waitFor({ timeout: 170_000 })
  await fallbackBadge('nakon plana')
  const planTxt = await page.locator('main').innerText()
  log('plan stigao; prvi redci:\n   ' + planTxt.split('\n').filter(Boolean).slice(0, 8).join('\n   '))
  await shot(page, '08-plan')

  // 6. Shake
  await page.getByRole('button', { name: /Protresi/ }).click()
  log('shake krenuo')
  await page.waitForResponse((r) => r.url().includes('/shake'), { timeout: 60_000 })
  await page.waitForTimeout(800)
  await fallbackBadge('nakon shakea')
  await shot(page, '09-plan-after-shake')

  // 7. Detalj obroka + swap
  await page.locator('a[href^="/obrok/"]').first().click()
  await page.waitForURL(/\/obrok\//, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Ne jede mi se ovo' }).waitFor({ timeout: 30_000 })
  await shot(page, '10-meal')
  await page.getByRole('button', { name: 'Ne jede mi se ovo' }).click()
  await page.getByRole('button', { name: 'Samo mi daj nešto drugo' }).click()
  log('swap krenuo')
  await page.waitForResponse((r) => r.url().includes('/swap'), { timeout: 60_000 })
  await page.waitForTimeout(800)
  await fallbackBadge('nakon swapa')
  await shot(page, '11-meal-after-swap')

  // 8. Košarica
  await page.goto(APP + '/kosarica')
  await page.getByText('Pretpostavka:').waitFor({ timeout: 30_000 })
  await fallbackBadge('u kosarici')
  const cartTxt = await page.locator('main').innerText()
  log('kosarica:\n   ' + cartTxt.split('\n').filter(Boolean).slice(0, 14).join('\n   '))
  await shot(page, '12-cart')

  log('HAPPY PATH GOTOV')
} catch (e) {
  log('PUKLO:', e.message.split('\n')[0])
  await shot(page, '99-error').catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
