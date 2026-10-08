/**
 * KuhAI — brze provjere engine-a. Bez test frameworka:
 *   npx tsx src/engine/__check.ts
 * Pakiranja i cijene se ne smiju testirati tek na demu (D6).
 */
import { normalize, convertBetween, normalizeName } from './units.js'
import { computePackaging } from './packaging.js'
import { matchIngredient, guessCategory } from './matcher.js'
import { buildCart, DELIVERY_EUR_PER_MEAL, type CatalogProduct, type CartInput } from './cart.js'
import { Cart } from '../schemas/index.js'

let failed = 0
function check(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ok   ${msg}`)
  } else {
    failed++
    console.error(`  FAIL ${msg}`)
  }
}
function approx(a: number, b: number, eps = 0.011) {
  return Math.abs(a - b) <= eps
}

// --- katalog (~10 proizvoda) ---
const catalog: CatalogProduct[] = [
  { id: 'p_1', name: 'Pileći file 1 kg', category: 'meso', keywords: ['pileći file', 'piletina', 'pileća prsa'], packageSize: 1000, packageUnit: 'g', priceEur: 7.99, onSale: true },
  { id: 'p_2', name: 'Riža dugo zrno 1 kg', category: 'suho', keywords: ['riža', 'riza dugo zrno'], packageSize: 1000, packageUnit: 'g', priceEur: 2.49, onSale: false },
  { id: 'p_3', name: 'Jaja L 10/1', category: 'mliječno', keywords: ['jaja', 'jaje'], packageSize: 10, packageUnit: 'kom', priceEur: 2.79, onSale: false },
  { id: 'p_4', name: 'Luk žuti 1 kg', category: 'svježe', keywords: ['luk', 'luk žuti', 'crveni luk'], packageSize: 1000, packageUnit: 'g', priceEur: 1.29, onSale: false },
  { id: 'p_5', name: 'Maslinovo ulje 500 ml', category: 'suho', keywords: ['maslinovo ulje', 'ulje'], packageSize: 500, packageUnit: 'ml', priceEur: 6.49, onSale: true },
  { id: 'p_6', name: 'Mlijeko 2,8% 1 l', category: 'mliječno', keywords: ['mlijeko'], packageSize: 1000, packageUnit: 'ml', priceEur: 1.19, onSale: false },
  { id: 'p_7', name: 'Pelati 400 g', category: 'suho', keywords: ['pelati', 'rajčica pelat', 'konzerva rajčice'], packageSize: 400, packageUnit: 'g', priceEur: 0.99, onSale: false },
  { id: 'p_8', name: 'Sir gauda 300 g', category: 'mliječno', keywords: ['gauda', 'sir', 'sir gauda'], packageSize: 300, packageUnit: 'g', priceEur: 3.49, onSale: false },
  { id: 'p_9', name: 'Brašno glatko 1 kg', category: 'suho', keywords: ['brašno', 'brasno glatko'], packageSize: 1000, packageUnit: 'g', priceEur: 1.09, onSale: false },
  { id: 'p_10', name: 'Svinjski vrat 1 kg', category: 'meso', keywords: ['svinjski vrat', 'svinjetina'], packageSize: 1000, packageUnit: 'g', priceEur: 6.99, onSale: false },
  { id: 'p_11', name: 'Rajčica 500 g', category: 'svježe', keywords: ['rajčica', 'rajcice'], packageSize: 500, packageUnit: 'g', priceEur: 1.79, onSale: false },
]

console.log('\n== units ==')
{
  const a = normalize(1.5, 'kg', 'piletina')
  check(a.quantity === 1500 && a.unit === 'g', `1.5 kg -> ${a.quantity} ${a.unit}`)
  const b = normalize(2, 'žlice', 'ulje')
  check(b.quantity === 30 && b.unit === 'ml', `2 žlice -> ${b.quantity} ${b.unit}`)
  const c = normalize(1, 'zlicica', 'sol')
  check(c.quantity === 5 && c.unit === 'ml', `1 zlicica -> ${c.quantity} ${c.unit}`)
  const d = normalize(2, 'dl', 'mlijeko')
  check(d.quantity === 200 && d.unit === 'ml', `2 dl -> ${d.quantity} ${d.unit}`)
  const e = normalize(3, 'komad', 'jaja')
  check(e.quantity === 3 && e.unit === 'kom', `3 komad -> ${e.quantity} ${e.unit}`)
  const f = normalize(1, 'šalica', 'riža')
  check(f.quantity === 240 && f.unit === 'ml', `1 šalica -> ${f.quantity} ${f.unit}`)
  const g = normalize(2, 'kom.', 'luk')
  check(g.quantity === 2 && g.unit === 'kom', `2 kom. -> ${g.quantity} ${g.unit}`)
  const h = normalize(5, 'dag', 'sir')
  check(h.quantity === 50 && h.unit === 'g', `5 dag -> ${h.quantity} ${h.unit}`)
  console.log('  (ocekujem warn za nepoznatu jedinicu dolje)')
  const i = normalize(1, 'šaka-nesto', 'orasi')
  check(i.unit === 'kom' && i.quantity === 1, `nepoznata jedinica -> ${i.quantity} ${i.unit}`)

  check(convertBetween(240, 'ml', 'g', 'riža') === 192, `240 ml riže -> ${convertBetween(240, 'ml', 'g', 'riža')} g (gustoća 0.8)`)
  check(convertBetween(2, 'kom', 'g', 'luk') === 300, `2 kom luka -> ${convertBetween(2, 'kom', 'g', 'luk')} g`)
  check(convertBetween(120, 'g', 'kom', 'jaja') === 2, `120 g jaja -> ${convertBetween(120, 'g', 'kom', 'jaja')} kom`)
  check(convertBetween(1, 'kom', 'g', 'šafran') === null, `1 kom šafrana -> g = null (nepoznata masa komada)`)
  check(convertBetween(100, 'ml', 'g', 'voda') === 100, `100 ml vode -> 100 g (gustoća 1)`)
  check(normalizeName('  Pileći  File ') === 'pileci file', `normalizeName('  Pileći  File ') = '${normalizeName('  Pileći  File ')}'`)
}

console.log('\n== packaging ==')
{
  const r1 = computePackaging(180, 'g', { packageSize: 1000, packageUnit: 'g' }, 'pileći file')
  check(r1.quantity === 1 && r1.neededAmount === 180 && r1.leftoverAmount === 820, `180 g / pak 1000 g -> qty=${r1.quantity} needed=${r1.neededAmount} leftover=${r1.leftoverAmount}`)
  const r2 = computePackaging(1200, 'g', { packageSize: 500, packageUnit: 'g' }, 'rajčica')
  check(r2.quantity === 3 && r2.leftoverAmount === 300, `1200 g / pak 500 g -> qty=${r2.quantity} leftover=${r2.leftoverAmount}`)
  const r3 = computePackaging(2, 'kom', { packageSize: 1000, packageUnit: 'g' }, 'luk')
  check(r3.quantity === 1 && r3.neededAmount === 300 && r3.leftoverAmount === 700, `2 kom luka / pak 1000 g -> qty=${r3.quantity} needed=${r3.neededAmount} g leftover=${r3.leftoverAmount}`)
  const r4 = computePackaging(12, 'kom', { packageSize: 10, packageUnit: 'kom' }, 'jaja')
  check(r4.quantity === 2 && r4.leftoverAmount === 8, `12 jaja / pak 10 -> qty=${r4.quantity} leftover=${r4.leftoverAmount}`)
  const r5 = computePackaging(1000, 'g', { packageSize: 1000, packageUnit: 'g' }, 'riža')
  check(r5.quantity === 1 && r5.leftoverAmount === 0, `1000 g / pak 1000 g -> qty=${r5.quantity} (ne 2!)`)
  const r6 = computePackaging(45, 'ml', { packageSize: 500, packageUnit: 'ml' }, 'ulje')
  check(r6.quantity === 1 && r6.leftoverAmount === 455, `45 ml ulja / pak 500 ml -> qty=${r6.quantity} (NE 10 litara) leftover=${r6.leftoverAmount}`)
  const r7 = computePackaging(1, 'kom', { packageSize: 400, packageUnit: 'g' }, 'konzerva pelata')
  check(r7.quantity === 1 && r7.neededAmount === 400, `1 kom konzerve / pak 400 g -> qty=${r7.quantity} needed=${r7.neededAmount}`)
  const r8 = computePackaging(1, 'kom', { packageSize: 100, packageUnit: 'g' }, 'šafran')
  check(r8.quantity === 1 && r8.neededAmount === 100 && r8.leftoverAmount === 0, `nepretvorivo (kom šafrana -> g) -> fallback qty=1 needed=pakiranje`)
}

console.log('\n== matcher ==')
{
  const m1 = matchIngredient('pileći file', catalog, 'g')
  check(m1?.product.id === 'p_1' && m1.quality === 'exact', `'pileći file' -> ${m1?.product.id} (${m1?.quality})`)
  const m2 = matchIngredient('Piletina', catalog, 'g')
  check(m2?.product.id === 'p_1' && m2.quality === 'exact', `'Piletina' -> ${m2?.product.id} (${m2?.quality})`)
  const m3 = matchIngredient('pileca prsa bez kože', catalog, 'g')
  check(m3?.product.id === 'p_1', `'pileca prsa bez kože' -> ${m3?.product.id} (${m3?.quality})`)
  const m4 = matchIngredient('riža', catalog, 'g')
  check(m4?.product.id === 'p_2' && m4.quality === 'exact', `'riža' -> ${m4?.product.id} (${m4?.quality})`)
  const m5 = matchIngredient('crveni luk', catalog, 'kom')
  check(m5?.product.id === 'p_4', `'crveni luk' -> ${m5?.product.id} (${m5?.quality})`)
  const m6 = matchIngredient('junetina mljevena', catalog, 'g')
  check(m6?.quality === 'generic' && m6.product.id === 'generic_meso' && m6.product.packageUnit === 'g', `'junetina mljevena' -> ${m6?.product.id} (${m6?.quality}) perUnit=${m6?.product.priceEur}`)
  const m7 = matchIngredient('šafran', catalog, 'g')
  check(m7 === null, `'šafran' -> null (ide u unmatched)`)
  const m8 = matchIngredient('mozzarella', catalog, 'g')
  check(m8?.quality === 'generic' && m8.product.id === 'generic_mlijecno', `'mozzarella' -> ${m8?.product.id} (${m8?.quality})`)
  check(guessCategory('kokosovo mlijeko') === 'suho', `guessCategory('kokosovo mlijeko') = ${guessCategory('kokosovo mlijeko')}`)
  check(guessCategory('svježi špinat') === 'svjeze', `guessCategory('svježi špinat') = ${guessCategory('svježi špinat')}`)
}

console.log('\n== cart ==')
{
  const input: CartInput = {
    meals: [
      {
        id: 'm_1', title: 'Piletina s rižom', usesExpiring: ['pileći file'],
        ingredients: [
          { name: 'pileći file', quantity: 180, unit: 'g' },
          { name: 'riža', quantity: 1, unit: 'šalica' },
          { name: 'luk', quantity: 1, unit: 'kom' },
          { name: 'maslinovo ulje', quantity: 2, unit: 'žlice' },
        ],
      },
      {
        id: 'm_2', title: 'Omlet sa sirom', usesExpiring: [],
        ingredients: [
          { name: 'jaja', quantity: 3, unit: 'kom' },
          { name: 'sir gauda', quantity: 50, unit: 'g' },
          { name: 'mlijeko', quantity: 0.5, unit: 'dl' },
        ],
      },
      {
        id: 'm_3', title: 'Pileći curry', usesExpiring: ['pileći file'],
        ingredients: [
          { name: 'Pileći file', quantity: 0.4, unit: 'kg' },
          { name: 'luk', quantity: 2, unit: 'kom' },
          { name: 'pelati', quantity: 1, unit: 'konzerva' },
          { name: 'šafran', quantity: 1, unit: 'g' },
          { name: 'junetina mljevena', quantity: 200, unit: 'g' },
        ],
      },
    ],
    pantry: [
      { name: 'Pileći file', quantity: 300, unit: 'g', urgency: 'umire' },
      { name: 'jaja', quantity: 6, unit: 'kom', urgency: 'ok' },
      { name: 'mlijeko', quantity: 1000, unit: 'ml', urgency: 'skoro' },
    ],
    catalog,
    budgetEur: 20,
    mealsCount: 3,
  }

  const cart = buildCart(input)
  console.log(JSON.stringify(cart, null, 2))
  check(Cart.safeParse(cart).success, 'buildCart izlaz prolazi Zod Cart shemu (API.md 12)')

  const line = (id: string) => cart.lines.find((l) => l.productId === id)

  // Piletina: 180 + 400 = 580 g trazeno, pantry 300 g -> kupi 280 g -> 1 pak od 1 kg, leftover 720
  const pil = line('p_1')
  check(!!pil && pil.quantity === 1 && pil.neededAmount === 280 && pil.leftoverAmount === 720, `piletina: 580 g - 300 g pantry = 280 g -> qty=${pil?.quantity} needed=${pil?.neededAmount} leftover=${pil?.leftoverAmount}`)
  check(pil?.matchedIngredients.length === 1, `piletina: 'pileći file' i 'Pileći file' agregirani u jedan sastojak (${pil?.matchedIngredients.join(', ')})`)
  check(pil?.lineTotalEur === 7.99 && pil.onSale === true, `piletina lineTotal=${pil?.lineTotalEur} onSale=${pil?.onSale}`)

  // Luk: 1 + 2 = 3 kom -> 450 g -> 1 pak 1 kg, leftover 550
  const luk = line('p_4')
  check(!!luk && luk.quantity === 1 && luk.neededAmount === 450 && luk.leftoverAmount === 550, `luk: 3 kom -> ${luk?.neededAmount} g, qty=${luk?.quantity} leftover=${luk?.leftoverAmount}`)

  // Riza: 1 salica = 240 ml -> 192 g -> 1 pak
  const riza = line('p_2')
  check(!!riza && riza.quantity === 1 && riza.neededAmount === 192, `riža: 1 šalica -> ${riza?.neededAmount} g, qty=${riza?.quantity}`)

  // Ulje: 30 ml -> 1 pak od 500 ml (ne 10 litara)
  const ulje = line('p_5')
  check(!!ulje && ulje.quantity === 1 && ulje.neededAmount === 30, `ulje: 2 žlice -> ${ulje?.neededAmount} ml, qty=${ulje?.quantity} (D6: nema 10 litara)`)

  // Jaja i mlijeko u cijelosti iz pantry-ja -> nema linije
  check(line('p_3') === undefined, `jaja: 3 kom pokriveno iz pantry-ja (6 kom) -> nema linije`)
  check(line('p_6') === undefined, `mlijeko: 50 ml pokriveno iz pantry-ja -> nema linije`)

  // Pelati: 1 konzerva -> 400 g -> 1 pak
  const pelati = line('p_7')
  check(!!pelati && pelati.quantity === 1 && pelati.neededAmount === 400, `pelati: 1 konzerva -> ${pelati?.neededAmount} g, qty=${pelati?.quantity}`)

  // Generic junetina
  const jun = line('generic_meso')
  check(!!jun && jun.matchQuality === 'generic' && jun.quantity === 1 && jun.packageSize === 200, `junetina: generic_meso, size=${jun?.packageSize} g, total=${jun?.lineTotalEur}`)

  // Unmatched: safran
  check(cart.unmatched.length === 1 && cart.unmatched[0]?.name === 'šafran', `unmatched = ${JSON.stringify(cart.unmatched)}`)

  // savedFromPantry: 300 g piletine * 7.99/1000 + 3 jaja * 0.279 + 50 ml mlijeka * 0.00119
  const expectedPantry = 300 * (7.99 / 1000) + 3 * (2.79 / 10) + 50 * (1.19 / 1000)
  check(approx(cart.savedFromPantryEur, expectedPantry), `savedFromPantryEur=${cart.savedFromPantryEur} (ocekivano ~${expectedPantry.toFixed(2)})`)

  // savedFromWaste: samo piletina (umire), cijela pantry kolicina 300 g * 7.99/1000 = 2.40
  check(approx(cart.savedFromWasteEur, 2.4), `savedFromWasteEur=${cart.savedFromWasteEur} (ocekivano 2.40 — samo ono sto umire)`)
  check(cart.savedFromWasteEur < cart.savedFromPantryEur, `waste (${cart.savedFromWasteEur}) < pantry (${cart.savedFromPantryEur}) — dvije razlicite brojke`)

  // Total
  const expectedTotal = cart.lines.reduce((s, l) => s + l.lineTotalEur, 0)
  check(approx(cart.totalEur, expectedTotal), `totalEur=${cart.totalEur} = suma linija`)
  check(cart.onSaleLinesCount === 2, `onSaleLinesCount=${cart.onSaleLinesCount} (piletina + ulje)`)
  check(cart.perMealEur === Math.round((cart.totalEur / 3) * 100) / 100, `perMealEur=${cart.perMealEur}`)
  check(cart.withinBudget === cart.totalEur <= 20, `withinBudget=${cart.withinBudget} (total ${cart.totalEur} vs budget 20)`)

  // Delivery
  check(cart.deliveryComparison.deliveryEur === Math.round(3 * DELIVERY_EUR_PER_MEAL * 100) / 100, `deliveryEur=${cart.deliveryComparison.deliveryEur} (3 × 14.76)`)
  check(approx(cart.deliveryComparison.savedEur, cart.deliveryComparison.deliveryEur - cart.totalEur), `delivery savedEur=${cart.deliveryComparison.savedEur}`)
  check(cart.deliveryComparison.assumption === '3 obroka preko dostave, prosjek 14,76 € po obroku s dostavom i naknadama', `assumption: "${cart.deliveryComparison.assumption}"`)
  check(cart.currency === 'EUR' && cart.deepLink.startsWith('https://www.konzum.hr/'), `currency/deepLink ok`)

  // Budget fail mora biti vidljiv, ne tih
  const tight = buildCart({ ...input, budgetEur: 5 })
  check(tight.withinBudget === false && tight.budgetEur === 5, `budget 5 -> withinBudget=${tight.withinBudget}, budgetEur=${tight.budgetEur}`)
  const noBudget = buildCart({ ...input, budgetEur: null })
  check(noBudget.withinBudget === true && noBudget.budgetEur === null, `budget null -> withinBudget=true`)

  // Prazan pantry, nikad prazna kosarica
  const empty = buildCart({ ...input, pantry: [] })
  check(empty.lines.length >= cart.lines.length && empty.savedFromPantryEur === 0 && empty.savedFromWasteEur === 0, `prazan pantry: lines=${empty.lines.length}, saved=0`)
  check(line('p_1')!.neededAmount < empty.lines.find((l) => l.productId === 'p_1')!.neededAmount, `bez pantry-ja treba vise piletine (${empty.lines.find((l) => l.productId === 'p_1')!.neededAmount} g)`)
}

console.log(failed === 0 ? '\nSVE PROVJERE PROSLE' : `\n${failed} PROVJERA PALO`)
process.exit(failed === 0 ? 0 : 1)
