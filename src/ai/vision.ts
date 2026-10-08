import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import '../env.js' // validira ANTHROPIC_API_KEY pri importu; provider ga cita iz process.env
import { FridgeScanOutput, type ScannedItem, type Urgency } from '../schemas/index.js'

/**
 * KuhAI vision: fotka frizidera -> popis namirnica s procjenom roka.
 * Fotka se NE sprema (CLAUDE.md): ulazi kao bytes, izlazi kao lista, bytes se bace.
 * Urgency presuduje KOD iz expiresInDays (D14), ne model.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const MODEL = 'claude-sonnet-5-5'

/** Rok kad model ne vrati nista upotrebljivo — dovoljno dug da ne lazira "umire". */
const DEFAULT_EXPIRES_IN_DAYS = 14

/** Prompt iz docs/PROMPTS.md §2, doslovno. */
const SYSTEM = `Gledaš fotku frižidera, zamrzivača ili ostave hrvatskog korisnika. Tvoj posao je
popisati hranu koju VIDIŠ, procijeniti koliko je ima i — najvažnije — procijeniti
za koliko dana propada. Ta procjena roka je glavni razlog zašto ovaj poziv
postoji: plan tjedna se gradi počevši od onoga što umire.

IMENA
Koristi hrvatsko ime kakvim bi ga recept nazvao, u jednini, malim slovom:
"jaja", "mlijeko", "pileći file", "kiselo vrhnje", "špinat", "paprika", "feta".
Bez brendova ("Dukat mlijeko" -> "mlijeko"), bez opisa stanja u imenu
("pola kupusa" -> name "kupus", quantity 0.5), bez engleskog.
Ako vidiš više varijanti istog (3 jogurta) — jedan item, zbrojena količina.

KOLIČINE
\`unit\` je ISKLJUČIVO "g", "ml" ili "kom". Ništa drugo.
- "kom" za ono što se broji: jaja, jogurt u čašici, limun, glavica kupusa,
  konzerva, pakiranje
- "g" za rasuto i za meso, sir, povrće na težinu
- "ml" za tekućine bez čašice: mlijeko, ulje, sok
Procijeni REALNO, ne okruglo-lijeno. Pola glavice kupusa = 0.5 kom.
Dopola popunjena litrena tetrapak = 500 ml. Tri jaja u kartonu = 3 kom.
Ako vidiš zatvorenu vrećicu, procijeni iz tipičnog pakiranja (špinat ~150 g,
riža 1000 g). Nikad ne vraćaj 0.

CONFIDENCE — BUDI ISKREN
0.9+ jasno vidim i siguran sam što je;
0.7-0.9 vidim, ali količina je procjena;
0.5-0.7 vjerojatno to je, djelomično zaklonjeno;
<0.5 nagađam.
Korisnik ispravlja listu i to je dio toka, pa je nisko \`confidence\` korisno,
a lažno visoko je šteta. Nemoj sve staviti na 0.9.

EXPIRESINDAYS — SRCE OVOG POZIVA
Procijeni broj dana koje namirnica JOŠ ima, kombinirajući dvoje:
1) tipičan rok te vrste hrane, i
2) ono što VIDIŠ na fotki (venulo? smežurano? smeđi rubovi? otvoreno
   pakiranje? kondenzacija? već prerezano?).
Orijentacijski, ako je stanje normalno:
  svježi listovi (špinat, salata, rukola) 2 · svježe bobice 2-3 ·
  svježa riba 1 · svježe mljeveno meso 1-2 · svježa piletina 2-3 ·
  otvoren jogurt 3 · neotvoren jogurt 10 · mlijeko otvoreno 3, neotvoreno 7 ·
  svježi sir 5 · tvrdi sir 21 · jaja 21 · paprika/tikvica/krastavac 7 ·
  mrkva/cikla 21 · kupus/kelj 14 · krumpir/luk 30 ·
  kruh 3 · smrznuto 90 · konzerva, tjestenina, riža, ulje, začini 180+
Vidljivo stanje PRETEŽE nad tablicom: venuli špinat je 1, a ne 2;
zrele banane s pjegama su 2, a ne 7.

\`urgency\` izvedi točno iz svoje brojke, bez iznimke:
expiresInDays <= 2 -> "umire" · 3-7 -> "skoro" · 8+ -> "ok"

ŠTO NE SMIJEŠ
Ne izmišljaj. Popisuješ samo ono što je na fotki vidljivo. Zabranjeno je dodati
"sol, ulje, luk — ionako svi imaju". Ako je frižider skoro prazan, vrati kratku
listu ili prazan array. Prazna lista je točan odgovor, izmišljena nije.
Ne popisuj ambalažu bez sadržaja, piće koje nije hrana za plan ne moraš
izostaviti ali ne izmišljaj ga.

FOLLOW-UP PITANJA
Do 3 kratka pitanja isključivo o onome što se s fotke NE MOŽE vidjeti:
količina u neprozirnoj posudi, što je u zatvorenoj kutiji, koliko je stara
otvorena stvar, ima li još nešto izvan kadra (zamrzivač, ostava).
Razgovorno, s ponuđenim rasponom da je lako odgovoriti.
DOBRO: "Koliko ti je riže ostalo, pola kile ili skoro ništa?"
DOBRO: "Je li to mljeveno meso od danas ili stoji par dana?"
LOŠE: "Možete li potvrditi popis?" (to frontend već radi)
LOŠE: "Imate li alergije?" (nije tema ovog poziva)
Ako nema ničeg nejasnog, vrati prazan array.

Sve na hrvatskom.`

