import Fuse from 'fuse.js'
import type { Cart, CartLine, PlannedIngredient, Unit, Urgency } from '../schemas/index.js'
import { convertBetween, normalize, normalizeName } from './units.js'
import { createMatcher, perUnitPrice, type MatchQuality } from './matcher.js'
import { computePackaging } from './packaging.js'

/**
 * KuhAI — kosarica. Agregacija sastojaka kroz tjedan, odbijanje pantry-ja,
 * pakiranja, cijena, usporedba s dostavom. NISTA ovdje nije AI (D6, D18):
 * svaki broj koji ide na ekran je zbrajanje i mnozenje nad katalogom.
 */

// --- Ulazni tipovi (rucni TS tipovi su ok — nisu API oblik) ---

export type CatalogProduct = {
  id: string
  name: string
  category: string
  keywords: string[]
  packageSize: number
  packageUnit: Unit
  priceEur: number
  onSale: boolean
}

export type PantryItemForCart = {
  name: string
  quantity: number
  unit: Unit
  urgency: Urgency | null
}

export type MealForCart = {
  id: string
  title: string
  usesExpiring: string[]
  /** unit je string jer AI moze vratiti nesto izvan g/ml/kom — units.ts normalizira. */
  ingredients: Array<{ name: string; quantity: number; unit: string }>
}

export type CartInput = {
  meals: MealForCart[]
  pantry: PantryItemForCart[]
  catalog: CatalogProduct[]
  budgetEur: number | null
  mealsCount: number
}

/** Prosjek po obroku preko dostave, s dostavom i naknadama. Konstanta, ne procjena modela. */
export const DELIVERY_EUR_PER_MEAL = 14.76

export const KONZUM_DEEP_LINK = 'https://www.konzum.hr/web/'

// --- Interni tipovi ---

type AggregatedIngredient = {
  /** Originalno ime (prvo videno). */
  name: string
  normName: string
  unit: Unit
  /** Ukupno trazeno kroz tjedan. */
  needed: number
  /** Sto ostaje za kupiti nakon pantry-ja. */
  toBuy: number
  /** Koliko je pokriveno iz pantry-ja (u jedinici sastojka). */
  fromPantry: number
}

type PantryStock = {
  item: PantryItemForCart
  normName: string
  /** Preostala kolicina koju jos mozemo "potrositi" na sastojke. */
  remaining: number
}

const QUALITY_RANK: Record<MatchQuality, number> = { exact: 0, fuzzy: 1, generic: 2 }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// --- 1) Normalizacija + agregacija ---

/** Sastojci koje model navede a ne idu u kosaricu: voda iz slavine, led. */
const IGNORED_INGREDIENT = /(^|s)(voda|led)(s|$)|^voda za /

function aggregateIngredients(meals: MealForCart[]): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>()
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      if (!ing?.name) continue
      const norm = normalize(ing.quantity, ing.unit, ing.name)
      const normName = normalizeName(ing.name)
      if (!normName) continue
      const key = `${normName}|${norm.unit}`
      const existing = byKey.get(key)
      if (existing) {
        existing.needed += norm.quantity
        existing.toBuy = existing.needed
      } else {
        byKey.set(key, {
          name: ing.name.trim(),
          normName,
          unit: norm.unit,
          needed: norm.quantity,
          toBuy: norm.quantity,
          fromPantry: 0,
        })
      }
    }
  }
  return [...byKey.values()]
}

// --- 2) Pantry: nadi stavku po imenu (tocno, pa fuzzy) ---

