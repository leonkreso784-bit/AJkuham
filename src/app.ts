import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { ZodError } from 'zod'
import { db, schema } from './db/client.js'
import {
  AnswersInput,
  CandidatesInput,
  PantryInput,
  PlanGenerateInput,
  ProfileInput,
  SwapInput,
  TasteInput,
  type Cart,
  type PlannedMeal,
  type ProductCategory,
  type Urgency,
} from './schemas/index.js'
import { generateQuestions } from './ai/questions.js'
import sharp from 'sharp'
import { scanFridge, MAX_IMAGE_BYTES } from './ai/vision.js'
import {
  generateWeekPlan,
  generateSingleMeal,
  generateCandidates,
  type CandidatesContext,
  type CategoryExamples,
  type PlannerInput,
  type SwapContext,
  type Taste,
} from './ai/planner.js'
import { buildCart, type CatalogProduct, type MealForCart, type PantryItemForCart } from './engine/cart.js'

/**
 * Hono app: 13 ruta iz docs/API.md (zamrznuti kontrakt).
 * Ovdje je samo spoj: validacija (Zod), baza (Drizzle), AI moduli, engine.
 * Nikakva logika cijena ovdje — to je src/engine/.
 */

// ---------- greske u obliku iz API.md ----------

type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'AI_ERROR' | 'SERVER_ERROR'
const STATUS: Record<ErrorCode, 400 | 404 | 500 | 502> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  AI_ERROR: 502,
  SERVER_ERROR: 500,
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}

// ---------- pomocne ----------

const id = (prefix: string) => `${prefix}_${nanoid(10)}`
const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v)

/** urgency presudjuje kod, ne model (D14) */
export function urgencyFromDays(days: number | null | undefined): Urgency {
  if (days === null || days === undefined || Number.isNaN(days)) return 'ok'
  if (days <= 2) return 'umire'
  if (days <= 7) return 'skoro'
  return 'ok'
}

const DAY_NAMES = ['ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja']

/** Sljedeci ponedjeljak (ako je danas ponedjeljak, danas). */
function nextMonday(from = new Date()): string {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))
  const dow = d.getUTCDay() // 0 = nedjelja
  const add = dow === 1 ? 0 : (8 - dow) % 7
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const stripDiacritics = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/č|ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')

/** Profil iz baze u ProfileInput (numeric -> number). Bez profila: defaulti, demo ne pada. */
function rowToProfile(row: typeof schema.profiles.$inferSelect | undefined) {
  if (!row) {
    console.warn('[app] profil ne postoji, koristim defaulte')
    return ProfileInput.parse({
      mealsPerDay: 3,
      householdSize: 1,
      cookingStyle: 'meal_prep',
      minutesPerMeal: 30,
      diet: 'sve',
      allergies: [],
      cuisines: [],
      adventurousness: 3,
      budgetLevel: 'srednje',
    })
  }
  return ProfileInput.parse({
    mealsPerDay: row.mealsPerDay,
    householdSize: row.householdSize,
    cookingStyle: row.cookingStyle,
    minutesPerMeal: row.minutesPerMeal,
    diet: row.diet,
    allergies: row.allergies,
    cuisines: row.cuisines,
    adventurousness: row.adventurousness,
    budgetLevel: row.budgetLevel,
    budgetPerWeekEur: num(row.budgetPerWeekEur) ?? undefined,
  })
}

/** Swipe izbor iz profila (API.md §15). Bez profila: prazno. */
function rowToTaste(row: typeof schema.profiles.$inferSelect | undefined): Taste {
  return { likes: row?.likes ?? [], dislikes: row?.dislikes ?? [] }
}

/** Tekst pitanja cuvamo u qa pod kljucem "q_text:<id>" — nema zasebne tablice. */
const Q_TEXT_PREFIX = 'q_text:'

function qaPairs(qa: Record<string, string | string[]>) {
  return Object.entries(qa)
    .filter(([k]) => !k.startsWith(Q_TEXT_PREFIX))
    .map(([k, v]) => {
      const text = qa[`${Q_TEXT_PREFIX}${k}`]
      return { question: typeof text === 'string' ? text : k, answer: v }
    })
}

// ---------- katalog (cache 5 min, 250 redova) ----------

