import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import {
  PlannedMeal,
  PlannerOutput,
  SingleMealOutput,
  PlannedPrepBlock,
  PlannedRescue,
  PlannedSaleDriven,
  type ProfileInput,
  type Slot,
} from '../schemas/index.js'

/**
 * KuhAI planer: profil + pantry + akcije -> tjedni plan (D13-D17).
 *
 * Sto ovaj modul NE radi: ne racuna eure, ne racuna `savedEur` ni
 * `saleDriven.count` — to dopisuje src/engine/ iz kataloga (D6).
 * Model vraca PlannedRescue / PlannedSaleDriven: imena + ljudska poruka.
 *
 * Red gradnje je fiksan i stoji u system promptu: umire -> skoro -> onSale
 * -> ostatak (D15). Sastojci smiju biti samo iz dostupnih kategorija
 * kataloga; lista s primjerima ulazi u user prompt (D7).
 *
 * Fallback lanac za cijeli tjedan (demo ne smije pasti na 500):
 *   1. cetiri PARALELNA poziva (pon-uto, sri-cet, pet-sub, ned) sa sidrima
 *   2. dio koji padne ide dan-po-dan (sekvencijalno), isti system prompt
 *   3. dan koji ni tako ne uspije dobije staticne FALLBACK obroke
 * Nakon svega ide deterministicko post-procesiranje (bez retrya).
 */

// ---------------------------------------------------------------------------
// Ulazni tipovi (nisu Zod sheme — ovo su interni ulazi, ne API/AI oblik)
// ---------------------------------------------------------------------------

export type PantryForPlanner = {
  name: string
  quantity: number
  unit: 'g' | 'ml' | 'kom'
  expiresInDays: number | null
  urgency: 'umire' | 'skoro' | 'ok'
}

export type SaleProduct = {
  name: string
  category: string
  packageSize: number
  packageUnit: string
}

/** kategorija -> 5-10 primjera imena iz kataloga */
export type CategoryExamples = Record<string, string[]>

export type PlannerInput = {
  profile: ProfileInput
  tasteNotes: string
  qa: Array<{ question: string; answer: string | string[] }>
  pantry: PantryForPlanner[]
  onSale: SaleProduct[]
  categories: CategoryExamples
  budgetEur: number | null
  /** YYYY-MM-DD, ponedjeljak */
  weekStart: string
}

export type SwapContext = {
  profile: ProfileInput
  tasteNotes: string
  qa: PlannerInput['qa']
  oldMeal: PlannedMeal
  reason: string | null
  /** imena sastojaka vec u kosarici + pantry */
  cartIngredients: string[]
  otherMealTitles: string[]
  categories: CategoryExamples
}

// ---------------------------------------------------------------------------
// Konstante
// ---------------------------------------------------------------------------

const MODEL_ID = 'claude-sonnet-5-5'
const MAX_RETRIES = 2
const WEEK_TIMEOUT_MS = Number(process.env.PLANNER_WEEK_TIMEOUT_MS ?? 90_000)
const DAY_TIMEOUT_MS = 45_000
const MEAL_TIMEOUT_MS = 45_000
const MAX_SALE_ITEMS = 30

export const DAY_NAMES = [
  'ponedjeljak',
  'utorak',
  'srijeda',
  'četvrtak',
  'petak',
  'subota',
  'nedjelja',
] as const

/** mealsPerDay -> slotovi, po pravilu iz system prompta. */
function slotsFor(mealsPerDay: number): Slot[] {
  const all: Slot[] = ['dorucak', 'rucak', 'vecera', 'snack1', 'snack2']
  if (mealsPerDay <= 2) return ['rucak', 'vecera']
  return all.slice(0, Math.min(mealsPerDay, 5))
}

// ---------------------------------------------------------------------------
// Promptovi — doslovno iz docs/PROMPTS.md §3 i §4
// ---------------------------------------------------------------------------

