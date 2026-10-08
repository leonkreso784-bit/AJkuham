// Isti niz AI poziva protiv dva lokalna servera (npr. Claude na 3011, Gemini na 3012).
// node scripts/compare-providers.mjs http://localhost:3011 http://localhost:3012
// Ispisuje vrijeme, status i uzorak odgovora po koraku; fallback se vidi u logu servera.
import { readFileSync } from 'node:fs'

const targets = process.argv.slice(2)
if (!targets.length) { console.error('daj barem jedan baseUrl'); process.exit(1) }

const profile = { mealsPerDay: 3, householdSize: 2, cookingStyle: 'meal_prep', minutesPerMeal: 30, diet: 'sve', diets: ['sve'], allergies: ['orasi'], cuisines: ['domaca', 'mediteranska'], adventurousness: 3, budgetLevel: 'srednje', budgetPerWeekEur: 70 }
const pantry = [{ name: 'špinat', quantity: 150, unit: 'g', expiresInDays: 1 }, { name: 'jaja', quantity: 6, unit: 'kom', expiresInDays: 10 }, { name: 'mrkva', quantity: 500, unit: 'g', expiresInDays: 5 }]
// Plan s 3 statična obroka iz fallbacka (planner.ts fallbackMealFor) = model je pao.
const STATIC = ['kajgana', 'zobena kaša', 'voćna salata', 'varivo od graha', 'tjestenina s umakom', 'pečeno povrće']

async function run(base) {
  const steps = []
  const call = async (name, method, path, { body, session } = {}) => {
    const h = {}
    if (session) h['x-session-id'] = session
    let payload = body
    if (body && !(body instanceof FormData)) { payload = JSON.stringify(body); h['content-type'] = 'application/json' }
    const t = Date.now()
    const res = await fetch(base + path, { method, headers: h, body: payload }).catch((e) => ({ status: 0, text: async () => String(e) }))
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    const step = { name, status: res.status, s: ((Date.now() - t) / 1000).toFixed(1), json }
    steps.push(step)
    return step
  }

  const s = (await call('session', 'POST', '/api/session')).json.sessionId
  await call('profile', 'PUT', '/api/profile', { session: s, body: profile })

  const q = await call('pitanja', 'POST', '/api/questions', { session: s })
  q.sample = (q.json?.questions ?? []).map((x) => x.text ?? x.question).join(' | ')

  const fd = new FormData()
  fd.append('image', new Blob([readFileSync(new URL('../web/public/food/povrce.jpg', import.meta.url))], { type: 'image/jpeg' }), 'povrce.jpg')
  const v = await call('vision', 'POST', '/api/fridge/scan', { session: s, body: fd })
  v.sample = (v.json?.items ?? []).map((i) => `${i.name} ${i.quantity ?? ''}${i.unit ?? ''}`).join(', ')

  await call('pantry', 'PUT', '/api/pantry', { session: s, body: { items: pantry } })

  const c = await call('kandidati', 'POST', '/api/taste/candidates', { session: s, body: {} })
  const cands = c.json?.cards ?? []
  c.sample = `${cands.length} kom: ` + cands.slice(0, 6).map((m) => m.title).join(', ')

  const g = await call('plan', 'POST', '/api/plan/generate', { session: s, body: {} })
  const plan = g.json?.plan ?? g.json
  const meals = (plan?.days ?? []).flatMap((d) => d.meals)
  const titles = meals.map((m) => m.title)
  const stat = titles.filter((t) => STATIC.some((x) => t.toLowerCase().includes(x))).length
  g.sample = `${meals.length} obroka, ${new Set(titles).size} različitih, ~${stat} statičnih, prep blokova ${plan?.prepBlocks?.length ?? '?'}; ` + titles.slice(0, 7).join(', ')
  const planId = g.json?.planId ?? plan?.id

  if (planId) {
    const cart = await call('košarica', 'GET', `/api/plan/${planId}/cart`, { session: s })
    cart.sample = `${cart.json?.totalEur} EUR, ${cart.json?.items?.length ?? '?'} stavki, nematchano ${cart.json?.unmatched?.length ?? '?'}`
  }
  if (meals[1]) {
    const w = await call('swap', 'POST', `/api/meal/${meals[1].id}/swap`, { session: s, body: { reason: 'ne jede mi se to danas' } })
    w.sample = `${meals[1].title} -> ${w.json?.title ?? w.json?.meal?.title}${w.json?.swapFailed ? ' (swapFailed!)' : ''}`
  }
  return steps
}

const all = await Promise.all(targets.map(run))
for (let i = 0; i < targets.length; i++) {
  console.log(`\n===== ${targets[i]} =====`)
  for (const st of all[i]) {
    if (['session', 'profile', 'pantry'].includes(st.name)) continue
    console.log(`${st.name.padEnd(10)} ${String(st.status).padEnd(4)} ${st.s.padStart(6)} s  ${st.sample ?? (st.status >= 400 ? JSON.stringify(st.json?.error ?? st.json) : '')}`)
  }
}