let catalogCache: { at: number; items: CatalogProduct[] } | null = null

async function loadCatalog(): Promise<CatalogProduct[]> {
  if (catalogCache && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.items
  const rows = await db.select().from(schema.products)
  const items: CatalogProduct[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    keywords: r.keywords,
    packageSize: Number(r.packageSize),
    packageUnit: r.packageUnit as CatalogProduct['packageUnit'],
    priceEur: Number(r.priceEur),
    onSale: r.onSale,
  }))
  catalogCache = { at: Date.now(), items }
  return items
}

/** kategorija -> 5-10 primjera imena, drzi matcher mirnim (D7) */
function categoryExamples(catalog: CatalogProduct[]): CategoryExamples {
  const out: CategoryExamples = {}
  for (const p of catalog) {
    const list = (out[p.category] ??= [])
    if (list.length < 10) list.push(p.name)
  }
  return out
}

// ---------- ucitavanje plana ----------

type PrepBlockStored = {
  id: string
  day: string
  startHint: string
  minutes: number
  title: string
  covers: string[]
  mealIds: string[]
  timeline: unknown[]
}

async function loadPlan(planId: string, sessionId: string) {
  const plan = await db.query.plans.findFirst({
    where: and(eq(schema.plans.id, planId), eq(schema.plans.sessionId, sessionId)),
  })
  if (!plan) throw new ApiError('NOT_FOUND', `Plan ${planId} ne postoji`)
  const meals = await db.select().from(schema.meals).where(eq(schema.meals.planId, planId))
  return { plan, meals }
}

function planToApi(plan: typeof schema.plans.$inferSelect, meals: (typeof schema.meals.$inferSelect)[]) {
  const prepBlocks = (plan.prepBlocks as PrepBlockStored[]).map((pb) => ({
    ...pb,
    mealIds: meals.filter((m) => m.prepBlockId === pb.id).map((m) => m.id),
  }))
  const slotOrder = ['dorucak', 'snack1', 'rucak', 'snack2', 'vecera']
  const days = DAY_NAMES.map((dayName, i) => ({
    date: addDays(plan.weekStart, i),
    dayName,
    meals: meals
      .filter((m) => m.dayIndex === i)
      .sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot))
      .map((m) => ({
        id: m.id,
        slot: m.slot,
        title: m.title,
        minutes: m.minutes,
        source: m.source,
        prepBlockId: m.prepBlockId,
        servings: m.servings,
        imageHint: m.imageHint ?? '',
        why: m.why,
        usesExpiring: m.usesExpiring,
      })),
  }))
  return {
    planId: plan.id,
    weekStart: plan.weekStart,
    budgetEur: num(plan.budgetEur),
    estimatedTotalEur: num(plan.estimatedTotalEur),
    rescue: plan.rescue ?? { savedItems: [], savedEur: 0, message: '' },
    saleDriven: plan.saleDriven ?? { count: 0, items: [], message: '' },
    prepBlocks,
    days,
  }
}

async function loadPantry(sessionId: string): Promise<PantryItemForCart[]> {
  const rows = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.sessionId, sessionId))
  return rows.map((r) => ({
    name: r.name,
    quantity: Number(r.quantity),
    unit: r.unit as PantryItemForCart['unit'],
    urgency: (r.urgency as PantryItemForCart['urgency']) ?? null,
  }))
}

async function mealsForCart(mealRows: (typeof schema.meals.$inferSelect)[]): Promise<MealForCart[]> {
  if (mealRows.length === 0) return []
  const ings = await db
    .select()
    .from(schema.mealIngredients)
    .where(
      inArray(
        schema.mealIngredients.mealId,
        mealRows.map((m) => m.id),
      ),
    )
  return mealRows.map((m) => ({
    id: m.id,
    title: m.title,
    usesExpiring: m.usesExpiring,
    ingredients: ings
      .filter((i) => i.mealId === m.id)
      .map((i) => ({ name: i.name, quantity: Number(i.quantity), unit: i.unit })),
  }))
}

async function cartForPlan(plan: typeof schema.plans.$inferSelect, meals: (typeof schema.meals.$inferSelect)[]): Promise<Cart> {
  const [catalog, pantry, mfc] = await Promise.all([loadCatalog(), loadPantry(plan.sessionId), mealsForCart(meals)])
  return buildCart({
    meals: mfc,
    pantry,
    catalog,
    budgetEur: num(plan.budgetEur),
    mealsCount: meals.length,
  })
}