const SYSTEM_PLAN = `Ti si KuhAI — planer koji ljudima u Hrvatskoj slaže cijeli tjedan hrane.
Ne pišeš recepte iz kuharice. Slažeš tjedan koji će ovaj konkretan čovjek
stvarno odraditi: s hranom koju već ima doma, s novcem koji ima, s vremenom
koje ima i s opremom koju ima.

Šest pravila. Prva tri su tvrda i presuđuju sve ostalo.

=== 1. FRIŽIDER JE PROTAGONIST ===
Ne gradiš plan pa gledaš što od toga već ima. Gradiš plan POČEVŠI od onoga
što mu umire.
Postupak, u ovom redu:
  a) izvuci sve pantry namirnice s urgency "umire"
  b) smisli obroke koji ih troše — svaka takva namirnica mora biti
     POTROŠENA U PRVA DVA DANA plana (dan 1 i dan 2)
  c) dodaj namirnice s urgency "skoro" — do dana 4-5
  d) tek sad slažeš ostatak tjedna
Na svakom obroku koji troši "umire" namirnicu, navedi je u \`usesExpiring\`
(točno ono ime kakvo je u pantryju).
Ako nešto što umire objektivno ne ide ni u jedan obrok (npr. 50 ml mlijeka),
smiješ ga ostaviti — ali to je iznimka, ne izlaz iz pravila.
\`rescue.savedItems\` = imena svih spašenih namirnica.
\`rescue.message\` = jedna rečenica koja imenuje što je spašeno i kad se troši.
  DOBRO: "Špinat i jogurt ti umiru za 2 dana — stavio sam ih u ponedjeljak i utorak."
  LOŠE: "Plan koristi vaše postojeće namirnice." (ništa ne kaže)
Cijenu ušteđenog NE računaj — \`savedEur\` puni kod.

=== 2. BUDŽET JE TVRDO OGRANIČENJE, NE FILTER ===
Ako je budžet poslan, plan MORA stati u njega. Ne "trudi se", mora.
Poluge, po redu agresivnosti:
  - jeftiniji proteini: jaja, piletina (batak prije filea), mljeveno,
    leća, slanutak, grah, tuna u konzervi, skuša
  - jeftiniji nosači: krumpir, riža, tjestenina, kruh, kupus, mrkva, luk
  - MANJE RAZLIČITIH SASTOJAKA, VIŠE PONAVLJANJA — isti sastojak kroz
    4-5 obroka, veća pakiranja koja se isplate
  - duplaj porcije i planiraj \`iz_prepa\` umjesto novog kuhanja
  - skupe stvari (losos, pinjoli, parmezan, svježe bobice, avokado,
    orasi, plodovi mora) kod strogog budžeta ne postoje
Što je budžet manji po osobi po danu, to je plan ponovljiviji. Pod ~1,5 €
po obroku očekuj 8-10 različitih jela u tjednu, ne 21.
Ne ispisuj nikakve eure u izlazu. Samo biraj jeftinije.

=== 3. PLANIRAJ IZ AKCIJE ===
Dobivaš listu proizvoda koji su ovaj tjedan na akciji. To nije filter na kraju
— to je POČETNA TOČKA uz frižider. Tako ljudi stvarno kupuju: vide što je
sniženo i iz toga smisle tjedan. Nijedna aplikacija to ne radi; ti radiš.
Odaberi 2-4 proizvoda s akcije koji se daju iskoristiti više puta i izgradi
obroke oko njih.
\`saleDriven.items\` = imena iskorištenih proizvoda s akcije.
\`saleDriven.count\` = koliko obroka je građeno oko njih.
\`saleDriven.message\` = jedna rečenica.
  DOBRO: "Svinjski file je -30% ovaj tjedan, iskoristio sam ga tri puta."
Ako lista akcija dođe prazna, \`count: 0\`, \`items: []\`, message neka kaže da
ovaj tjedan nije bilo korisnih akcija. Ne izmišljaj akciju.

=== 4. PREP BLOKOVI S PARALELNIM TIMELINEOM ===
Recepti su linearni jer su knjige linearne. Prava kuhinja je paralelna.
Prep blok je sat-dva u kojem se kuha za 3+ obroka istovremeno.
\`timeline\` je lista stavki, svaka na jednoj traci:
  "pecnica" | "stednjak" | "ti" | "mikrovalna" | "air_fryer"
\`startMinute\` je offset od početka bloka, \`durationMinutes\` trajanje.
Trake se PREKLAPAJU — to je cijela ideja. Dok je piletina 45 min u pećnici,
riža je 20 min na štednjaku, a ti 10 min sjeckaš povrće.
TVRDO: suma \`durationMinutes\` na traci "ti" mora biti ZNATNO manja od
\`minutes\` cijelog bloka — ciljaj 25-40 %. Blok od 70 min ima 15-30 min
tvoje stvarne pažnje. Ako ti izlazi više, prebaci rad na pećnicu/štednjak
ili ga razvuci.
Ne stavljaj dvije stvari na istu traku u isto vrijeme (jedna pećnica, jedan
štednjak — osim ako je oprema izričito navedena kao dostupna).
Traka "ti" ne smije biti u minuti 0 i onda tek u minuti 60 bez ičega između
osim ako nešto zaista kuha u međuvremenu.
Broj i raspored blokova iz \`cookingStyle\`:
  "meal_prep" -> 1-2 bloka (npr. nedjelja 18:00 pokriva pon-sri,
                 srijeda večer pokriva čet-sub), \`covers\` navodi te dane
  "svaki_dan" -> 0 ili 1 mali blok; većina obroka je \`kuhaj_sad\`
Obrok koji dolazi iz bloka: \`source: "iz_prepa"\` i \`prepBlockIndex\` =
indeks tog bloka u \`prepBlocks\` arrayu. Obrok koji se kuha na licu mjesta:
\`source: "kuhaj_sad"\` i \`prepBlockIndex: null\`.
\`minutes\` na obroku \`iz_prepa\` je samo zagrijavanje/sastavljanje (3-10 min).

=== 5. \`why\` NA SVAKOM OBROKU ===
Jedna rečenica, na hrvatskom, koja kaže zašto je TAJ obrok TU, i veže se na
nešto konkretno: na namirnicu iz frižidera, na rok, na akciju, na nešto što
je korisnik rekao u pitanjima, na vrijeme ili opremu koju ima.
Nikad generički. \`why\` nikad nije null ni prazan.
  DOBRO: "Špinat ti umire za 2 dana, a rekao si da voliš češnjak."
  DOBRO: "Piletina je ostala od nedjeljnog prepa, treba ti samo 5 min i wrap."
  DOBRO: "Tikvice su na akciji, a ti si tražio 15-minutne večere."
  DOBRO: "Rekao si da si jučer jeo burger, pa je ovo nešto lakše."
  LOŠE: "Zdravo i ukusno."
  LOŠE: "Odličan izvor proteina."
  LOŠE: "Savršeno za tvoj tjedan."
Ako na obroku ne možeš napisati konkretan \`why\`, obrok je vjerojatno pogrešan
— zamijeni ga obrokom koji ima razlog.

=== 6. SAMO SASTOJCI KOJI SE MOGU KUPITI ===
Smiješ koristiti SAMO sastojke koji pripadaju dostupnim kategorijama kataloga
koje ćeš dobiti u ulazu. Kuhinja je obična hrvatska trgovina: ono što ima
Konzum. Nema yuzua, gochujanga, tahinija ako ga nema u katalogu, nema
svježeg kokosa. Ako jelo traži nešto takvo — promijeni jelo, ne sastojak.
Ovo nije stilska preferencija: matcher iz \`src/engine/\` pada na sastojku koji
ne postoji i korisnik dobije polupraznu košaricu.

=== RAVNOTEŽA I VOĐENJE TJEDNA ===
- preklapaj sastojke: jedan kupljeni sastojak ide u 2-4 obroka; cijela
  pakiranja se potroše (ne 180 g od kile pa ostatak nikad)
- leftover lanci: pečena piletina -> wrap -> juha od kostiju; pečeno povrće
  -> salata -> frittata. Navedi ih kroz \`source: "iz_prepa"\`.
- ravnoteža: NE 5 dana tjestenine, ali NI 21 različito jelo.
  Ciljaj 9-14 različitih jela u tjednu kod normalnog budžeta, manje kod
  strogog. Isto jelo smije se ponoviti 2-3 puta, ne 5.
- varijacija kroz tjedan: ne tri dana zaredom isti protein, ne dva dana
  zaredom isti doručak ako avanturizam nije 1
- \`days\` ima TOČNO 7 elemenata, \`dayName\` hrvatski redom:
  ponedjeljak, utorak, srijeda, četvrtak, petak, subota, nedjelja
- svaki dan ima TOČNO \`mealsPerDay\` obroka. 2 -> rucak+vecera;
  3 -> dorucak+rucak+vecera; 4 -> +snack1; 5 -> +snack2
- \`servings\` = \`householdSize\` (ili 2× ako je namjerno za sutra)
- \`minutes\` na \`kuhaj_sad\` obroku <= \`minutesPerMeal\` iz profila
- dijeta i alergije su ABSOLUTNE. vegan = ništa životinjsko, ni med ni
  maslac ni jaja. bez_glutena = ni tjestenina ni kruh ni krušne mrvice.
  Alergen se ne smije pojaviti ni u jednom sastojku, nijednom.
- \`steps\`: 3-7 koraka, imperativ, kratko, s količinama i vremenima
  ("Nasjeckaj kupus na tanke rezance.", "Pirjaj 5 min na srednjoj.")
- \`ingredients\`: hrvatska imena, \`unit\` samo "g"/"ml"/"kom",
  količine za navedeni \`servings\`
- \`nutrition\` je opcionalan: stavi grubu procjenu ili null. Ako nisi siguran,
  null. Lažna brojka je gora od nikakve.
- \`imageHint\`: 2-4 riječi, vizualni opis jela ("kajgana u tavi")

ŠTO NIKAD NE RADIŠ
- ne računaš cijene, eure, popuste ni ukupne iznose (to je kod)
- ne izmišljaš proizvode, brendove ni akcije
- ne pišeš ništa na engleskom
- ne vraćaš manje od 7 dana i ne vraćaš obrok bez \`why\``

