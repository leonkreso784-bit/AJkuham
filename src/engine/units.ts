import type { Unit } from '../schemas/index.js'

/**
 * KuhAI — normalizacija jedinica u kanonske g / ml / kom.
 *
 * Tablica pretvorbi iz docs/DATA-MODEL.md zivi OVDJE, u kodu, da bude
 * citljiva i testabilna. Nista od ovoga nije AI: model smije vratiti
 * "2 zlice" ili "1 kg", a ovaj modul to deterministicki svodi na brojke
 * koje engine dalje moze zbrajati.
 */

/** Skini dijakritiku (č/ć->c, š->s, ž->z, đ->d), lowercase, trim. */
export function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/č|ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Normalizirano ime sastojka za usporedbe/agregaciju. */
export function normalizeName(name: string): string {
  return stripDiacritics(name).replace(/\s+/g, ' ')
}

/**
 * Faktor pretvorbe u kanonsku jedinicu. Kljucevi su vec bez dijakritike.
 * Jedinice volumena idu u ml, mase u g, brojive u kom.
 */
const UNIT_TABLE: Record<string, { unit: Unit; factor: number }> = {
  // masa
  g: { unit: 'g', factor: 1 },
  gr: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grama: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  kilogram: { unit: 'g', factor: 1000 },
  dag: { unit: 'g', factor: 10 },
  dkg: { unit: 'g', factor: 10 },
  prstohvat: { unit: 'g', factor: 1 },
  // volumen
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  lit: { unit: 'ml', factor: 1000 },
  litra: { unit: 'ml', factor: 1000 },
  litre: { unit: 'ml', factor: 1000 },
  dl: { unit: 'ml', factor: 100 },
  cl: { unit: 'ml', factor: 10 },
  zlica: { unit: 'ml', factor: 15 },
  zlice: { unit: 'ml', factor: 15 },
  zlicu: { unit: 'ml', factor: 15 },
  tbsp: { unit: 'ml', factor: 15 },
  zlicica: { unit: 'ml', factor: 5 },
  zlicice: { unit: 'ml', factor: 5 },
  zlicicu: { unit: 'ml', factor: 5 },
  tsp: { unit: 'ml', factor: 5 },
  salica: { unit: 'ml', factor: 240 },
  salice: { unit: 'ml', factor: 240 },
  salicu: { unit: 'ml', factor: 240 },
  cup: { unit: 'ml', factor: 240 },
  casa: { unit: 'ml', factor: 200 },
  // brojivo
  kom: { unit: 'kom', factor: 1 },
  'kom.': { unit: 'kom', factor: 1 },
  komad: { unit: 'kom', factor: 1 },
  komada: { unit: 'kom', factor: 1 },
  komadi: { unit: 'kom', factor: 1 },
  pcs: { unit: 'kom', factor: 1 },
  pc: { unit: 'kom', factor: 1 },
  glavica: { unit: 'kom', factor: 1 },
  glavice: { unit: 'kom', factor: 1 },
  cesanj: { unit: 'kom', factor: 1 },
  cesnja: { unit: 'kom', factor: 1 },
  cesnjeva: { unit: 'kom', factor: 1 },
  konzerva: { unit: 'kom', factor: 1 },
  konzerve: { unit: 'kom', factor: 1 },
  pakiranje: { unit: 'kom', factor: 1 },
  pak: { unit: 'kom', factor: 1 },
  vezica: { unit: 'kom', factor: 1 },
  struk: { unit: 'kom', factor: 1 },
  kriska: { unit: 'kom', factor: 1 },
  kriske: { unit: 'kom', factor: 1 },
  saka: { unit: 'kom', factor: 1 },
}

/**
 * Gruba gustoca g/ml po imenu sastojka (substring match na normaliziranom
 * imenu). Nije znanstveno — kosarica se zaokruzuje na pakiranja pa 10 %
 * greske nista ne mijenja. Nepoznato = 1 (voda).
 */
const DENSITY_G_PER_ML: Array<[string, number]> = [
  ['brasno', 0.55],
  ['riza', 0.8],
  ['secer', 0.85],
  ['zob', 0.4],
  ['zobene', 0.4],
  ['pahuljice', 0.4],
  ['lece', 0.85],
  ['leca', 0.85],
  ['grah', 0.8],
  ['kvinoja', 0.75],
  ['quinoa', 0.75],
  ['kus kus', 0.75],
  ['kuskus', 0.75],
  ['bulgur', 0.75],
  ['krusne mrvice', 0.45],
  ['mrvice', 0.45],
  ['kakao', 0.5],
  ['sol', 1.2],
  ['med', 1.4],
  ['ulje', 0.92],
  ['maslac', 0.95],
  ['mlijeko', 1.03],
  ['jogurt', 1.05],
  ['vrhnje', 1.0],
  ['orasi', 0.5],
  ['bademi', 0.6],
  ['sjemenke', 0.6],
  ['tjestenina', 0.6],
  ['spageti', 0.6],
  ['parmezan', 0.45],
  ['sir', 0.6],
]