/** Detalj obroka (GET /api/meal/:id oblik) s inPantry/expiring oznakama. */
async function mealDetail(meal: typeof schema.meals.$inferSelect, sessionId: string) {
  const [ings, pantry] = await Promise.all([
    db.select().from(schema.mealIngredients).where(eq(schema.mealIngredients.mealId, meal.id)),
    loadPantry(sessionId),
  ])
  const pantryIdx = new Map(pantry.map((p) => [stripDiacritics(p.name), p]))
  return {
    id: meal.id,
    title: meal.title,
    slot: meal.slot,
    minutes: meal.minutes,
    servings: meal.servings,
    source: meal.source,
    steps: meal.steps,
    ingredients: ings.map((i) => {
      const p = pantryIdx.get(stripDiacritics(i.name))
      return {
        name: i.name,
        quantity: Number(i.quantity),
        unit: i.unit,
        inPantry: !!p,
        expiring: !!p && p.urgency === 'umire',
      }
    }),
    why: meal.why,
    usesExpiring: meal.usesExpiring,
    nutrition: meal.nutrition ?? null,
  }
}

async function insertMeal(planId: string, dayIndex: number, pm: PlannedMeal, prepBlockId: string | null, replacedMealId: string | null) {
  const mealId = id('m')
  await db.insert(schema.meals).values({
    id: mealId,
    planId,
    dayIndex,
    slot: pm.slot,
    title: pm.title,
    minutes: pm.minutes,
    servings: pm.servings,
    source: prepBlockId ? pm.source : 'kuhaj_sad',
    prepBlockId,
    steps: pm.steps,
    nutrition: pm.nutrition ?? null,
    imageHint: pm.imageHint ?? null,
    why: pm.why,
    usesExpiring: pm.usesExpiring,
    replacedMealId,
  })
  if (pm.ingredients.length) {
    await db.insert(schema.mealIngredients).values(
      pm.ingredients.map((ing) => ({
        mealId,
        name: ing.name.trim().toLowerCase(),
        quantity: String(ing.quantity),
        unit: ing.unit,
        raw: `${ing.quantity} ${ing.unit} ${ing.name}`,
      })),
    )
  }
  return mealId
}

/** Tvrda provjera dijete/alergija nad sastojcima — swap koji prekrsi dijetu je gori od nikakvog. */
const DIET_FORBIDDEN: Record<string, string[]> = {
  vegan: ['meso', 'pile', 'svinj', 'june', 'govedi', 'riba', 'tuna', 'losos', 'jaj', 'mlijek', 'sir', 'jogurt', 'maslac', 'vrhnje', 'med', 'slanin', 'kobasic', 'hrenovk'],
  bez_mesa: ['meso', 'pile', 'svinj', 'june', 'govedi', 'mljeven', 'slanin', 'kobasic', 'hrenovk', 'pur'],
  bez_svinjetine: ['svinj', 'slanin', 'kobasic', 'hrenovk', 'sunk', 'panceta'],
  bez_laktoze: ['mlijek', 'jogurt', 'vrhnje', 'maslac', 'sir'],
  bez_glutena: ['tjesten', 'kruh', 'brasn', 'mrvic', 'tortilj', 'kuskus', 'bulgur', 'njok'],
}

function violatesProfile(meal: PlannedMeal, profile: ProfileInput): string | null {
  const names = meal.ingredients.map((i) => stripDiacritics(i.name))
  const forbidden = DIET_FORBIDDEN[profile.diet] ?? []
  for (const n of names) {
    if (forbidden.some((f) => n.includes(f))) return `dijeta ${profile.diet}: ${n}`
    for (const a of profile.allergies) {
      const na = stripDiacritics(a)
      if (na && n.includes(na)) return `alergija ${a}: ${n}`
    }
  }
  return null
}