const SYSTEM_SWAP = `Zamjenjuješ JEDAN obrok u već gotovom tjednom planu. Ostatak tjedna ostaje
netaknut i ti ga ne smiješ pokvariti.

Pet uvjeta koje novi obrok mora zadovoljiti:

1. ISTI OKVIR
   Isti \`slot\` (doručak ostaje doručak), isti \`servings\`, \`minutes\` unutar
   korisnikovog ograničenja. Ako je stari obrok bio \`iz_prepa\`, novi je
   \`kuhaj_sad\` s \`prepBlockIndex: null\` — prep blok je već odrađen i ne
   prepravljamo ga.

2. NE POSKUPLJUJ TJEDAN
   Dobivaš listu sastojaka koji su VEĆ U KOŠARICI. Gradi novi obrok
   PRVENSTVENO od njih. Svaki novi sastojak znači novu stavku u košarici i
   skuplji tjedan — to je najčešći način da swap razočara.
   Ciljaj: barem 2 sastojka iz košarice, najviše 2-3 nova.
   Ako je stari obrok bio jeftin (jaja, krumpir, leća), novi ne smije biti
   losos ni biftek. Približno ista razina cijene, u istoj kategoriji.
   Eure ne računaš i ne spominješ.

3. PROFIL I DIJETA SU APSOLUTNI
   Dijeta, alergije, minute, oprema, broj ljudi — isto kao u planu.
   Alergen se ne smije pojaviti. Swap koji prekrši dijetu je gori od
   nikakvog swapa.

4. STVARNO DRUKČIJE
   Novi obrok mora biti drugo jelo, ne preimenovana varijanta. "Tjestenina s
   tikvicama" -> "Tjestenina s tikvicama i sirom" NIJE swap. Promijeni glavni
   sastojak ili tehniku.

5. RAZLOG, AKO JE DAN
   Ako korisnik kaže zašto mijenja, poslušaj ga doslovno i spomeni to u \`why\`:
   "ne jede mi se kupus" -> kupus se ne pojavljuje NIGDJE u novom obroku
   "nemam vremena" -> znatno kraći obrok
   "hoću nešto toplo" / "nešto lakše" -> ispuni to
   Bez razloga (shake): daj nešto svježe iz istog registra.

\`why\` jedna rečenica, konkretna, hrvatski. Ako je dan razlog, veže se na njega.
  DOBRO: "Rekao si da ti se ne jede kupus — ovdje je mrkva koju si već kupio."
  DOBRO: "Isti sastojci kao prije, ali 10 minuta kraće."
  LOŠE: "Nova ukusna opcija."

Sastojci: samo iz dostupnih kategorija kataloga. \`unit\` samo "g"/"ml"/"kom".
\`steps\` 3-7 koraka, imperativ. \`nutrition\` procjena ili null.
Sve na hrvatskom.`

// ---------------------------------------------------------------------------
// Interpolacija — po tablici "Što interpolirati" iz PROMPTS.md §3
// ---------------------------------------------------------------------------

const DIET_LABEL: Record<ProfileInput['diet'], string> = {
  sve: 'sve (bez ograničenja)',
  bez_mesa: 'bez mesa (vegetarijanski)',
  vegan: 'vegan — ništa životinjsko',
  bez_svinjetine: 'bez svinjetine',
  bez_laktoze: 'bez laktoze',
  bez_glutena: 'bez glutena',
}

const STYLE_LABEL: Record<ProfileInput['cookingStyle'], string> = {
  meal_prep: 'meal prep (kuha unaprijed u blokovima)',
  svaki_dan: 'kuha svaki dan',
}

/** 1 osoba, 2-4 osobe, 5+ osoba */
function osobe(n: number): string {
  if (n === 1) return '1 osoba'
  if (n >= 2 && n <= 4) return `${n} osobe`
  return `${n} osoba`
}

function formatProfile(p: ProfileInput, tasteNotes: string): string {
  const lines = [
    `Obroka dnevno: ${p.mealsPerDay}`,
    `Ljudi u kući: ${p.householdSize}`,
    `Stil kuhanja: ${STYLE_LABEL[p.cookingStyle]}`,
    `Minute po obroku: ${p.minutesPerMeal}`,
    `Dijeta: ${DIET_LABEL[p.diet]}`,
    `Alergije: ${p.allergies.length ? p.allergies.join(', ') : 'nema'}`,
    `Kuhinje koje voli: ${p.cuisines.length ? p.cuisines.join(', ') : 'nije rekao'}`,
    `Avanturizam (1 = samo poznato, 5 = sve novo): ${p.adventurousness}`,
    `Razina budžeta: ${p.budgetLevel}`,
  ]
  if (p.budgetPerWeekEur) lines.push(`Budžet tjedno iz profila: ${p.budgetPerWeekEur} €`)
  if (tasteNotes.trim()) lines.push(`Bilješke o ukusu: ${tasteNotes.trim()}`)
  return lines.join('\n')
}

function formatQa(qa: PlannerInput['qa']): string {
  if (!qa.length) return '(nije odgovarao na dodatna pitanja)'
  return qa
    .map((q) => {
      const a = Array.isArray(q.answer) ? q.answer.join(', ') : q.answer
      return `${q.question}: ${a}`
    })
    .join('\n')
}

function formatPantryLine(item: PantryForPlanner): string {
  const rok =
    item.expiresInDays === null
      ? 'bez roka'
      : item.expiresInDays === 0
        ? 'rok ističe danas'
        : `rok za ${item.expiresInDays} ${item.expiresInDays === 1 ? 'dan' : 'dana'}`
  return `${item.name} — ${item.quantity} ${item.unit}, ${rok}`
}

function formatPantryGroup(items: PantryForPlanner[]): string {
  if (!items.length) return '(nema)'
  return items.map(formatPantryLine).join('\n')
}

/** Akcije BEZ cijena — model ne smije računati (D6). */
function formatSales(onSale: SaleProduct[]): string {
  if (!onSale.length) return '(ovaj tjedan nema akcija u katalogu)'
  return onSale
    .slice(0, MAX_SALE_ITEMS)
    .map((s) => `${s.name} — ${s.category}, ${s.packageSize} ${s.packageUnit}`)
    .join('\n')
}

function formatCategories(categories: CategoryExamples): string {
  const entries = Object.entries(categories)
  if (!entries.length) return '(katalog nije dostupan — koristi osnovne namirnice iz obične trgovine)'
  return entries
    .map(([cat, examples]) => `- ${cat}: ${examples.length ? examples.join(', ') : '(bez primjera)'}`)
    .join('\n')
}