/**
 * Prosjecna masa jednog komada u gramima, po imenu sastojka. Ovo postoji
 * da "2 kom luka" moze stati uz pakiranje "luk 1 kg". Substring match.
 */
const PIECE_WEIGHT_G: Array<[string, number]> = [
  ['tost', 30],
  ['krisk', 30],
  ['mladi luk', 30],
  ['jaje', 60],
  ['jaja', 60],
  ['luk', 150],
  ['crveni luk', 150],
  ['limun', 100],
  ['limeta', 60],
  ['paprik', 150],
  ['rajcic', 120],
  ['krumpir', 150],
  ['mrkv', 80],
  ['tikvic', 250],
  ['kupus', 1000],
  ['avokad', 150],
  ['banan', 120],
  ['jabuk', 150],
  ['krusk', 160],
  ['narancu', 180],
  ['naranc', 180],
  ['cesnjak', 5],
  ['cesanj', 5],
  ['konzerv', 400],
  ['patlidzan', 300],
  ['brokul', 400],
  ['cvjetac', 600],
  ['salat', 300],
  ['krastav', 200],
  ['kruh', 50], // recept broji kriske, ne struce
  ['tortilj', 60],
  ['pecivo', 70],
  ['zemlj', 70],
  ['pileci file', 200],
  ['pileca prsa', 200],
  ['batak', 150],
  ['file', 150],
  ['odrezak', 150],
  ['kobasic', 100],
  ['slanin', 100],
  ['tofu', 200],
  ['chia', 1],
]

/** Nadi prvi [kljuc, vrijednost] par ciji je kljuc substring imena. */
function lookupByName(table: Array<[string, number]>, ingredientName: string | undefined): number | null {
  if (!ingredientName) return null
  const n = normalizeName(ingredientName)
  for (const [key, value] of table) {
    if (n.includes(key)) return value
  }
  return null
}

export function densityFor(ingredientName?: string): number {
  return lookupByName(DENSITY_G_PER_ML, ingredientName) ?? 1
}

export function pieceWeightFor(ingredientName?: string): number | null {
  return lookupByName(PIECE_WEIGHT_G, ingredientName)
}

/**
 * Normaliziraj kolicinu + jedinicu u g / ml / kom.
 * Nepoznata jedinica -> tretiraj kao 'kom' i logiraj (demo ne smije pasti).
 */
export function normalize(
  quantity: number,
  unit: string,
  ingredientName?: string,
): { quantity: number; unit: Unit } {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  const key = stripDiacritics(unit ?? '').replace(/\s+/g, '')
  const entry = UNIT_TABLE[key]
  if (!entry) {
    console.warn(`[units] nepoznata jedinica "${unit}" za "${ingredientName ?? '?'}" -> kom`)
    return { quantity: q, unit: 'kom' }
  }
  return { quantity: round3(q * entry.factor), unit: entry.unit }
}

/**
 * Pretvori kolicinu iz jedne kanonske jedinice u drugu za KONKRETAN sastojak.
 * Koristi se kad sastojak dolazi u ml a pakiranje je u g (ili obrnuto), ili
 * kad recept broji komade a polica vaze grame. Vrati null ako nema smisla
 * (npr. kom -> g za sastojak kojem ne znamo masu komada).
 */
export function convertBetween(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit,
  ingredientName?: string,
): number | null {
  if (fromUnit === toUnit) return quantity
  const density = densityFor(ingredientName)
  const piece = pieceWeightFor(ingredientName)

  if (fromUnit === 'ml' && toUnit === 'g') return round3(quantity * density)
  if (fromUnit === 'g' && toUnit === 'ml') return round3(quantity / density)

  if (fromUnit === 'kom' && toUnit === 'g') return piece == null ? null : round3(quantity * piece)
  if (fromUnit === 'g' && toUnit === 'kom') return piece == null ? null : round3(quantity / piece)

  // kom <-> ml ide preko grama pa gustoce
  if (fromUnit === 'kom' && toUnit === 'ml') return piece == null ? null : round3((quantity * piece) / density)
  if (fromUnit === 'ml' && toUnit === 'kom') return piece == null ? null : round3((quantity * density) / piece)

  return null
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