/** User prompt iz docs/PROMPTS.md §2; {{izvor}} i {{danas}} interpolirani. */
function userPrompt(source: string, today: string): string {
  return `Ovo je fotka: ${source}.
Popiši sve namirnice koje vidiš, s procjenom količine, confidence i
expiresInDays. Današnji datum: ${today}.`
}

/** Fallback kad vision ne vrati nista — ruta i dalje vraca 200, tok se ne prekida. */
function fallback(): FridgeScanOutput {
  return {
    items: [],
    followUpQuestions: ['Nisam uspio pročitati fotku — možeš mi reći što imaš doma?'],
  }
}

/**
 * Jedini izvor istine za urgency (D14). Pragovi iz API.md §5:
 * <=2 umire, 3-7 skoro, 8+ ok. Bez roka -> 'ok' (ne lazira hitnost).
 */
export function urgencyFromDays(days: number | null | undefined): Urgency {
  if (days == null || !Number.isFinite(days)) return 'ok'
  if (days <= 2) return 'umire'
  if (days <= 7) return 'skoro'
  return 'ok'
}

/**
 * Ocisti ono sto model vrati: lowercase+trim imena, izbaci prazno i quantity<=0,
 * dedupliciraj po (ime, jedinica), preracunaj rok i urgency u kodu.
 * Pesimisticno spajanje: visi confidence, NIZI expiresInDays.
 */
function normalizeItems(raw: ScannedItem[]): ScannedItem[] {
  const byKey = new Map<string, ScannedItem>()

  for (const item of raw) {
    const name = (item.name ?? '').toLowerCase().trim()
    const quantity = Number(item.quantity)
    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue

    const rawDays = Number(item.expiresInDays)
    const expiresInDays =
      Number.isFinite(rawDays) && rawDays >= 0 ? Math.round(rawDays) : DEFAULT_EXPIRES_IN_DAYS
    const confidence = Number.isFinite(item.confidence)
      ? Math.min(1, Math.max(0, item.confidence))
      : 0.5

    const key = `${name}|${item.unit}`
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += quantity
      existing.confidence = Math.max(existing.confidence, confidence)
      existing.expiresInDays = Math.min(existing.expiresInDays, expiresInDays)
      existing.urgency = urgencyFromDays(existing.expiresInDays)
      continue
    }

    byKey.set(key, {
      name,
      quantity,
      unit: item.unit,
      confidence,
      expiresInDays,
      urgency: urgencyFromDays(expiresInDays),
    })
  }

  return [...byKey.values()]
}

/**
 * Fotka(e) -> FridgeScanOutput. Nikad ne baca: na gresku modela vraca fallback
 * (prazna lista + jedno pitanje), da demo ne stane na mutnoj fotki.
 */
export async function scanFridge(
  images: { data: Uint8Array; mediaType: string }[],
  opts?: { source?: string },
): Promise<FridgeScanOutput> {
  const source = opts?.source ?? 'frižider'
  const today = new Date().toISOString().slice(0, 10)

  const usable = images.filter(
    (img) => img.data.byteLength > 0 && img.data.byteLength <= MAX_IMAGE_BYTES,
  )
  if (usable.length === 0) {
    console.error('[vision] nema upotrebljive slike (prazna ili > MAX_IMAGE_BYTES)')
    return fallback()
  }

  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: FridgeScanOutput,
      maxRetries: 2,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...usable.map((img) => ({
              type: 'image' as const,
              image: img.data,
              mediaType: img.mediaType,
            })),
            { type: 'text' as const, text: userPrompt(source, today) },
          ],
        },
      ],
    })

    return {
      items: normalizeItems(object.items ?? []),
      followUpQuestions: (object.followUpQuestions ?? [])
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .slice(0, 3),
    }
  } catch (err) {
    console.error('[vision] scanFridge pao, vracam fallback:', err)
    return fallback()
  }
}
