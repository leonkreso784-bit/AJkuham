// Mock odgovori po docs/API.md. Koristi se kad VITE_API_URL nije postavljen.
import type { Cart, MealDetail, Plan, PlanMeal, Question, ScanResult, Slot } from './types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const DAYS = ['ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja']

type Seed = Omit<PlanMeal, 'id' | 'slot' | 'servings' | 'prepBlockId'> & { cheap: boolean; slot: Slot }

const POOL: Seed[] = [
  { slot: 'dorucak', title: 'Kajgana sa špinatom', minutes: 12, source: 'kuhaj_sad', imageHint: 'kajgana', why: 'Špinat ti umire za 1 dan — ide prvi.', usesExpiring: ['špinat'], cheap: true },
  { slot: 'dorucak', title: 'Zobena s jogurtom i jabukom', minutes: 5, source: 'kuhaj_sad', imageHint: 'zobena', why: 'Jogurt ti umire za 2 dana, a zobena je 0,40 € po porciji.', usesExpiring: ['jogurt'], cheap: true },
  { slot: 'dorucak', title: 'Tost s jajem i rajčicom', minutes: 8, source: 'kuhaj_sad', imageHint: 'tost', why: 'Brzo, a rekao si da doručak jedeš ponekad.', usesExpiring: [], cheap: true },
  { slot: 'rucak', title: 'Piletina s rižom i povrćem', minutes: 5, source: 'iz_prepa', imageHint: 'piletina riža', why: 'Iz nedjeljnog prepa — samo podgrij.', usesExpiring: ['mrkva'], cheap: false },
  { slot: 'rucak', title: 'Varivo od leće', minutes: 5, source: 'iz_prepa', imageHint: 'leća', why: 'Leća je najjeftiniji protein u katalogu.', usesExpiring: [], cheap: true },
  { slot: 'rucak', title: 'Svinjski file s tikvicama', minutes: 25, source: 'kuhaj_sad', imageHint: 'svinjetina', why: 'Svinjski file je -30% ovaj tjedan.', usesExpiring: [], cheap: false },
  { slot: 'rucak', title: 'Tjestenina s tikvicama', minutes: 20, source: 'kuhaj_sad', imageHint: 'tjestenina', why: 'Tikvice su na akciji, a tjesteninu imaš doma.', usesExpiring: [], cheap: true },
  { slot: 'vecera', title: 'Salata od kupusa s jajem', minutes: 10, source: 'kuhaj_sad', imageHint: 'salata', why: 'Pola kupusa ti stoji u frižideru već tjedan.', usesExpiring: ['kupus'], cheap: true },
  { slot: 'vecera', title: 'Pečeni krumpir s jogurt-umakom', minutes: 35, source: 'kuhaj_sad', imageHint: 'krumpir', why: 'Krumpir je tvoj staple, jogurt mora otići.', usesExpiring: ['jogurt'], cheap: true },
  { slot: 'vecera', title: 'Wok s piletinom', minutes: 20, source: 'kuhaj_sad', imageHint: 'wok', why: 'Rekao si da voliš azijsku kuhinju.', usesExpiring: [], cheap: false },
  { slot: 'vecera', title: 'Juha od povrća', minutes: 5, source: 'iz_prepa', imageHint: 'juha', why: 'Skuhana u prepu, traje do četvrtka.', usesExpiring: ['mrkva'], cheap: true },
]

let counter = 100
let currentPlan: Plan | null = null
const mealIndex = new Map<string, Seed>()

function pick(slot: Slot, day: number, budget: number | null): Seed {
  const all = POOL.filter((m) => m.slot === slot && (budget == null || budget >= 45 || m.cheap))
  return all[day % all.length]
}

function makeMeal(seed: Seed): PlanMeal {
  const id = `m_${++counter}`
  mealIndex.set(id, seed)
  const { cheap: _cheap, ...rest } = seed
  return { ...rest, id, servings: 2, prepBlockId: seed.source === 'iz_prepa' ? 'pb_1' : null }
}