/** Zajednicka swap logika za /swap i /shake. Vraca detalj novog (ili starog) obroka. */
async function swapMeal(sessionId: string, meal: typeof schema.meals.$inferSelect, reason: string | null) {
  const { plan, meals } = await loadPlan(meal.planId, sessionId)
  const profileRow = await db.query.profiles.findFirst({ where: eq(schema.profiles.sessionId, sessionId) })
  const profile = rowToProfile(profileRow)
  const [catalog, cart, ings] = await Promise.all([
    loadCatalog(),
    cartForPlan(plan, meals),
    db.select().from(schema.mealIngredients).where(eq(schema.mealIngredients.mealId, meal.id)),
  ])
  const pantry = await loadPantry(sessionId)

  const oldMeal: PlannedMeal = {
    slot: meal.slot as PlannedMeal['slot'],
    title: meal.title,
    minutes: meal.minutes,
    servings: meal.servings,
    source: meal.source as PlannedMeal['source'],
    prepBlockIndex: null,
    steps: meal.steps,
    ingredients: ings.map((i) => ({ name: i.name, quantity: Number(i.quantity), unit: i.unit as PlannedMeal['ingredients'][number]['unit'] })),
    nutrition: meal.nutrition ?? null,
    imageHint: meal.imageHint ?? undefined,
    why: meal.why,
    usesExpiring: meal.usesExpiring,
  }

  const ctx: SwapContext = {
    profile,
    tasteNotes: profileRow?.tasteNotes ?? '',
    qa: qaPairs(profileRow?.qa ?? {}),
    taste: rowToTaste(profileRow),
    oldMeal,
    reason,
    cartIngredients: [...new Set([...cart.lines.flatMap((l) => l.matchedIngredients), ...pantry.map((p) => p.name)])],
    otherMealTitles: meals.filter((m) => m.id !== meal.id).map((m) => m.title),
    categories: categoryExamples(catalog),
  }

  let fresh: PlannedMeal | null = null
  for (let attempt = 0; attempt < 2 && !fresh; attempt++) {
    try {
      const candidate = await generateSingleMeal(ctx)
      const violation = violatesProfile(candidate, profile)
      if (violation) {
        console.warn(`[swap] kandidat krsi profil (${violation}), pokusaj ${attempt + 1}`)
        continue
      }
      fresh = candidate
    } catch (err) {
      console.error('[swap] AI pao:', (err as Error).message)
      break
    }
  }

  if (!fresh) {
    // shake koji nista ne promijeni je razocaranje; shake koji srusi app je demo-killer
    return { ...(await mealDetail(meal, sessionId)), swapFailed: true }
  }

  // usesExpiring prenesi samo ako novi obrok stvarno i dalje koristi tu namirnicu
  const freshNames = fresh.ingredients.map((i) => stripDiacritics(i.name))
  fresh.usesExpiring = meal.usesExpiring.filter((u) => freshNames.some((n) => n.includes(stripDiacritics(u))))
  fresh.slot = oldMeal.slot
  fresh.servings = oldMeal.servings

  const newId = await insertMeal(meal.planId, meal.dayIndex, fresh, null, meal.id)
  await db.delete(schema.meals).where(eq(schema.meals.id, meal.id))
  const newRow = await db.query.meals.findFirst({ where: eq(schema.meals.id, newId) })
  return mealDetail(newRow!, sessionId)
}

// ---------- app ----------

type Env = { Variables: { sessionId: string } }
export const app = new Hono<Env>()

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'x-session-id'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, STATUS[err.code])
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
    return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400)
  }
  console.error('[app] neuhvacena greska:', err)
  return c.json({ error: { code: 'SERVER_ERROR', message: err.message || 'Nepoznata greska' } }, 500)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: `Ruta ${c.req.method} ${c.req.path} ne postoji` } }, 404))

app.get('/health', (c) => c.json({ ok: true, name: 'KuhAI', time: new Date().toISOString() }))
app.get('/api/health', (c) => c.json({ ok: true, name: 'KuhAI', time: new Date().toISOString() }))

// 1. POST /api/session
app.post('/api/session', async (c) => {
  const sessionId = id('ses')
  await db.insert(schema.sessions).values({ id: sessionId })
  return c.json({ sessionId })
})