function createPantryFinder(stock: PantryStock[]): (normName: string) => PantryStock | null {
  const fuse = new Fuse(stock, {
    keys: ['normName'],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  return (normName: string) => {
    const exact = stock.find((s) => s.normName === normName)
    if (exact) return exact
    const hit = fuse.search(normName)[0]
    return hit && hit.score != null && hit.score <= 0.4 ? hit.item : null
  }
}

/**
 * Odbij pantry od agregiranih sastojaka. Pantry zaliha se trosi redom —
 * dva sastojka koja oba mapiraju na "jaja" ne smiju oba odbiti istih 6 kom.
 */
function subtractPantry(ingredients: AggregatedIngredient[], pantry: PantryItemForCart[]): PantryStock[] {
  const stock: PantryStock[] = pantry
    .filter((p) => p?.name && p.quantity > 0)
    .map((item) => ({ item, normName: normalizeName(item.name), remaining: item.quantity }))
  if (stock.length === 0) return stock

  const find = createPantryFinder(stock)
  for (const ing of ingredients) {
    const hit = find(ing.normName)
    if (!hit || hit.remaining <= 0) continue
    // Pantry kolicina u jedinici sastojka.
    const haveInIngUnit = convertBetween(hit.remaining, hit.item.unit, ing.unit, ing.name)
    if (haveInIngUnit == null || haveInIngUnit <= 0) continue
    const used = Math.min(ing.needed, haveInIngUnit)
    ing.fromPantry = used
    ing.toBuy = Math.max(0, ing.needed - used)
    // Vrati potroseno u pantry jedinicu i smanji zalihu.
    const usedInPantryUnit = convertBetween(used, ing.unit, hit.item.unit, ing.name) ?? hit.remaining
    hit.remaining = Math.max(0, hit.remaining - usedInPantryUnit)
  }
  return stock
}

// --- 3) Vrijednost kolicine sastojka po katalogu ---

/** Eur vrijednost `quantity` u `unit` za sastojak, po perUnit cijeni matchanog proizvoda. */
function valueByCatalog(
  quantity: number,
  unit: Unit,
  ingredientName: string,
  product: CatalogProduct,
): number {
  const inPkgUnit = convertBetween(quantity, unit, product.packageUnit, ingredientName)
  if (inPkgUnit == null) return 0
  return inPkgUnit * perUnitPrice(product)
}

// --- 4) Glavna funkcija ---

export function buildCart(input: CartInput): Cart {
  const { meals, pantry, catalog, budgetEur } = input
  const mealsCount = Math.max(0, Math.floor(input.mealsCount ?? 0))
  const matcher = createMatcher(catalog)

  const ingredients = aggregateIngredients(meals)
  const stock = subtractPantry(ingredients, pantry)

  // Linije grupirane po proizvodu: vise sastojaka moze pasti na isti SKU.
  type LineAcc = {
    product: CatalogProduct
    quality: MatchQuality
    neededInPkgUnit: number
    ingredientNames: string[]
    representativeName: string
  }
  const lineByProduct = new Map<string, LineAcc>()
  const unmatched: PlannedIngredient[] = []
  let savedFromPantryEur = 0

  for (const ing of ingredients) {
    const m = matcher.match(ing.name, ing.unit)

    if (m && ing.fromPantry > 0) {
      savedFromPantryEur += valueByCatalog(ing.fromPantry, ing.unit, ing.name, m.product)
    }

    if (ing.toBuy <= 0) continue // pantry ga pokriva u cijelosti

    if (!m) {
      unmatched.push({ name: ing.name, quantity: round2(ing.toBuy), unit: ing.unit })
      continue
    }

    const pkg = computePackaging(ing.toBuy, ing.unit, m.product, ing.name)
    const acc = lineByProduct.get(m.product.id)
    if (acc) {
      acc.neededInPkgUnit += pkg.neededAmount
      if (!acc.ingredientNames.includes(ing.name)) acc.ingredientNames.push(ing.name)
      if (QUALITY_RANK[m.quality] > QUALITY_RANK[acc.quality]) acc.quality = m.quality
    } else {
      lineByProduct.set(m.product.id, {
        product: m.product,
        quality: m.quality,
        neededInPkgUnit: pkg.neededAmount,
        ingredientNames: [ing.name],
        representativeName: ing.name,
      })
    }
  }

  const lines: CartLine[] = []
  for (const acc of lineByProduct.values()) {
    const p = acc.product
    if (acc.quality === 'generic') {
      // Sinteticki proizvod: cijena je po jedinici, pa "pakiranje" = tocno trazena kolicina.
      const size = Math.max(1, Math.ceil(acc.neededInPkgUnit))
      const unitPrice = round2(size * p.priceEur)
      lines.push({
        productId: p.id,
        productName: p.name,
        category: p.category,
        packageSize: size,
        packageUnit: p.packageUnit,
        quantity: 1,
        unitPriceEur: unitPrice,
        lineTotalEur: unitPrice,
        onSale: false,
        neededAmount: round2(acc.neededInPkgUnit),
        leftoverAmount: round2(size - acc.neededInPkgUnit),
        matchedIngredients: acc.ingredientNames,
        matchQuality: 'generic',
      })
      continue
    }

    const pkg = computePackaging(acc.neededInPkgUnit, p.packageUnit, p, acc.representativeName)
    const unitPrice = round2(p.priceEur)
    lines.push({
      productId: p.id,
      productName: p.name,
      category: p.category,
      packageSize: p.packageSize,
      packageUnit: p.packageUnit,
      quantity: pkg.quantity,
      unitPriceEur: unitPrice,
      lineTotalEur: round2(pkg.quantity * p.priceEur),
      onSale: p.onSale,
      neededAmount: pkg.neededAmount,
      leftoverAmount: pkg.leftoverAmount,
      matchedIngredients: acc.ingredientNames,
      matchQuality: acc.quality,
    })
  }

  // Stabilan redoslijed za UI: kategorija pa ime.
  lines.sort((a, b) => a.category.localeCompare(b.category) || a.productName.localeCompare(b.productName))

  const totalEur = round2(lines.reduce((s, l) => s + l.lineTotalEur, 0))
  const savedFromWasteEur = computeSavedFromWaste(meals, stock, matcher)

  const deliveryEur = round2(mealsCount * DELIVERY_EUR_PER_MEAL)

  return {
    currency: 'EUR',
    totalEur,
    savedFromPantryEur: round2(savedFromPantryEur),
    savedFromWasteEur,
    perMealEur: mealsCount > 0 ? round2(totalEur / mealsCount) : 0,
    budgetEur: budgetEur == null ? null : round2(budgetEur),
    withinBudget: budgetEur == null ? true : totalEur <= budgetEur,
    deliveryComparison: {
      deliveryEur,
      savedEur: round2(deliveryEur - totalEur),
      assumption: `${mealsCount} obroka preko dostave, prosjek 14,76 € po obroku s dostavom i naknadama`,
    },
    onSaleLinesCount: lines.filter((l) => l.onSale).length,
    lines,
    unmatched,
    deepLink: KONZUM_DEEP_LINK,
  }
}

/**
 * savedFromWasteEur: SAMO ono sto bi se bacilo a plan ga je iskoristio.
 * Unija meal.usesExpiring × pantry s urgency 'umire' × katalog — cijena
 * CIJELE pantry kolicine te namirnice po perUnit. Svaka pantry stavka jednom.
 */
function computeSavedFromWaste(
  meals: MealForCart[],
  stock: PantryStock[],
  matcher: ReturnType<typeof createMatcher>,
): number {
  const expiringNames = new Set<string>()
  for (const meal of meals) {
    for (const n of meal.usesExpiring ?? []) {
      const nn = normalizeName(n)
      if (nn) expiringNames.add(nn)
    }
  }
  if (expiringNames.size === 0) return 0

  const dying = stock.filter((s) => s.item.urgency === 'umire')
  if (dying.length === 0) return 0
  const find = createPantryFinder(dying)

  const counted = new Set<PantryStock>()
  let total = 0
  for (const name of expiringNames) {
    const hit = find(name)
    if (!hit || counted.has(hit)) continue
    counted.add(hit)
    const m = matcher.match(hit.item.name, hit.item.unit)
    if (!m) continue
    total += valueByCatalog(hit.item.quantity, hit.item.unit, hit.item.name, m.product)
  }
  return round2(total)
}