function buildPlan(budget: number | null): Plan {
  const days = DAYS.map((dayName, i) => {
    const date = new Date(2026, 9, 12 + i)
    return {
      date: date.toISOString().slice(0, 10),
      dayName,
      meals: (['dorucak', 'rucak', 'vecera'] as Slot[]).map((s) => makeMeal(pick(s, i, budget))),
    }
  })
  const prepIds = days.flatMap((d) => d.meals).filter((m) => m.source === 'iz_prepa').map((m) => m.id)
  const est = budget == null ? 54.6 : Math.min(budget - 1.2, budget >= 45 ? 54.6 : 33.8)
  return {
    planId: `pl_${counter}`,
    weekStart: days[0].date,
    budgetEur: budget,
    estimatedTotalEur: Math.round(est * 10) / 10,
    rescue: {
      savedItems: ['špinat', 'jogurt', 'pola kupusa', 'mrkva'],
      savedEur: 11.2,
      message: 'Špinat i jogurt ti umiru za 2 dana — stavio sam ih u ponedjeljak i utorak.',
    },
    saleDriven: budget != null && budget < 45
      ? { count: 2, items: ['tikvice'], message: 'Tikvice su -25% ovaj tjedan, iskoristio sam ih dvaput.' }
      : { count: 3, items: ['svinjski file', 'tikvice'], message: 'Svinjski file je -30% ovaj tjedan, iskoristio sam ga tri puta.' },
    prepBlocks: [
      {
        id: 'pb_1', day: 'nedjelja', startHint: '18:00', minutes: 70, title: 'Veliki prep',
        covers: ['ponedjeljak', 'utorak', 'srijeda'], mealIds: prepIds.slice(0, 6),
        timeline: [
          { track: 'pecnica', label: 'Piletina', startMinute: 0, durationMinutes: 45 },
          { track: 'stednjak', label: 'Riža', startMinute: 10, durationMinutes: 20 },
          { track: 'stednjak', label: 'Leća', startMinute: 35, durationMinutes: 25 },
          { track: 'ti', label: 'Sjeckaj', startMinute: 0, durationMinutes: 10 },
          { track: 'ti', label: 'Začini', startMinute: 30, durationMinutes: 5 },
          { track: 'ti', label: 'Pakiraj', startMinute: 55, durationMinutes: 15 },
        ],
      },
      {
        id: 'pb_2', day: 'srijeda', startHint: '19:00', minutes: 40, title: 'Mali prep',
        covers: ['četvrtak', 'petak'], mealIds: prepIds.slice(6),
        timeline: [
          { track: 'stednjak', label: 'Juha', startMinute: 0, durationMinutes: 30 },
          { track: 'air_fryer', label: 'Krumpir', startMinute: 5, durationMinutes: 25 },
          { track: 'ti', label: 'Ogulji', startMinute: 0, durationMinutes: 8 },
          { track: 'ti', label: 'Pakiraj', startMinute: 30, durationMinutes: 10 },
        ],
      },
    ],
    days,
  }
}

function detail(id: string): MealDetail {
  const seed = mealIndex.get(id) ?? POOL[0]
  const expiring = new Set(seed.usesExpiring)
  return {
    id, title: seed.title, slot: seed.slot, minutes: seed.minutes, servings: 2, source: seed.source,
    steps: [
      'Pripremi sve sastojke i nasjeckaj povrće.',
      'Zagrij tavu s malo ulja na srednjoj vatri.',
      'Dodaj glavni sastojak i peci 5–7 min uz miješanje.',
      'Začini, kušaj, posluži odmah ili spakiraj u posudu.',
    ],
    ingredients: [
      { name: 'jaja', quantity: 4, unit: 'kom', inPantry: true, expiring: false },
      ...seed.usesExpiring.map((n) => ({ name: n, quantity: 150, unit: 'g' as const, inPantry: true, expiring: expiring.has(n) })),
      { name: 'luk', quantity: 1, unit: 'kom', inPantry: false, expiring: false },
      { name: 'maslinovo ulje', quantity: 20, unit: 'ml', inPantry: true, expiring: false },
    ],
    why: seed.why,
    usesExpiring: seed.usesExpiring,
    nutrition: seed.cheap ? { kcal: 420, protein: 24, carbs: 38, fat: 18 } : null,
  }
}