// sesija iz headera za sve ostale /api rute
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/session' || c.req.path === '/api/health') return next()
  const sessionId = c.req.header('x-session-id')
  if (!sessionId) throw new ApiError('VALIDATION_ERROR', 'Nedostaje header x-session-id (prvo POST /api/session)')
  const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) })
  if (!s) throw new ApiError('NOT_FOUND', `Sesija ${sessionId} ne postoji`)
  c.set('sessionId', sessionId)
  await next()
})

async function readJson<T>(c: Context<Env>, parse: (v: unknown) => T): Promise<T> {
  let body: unknown = {}
  try {
    const text = await c.req.text()
    body = text.trim() ? JSON.parse(text) : {}
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Body nije valjan JSON')
  }
  return parse(body)
}

// 2. PUT /api/profile
app.put('/api/profile', async (c) => {
  const sessionId = c.get('sessionId')
  const input = await readJson(c, (b) => ProfileInput.parse(b))
  const values = {
    mealsPerDay: input.mealsPerDay,
    householdSize: input.householdSize,
    cookingStyle: input.cookingStyle,
    minutesPerMeal: input.minutesPerMeal,
    diet: input.diet,
    allergies: input.allergies,
    cuisines: input.cuisines,
    adventurousness: input.adventurousness,
    budgetLevel: input.budgetLevel,
    budgetPerWeekEur: input.budgetPerWeekEur === undefined ? null : String(input.budgetPerWeekEur),
    updatedAt: new Date(),
  }
  await db
    .insert(schema.profiles)
    .values({ sessionId, ...values })
    .onConflictDoUpdate({ target: schema.profiles.sessionId, set: values })
  return c.json({ ok: true })
})

// 3. POST /api/questions
app.post('/api/questions', async (c) => {
  const sessionId = c.get('sessionId')
  const row = await db.query.profiles.findFirst({ where: eq(schema.profiles.sessionId, sessionId) })
  const profile = rowToProfile(row)
  const questions = await generateQuestions(profile)
  // zapamti tekst pitanja da planer dobije "pitanje: odgovor", ne "id: odgovor"
  const qa: Record<string, string | string[]> = { ...(row?.qa ?? {}) }
  for (const q of questions) qa[`${Q_TEXT_PREFIX}${q.id}`] = q.text
  if (row) {
    await db.update(schema.profiles).set({ qa, updatedAt: new Date() }).where(eq(schema.profiles.sessionId, sessionId))
  }
  return c.json({ questions })
})

// 4. POST /api/questions/answers
app.post('/api/questions/answers', async (c) => {
  const sessionId = c.get('sessionId')
  const input = await readJson(c, (b) => AnswersInput.parse(b))
  const row = await db.query.profiles.findFirst({ where: eq(schema.profiles.sessionId, sessionId) })
  const qa: Record<string, string | string[]> = { ...(row?.qa ?? {}) }
  for (const a of input.answers) qa[a.id] = a.value
  // taste_notes: slobodni tekst koji planer cita; gradimo ga deterministicki iz odgovora
  const tasteNotes = qaPairs(qa)
    .map((p) => `${p.question} ${Array.isArray(p.answer) ? p.answer.join(', ') : p.answer}`)
    .join('\n')
  if (row) {
    await db.update(schema.profiles).set({ qa, tasteNotes, updatedAt: new Date() }).where(eq(schema.profiles.sessionId, sessionId))
  } else {
    await db.insert(schema.profiles).values({ sessionId, qa, tasteNotes })
  }
  return c.json({ ok: true })
})

