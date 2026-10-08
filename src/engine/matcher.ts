import Fuse from 'fuse.js'
import type { CatalogProduct } from './cart.js'
import type { Unit } from '../schemas/index.js'
import { normalizeName } from './units.js'

/**
 * KuhAI — sastojak -> SKU iz seedanog kataloga.
 *
 * fuse.js nad name + keywords, sve bez dijakritike. Nema LLM fallbacka:
 * ako fuzzy ne prode, pogadamo kategoriju iz imena preko malog rjecnika i
 * vratimo sinteticki "generic" proizvod po prosjecnoj cijeni kategorije.
 * Kosarica NIKAD nije prazna zbog neuspjelog matcha; sto ni kategorija ne
 * pokrije ide u cart.unmatched (matchIngredient vraca null).
 */

export type MatchQuality = 'exact' | 'fuzzy' | 'generic'

export type MatchResult = {
  product: CatalogProduct
  quality: MatchQuality
}

type IndexedProduct = {
  product: CatalogProduct
  name: string
  keywords: string[]
}

export type Matcher = {
  match: (name: string, unit?: Unit) => MatchResult | null
}

/** Pragovi fuse score-a (0 = savrseno, 1 = nista). */
const EXACT_SCORE = 0.1
const FUZZY_SCORE = 0.4
const FUSE_THRESHOLD = 0.35

/**
 * Rjecnik za pogadanje kategorije iz imena kad fuzzy ne prode.
 * Redoslijed je bitan: specificnije kategorije prvo ("kokosovo mlijeko" je
 * suho, pa suho ide prije mlijecno; "svjezi spinat" je svjeze, pa smrznuto
 * hvata samo rijec "smrznut").
 */
const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/kokosov|konzerv|pasirana|pelat|umak|past[aeu]|tjesten|spaget|riz|brasn|secer|zob|lec[ae]|grah|slanutak|kvinoj|bulgur|kus ?kus|orah|badem|sjemenk|ulje|ocat|med|kakao|cokolad|keks|musli|granol|tun[ae]|sardin|kukuruz/, 'suho'],
  [/sol|papar|zacin|curry|kurkum|cimet|origano|bosiljak|persin|timijan|ruzmarin|u prahu|cili|chili|kim|lovor|vegeta|senf|kecap|ketchup|majonez|soj[ai]|sezam|vanil|prasak/, 'zacini'],
  [/piletin|pilec|pile|puretin|purec|svinj|govedin|govedj|junet|janjet|meso|mljeven|kobasic|slanin|sunk|salam|pancet|file|odrezak|batak|zabatak|prsa|riba|losos|oslic|skus|kozic|skamp|lignj/, 'meso'],
  [/mlijek|jogurt|sir|sira|sirev|vrhnje|maslac|skuta|mozzarel|parmez|gauda|feta|kefir|jaj[ae]|rikot/, 'mlijecno'],
  [/smrznut|zamrznut|ledeni|sladoled/, 'smrznuto'],
  [/kruh|pecivo|zemlj|tortilj|pita|lepinj|toast|tost|baget|kifl|burek|brioche|kreker/, 'pekara'],
  [/voda|sok|sokov|caj|kav[ae]|pivo|vino|limunad|napitak|gazir|mineral/, 'napitci'],
  [/luk|cesnjak|rajcic|paprik|krumpir|mrkv|tikvic|kupus|salat|krastav|limun|limet|naranc|banan|jabuk|krusk|avokad|brokul|cvjetac|patlidz|spina[ct]|blitv|celer|porilu|gljiv|sampinjon|bobic|jagod|borovnic|grozd|rukol|dinj|lubenic|kelj|zelje|povrc|voce|dumbir|svjez|kopar|menta|cikl|rotkv|tikv|bundev|mahun|grasak/, 'svjeze'],
]

export function guessCategory(ingredientName: string): string | null {
  const n = normalizeName(ingredientName)
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(n)) return cat
  }
  return null
}

/** Normaliziraj kategoriju iz kataloga (seed moze imati "mliječno", "svježe"). */
export function normalizeCategory(category: string): string {
  return normalizeName(category)
}

/** Cijena po jednoj jedinici pakiranja (po g / ml / kom). */
export function perUnitPrice(p: CatalogProduct): number {
  return p.packageSize > 0 ? p.priceEur / p.packageSize : p.priceEur
}