function formatBudget(budgetEur: number | null, p: ProfileInput): string {
  if (budgetEur === null || budgetEur <= 0) {
    return 'Nema zadanog budžeta, ali ne rastezuj bez potrebe.'
  }
  const obroka = p.mealsPerDay * 7
  // Cilj za model je 75 % budzeta: cijela pakiranja i zacini u kosarici pojedu
  // ostatak (mjereno: plan "na X" izlazi 30-50 % iznad X bez ove rezerve).
  const target = Math.max(5, Math.round(budgetEur * 0.75))
  const perPortion = target / (obroka * p.householdSize)
  // Razina stednje izvodi KOD iz budzeta po porciji; model dobiva samo smjernicu, ne racuna eure (D6).
  const tier =
    perPortion < 1
      ? 'To je ispod 1 € po porciji — EKSTREMNO ŠTEDLJIVO. Proteini: jaja, leća, grah, slanutak, tuna u konzervi; meso NAJVIŠE 2 obroka u tjednu (batak ili mljeveno, ne file). Nosači: krumpir, riža, tjestenina, kupus, luk, mrkva. 6-8 različitih jela, svako 2-3 puta. Bez sira osim malo za posip, bez voća osim banane/jabuke.'
      : perPortion < 1.6
        ? 'To je 1-1,6 € po porciji — ŠTEDLJIVO. Meso u najviše 5-6 obroka (batak, mljeveno, jedno pakiranje pilećih prsa), ostatak jaja i mahunarke. 8-10 različitih jela, ponavljanje je poželjno.'
        : perPortion < 2.5
          ? 'To je 1,6-2,5 € po porciji — UMJERENO. Meso ili riba do 8-10 obroka, ostatak jeftiniji proteini. 10-14 različitih jela.'
          : 'To je iznad 2,5 € po porciji — KOMOTNO. Normalan, raznolik tjedan, ali i dalje bez rasipanja.'
  const orient =
    'Orijentacija (samo za odabir, NE računaj): pileća prsa ~11 €/kg, batak ~5 €/kg, mljeveno ~7 €/kg, svinjski vrat ~7 €/kg, losos ~25 €/kg, jaja ~0,25 €/kom, tuna konzerva ~1,5 €, leća/grah ~2-3 €/kg, riža/tjestenina ~2 €/kg, krumpir ~1 €/kg, luk/mrkva/kupus ~1 €/kg, paprika/tikvica ~3 €/kg, jogurt ~0,5 €/kom, sir ~10 €/kg, mlijeko ~1 €/l, kruh ~1,5 €.'
  return `Tvrdo ograničenje: ${budgetEur} € za cijeli tjedan (${obroka} obroka, ${osobe(p.householdSize)}). Cilj za sastojke je ${target} € — ostatak pojedu cijela pakiranja i začini. Plan MORA stati u ${target} €.
${tier}
${orient}`
}

function buildWeekPrompt(input: PlannerInput): string {
  const umire = input.pantry.filter((i) => i.urgency === 'umire')
  const skoro = input.pantry.filter((i) => i.urgency === 'skoro')
  const ok = input.pantry.filter((i) => i.urgency === 'ok')

  return `=== PROFIL ===
${formatProfile(input.profile, input.tasteNotes)}

=== ODGOVORI NA PITANJA ===
${formatQa(input.qa)}

=== ŠTO IMA DOMA (pantry) ===
Umire (potroši u prva 2 dana):
${formatPantryGroup(umire)}
Skoro (potroši do petog dana):
${formatPantryGroup(skoro)}
Ostalo:
${formatPantryGroup(ok)}

=== NA AKCIJI OVAJ TJEDAN ===
${formatSales(input.onSale)}

=== DOSTUPNE KATEGORIJE KATALOGA ===
Smiješ koristiti samo sastojke iz ovih kategorija:
${formatCategories(input.categories)}

=== BUDŽET ===
${formatBudget(input.budgetEur, input.profile)}

=== TJEDAN ===
Počinje ${input.weekStart} (ponedjeljak).

Složi cijeli tjedan. Počni od onoga što umire.`
}

// ---------------------------------------------------------------------------
// Fallback obroci — staticni, bez AI-ja. Zadnja mreza kad i dan-po-dan padne.
// ---------------------------------------------------------------------------

type FallbackMeal = Omit<PlannedMeal, 'servings'> & {
  /** Dijete s kojima se ovo jelo NE smije posluziti. */
  avoidDiet: ProfileInput['diet'][]
}

/**
 * Po slotu nekoliko kandidata, od "najnormalnijeg" prema univerzalnom.
 * Zadnji kandidat u svakom slotu je siguran za sve dijete iz enuma.
 * Kolicine su za 1 osobu; skaliraju se na householdSize.
 */
export const FALLBACK_MEALS: Record<Slot, FallbackMeal[]> = {
  dorucak: [
    {
      slot: 'dorucak',
      title: 'Kajgana s paprikom',
      minutes: 10,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: [
        'Nasjeckaj pola paprike na kockice.',
        'Zagrij žlicu ulja u tavi i pirjaj papriku 3 min.',
        'Razmuti 2 jaja s prstohvatom soli i ulij u tavu.',
        'Miješaj 2 min dok se ne stisne. Posluži s kruhom.',
      ],
      ingredients: [
        { name: 'jaja', quantity: 2, unit: 'kom' },
        { name: 'paprika', quantity: 0.5, unit: 'kom' },
        { name: 'ulje', quantity: 10, unit: 'ml' },
        { name: 'kruh', quantity: 80, unit: 'g' },
      ],
      nutrition: null,
      imageHint: 'kajgana u tavi',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: ['vegan', 'bez_glutena'],
    },
    {
      slot: 'dorucak',
      title: 'Zobena kaša s bananom',
      minutes: 8,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: [
        'Stavi 50 g zobenih pahuljica i 200 ml vode u lončić.',
        'Kuhaj 4 min na srednjoj uz miješanje.',
        'Nareži bananu i dodaj na vrh.',
      ],
      ingredients: [
        { name: 'zobene pahuljice', quantity: 50, unit: 'g' },
        { name: 'banana', quantity: 1, unit: 'kom' },
      ],
      nutrition: null,
      imageHint: 'zobena kaša s bananom',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: ['bez_glutena'],
    },
    {
      slot: 'dorucak',
      title: 'Voćna salata s jabukom i bananom',
      minutes: 5,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: ['Nareži jabuku i bananu na kockice.', 'Pomiješaj u zdjeli i posluži odmah.'],
      ingredients: [
        { name: 'jabuka', quantity: 1, unit: 'kom' },
        { name: 'banana', quantity: 1, unit: 'kom' },
      ],
      nutrition: null,
      imageHint: 'voćna salata u zdjeli',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: [],
    },
  ],
  rucak: [
    {
      slot: 'rucak',
      title: 'Varivo od graha s mrkvom i krumpirom',
      minutes: 30,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: [
        'Nasjeckaj pola luka i mrkvu na kolutiće, krumpir na kocke.',
        'Pirjaj luk 3 min na žlici ulja, dodaj mrkvu i krumpir.',
        'Dodaj ocijeđeni grah iz konzerve i 300 ml vode.',
        'Kuhaj 20 min dok krumpir ne omekša. Posoli po ukusu.',
      ],
      ingredients: [
        { name: 'grah u konzervi', quantity: 1, unit: 'kom' },
        { name: 'mrkva', quantity: 1, unit: 'kom' },
        { name: 'krumpir', quantity: 200, unit: 'g' },
        { name: 'luk', quantity: 0.5, unit: 'kom' },
        { name: 'ulje', quantity: 10, unit: 'ml' },
      ],
      nutrition: null,
      imageHint: 'varivo od graha u loncu',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: [],
    },
  ],
  vecera: [
    {
      slot: 'vecera',
      title: 'Tjestenina s rajčicom i češnjakom',
      minutes: 20,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: [
        'Skuhaj 100 g tjestenine u posoljenoj vodi 9 min.',
        'Nasjeckaj češanj češnjaka i pirjaj 1 min na ulju.',
        'Dodaj pola konzerve pelata, kuhaj 5 min.',
        'Umiješaj tjesteninu i posluži.',
      ],
      ingredients: [
        { name: 'tjestenina', quantity: 100, unit: 'g' },
        { name: 'pelati', quantity: 200, unit: 'g' },
        { name: 'češnjak', quantity: 1, unit: 'kom' },
        { name: 'ulje', quantity: 10, unit: 'ml' },
      ],
      nutrition: null,
      imageHint: 'tjestenina s umakom od rajčice',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: ['bez_glutena'],
    },
    {
      slot: 'vecera',
      title: 'Pečeni krumpir s tikvicom i paprikom',
      minutes: 30,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: [
        'Nareži krumpir, tikvicu i papriku na krupne komade.',
        'Pomiješaj s uljem, soli i paprom na limu.',
        'Peci 25 min na 200 °C, jednom promiješaj.',
      ],
      ingredients: [
        { name: 'krumpir', quantity: 250, unit: 'g' },
        { name: 'tikvica', quantity: 0.5, unit: 'kom' },
        { name: 'paprika', quantity: 0.5, unit: 'kom' },
        { name: 'ulje', quantity: 15, unit: 'ml' },
      ],
      nutrition: null,
      imageHint: 'pečeno povrće na limu',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: [],
    },
  ],
  snack1: [
    {
      slot: 'snack1',
      title: 'Jogurt s jabukom',
      minutes: 3,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: ['Nareži jabuku na kockice.', 'Pomiješaj s jogurtom.'],
      ingredients: [
        { name: 'jogurt', quantity: 180, unit: 'g' },
        { name: 'jabuka', quantity: 1, unit: 'kom' },
      ],
      nutrition: null,
      imageHint: 'jogurt s voćem',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: ['vegan', 'bez_laktoze'],
    },
    {
      slot: 'snack1',
      title: 'Jabuka i banana',
      minutes: 1,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: ['Operi jabuku, oguli bananu, pojedi.'],
      ingredients: [
        { name: 'jabuka', quantity: 1, unit: 'kom' },
        { name: 'banana', quantity: 1, unit: 'kom' },
      ],
      nutrition: null,
      imageHint: 'jabuka i banana',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: [],
    },
  ],
  snack2: [
    {
      slot: 'snack2',
      title: 'Štapići mrkve i krastavca',
      minutes: 5,
      source: 'kuhaj_sad',
      prepBlockIndex: null,
      steps: ['Oguli mrkvu i nareži na štapiće.', 'Nareži krastavac na štapiće.', 'Posoli i posluži.'],
      ingredients: [
        { name: 'mrkva', quantity: 1, unit: 'kom' },
        { name: 'krastavac', quantity: 0.5, unit: 'kom' },
      ],
      nutrition: null,
      imageHint: 'štapići povrća',
      why: 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.',
      usesExpiring: [],
      avoidDiet: [],
    },
  ],
}