// 5. POST /api/fridge/scan — fotka se NE cuva
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const RAW_IMAGE_LIMIT = 25 * 1024 * 1024
app.post('/api/fridge/scan', async (c) => {
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Ocekujem multipart/form-data s poljem image')
  }
  const files = form.getAll('image').filter((f): f is File => typeof f !== 'string')
  if (files.length === 0) throw new ApiError('VALIDATION_ERROR', 'Polje image nedostaje')
  const images: { data: Uint8Array; mediaType: string }[] = []
  for (const f of files) {
    if (f.size > RAW_IMAGE_LIMIT) throw new ApiError('VALIDATION_ERROR', 'Slika je veca od 25 MB')
    const raw = Buffer.from(await f.arrayBuffer())
    // Fotka s telefona je 4-12 MB i 4000 px; vision ne treba vise od ~1600 px.
    // Smanjivanje drzi upload ispod 8 MB limita i ubrzava poziv. HEIC/nepoznato
    // isto prolazi kroz sharp — ako ga ne zna dekodirati, vracamo jasnu gresku.
    try {
      const data = await sharp(raw, { failOn: 'none' })
        .rotate() // EXIF orijentacija s telefona
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
      images.push({ data: new Uint8Array(data), mediaType: 'image/jpeg' })
    } catch (err) {
      const mediaType = f.type || 'image/jpeg'
      if (!IMAGE_TYPES.has(mediaType)) {
        throw new ApiError('VALIDATION_ERROR', `Nepodrzan tip slike: ${mediaType} (jpeg/png/webp)`)
      }
      if (f.size > MAX_IMAGE_BYTES) throw new ApiError('VALIDATION_ERROR', 'Slika je veca od 8 MB')
      console.warn('[scan] sharp nije uspio, saljem original:', (err as Error).message)
      images.push({ data: new Uint8Array(raw), mediaType })
    }
  }
  const sourceRaw = form.get('source')
  const source = typeof sourceRaw === 'string' && sourceRaw.trim() ? sourceRaw.trim() : undefined
  const result = await scanFridge(images, source ? { source } : undefined)
  // urgency presudjuje kod, uvijek
  const items = result.items.map((it) => ({ ...it, urgency: urgencyFromDays(it.expiresInDays) }))
  return c.json({ items, followUpQuestions: result.followUpQuestions.slice(0, 3) })
})

// 6. PUT /api/pantry — zamjenjuje cijeli pantry
app.put('/api/pantry', async (c) => {
  const sessionId = c.get('sessionId')
  const input = await readJson(c, (b) => PantryInput.parse(b))
  await db.delete(schema.pantryItems).where(eq(schema.pantryItems.sessionId, sessionId))
  if (input.items.length) {
    await db.insert(schema.pantryItems).values(
      input.items.map((it) => ({
        id: id('pi'),
        sessionId,
        name: it.name.trim().toLowerCase(),
        quantity: String(it.quantity),
        unit: it.unit,
        source: it.expiresInDays === undefined ? 'manual' : 'vision',
        expiresInDays: it.expiresInDays ?? null,
        urgency: it.expiresInDays === undefined ? null : urgencyFromDays(it.expiresInDays),
      })),
    )
  }
  return c.json({ ok: true, count: input.items.length })
})

// 7. GET /api/pantry
app.get('/api/pantry', async (c) => {
  const sessionId = c.get('sessionId')
  const rows = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.sessionId, sessionId))
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      quantity: Number(r.quantity),
      unit: r.unit,
      expiresInDays: r.expiresInDays,
      urgency: r.urgency,
    })),
  })
})