/**
 * Sinteticki proizvod za kategoriju: id 'generic_<kategorija>', packageSize 1,
 * packageUnit = jedinica sastojka, cijena = prosjecna perUnit cijena kategorije
 * u toj jedinici (ili bilo kojoj jedinici ako nema iste). Deterministicki.
 */
function buildGeneric(category: string, unit: Unit, catalog: CatalogProduct[]): CatalogProduct | null {
  const inCat = catalog.filter((p) => normalizeCategory(p.category) === category)
  if (inCat.length === 0) return null
  const sameUnit = inCat.filter((p) => p.packageUnit === unit)
  const pool = sameUnit.length > 0 ? sameUnit : inCat
  const avg = pool.reduce((s, p) => s + perUnitPrice(p), 0) / pool.length
  return {
    id: `generic_${category}`,
    name: `Generički proizvod (${category})`,
    category,
    keywords: [],
    packageSize: 1,
    packageUnit: unit,
    priceEur: Math.round(avg * 10000) / 10000,
    onSale: false,
  }
}

/**
 * Kreiraj matcher nad katalogom. Fuse index se gradi jednom po referenci
 * kataloga (WeakMap cache) — ruta smije zvati matchIngredient u petlji.
 */
export function createMatcher(catalog: CatalogProduct[]): Matcher {
  const indexed: IndexedProduct[] = catalog.map((product) => ({
    product,
    name: normalizeName(product.name),
    keywords: (product.keywords ?? []).map(normalizeName),
  }))

  const fuse = new Fuse(indexed, {
    keys: [
      { name: 'keywords', weight: 0.7 },
      { name: 'name', weight: 0.3 },
    ],
    includeScore: true,
    threshold: FUSE_THRESHOLD,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })

  const genericCache = new Map<string, CatalogProduct | null>()

  function match(rawName: string, unit: Unit = 'kom'): MatchResult | null {
    const query = normalizeName(rawName)
    if (!query) return null

    // 1) tocno podudaranje keyworda ili imena -> exact
    const exactHit = indexed.find((ip) => ip.name === query || ip.keywords.includes(query))
    if (exactHit) return { product: exactHit.product, quality: 'exact' }

    // 2) keyword sadrzan u upitu kao cijela rijec ("pileca prsa" u "pileca prsa bez koze")
    //    -> fuzzy. Fuse lose boduje dug upit s viskom rijeci, pa ovo ide prije.
    const padded = ` ${query} `
    let containHit: IndexedProduct | null = null
    let containLen = 0
    for (const ip of indexed) {
      for (const kw of ip.keywords) {
        if (kw.length >= 3 && kw.length > containLen && padded.includes(` ${kw} `)) {
          containHit = ip
          containLen = kw.length
        }
      }
    }
    if (containHit) return { product: containHit.product, quality: 'fuzzy' }

    // 3) fuse
    const results = fuse.search(query)
    const best = results[0]
    if (best && best.score != null) {
      if (best.score <= EXACT_SCORE) return { product: best.item.product, quality: 'exact' }
      if (best.score <= FUZZY_SCORE) return { product: best.item.product, quality: 'fuzzy' }
    }

    // 4) generic po kategoriji iz imena
    const category = guessCategory(query)
    if (!category) return null
    const cacheKey = `${category}|${unit}`
    if (!genericCache.has(cacheKey)) genericCache.set(cacheKey, buildGeneric(category, unit, catalog))
    const generic = genericCache.get(cacheKey) ?? null
    return generic ? { product: generic, quality: 'generic' } : null
  }

  return { match }
}

const matcherCache = new WeakMap<CatalogProduct[], Matcher>()

function matcherFor(catalog: CatalogProduct[]): Matcher {
  let m = matcherCache.get(catalog)
  if (!m) {
    m = createMatcher(catalog)
    matcherCache.set(catalog, m)
  }
  return m
}

/**
 * Sastojak -> proizvod. null samo kad ni kategorija nije pogodena —
 * onda ide u cart.unmatched ("dokupi sam").
 */
export function matchIngredient(
  name: string,
  catalog: CatalogProduct[],
  unit: Unit = 'kom',
): MatchResult | null {
  return matcherFor(catalog).match(name, unit)
}
