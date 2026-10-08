// Backend testovi protiv produkcije. node backend-tests.mjs [baseUrl]
const BASE = process.argv[2] ?? 'https://kuhai-api-production.up.railway.app'
const t0 = Date.now()
const results = []
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`) }

async function call(method, path, { body, session, raw, headers = {} } = {}) {
  const h = { ...headers }
  if (session) h['x-session-id'] = session
  let payload
  if (raw !== undefined) { payload = raw; h['content-type'] = 'application/json' }
  else if (body instanceof FormData) payload = body
  else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] = 'application/json' }
  const t = Date.now()
  try {
    const res = await fetch(BASE + path, { method, headers: h, body: payload })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, ms: Date.now() - t }
  } catch (e) {
    const cause = e.cause?.code ?? e.cause?.message ?? e.message
    console.log(`NET   ${method} ${path} pukao nakon ${((Date.now() - t) / 1000).toFixed(1)} s: ${cause}`)
    return { status: 0, json: null, text: `NETWORK: ${cause}`, ms: Date.now() - t, netError: cause }
  }
}
const newSession = async () => (await call('POST', '/api/session')).json.sessionId

const strip = (s) => s.toLowerCase().replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')

// ---------- A. greske i validacija ----------
async function errorTests() {
  const r1 = await call('PUT', '/api/profile', { body: {} })
  ok('A1 bez x-session-id -> 400 VALIDATION_ERROR', r1.status === 400 && r1.json?.error?.code === 'VALIDATION_ERROR', r1.json?.error?.message)
  const r2 = await call('GET', '/api/pantry', { session: 'ses_nepostoji' })
  ok('A2 nepostojeca sesija -> 404 NOT_FOUND', r2.status === 404 && r2.json?.error?.code === 'NOT_FOUND')
  const s = await newSession()
  ok('A3 POST /api/session vraca ses_ id', /^ses_/.test(s), s)
  const r3 = await call('PUT', '/api/profile', { session: s, raw: '{ nije json' })
  ok('A4 neispravan JSON -> 400 s porukom', r3.status === 400 && /JSON/i.test(r3.json?.error?.message ?? ''), r3.json?.error?.message)
  const base = { mealsPerDay: 3, householdSize: 1, cookingStyle: 'svaki_dan', minutesPerMeal: 30, diet: 'bez_laktoze', allergies: [], cuisines: [], adventurousness: 3, budgetLevel: 'srednje' }
  const d1 = await call('PUT', '/api/profile', { session: s, body: { ...base, diets: ['bez_laktoze', 'bez_glutena'], dietNote: 'ne jedem ribu' } })
  ok('A5b profil s vise dijeta + dietNote (API.md §2 dodatak) -> 200', d1.status === 200 && d1.json?.ok === true, `${d1.status}`)
  const d2 = await call('PUT', '/api/profile', { session: s, body: { ...base, diets: ['keto'] } })
  ok('A6b nepoznata dijeta u diets -> 400', d2.status === 400 && d2.json?.error?.code === 'VALIDATION_ERROR', d2.json?.error?.message)
  const r4 = await call('PUT', '/api/profile', { session: s, body: { mealsPerDay: 7, householdSize: 2, cookingStyle: 'meal_prep', minutesPerMeal: 30, diet: 'sve', allergies: [], cuisines: [], adventurousness: 3, budgetLevel: 'srednje' } })
  ok('A5 mealsPerDay=7 -> 400 i poruka imenuje polje', r4.status === 400 && /mealsPerDay/.test(r4.json?.error?.message ?? ''), r4.json?.error?.message)
  const r5 = await call('GET', '/api/nema/ove/rute', { session: s })
  ok('A6 nepoznata ruta -> 404 u API obliku', r5.status === 404 && r5.json?.error?.code === 'NOT_FOUND')
  const r6 = await call('GET', '/api/plan/pl_nepostoji', { session: s })
  ok('A7 nepostojeci plan -> 404', r6.status === 404)
  const r7 = await call('GET', '/api/meal/m_nepostoji', { session: s })
  ok('A8 nepostojeci obrok -> 404', r7.status === 404)
  const r8 = await call('POST', '/api/fridge/scan', { session: s, body: { image: 'x' } })
  ok('A9 scan bez multiparta -> 400', r8.status === 400, r8.json?.error?.message)
  const fd = new FormData(); fd.append('image', new Blob(['nije slika'], { type: 'text/plain' }), 'a.txt')
  const r9 = await call('POST', '/api/fridge/scan', { session: s, body: fd })
  ok('A10 scan s tekstualnom datotekom -> 400, ne 500', r9.status === 400, `${r9.status} ${r9.json?.error?.message ?? ''}`)
  const r10 = await call('PUT', '/api/pantry', { session: s, body: { items: [{ name: 'jaja', quantity: 6, unit: 'komada' }] } })
  ok('A11 pantry s unit=komada -> 400', r10.status === 400, r10.json?.error?.message)
  const r11 = await call('OPTIONS', '/api/profile', { headers: { Origin: 'https://kuhai.example', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'x-session-id,content-type' } })
  ok('A12 CORS preflight prolazi', r11.status < 300, `status ${r11.status}`)
  // pantry bez profila: planer ne smije pasti na defaultima — provjerava se u C
  return s
}

// ---------- B. rubni profil + invarijante plana ----------
function checkPlan(tag, plan, profile, pantry) {
  const meals = plan.days.flatMap((d) => d.meals)
  ok(`${tag} 7 dana`, plan.days.length === 7)
  ok(`${tag} ${profile.mealsPerDay} obroka svaki dan`, plan.days.every((d) => d.meals.length === profile.mealsPerDay), plan.days.map((d) => d.meals.length).join(','))
  ok(`${tag} weekStart je ponedjeljak`, new Date(plan.weekStart + 'T00:00:00Z').getUTCDay() === 1, plan.weekStart)
  ok(`${tag} svaki obrok ima why`, meals.every((m) => typeof m.why === 'string' && m.why.trim().length > 10))
  ok(`${tag} jedinstveni id obroka`, new Set(meals.map((m) => m.id)).size === meals.length)
  const slots = new Set(['dorucak', 'rucak', 'vecera', 'snack1', 'snack2'])
  ok(`${tag} slotovi valjani i bez duplikata u danu`, plan.days.every((d) => d.meals.every((m) => slots.has(m.slot)) && new Set(d.meals.map((m) => m.slot)).size === d.meals.length))
  ok(`${tag} prepBlockId pokazuje na postojeci blok`, meals.every((m) => m.prepBlockId === null || plan.prepBlocks.some((b) => b.id === m.prepBlockId)))
  ok(`${tag} iz_prepa obroci imaju prepBlockId`, meals.filter((m) => m.source === 'iz_prepa').every((m) => m.prepBlockId !== null))
  for (const b of plan.prepBlocks) {
    const ti = b.timeline.filter((t) => t.track === 'ti').reduce((a, t) => a + t.durationMinutes, 0)
    const maxEnd = Math.max(...b.timeline.map((t) => t.startMinute + t.durationMinutes))
    ok(`${tag} ${b.id} timeline: ti ${ti} < ${b.minutes} min, kraj ${maxEnd} <= ${b.minutes}`, ti < b.minutes && maxEnd <= b.minutes + 5 && b.timeline.length > 0)
    ok(`${tag} ${b.id} mealIds su obroci iz plana`, b.mealIds.length > 0 && b.mealIds.every((id) => meals.some((m) => m.id === id)), `${b.mealIds.length} obroka`)
  }
  const dying = pantry.filter((p) => p.expiresInDays != null && p.expiresInDays <= 2).map((p) => strip(p.name))
  if (dying.length) {
    const used = new Set(meals.flatMap((m) => m.usesExpiring.map(strip)))
    const covered = dying.filter((d) => [...used].some((u) => u.includes(d) || d.includes(u)))
    ok(`${tag} rescue: ${covered.length}/${dying.length} umirucih namirnica potroseno`, covered.length >= Math.ceil(dying.length * 0.6), `umire: ${dying.join(', ')} | koristi: ${[...used].join(', ')}`)
    ok(`${tag} rescue.savedItems popunjen`, plan.rescue.savedItems.length > 0 && plan.rescue.message.length > 0)
    const firstTwo = plan.days.slice(0, 2).flatMap((d) => d.meals)
    ok(`${tag} umiruce se trosi u pon/uto`, firstTwo.some((m) => m.usesExpiring.length > 0))
  }
  ok(`${tag} estimatedTotalEur > 0`, plan.estimatedTotalEur > 0, `${plan.estimatedTotalEur} €`)
  ok(`${tag} saleDriven.count <= broj obroka`, plan.saleDriven.count <= meals.length, `${plan.saleDriven.count}/${meals.length}`)
}

function checkCart(tag, cart, plan) {
  const mealsCount = plan.days.reduce((a, d) => a + d.meals.length, 0)
  const sum = cart.lines.reduce((a, l) => a + l.lineTotalEur, 0)
  ok(`${tag} totalEur = suma linija`, Math.abs(sum - cart.totalEur) < 0.05, `${sum.toFixed(2)} vs ${cart.totalEur}`)
  ok(`${tag} lineTotal = qty * unitPrice`, cart.lines.every((l) => Math.abs(l.quantity * l.unitPriceEur - l.lineTotalEur) < 0.02))
  ok(`${tag} quantity cijeli broj >= 1`, cart.lines.every((l) => Number.isInteger(l.quantity) && l.quantity >= 1))
  ok(`${tag} perMealEur = total / ${mealsCount}`, Math.abs(cart.totalEur / mealsCount - cart.perMealEur) < 0.02, `${cart.perMealEur}`)
  ok(`${tag} withinBudget konzistentan`, cart.budgetEur == null ? cart.withinBudget === true : cart.withinBudget === cart.totalEur <= cart.budgetEur, `${cart.totalEur} vs ${cart.budgetEur}`)
  ok(`${tag} needed <= qty*packageSize i leftover = razlika`, cart.lines.every((l) => l.neededAmount <= l.quantity * l.packageSize + 0.01 && Math.abs(l.quantity * l.packageSize - l.neededAmount - l.leftoverAmount) < 0.5))
  ok(`${tag} nema vode/leda u kosarici`, !cart.lines.some((l) => /\bvod[aeu]\b|\bled\b/i.test(l.productName)), cart.lines.filter((l) => /vod|led/i.test(l.productName)).map((l) => l.productName).join(','))
  ok(`${tag} onSaleLinesCount tocan`, cart.onSaleLinesCount === cart.lines.filter((l) => l.onSale).length)
  ok(`${tag} deliveryComparison: saved = delivery - total`, Math.abs(cart.deliveryComparison.deliveryEur - cart.totalEur - cart.deliveryComparison.savedEur) < 0.05 && cart.deliveryComparison.assumption.length > 10)
  ok(`${tag} savedFromWasteEur <= savedFromPantryEur`, cart.savedFromWasteEur <= cart.savedFromPantryEur + 0.01, `${cart.savedFromWasteEur} / ${cart.savedFromPantryEur}`)
  ok(`${tag} kosarica nije prazna`, cart.lines.length > 0, `${cart.lines.length} linija, ${cart.unmatched.length} unmatched`)
  ok(`${tag} matchedIngredients popunjen na svakoj liniji`, cart.lines.every((l) => l.matchedIngredients.length > 0))
  const generic = cart.lines.filter((l) => l.matchQuality === 'generic').length
  ok(`${tag} generic match < 40 % linija`, generic / cart.lines.length < 0.4, `${generic}/${cart.lines.length} generic, unmatched: ${cart.unmatched.map((u) => u.name).join(', ')}`)
}

const FORBIDDEN = {
  vegan: ['meso', 'pile', 'svinj', 'june', 'govedi', 'riba', 'tuna', 'losos', 'jaj', 'mlijek', 'sir', 'jogurt', 'maslac', 'vrhnje', 'med', 'slanin', 'kobasic', 'hrenovk', 'sunk'],
  bez_glutena: ['tjesten', 'kruh', 'brasn', 'mrvic', 'tortilj', 'kuskus', 'bulgur', 'njok', 'penne', 'spagete', 'spageti'],
}

async function dietCheck(tag, session, plan, diet, allergies) {
  const meals = plan.days.flatMap((d) => d.meals)
  const details = await Promise.all(meals.map((m) => call('GET', `/api/meal/${m.id}`, { session }).then((r) => r.json)))
  ok(`${tag} GET /api/meal za svih ${meals.length} obroka -> 200`, details.every((d) => d && d.id && Array.isArray(d.steps) && d.steps.length > 0 && d.ingredients.length > 0))
  const bad = []
  for (const d of details) for (const ing of d.ingredients) {
    const n = strip(ing.name)
    for (const f of FORBIDDEN[diet] ?? []) if (n.includes(f)) bad.push(`${d.title}: ${ing.name}`)
    for (const a of allergies) if (n.includes(strip(a))) bad.push(`${d.title}: ${ing.name} (alergija ${a})`)
  }
  ok(`${tag} dijeta ${diet} + alergije ${allergies.join('/')} postovane u sastojcima`, bad.length === 0, bad.slice(0, 4).join(' | '))
  return details
}

async function scenarioVegan() {
  const tag = 'B-vegan'
  const s = await newSession()
  const profile = { mealsPerDay: 2, householdSize: 1, cookingStyle: 'svaki_dan', minutesPerMeal: 15, diet: 'vegan', allergies: ['soja', 'orasi'], cuisines: ['azijska', 'indijska'], adventurousness: 5, budgetLevel: 'strogo', budgetPerWeekEur: 25 }
  await call('PUT', '/api/profile', { session: s, body: profile })
  const pantry = [
    { name: 'špinat', quantity: 200, unit: 'g', expiresInDays: 1 },
    { name: 'banane', quantity: 3, unit: 'kom', expiresInDays: 2 },
    { name: 'tofu', quantity: 300, unit: 'g', expiresInDays: 2 },
    { name: 'riža', quantity: 500, unit: 'g' },
    { name: 'leća', quantity: 400, unit: 'g', expiresInDays: 180 },
  ]
  const rp = await call('PUT', '/api/pantry', { session: s, body: { items: pantry } })
  ok(`${tag} PUT pantry count=5`, rp.json?.count === 5)
  const r = await call('POST', '/api/plan/generate', { session: s, body: {} })
  ok(`${tag} generate 200 (budzet iz profila 25 €) u ${(r.ms / 1000).toFixed(0)} s`, r.status === 200 && r.json?.budgetEur === 25, r.status !== 200 ? r.text.slice(0, 200) : `budgetEur=${r.json.budgetEur}`)
  if (r.status !== 200) return
  const plan = r.json
  checkPlan(tag, plan, profile, pantry)
  await dietCheck(tag, s, plan, 'vegan', profile.allergies)
  const c = await call('GET', `/api/plan/${plan.planId}/cart`, { session: s })
  ok(`${tag} cart 200`, c.status === 200)
  checkCart(tag, c.json, plan)
  // swap s razlogom mora ostati vegan
  const victim = plan.days[3].meals[0]
  const sw = await call('POST', `/api/meal/${victim.id}/swap`, { session: s, body: { reason: 'ne volim tofu' } })
  ok(`${tag} swap 200 u ${(sw.ms / 1000).toFixed(0)} s, novi id, isti slot`, sw.status === 200 && sw.json.id !== victim.id && sw.json.slot === victim.slot && !sw.json.swapFailed, sw.json?.swapFailed ? 'swapFailed' : sw.json?.title)
  const badSwap = sw.json?.ingredients?.filter((i) => FORBIDDEN.vegan.some((f) => strip(i.name).includes(f)) || profile.allergies.some((a) => strip(i.name).includes(strip(a)))) ?? []
  ok(`${tag} swap ostaje vegan bez alergena`, badSwap.length === 0, badSwap.map((i) => i.name).join(','))
  const after = await call('GET', `/api/plan/${plan.planId}`, { session: s })
  ok(`${tag} GET plan nakon swapa pokazuje novi obrok, stari nestao`, after.json.days[3].meals.some((m) => m.id === sw.json.id) && !after.json.days[3].meals.some((m) => m.id === victim.id))
  // izolacija sesija
  const s2 = await newSession()
  const iso = await call('GET', `/api/plan/${plan.planId}`, { session: s2 })
  ok(`${tag} tudja sesija ne vidi plan -> 404`, iso.status === 404)
  const iso2 = await call('GET', `/api/meal/${sw.json.id}`, { session: s2 })
  ok(`${tag} tudja sesija ne vidi obrok -> 404`, iso2.status === 404)
  const iso3 = await call('POST', `/api/plan/${plan.planId}/shake`, { session: s2 })
  ok(`${tag} tudja sesija ne moze shake -> 404`, iso3.status === 404)
}

async function scenarioFamily() {
  const tag = 'C-obitelj'
  const s = await newSession()
  const profile = { mealsPerDay: 5, householdSize: 4, cookingStyle: 'meal_prep', minutesPerMeal: 45, diet: 'bez_glutena', allergies: ['jaja'], cuisines: ['domaca', 'mediteranska'], adventurousness: 1, budgetLevel: 'labavo', budgetPerWeekEur: 120 }
  await call('PUT', '/api/profile', { session: s, body: profile })
  const q = await call('POST', '/api/questions', { session: s })
  ok(`${tag} questions 3-5, tocno jedno text, svi id-evi jedinstveni`, q.status === 200 && q.json.questions.length >= 3 && q.json.questions.length <= 5 && q.json.questions.filter((x) => x.type === 'text').length === 1 && new Set(q.json.questions.map((x) => x.id)).size === q.json.questions.length, q.json?.questions?.map((x) => `${x.id}:${x.type}`).join(' '))
  ok(`${tag} single/multi pitanja imaju >= 2 opcije`, q.json.questions.filter((x) => x.type !== 'text').every((x) => x.options.length >= 2))
  const answers = q.json.questions.map((x) => ({ id: x.id, value: x.type === 'multi' ? x.options.slice(0, 2) : x.type === 'single' ? x.options[0] : 'Jučer sam jeo grah i kobasice, djeca vole tjesteninu ali ne smiju gluten' }))
  const a = await call('POST', '/api/questions/answers', { session: s, body: { answers } })
  ok(`${tag} answers 200`, a.status === 200 && a.json.ok === true)
  // prazan pantry (preskocena fotka)
  const rp = await call('PUT', '/api/pantry', { session: s, body: { items: [] } })
  ok(`${tag} prazan pantry -> count 0`, rp.json?.count === 0)
  const r = await call('POST', '/api/plan/generate', { session: s, body: { budgetEur: 90 } })
  ok(`${tag} generate 200 (body budzet 90 pregazi profil 120) u ${(r.ms / 1000).toFixed(0)} s`, r.status === 200 && r.json?.budgetEur === 90, r.status !== 200 ? r.text.slice(0, 200) : `budgetEur=${r.json.budgetEur}`)
  if (r.status !== 200) return
  const plan = r.json
  checkPlan(tag, plan, profile, [])
  ok(`${tag} rescue prazan kad nema pantryja`, plan.rescue.savedItems.length === 0 && plan.rescue.savedEur === 0, JSON.stringify(plan.rescue).slice(0, 120))
  ok(`${tag} servings ~ 4 osobe`, plan.days.flatMap((d) => d.meals).every((m) => m.servings >= 2 && m.servings <= 8), [...new Set(plan.days.flatMap((d) => d.meals.map((m) => m.servings)))].join(','))
  ok(`${tag} ima snack1 i snack2 slotove`, plan.days.every((d) => d.meals.some((m) => m.slot === 'snack1') && d.meals.some((m) => m.slot === 'snack2')))
  await dietCheck(tag, s, plan, 'bez_glutena', profile.allergies)
  const c = await call('GET', `/api/plan/${plan.planId}/cart`, { session: s })
  checkCart(tag, c.json, plan)
  ok(`${tag} savedFromPantryEur = 0 bez pantryja`, c.json.savedFromPantryEur === 0 && c.json.savedFromWasteEur === 0)
  // shake dvaput zaredom
  const sh1 = await call('POST', `/api/plan/${plan.planId}/shake`, { session: s })
  ok(`${tag} shake 1: 200 u ${(sh1.ms / 1000).toFixed(0)} s, replacedMealId iz plana, meal.id nov`, sh1.status === 200 && plan.days.some((d) => d.meals.some((m) => m.id === sh1.json.replacedMealId)) && sh1.json.meal.id !== sh1.json.replacedMealId && !sh1.json.meal.swapFailed, sh1.json?.meal?.title)
  const sh2 = await call('POST', `/api/plan/${plan.planId}/shake`, { session: s })
  ok(`${tag} shake 2: 200, ne vraca vec obrisani obrok`, sh2.status === 200 && sh2.json.replacedMealId !== sh1.json.replacedMealId && !sh2.json.meal.swapFailed, sh2.json?.meal?.title)
  const badShake = [sh1, sh2].flatMap((x) => x.json?.meal?.ingredients ?? []).filter((i) => FORBIDDEN.bez_glutena.some((f) => strip(i.name).includes(f)) || strip(i.name).includes('jaj'))
  ok(`${tag} shake ostaje bez glutena i bez jaja`, badShake.length === 0, badShake.map((i) => i.name).join(','))
  const after = await call('GET', `/api/plan/${plan.planId}`, { session: s })
  ok(`${tag} i dalje ${profile.mealsPerDay} obroka svaki dan nakon 2 shakea`, after.json.days.every((d) => d.meals.length === profile.mealsPerDay))
  const c2 = await call('GET', `/api/plan/${plan.planId}/cart`, { session: s })
  ok(`${tag} cart nakon shakea i dalje konzistentan`, c2.status === 200 && Math.abs(c2.json.lines.reduce((a, l) => a + l.lineTotalEur, 0) - c2.json.totalEur) < 0.05, `${c.json.totalEur} -> ${c2.json.totalEur}`)
}

// ---------- D. bez profila (frontend preskocio onboarding) ----------
async function scenarioNoProfile() {
  const tag = 'D-bez-profila'
  const s = await newSession()
  const q = await call('POST', '/api/questions', { session: s })
  ok(`${tag} questions bez profila -> 200 (defaulti)`, q.status === 200 && q.json.questions.length >= 3, `${q.status}`)
  const p = await call('GET', '/api/pantry', { session: s })
  ok(`${tag} GET pantry prazan -> items []`, p.status === 200 && Array.isArray(p.json.items) && p.json.items.length === 0)
}

// ---------- E. paralelni generate (dva telefona na demu) ----------
async function scenarioParallel() {
  const tag = 'E-paralelno'
  const mk = async (budget) => {
    const s = await newSession()
    await call('PUT', '/api/profile', { session: s, body: { mealsPerDay: 3, householdSize: 2, cookingStyle: 'meal_prep', minutesPerMeal: 30, diet: 'sve', allergies: [], cuisines: ['domaca'], adventurousness: 3, budgetLevel: 'srednje', budgetPerWeekEur: budget } })
    await call('PUT', '/api/pantry', { session: s, body: { items: [{ name: 'jogurt', quantity: 400, unit: 'g', expiresInDays: 1 }, { name: 'mrkva', quantity: 500, unit: 'g', expiresInDays: 5 }] } })
    const r = await call('POST', '/api/plan/generate', { session: s, body: {} })
    return { s, r, budget }
  }
  const [a, b] = await Promise.all([mk(35), mk(80)])
  ok(`${tag} oba generatea 200 (${(a.r.ms / 1000).toFixed(0)} s i ${(b.r.ms / 1000).toFixed(0)} s)`, a.r.status === 200 && b.r.status === 200, `${a.r.status}/${b.r.status}`)
  if (a.r.status !== 200 || b.r.status !== 200) return
  ok(`${tag} razliciti planId`, a.r.json.planId !== b.r.json.planId)
  const titlesA = new Set(a.r.json.days.flatMap((d) => d.meals.map((m) => m.title)))
  const titlesB = a.r.json.days.flatMap(() => []).concat(b.r.json.days.flatMap((d) => d.meals.map((m) => m.title)))
  const overlap = titlesB.filter((t) => titlesA.has(t)).length
  ok(`${tag} 35 € i 80 € daju razlicit tjedan (preklapanje ${overlap}/21 naslova)`, overlap < 11)
  ok(`${tag} 35 € plan jeftiniji od 80 € plana`, a.r.json.estimatedTotalEur < b.r.json.estimatedTotalEur, `${a.r.json.estimatedTotalEur} vs ${b.r.json.estimatedTotalEur}`)
  ok(`${tag} 35 € plan ne prelazi budzet za > 60 %`, a.r.json.estimatedTotalEur <= 35 * 1.6, `${a.r.json.estimatedTotalEur} €`)
  ok(`${tag} jogurt (umire) spasen u oba`, [a, b].every((x) => x.r.json.rescue.savedItems.some((i) => strip(i).includes('jogurt'))), [a, b].map((x) => x.r.json.rescue.savedItems.join('/')).join(' | '))
}

// ---------- F. swipe kartice: kandidati + taste (API.md §14-15) ----------
const words = (t) => strip(t).split(/\s+/).filter((w) => w.length >= 4)
// "isto jelo" = isti naslov ili bar 2 zajednicke duze rijeci (model zna malo preformulirati naslov)
const sameMeal = (a, b) => strip(a) === strip(b) || words(a).filter((w) => words(b).includes(w)).length >= 2

async function scenarioTaste() {
  const tag = 'F-taste'
  const s = await newSession()
  const v1 = await call('POST', '/api/taste', { session: s, body: { liked: 'nije lista' } })
  ok(`${tag} liked kao string -> 400 VALIDATION_ERROR`, v1.status === 400 && v1.json?.error?.code === 'VALIDATION_ERROR', v1.json?.error?.message)
  const v2 = await call('POST', '/api/taste/candidates', { session: s, body: { count: 20 } })
  ok(`${tag} count 20 -> 400`, v2.status === 400, `${v2.status}`)
  await call('PUT', '/api/profile', { session: s, body: { mealsPerDay: 3, householdSize: 2, cookingStyle: 'svaki_dan', minutesPerMeal: 30, diet: 'bez_svinjetine', allergies: ['orasi'], cuisines: ['domaca'], adventurousness: 3, budgetLevel: 'srednje', budgetPerWeekEur: 60 } })
  await call('PUT', '/api/pantry', { session: s, body: { items: [{ name: 'špinat', quantity: 150, unit: 'g', expiresInDays: 1 }, { name: 'jaja', quantity: 6, unit: 'kom', expiresInDays: 12 }] } })
  const c = await call('POST', '/api/taste/candidates', { session: s, body: {} })
  ok(`${tag} candidates 200 u ${(c.ms / 1000).toFixed(0)} s (< 75 s)`, c.status === 200 && c.ms < 75000, `${c.status}`)
  if (c.status !== 200) return
  const cards = c.json.cards
  ok(`${tag} 8-10 kartica`, cards.length >= 8 && cards.length <= 10, `${cards.length}`)
  ok(`${tag} svaka kartica: id cand_, recept, sastojci s inPantry, why`, cards.every((k) => /^cand_/.test(k.id) && k.steps.length >= 1 && k.ingredients.length >= 1 && typeof k.ingredients[0].inPantry === 'boolean' && k.why && k.title))
  ok(`${tag} naslovi razliciti`, new Set(cards.map((k) => strip(k.title))).size === cards.length)
  ok(`${tag} bez svinjetine i oraha u sastojcima`, cards.every((k) => k.ingredients.every((i) => !/svinj|slanin|kobasic|hrenovk|sunk|panceta|orah|orasi/.test(strip(i.name)))))
  ok(`${tag} bar jedna kartica trosi spinat (umire)`, cards.some((k) => k.usesExpiring.some((u) => strip(u).includes('spinat'))))
  ok(`${tag} servings = 2 na svima`, cards.every((k) => k.servings === 2))
  const liked = cards.slice(0, 3).map((k) => k.title)
  const disliked = cards.slice(3, 5).map((k) => k.title)
  const t = await call('POST', '/api/taste', { session: s, body: { liked, disliked: [...disliked, liked[0]] } })
  ok(`${tag} taste 200, jelo u oba popisa ostaje samo liked`, t.status === 200 && t.json.likedCount === 3 && t.json.dislikedCount === 2, JSON.stringify(t.json))
  const g = await call('POST', '/api/plan/generate', { session: s, body: {} })
  ok(`${tag} generate nakon tastea 200 (${(g.ms / 1000).toFixed(0)} s)`, g.status === 200, `${g.status}`)
  if (g.status !== 200) return
  const titles = g.json.days.flatMap((d) => d.meals.map((m) => m.title))
  const hit = liked.filter((l) => titles.some((pt) => sameMeal(l, pt))).length
  ok(`${tag} bar 2 od 3 odabrana jela u tjednu (${hit}/3)`, hit >= 2, liked.join(' | '))
  const bad = disliked.filter((d) => titles.some((pt) => strip(pt) === strip(d)))
  ok(`${tag} odbijena jela nisu u tjednu`, bad.length === 0, bad.join(' | '))
}

const h = await call('GET', '/health')
ok('health', h.status === 200 && h.json?.ok === true, BASE)
await errorTests()
await scenarioNoProfile()
await Promise.all([scenarioVegan(), scenarioFamily(), scenarioParallel()])
await scenarioTaste()

const fails = results.filter((r) => !r.pass)
console.log(`\n${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL, ${((Date.now() - t0) / 1000).toFixed(0)} s`)
if (fails.length) { console.log('\nFAILOVI:'); for (const f of fails) console.log(` - ${f.name}${f.detail ? `  (${f.detail})` : ''}`) }