// 8. POST /api/plan/generate — najdulji poziv, 20-60 s
app.post('/api/plan/generate', async (c) => {
  const sessionId = c.get('sessionId')
  const input = await readJson(c, (b) => PlanGenerateInput.parse(b))
  const [profileRow, pantryRows, catalog] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(schema.profiles.sessionId, sessionId) }),
    db.select().from(schema.pantryItems).where(eq(schema.pantryItems.sessionId, sessionId)),
    loadCatalog(),
  ])
  const profile = rowToProfile(profileRow)
  // budzet: body -> profil -> bez ogranicenja (D13)
  const budgetEur = input.budgetEur ?? profile.budgetPerWeekEur ?? null
  const weekStart = nextMonday()

  const plannerInput: PlannerInput = {
    profile,
    tasteNotes: profileRow?.tasteNotes ?? '',
    qa: qaPairs(profileRow?.qa ?? {}),
    taste: rowToTaste(profileRow),
    pantry: pantryRows.map((r) => ({
      name: r.name,
      quantity: Number(r.quantity),
      unit: r.unit as 'g' | 'ml' | 'kom',
      expiresInDays: r.expiresInDays,
      urgency: (r.urgency as Urgency | null) ?? urgencyFromDays(r.expiresInDays),
    })),
    onSale: catalog
      .filter((p) => p.onSale)
      .slice(0, 30)
      .map((p) => ({ name: p.name, category: p.category, packageSize: p.packageSize, packageUnit: p.packageUnit })),
    categories: categoryExamples(catalog),
    budgetEur,
    weekStart,
  }

  const out = await generateWeekPlan(plannerInput)

  // --- persist ---
  const planId = id('pl')
  const prepBlocks: PrepBlockStored[] = out.prepBlocks.map((pb, i) => ({
    id: `pb_${i + 1}`,
    day: pb.day,
    startHint: pb.startHint,
    minutes: pb.minutes,
    title: pb.title,
    covers: pb.covers,
    mealIds: [],
    timeline: pb.timeline,
  }))
  await db.insert(schema.plans).values({
    id: planId,
    sessionId,
    weekStart,
    prepBlocks,
    budgetEur: budgetEur === null ? null : String(budgetEur),
  })
  for (let dayIndex = 0; dayIndex < out.days.length; dayIndex++) {
    const day = out.days[dayIndex]!
    for (const pm of day.meals) {
      const pbId =
        pm.prepBlockIndex !== null && pm.prepBlockIndex >= 0 && pm.prepBlockIndex < prepBlocks.length
          ? prepBlocks[pm.prepBlockIndex]!.id
          : null
      await insertMeal(planId, dayIndex, pm, pbId, null)
    }
  }

  // --- brojke dopisuje kod, ne model (D6) ---
  const { plan, meals } = await loadPlan(planId, sessionId)
  const cart = await cartForPlan(plan, meals)
  const saleNames = out.saleDriven.items.map(stripDiacritics).filter(Boolean)
  const mfc = await mealsForCart(meals)
  const saleCount = saleNames.length
    ? mfc.filter((m) => m.ingredients.some((i) => saleNames.some((s) => stripDiacritics(i.name).includes(s) || s.includes(stripDiacritics(i.name))))).length
    : 0
  const seen = new Set<string>()
  const savedItems = out.rescue.savedItems.map((s) => s.trim().toLowerCase()).filter((s) => s && !seen.has(stripDiacritics(s)) && seen.add(stripDiacritics(s)))
  const rescue = { savedItems, savedEur: cart.savedFromWasteEur, message: out.rescue.message }
  const saleDriven = { count: saleCount, items: out.saleDriven.items, message: out.saleDriven.message }
  await db
    .update(schema.plans)
    .set({ rescue, saleDriven, estimatedTotalEur: String(cart.totalEur) })
    .where(eq(schema.plans.id, planId))

  return c.json(planToApi({ ...plan, rescue, saleDriven, estimatedTotalEur: String(cart.totalEur) }, meals))
})

// 9. GET /api/plan/:planId
app.get('/api/plan/:planId', async (c) => {
  const { plan, meals } = await loadPlan(c.req.param('planId'), c.get('sessionId'))
  return c.json(planToApi(plan, meals))
})

// 12. GET /api/plan/:planId/cart — nikad se ne sprema, racuna se svaki put (D8)
app.get('/api/plan/:planId/cart', async (c) => {
  const { plan, meals } = await loadPlan(c.req.param('planId'), c.get('sessionId'))
  return c.json(await cartForPlan(plan, meals))
})

// 13. POST /api/plan/:planId/shake — slucajan obrok, ista swap logika
app.post('/api/plan/:planId/shake', async (c) => {
  const sessionId = c.get('sessionId')
  const { meals } = await loadPlan(c.req.param('planId'), sessionId)
  if (meals.length === 0) throw new ApiError('NOT_FOUND', 'Plan nema obroka')
  // po mogucnosti ne obrok koji spasava hranu, da shake ne razbije rescue
  const pool = meals.filter((m) => m.usesExpiring.length === 0)
  const pick = (pool.length ? pool : meals)[Math.floor(Math.random() * (pool.length ? pool : meals).length)]!
  const meal = await swapMeal(sessionId, pick, null)
  return c.json({ replacedMealId: pick.id, meal })
})

async function findMeal(mealId: string, sessionId: string) {
  const meal = await db.query.meals.findFirst({ where: eq(schema.meals.id, mealId) })
  if (!meal) throw new ApiError('NOT_FOUND', `Obrok ${mealId} ne postoji`)
  const plan = await db.query.plans.findFirst({ where: and(eq(schema.plans.id, meal.planId), eq(schema.plans.sessionId, sessionId)) })
  if (!plan) throw new ApiError('NOT_FOUND', `Obrok ${mealId} ne pripada ovoj sesiji`)
  return meal
}