function fallbackMealFor(slot: Slot, profile: ProfileInput): PlannedMeal {
  const candidates = FALLBACK_MEALS[slot]
  const allergies = profile.allergies.map((a) => a.toLowerCase().trim()).filter(Boolean)
  const hasAllergen = (name: string) => allergies.some((a) => name.toLowerCase().includes(a))

  // Dijeta je tvrda: zadnji kandidat u svakom slotu je siguran za sve dijete.
  const dietSafe = candidates.filter((m) => !m.avoidDiet.includes(profile.diet))
  const pool = dietSafe.length ? dietSafe : [candidates[candidates.length - 1]!]

  // Alergen je isto tvrd: prvo cisti kandidat, inace izbaci alergen iz
  // sastojaka (ostaje barem jedan) — bolje osiromaseno jelo nego alergen.
  const clean = pool.find((m) => !m.ingredients.some((ing) => hasAllergen(ing.name)))
  const chosen = clean ?? pool[0]!
  const { avoidDiet: _avoid, ...meal } = chosen

  let ingredients = meal.ingredients
  let title = meal.title
  if (!clean) {
    const removed = ingredients.filter((ing) => hasAllergen(ing.name)).map((ing) => ing.name)
    const kept = ingredients.filter((ing) => !hasAllergen(ing.name))
    if (kept.length) {
      ingredients = kept
      title = `${title} (bez: ${removed.join(', ')})`
    }
  }

  const n = profile.householdSize
  return {
    ...meal,
    title,
    servings: n,
    ingredients: ingredients.map((ing) => ({ ...ing, quantity: ing.quantity * n })),
    // Kopije arraya da post-procesiranje ne dira konstantu.
    steps: [...meal.steps],
    usesExpiring: [],
  }
}

function fallbackDay(dayName: string, profile: ProfileInput): { dayName: string; meals: PlannedMeal[] } {
  return {
    dayName,
    meals: slotsFor(profile.mealsPerDay).map((slot) => fallbackMealFor(slot, profile)),
  }
}

// ---------------------------------------------------------------------------
// Pozivi modela
// ---------------------------------------------------------------------------

/** Interna shema za dan-po-dan fallback. Nije API oblik pa smije biti lokalna. */
const DayOutput = z.object({
  dayName: z.string(),
  meals: z.array(PlannedMeal).min(1),
})
type DayOutput = z.infer<typeof DayOutput>

async function callWholeWeek(input: PlannerInput): Promise<PlannerOutput> {
  const { object } = await generateObject({
    model: anthropic(MODEL_ID),
    schema: PlannerOutput,
    schemaName: 'tjedni_plan',
    maxRetries: MAX_RETRIES,
    maxOutputTokens: 24_000,
    abortSignal: AbortSignal.timeout(WEEK_TIMEOUT_MS),
    system: SYSTEM_PLAN,
    prompt: buildWeekPrompt(input),
  })
  return object
}

async function callSingleDay(
  input: PlannerInput,
  dayName: string,
  dayIndex: number,
  plannedSoFar: string[],
): Promise<DayOutput> {
  const dosad = plannedSoFar.length ? plannedSoFar.join(', ') : '(ništa još)'
  const prompt = `${buildWeekPrompt(input)}

=== DAN-PO-DAN NAČIN ===
Već si isplanirao: ${dosad}. Sad složi ${dayName} (dan ${dayIndex + 1} od 7).
Vrati SAMO taj jedan dan s točno ${input.profile.mealsPerDay} obroka.
U ovom načinu nema prep blokova: svaki obrok je \`source: "kuhaj_sad"\` i
\`prepBlockIndex: null\`. Namirnice koje umiru moraju biti potrošene do kraja
dana 2; ako je ovo dan 1 ili 2, iskoristi ih sada i navedi u \`usesExpiring\`.`

  const { object } = await generateObject({
    model: anthropic(MODEL_ID),
    schema: DayOutput,
    schemaName: 'jedan_dan',
    maxRetries: MAX_RETRIES,
    maxOutputTokens: 6_000,
    abortSignal: AbortSignal.timeout(DAY_TIMEOUT_MS),
    system: SYSTEM_PLAN,
    prompt,
  })
  return object
}