export const mock = {
  async session() { await wait(150); return { sessionId: 'ses_mock' } },
  async putProfile() { await wait(250); return { ok: true } },
  async questions(): Promise<{ questions: Question[] }> {
    await wait(1200)
    return {
      questions: [
        { id: 'q_staple', text: 'Što od ovoga jedeš najčešće?', type: 'multi', options: ['krumpir', 'riža', 'tjestenina', 'kruh'] },
        { id: 'q_breakfast', text: 'Jedeš li doručak?', type: 'single', options: ['uvijek', 'ponekad', 'nikad'] },
        { id: 'q_hate', text: 'Nešto što nikako ne jedeš?', type: 'single', options: ['gljive', 'riba', 'kupus', 'sve jedem'] },
        { id: 'q_yesterday', text: 'Što si jeo jučer?', type: 'text', options: [] },
      ],
    }
  },
  async answers() { await wait(300); return { ok: true } },
  async scan(): Promise<ScanResult> {
    await wait(2600)
    return {
      items: [
        { name: 'jaja', quantity: 6, unit: 'kom', confidence: 0.93, expiresInDays: 12, urgency: 'ok' },
        { name: 'jogurt', quantity: 400, unit: 'g', confidence: 0.71, expiresInDays: 2, urgency: 'umire' },
        { name: 'špinat', quantity: 150, unit: 'g', confidence: 0.68, expiresInDays: 1, urgency: 'umire' },
        { name: 'kupus', quantity: 0.5, unit: 'kom', confidence: 0.55, expiresInDays: 7, urgency: 'skoro' },
        { name: 'mrkva', quantity: 300, unit: 'g', confidence: 0.82, expiresInDays: 5, urgency: 'skoro' },
        { name: 'mlijeko', quantity: 1000, unit: 'ml', confidence: 0.88, expiresInDays: 9, urgency: 'ok' },
        { name: 'sir gauda', quantity: 200, unit: 'g', confidence: 0.47, expiresInDays: 14, urgency: 'ok' },
      ],
      followUpQuestions: ['Koliko ti je riže ostalo, pola kile ili skoro ništa?'],
    }
  },
  async putPantry(items: unknown[]) { await wait(300); return { ok: true, count: items.length } },
  async generate(budgetEur?: number): Promise<Plan> {
    await wait(6500)
    currentPlan = buildPlan(budgetEur ?? null)
    return currentPlan
  },
  async getPlan(): Promise<Plan> {
    await wait(200)
    return (currentPlan ??= buildPlan(60))
  },
  async meal(id: string) { await wait(400); return detail(id) },
  async swap(id: string): Promise<MealDetail> {
    await wait(1800)
    const old = mealIndex.get(id) ?? POOL[0]
    const options = POOL.filter((m) => m.slot === old.slot && m.title !== old.title)
    const meal = makeMeal(options[Math.floor(Math.random() * options.length)])
    return detail(meal.id)
  },
  async shake(): Promise<{ replacedMealId: string; meal: MealDetail }> {
    const plan = currentPlan ?? buildPlan(60)
    const all = plan.days.flatMap((d) => d.meals)
    const victim = all[Math.floor(Math.random() * all.length)]
    const meal = await mock.swap(victim.id)
    return { replacedMealId: victim.id, meal }
  },
  async cart(): Promise<Cart> {
    await wait(900)
    const budget = currentPlan?.budgetEur ?? 60
    const tight = budget < 45
    const lines: Cart['lines'] = [
      { productId: 'p_142', productName: 'Pileći file 1 kg', category: 'meso', packageSize: 1000, packageUnit: 'g', quantity: 1, unitPriceEur: 7.99, lineTotalEur: 7.99, onSale: false, neededAmount: 820, leftoverAmount: 180, matchedIngredients: ['pileći file'], matchQuality: 'exact' },
      { productId: 'p_88', productName: 'Tikvice 500 g', category: 'povrće', packageSize: 500, packageUnit: 'g', quantity: 2, unitPriceEur: 1.29, lineTotalEur: 2.58, onSale: true, neededAmount: 900, leftoverAmount: 100, matchedIngredients: ['tikvice'], matchQuality: 'exact' },
      { productId: 'p_12', productName: 'Riža dugo zrno 1 kg', category: 'žitarice', packageSize: 1000, packageUnit: 'g', quantity: 1, unitPriceEur: 1.89, lineTotalEur: 1.89, onSale: false, neededAmount: 600, leftoverAmount: 400, matchedIngredients: ['riža'], matchQuality: 'exact' },
      { productId: 'p_31', productName: 'Leća crvena 500 g', category: 'mahunarke', packageSize: 500, packageUnit: 'g', quantity: 1, unitPriceEur: 1.59, lineTotalEur: 1.59, onSale: false, neededAmount: 400, leftoverAmount: 100, matchedIngredients: ['leća'], matchQuality: 'fuzzy' },
      { productId: 'p_7', productName: 'Luk crveni 1 kg', category: 'povrće', packageSize: 1000, packageUnit: 'g', quantity: 1, unitPriceEur: 0.99, lineTotalEur: 0.99, onSale: true, neededAmount: 500, leftoverAmount: 500, matchedIngredients: ['luk'], matchQuality: 'generic' },
      { productId: 'p_55', productName: 'Jaja M 10 kom', category: 'jaja', packageSize: 10, packageUnit: 'kom', quantity: 1, unitPriceEur: 2.49, lineTotalEur: 2.49, onSale: false, neededAmount: 8, leftoverAmount: 2, matchedIngredients: ['jaja'], matchQuality: 'exact' },
    ]
    if (!tight) lines.push({ productId: 'p_160', productName: 'Svinjski file ~600 g', category: 'meso', packageSize: 600, packageUnit: 'g', quantity: 1, unitPriceEur: 6.29, lineTotalEur: 6.29, onSale: true, neededAmount: 550, leftoverAmount: 50, matchedIngredients: ['svinjski file'], matchQuality: 'exact' })
    const totalEur = tight ? 33.8 : 58.4
    return {
      currency: 'EUR', totalEur, savedFromPantryEur: 9.2, savedFromWasteEur: 11.2,
      perMealEur: Math.round((totalEur / 21) * 100) / 100, budgetEur: budget, withinBudget: totalEur <= budget,
      deliveryComparison: { deliveryEur: 310, savedEur: Math.round((310 - totalEur) * 10) / 10, assumption: '21 obrok preko dostave, prosjek 14,76 € po obroku s dostavom i naknadama' },
      onSaleLinesCount: lines.filter((l) => l.onSale).length,
      lines,
      unmatched: [{ name: 'šafran', quantity: 1, unit: 'g' }],
      deepLink: 'https://www.konzum.hr/',
    }
  },
}