// 14. POST /api/taste/candidates — deck jela za swipe kartice, nista se ne sprema
app.post('/api/taste/candidates', async (c) => {
  const sessionId = c.get('sessionId')
  const input = await readJson(c, (b) => CandidatesInput.parse(b ?? {}))
  const [profileRow, pantryRows, catalog] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(schema.profiles.sessionId, sessionId) }),
    db.select().from(schema.pantryItems).where(eq(schema.pantryItems.sessionId, sessionId)),
    loadCatalog(),
  ])
  const profile = rowToProfile(profileRow)
  const pantry = pantryRows.map((r) => ({
    name: r.name,
    quantity: Number(r.quantity),
    unit: r.unit as 'g' | 'ml' | 'kom',
    expiresInDays: r.expiresInDays,
    urgency: (r.urgency as Urgency | null) ?? urgencyFromDays(r.expiresInDays),
  }))
  const ctx: CandidatesContext = {
    profile,
    tasteNotes: profileRow?.tasteNotes ?? '',
    qa: qaPairs(profileRow?.qa ?? {}),
    pantry,
    onSale: catalog
      .filter((p) => p.onSale)
      .slice(0, 30)
      .map((p) => ({ name: p.name, category: p.category, packageSize: p.packageSize, packageUnit: p.packageUnit })),
    categories: categoryExamples(catalog),
    count: input.count,
  }
  const meals = await generateCandidates(ctx)
  // tvrda provjera dijete/alergija kao kod swapa; kandidat koji krsi profil ispada
  const safe = meals.filter((m) => {
    const v = violatesProfile(m, profile)
    if (v) console.warn(`[candidates] izbacujem "${m.title}": ${v}`)
    return !v
  })
  const pantryIdx = new Map(pantry.map((p) => [stripDiacritics(p.name), p]))
  const cards = safe.map((m) => ({
    id: id('cand'),
    title: m.title,
    slot: m.slot,
    minutes: m.minutes,
    servings: m.servings,
    source: 'kuhaj_sad' as const,
    steps: m.steps,
    ingredients: m.ingredients.map((i) => {
      const p = pantryIdx.get(stripDiacritics(i.name))
      return { name: i.name, quantity: i.quantity, unit: i.unit, inPantry: !!p, expiring: !!p && p.urgency === 'umire' }
    }),
    why: m.why,
    usesExpiring: m.usesExpiring,
    nutrition: m.nutrition ?? null,
    imageHint: m.imageHint ?? '',
  }))
  return c.json({ cards })
})

// 15. POST /api/taste — sto je odabrao na karticama; planer, swap i shake to citaju
app.post('/api/taste', async (c) => {
  const sessionId = c.get('sessionId')
  const input = await readJson(c, (b) => TasteInput.parse(b ?? {}))
  const dedupe = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]
  const likes = dedupe(input.liked)
  const dislikedSet = new Set(likes.map(stripDiacritics))
  // isto jelo ne moze biti i odabrano i odbijeno; zadnja rijec je "odabrano"
  const dislikes = dedupe(input.disliked).filter((d) => !dislikedSet.has(stripDiacritics(d)))
  await db
    .insert(schema.profiles)
    .values({ sessionId, likes, dislikes })
    .onConflictDoUpdate({ target: schema.profiles.sessionId, set: { likes, dislikes, updatedAt: new Date() } })
  return c.json({ ok: true, likedCount: likes.length, dislikedCount: dislikes.length })
})

// 10. GET /api/meal/:mealId
app.get('/api/meal/:mealId', async (c) => {
  const sessionId = c.get('sessionId')
  const meal = await findMeal(c.req.param('mealId'), sessionId)
  return c.json(await mealDetail(meal, sessionId))
})

// 11. POST /api/meal/:mealId/swap
app.post('/api/meal/:mealId/swap', async (c) => {
  const sessionId = c.get('sessionId')
  const meal = await findMeal(c.req.param('mealId'), sessionId)
  const input = await readJson(c, (b) => SwapInput.parse(b ?? {}))
  return c.json(await swapMeal(sessionId, meal, input.reason?.trim() || null))
})

export type { ProductCategory }