/**
 * Fallback razina 2: sedam manjih poziva, sekvencijalno (svaki dobiva naslove
 * dosadasnjih obroka da ne ponavlja). Dan koji padne ide na staticne obroke.
 */
async function generateDayByDay(input: PlannerInput): Promise<PlannerOutput> {
  const days: PlannerOutput['days'] = []
  const plannedTitles: string[] = []
  let fallbackDays = 0

  for (let i = 0; i < DAY_NAMES.length; i++) {
    const dayName = DAY_NAMES[i]!
    try {
      const day = await callSingleDay(input, dayName, i, plannedTitles)
      days.push({ dayName, meals: day.meals })
      plannedTitles.push(...day.meals.map((m) => m.title))
    } catch (err) {
      fallbackDays++
      console.warn(`[planner] dan-po-dan pao za ${dayName}, idem na statične obroke:`, errMessage(err))
      const day = fallbackDay(dayName, input.profile)
      days.push(day)
      plannedTitles.push(...day.meals.map((m) => m.title))
    }
  }

  // Unija svega sto je model oznacio kao potroseno "umire".
  const savedSet = new Set<string>()
  for (const d of days) for (const m of d.meals) for (const x of m.usesExpiring) savedSet.add(x)
  const savedItems = [...savedSet]

  const umireNames = input.pantry.filter((i) => i.urgency === 'umire').map((i) => i.name)
  const rescueMessage = savedItems.length
    ? `${joinHr(savedItems)} ti ${savedItems.length === 1 ? 'umire' : 'umiru'} — ${
        savedItems.length === 1 ? 'potrošen je' : 'potrošeni su'
      } u prvim danima tjedna.`
    : umireNames.length
      ? `Nisam uspio uklopiti ${joinHr(umireNames)} u plan — potroši to sam u sljedeća dva dana.`
      : 'Ovaj tjedan ništa iz frižidera nije bilo pred istekom.'

  if (fallbackDays > 0) {
    console.warn(`[planner] ${fallbackDays}/7 dana je iz statičnog fallbacka.`)
  }

  return {
    prepBlocks: [],
    days,
    rescue: { savedItems, message: rescueMessage },
    saleDriven: {
      items: [],
      message: 'Plan je složen dan po dan, pa akcije ovaj tjedan nisu posebno iskorištene.',
    },
  }
}

// ---------------------------------------------------------------------------
// Tjedan u dijelovima, paralelno.
//
// Zasto: jedan poziv za 21 obrok na hrvatskom izlazi iz 24k izlaznih tokena
// (hrvatski s dijakritikom tokenizira ~2-3x skuplje) i traje vise minuta.
// Cetiri paralelna poziva (pon-uto, sri-cet, pet-sub, ned) vrate tjedan u
// ~60-90 s. Koherencija se drzi SIDRIMA koja racuna kod: isti akcijski
// proizvodi i isti jeftini nosaci idu u svaki dio, a "umire" namirnice
// pripadaju samo prvom dijelu (D15).
// ---------------------------------------------------------------------------

const CHUNKS: number[][] = [[0, 1], [2, 3], [4, 5], [6]]
const CHUNK_TIMEOUT_MS = Number(process.env.PLANNER_CHUNK_TIMEOUT_MS ?? 150_000)

/** Interna shema za jedan dio tjedna. Nije API oblik pa smije biti lokalna. */
const ChunkOutput = z.object({
  prepBlocks: z.array(PlannedPrepBlock).max(1),
  days: z.array(DayOutput).min(1).max(2),
  rescue: PlannedRescue,
  saleDriven: PlannedSaleDriven,
})
type ChunkOutput = z.infer<typeof ChunkOutput>

/** Do 4 akcijska proizvoda oko kojih se gradi cijeli tjedan: meso, svjeze, suho, mlijecno. */
function pickSaleAnchors(onSale: SaleProduct[]): SaleProduct[] {
  const out: SaleProduct[] = []
  // Slucajan izbor unutar kategorije da svaki tjedan (i svaki demo) ne izgleda isto.
  for (const cat of ['meso', 'svjeze', 'suho', 'mlijecno']) {
    const pool = onSale.filter((s) => s.category === cat && !out.includes(s))
    const hit = pool[Math.floor(Math.random() * pool.length)]
    if (hit) out.push(hit)
  }
  return out
}

function buildChunkPrompt(input: PlannerInput, chunkIdx: number, anchors: SaleProduct[]): string {
  const dayIdx = CHUNKS[chunkIdx]!
  const dani = dayIdx.map((i) => `${DAY_NAMES[i]} (dan ${i + 1})`).join(', ')
  const prepEve = ['nedjelja navečer (prije ponedjeljka)', 'utorak navečer', 'četvrtak navečer', null][chunkIdx]
  const isPrep = input.profile.cookingStyle === 'meal_prep'

  const umireRule =
    chunkIdx === 0
      ? 'SVE što UMIRE mora biti potrošeno u OVOM dijelu (ovo su dani 1 i 2). Navedi ga u `usesExpiring` i u `rescue.savedItems`.'
      : chunkIdx === 1
        ? 'Ono što UMIRE već je potrošeno u ponedjeljak i utorak — NE koristi te namirnice i ostavi `usesExpiring` prazan. Ono što je SKORO potroši u ovom dijelu.'
        : 'Namirnice koje UMIRU i one SKORO već su potrošene ranije u tjednu — ne koristi ih, `usesExpiring` ostaje prazan, `rescue.savedItems` prazan.'

  const prepRule = !isPrep
    ? 'Stil je svaki_dan: bez prep blokova, svi obroci `kuhaj_sad`, `prepBlocks: []`.'
    : prepEve
      ? `Stil je meal_prep: definiraj NAJVIŠE JEDAN prep blok za ovaj dio, u ${prepEve}, koji pokriva samo dane ovog dijela (\`covers\`). Obroci iz njega imaju \`source: "iz_prepa"\` i \`prepBlockIndex: 0\`. Timeline s paralelnim trakama, traka "ti" 25-40 % ukupnih minuta.`
      : 'Ovo je zadnji dan tjedna: bez prep bloka, `prepBlocks: []`, sve `kuhaj_sad`.'

  const anchorText = anchors.length
    ? anchors.map((a) => `${a.name} (${a.category})`).join(', ')
    : '(ovaj tjedan nema akcija — gradi oko jeftinih nosača)'

  return `${buildWeekPrompt(input)}

=== DIO TJEDNA KOJI SLAŽEŠ SAD ===
Tjedan se slaže u 4 dijela paralelno. Ti slažeš SAMO: ${dani}.
Vrati \`days\` s točno ${dayIdx.length} ${dayIdx.length === 1 ? 'elementom' : 'elementa'}, tim redom, i točno ${input.profile.mealsPerDay} obroka po danu.
${umireRule}

SIDRA — da tjedan bude koherentan iako se dijelovi slažu odvojeno:
- Tjedan je građen oko ovih akcija: ${anchorText}. Iskoristi barem jednu od njih u ovom dijelu i navedi je u \`saleDriven.items\`.
- Isti jeftini nosači kroz cijeli tjedan: krumpir, riža, tjestenina, luk, mrkva, jaja. Ne uvodi novi skupi glavni sastojak ako sidro već daje protein.
- Ne ponavljaj isti doručak dva dana zaredom unutar svog dijela.
- Budi sažet: \`steps\` najviše 5 koraka, svaki do 12 riječi; \`ingredients\` najviše 8 stavki; \`why\` jedna rečenica. Kraći izlaz = brži plan.
${prepRule}
\`rescue\` i \`saleDriven\` opisuju samo ovaj dio.`
}

async function callChunk(input: PlannerInput, chunkIdx: number, anchors: SaleProduct[]): Promise<ChunkOutput> {
  const { object } = await generateObject({
    model: anthropic(MODEL_ID),
    schema: ChunkOutput,
    schemaName: 'dio_tjedna',
    maxRetries: MAX_RETRIES,
    maxOutputTokens: 12_000,
    abortSignal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    system: SYSTEM_PLAN,
    prompt: buildChunkPrompt(input, chunkIdx, anchors),
  })
  return object
}

/**
 * Cetiri paralelna poziva. Dio koji padne ide dan-po-dan (sekvencijalno,
 * s naslovima iz uspjesnih dijelova), a dan koji ni tako ne uspije dobije
 * staticne obroke. Nikad ne baca.
 */
async function generateChunked(input: PlannerInput): Promise<PlannerOutput> {
  const anchors = pickSaleAnchors(input.onSale)
  const t0 = Date.now()
  const settled = await Promise.allSettled(CHUNKS.map((_, i) => callChunk(input, i, anchors)))
  console.log(
    `[planner] 4 dijela gotova u ${Math.round((Date.now() - t0) / 1000)} s (${settled.filter((s) => s.status === 'fulfilled').length}/4 uspjela)`,
  )

  const prepBlocks: PlannerOutput['prepBlocks'] = []
  const daysByIdx = new Map<number, { dayName: string; meals: PlannedMeal[] }>()
  const rescueMessages: string[] = []
  const saleItems = new Set<string>()
  const saleMessages: string[] = []
  const failedChunks: number[] = []

  settled.forEach((res, ci) => {
    const dayIdx = CHUNKS[ci]!
    if (res.status === 'rejected') {
      console.warn(`[planner] dio ${ci + 1} pao:`, errMessage(res.reason))
      failedChunks.push(ci)
      return
    }
    const out = res.value
    const offset = prepBlocks.length
    const hasBlock = out.prepBlocks.length > 0
    if (hasBlock) prepBlocks.push(...out.prepBlocks)
    dayIdx.forEach((di, k) => {
      const day = out.days[k] ?? out.days[out.days.length - 1]!
      daysByIdx.set(di, {
        dayName: DAY_NAMES[di]!,
        meals: day.meals.map((m) =>
          m.prepBlockIndex !== null && hasBlock
            ? { ...m, prepBlockIndex: offset, source: 'iz_prepa' as const }
            : { ...m, prepBlockIndex: null, source: 'kuhaj_sad' as const },
        ),
      })
    })
    if (ci === 0 && out.rescue.message.trim()) rescueMessages.push(out.rescue.message.trim())
    for (const s of out.saleDriven.items) if (s.trim()) saleItems.add(s.trim())
    if (out.saleDriven.items.length && out.saleDriven.message.trim()) saleMessages.push(out.saleDriven.message.trim())
  })

  // Pali dijelovi: dan-po-dan, pa staticni obroci.
  for (const ci of failedChunks) {
    for (const di of CHUNKS[ci]!) {
      const dayName = DAY_NAMES[di]!
      const planned = [...daysByIdx.values()].flatMap((d) => d.meals.map((m) => m.title))
      try {
        const day = await callSingleDay(input, dayName, di, planned)
        daysByIdx.set(di, {
          dayName,
          meals: day.meals.map((m) => ({ ...m, prepBlockIndex: null, source: 'kuhaj_sad' as const })),
        })
      } catch (err) {
        console.warn(`[planner] dan ${dayName} pao i dan-po-dan, idem na statične obroke:`, errMessage(err))
        daysByIdx.set(di, fallbackDay(dayName, input.profile))
      }
    }
  }

  const days = DAY_NAMES.map((dayName, i) => daysByIdx.get(i) ?? fallbackDay(dayName, input.profile))

  // rescue: unija svega sto je oznaceno kao potroseno "umire"
  const savedSet = new Set<string>()
  for (const d of days) for (const m of d.meals) for (const x of m.usesExpiring) if (x.trim()) savedSet.add(x.trim())
  const savedItems = [...savedSet]
  const umireNames = input.pantry.filter((i) => i.urgency === 'umire').map((i) => i.name)
  const rescueMessage =
    rescueMessages[0] ??
    (savedItems.length
      ? `${joinHr(savedItems)} ti ${savedItems.length === 1 ? 'umire' : 'umiru'} — ${savedItems.length === 1 ? 'potrošen je' : 'potrošeni su'} u ponedjeljak i utorak.`
      : umireNames.length
        ? `Nisam uspio uklopiti ${joinHr(umireNames)} u plan — potroši to sam u sljedeća dva dana.`
        : 'Ovaj tjedan ništa iz frižidera nije bilo pred istekom.')

  const saleMessage =
    saleMessages.sort((a, b) => b.length - a.length)[0] ??
    (saleItems.size
      ? `${joinHr([...saleItems])} ${saleItems.size === 1 ? 'je' : 'su'} na akciji ovaj tjedan, pa je tjedan građen oko toga.`
      : 'Ovaj tjedan u katalogu nije bilo akcija koje bi se dale iskoristiti.')

  return {
    prepBlocks,
    days,
    rescue: { savedItems, message: rescueMessage },
    saleDriven: { items: [...saleItems], message: saleMessage },
  }
}

// ---------------------------------------------------------------------------
// Post-procesiranje — deterministicko, bez retrya (PROMPTS.md §3 "Kako puca")
// ---------------------------------------------------------------------------

function tiSum(block: PlannedPrepBlock): number {
  return block.timeline.filter((t) => t.track === 'ti').reduce((s, t) => s + t.durationMinutes, 0)
}

function maxEnd(block: PlannedPrepBlock): number {
  return block.timeline.reduce((m, t) => Math.max(m, t.startMinute + t.durationMinutes), 0)
}

export function postProcessPlan(plan: PlannerOutput): PlannerOutput {
  const blockCount = plan.prepBlocks.length

  // Suma trake 'ti' >= minutes bloka -> podigni minutes. Prompt cilja 25-40 %
  // aktivnog vremena; ovdje garantiramo barem da aktivno < ukupno i da
  // nijedna stavka ne strsi preko kraja bloka.
  const prepBlocks = plan.prepBlocks.map((block) => {
    const ti = tiSum(block)
    const end = maxEnd(block)
    let minutes = block.minutes
    if (ti >= minutes) {
      minutes = Math.max(end, Math.ceil(ti / 0.6))
      console.warn(`[planner] prep blok "${block.title}": traka ti ${ti} >= ${block.minutes} min, dižem na ${minutes}.`)
    } else if (end > minutes) {
      minutes = end
    }
    return { ...block, minutes }
  })

  // dayName normaliziraj po indeksu; days vec ima tocno 7 (Zod) ili dolazi iz fallbacka.
  const days = plan.days.map((day, i) => ({
    dayName: DAY_NAMES[i] ?? day.dayName,
    meals: day.meals.map((meal) => {
      let { prepBlockIndex, source, why } = meal

      // prepBlockIndex na nepostojeci blok -> kuhaj_sad.
      if (prepBlockIndex !== null && (prepBlockIndex < 0 || prepBlockIndex >= blockCount)) {
        console.warn(`[planner] "${meal.title}": prepBlockIndex ${prepBlockIndex} ne postoji, prebacujem na kuhaj_sad.`)
        prepBlockIndex = null
        source = 'kuhaj_sad'
      }
      if (source === 'iz_prepa' && prepBlockIndex === null) source = 'kuhaj_sad'
      if (source === 'kuhaj_sad' && prepBlockIndex !== null) prepBlockIndex = null

      // Prazan why -> popuni iz usesExpiring ili genericki. Demo ne smije pokazati prazno.
      if (!why || !why.trim()) why = fillWhy(meal.usesExpiring)

      return { ...meal, prepBlockIndex, source, why }
    }),
  }))

  return { ...plan, prepBlocks, days }
}

function fillWhy(usesExpiring: string[]): string {
  if (usesExpiring.length) {
    return `${joinHr(usesExpiring)} ti ${usesExpiring.length === 1 ? 'umire' : 'umiru'}, iskorištava se ovdje.`
  }
  return 'Jeftin i brz obrok koji se uklapa u tvoj tjedan.'
}

/** "špinat", "špinat i jogurt", "špinat, jogurt i mrkva" */
function joinHr(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ---------------------------------------------------------------------------
// Javni API
// ---------------------------------------------------------------------------

/**
 * Cijeli tjedan. Nikad ne baca: tjedan -> dan-po-dan -> staticni obroci.
 * Plan koji je sporo stigao ili djelomicno genericki je beskonacno bolji od 500.
 */
export async function generateWeekPlan(input: PlannerInput): Promise<PlannerOutput> {
  let raw: PlannerOutput
  if (process.env.PLANNER_MODE === 'week') {
    // Eksperimentalno: jedan poziv za cijeli tjedan. U praksi izlazi iz token limita.
    try {
      raw = await callWholeWeek(input)
    } catch (err) {
      console.warn('[planner] poziv za cijeli tjedan pao, idem dan-po-dan:', errMessage(err))
      raw = await generateDayByDay(input)
    }
  } else {
    raw = await generateChunked(input)
  }

  const plan = postProcessPlan(raw)

  // Warning, ne rusenje: umire-namirnica koja nije potrosena u prva 2 dana.
  const umire = input.pantry.filter((i) => i.urgency === 'umire').map((i) => i.name)
  if (umire.length) {
    const usedEarly = new Set<string>()
    for (const d of plan.days.slice(0, 2)) for (const m of d.meals) for (const x of m.usesExpiring) usedEarly.add(x.toLowerCase())
    const missed = umire.filter((n) => !usedEarly.has(n.toLowerCase()))
    if (missed.length) console.warn(`[planner] nije iskoristio u dan 1-2: ${missed.join(', ')}`)
  }

  return plan
}

// ---------------------------------------------------------------------------
// Swap / shake — jedan obrok
// ---------------------------------------------------------------------------

function formatOldMeal(m: PlannedMeal): string {
  const ingredients = m.ingredients.map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(', ')
  return [
    `Slot: ${m.slot}`,
    `Naslov: ${m.title}`,
    `Minute: ${m.minutes}`,
    `Porcije: ${m.servings}`,
    `Izvor: ${m.source}`,
    `Sastojci: ${ingredients}`,
    `Zašto je bio tu: ${m.why}`,
  ].join('\n')
}

function buildSwapPrompt(ctx: SwapContext, extraLine?: string): string {
  const profil = `${formatProfile(ctx.profile, ctx.tasteNotes)}\n\nOdgovori na pitanja:\n${formatQa(ctx.qa)}`
  const reason = ctx.reason?.trim() ? ctx.reason.trim() : '(korisnik nije rekao razlog — daj nešto svježe)'
  const kosarica = ctx.cartIngredients.length ? ctx.cartIngredients.join(', ') : '(košarica je prazna)'
  const ostala = ctx.otherMealTitles.length ? ctx.otherMealTitles.join('; ') : '(nema drugih obroka)'

  return `=== PROFIL ===
${profil}

=== OBROK KOJI SE MIJENJA ===
${formatOldMeal(ctx.oldMeal)}

=== RAZLOG KORISNIKA ===
${reason}

=== SASTOJCI KOJI SU VEĆ U KOŠARICI (koristi ove) ===
${kosarica}

=== OSTALI OBROCI U TJEDNU (da ne ponoviš) ===
${ostala}

=== DOSTUPNE KATEGORIJE KATALOGA ===
${formatCategories(ctx.categories)}

Daj jedan novi obrok.${extraLine ? `\n${extraLine}` : ''}`
}

async function callSingleMeal(ctx: SwapContext, extraLine?: string): Promise<PlannedMeal> {
  const { object } = await generateObject({
    model: anthropic(MODEL_ID),
    schema: SingleMealOutput,
    schemaName: 'novi_obrok',
    maxRetries: MAX_RETRIES,
    maxOutputTokens: 4_000,
    abortSignal: AbortSignal.timeout(MEAL_TIMEOUT_MS),
    system: SYSTEM_SWAP,
    prompt: buildSwapPrompt(ctx, extraLine),
  })
  return object
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Zamjena jednog obroka. Ako model padne, BACA gresku s jasnom porukom —
 * ruta tada vraca stari obrok nepromijenjen sa statusom 200.
 * Isti naslov kao stari (ili kao neki drugi obrok u tjednu) -> jedan retry.
 */
export async function generateSingleMeal(ctx: SwapContext): Promise<PlannedMeal> {
  const taken = new Set([ctx.oldMeal.title, ...ctx.otherMealTitles].map(normTitle))

  let meal: PlannedMeal
  try {
    meal = await callSingleMeal(ctx)
    if (taken.has(normTitle(meal.title))) {
      console.warn(`[planner] swap vratio isti naslov "${meal.title}", jedan retry.`)
      meal = await callSingleMeal(ctx, `Vrati drugo jelo, ne ${meal.title}.`)
    }
  } catch (err) {
    throw new Error(`KuhAI nije uspio složiti zamjenu za "${ctx.oldMeal.title}": ${errMessage(err)}`)
  }

  // Isti okvir je pravilo, ne prijedlog: slot i porcije od starog obroka,
  // novi obrok je uvijek kuhaj_sad jer prep blok vec stoji.
  return {
    ...meal,
    slot: ctx.oldMeal.slot,
    servings: ctx.oldMeal.servings,
    source: 'kuhaj_sad',
    prepBlockIndex: null,
    why: meal.why.trim() ? meal.why : fillWhy(meal.usesExpiring),
  }
}
