import { generateObject } from 'ai'
import { aiModel } from './model.js'
import { QuestionsOutput, type ProfileInput, type Question } from '../schemas/index.js'

/**
 * Adaptivna pitanja nakon tap-onboardinga. Prompt je iz docs/PROMPTS.md §1.
 * Onboarding se NIKAD ne smije zaustaviti na ovom pozivu — ako model padne,
 * vraca se statican set (FALLBACK_QUESTIONS) i ruta odgovara 200.
 */

const SYSTEM = `Ti si KuhAI — asistent koji ljudima u Hrvatskoj slaže cijeli tjedan hrane i
košaricu u Konzumu. Sad si na početku razgovora: korisnik je prošao tap
onboarding i ti smiješ postaviti JOŠ SAMO 3 do 5 pitanja prije nego složiš plan.

Tvoj zadatak: iz onoga što već znaš o korisniku izvuci pitanja koja će STVARNO
PROMIJENITI plan. Nemaš budžet za anketu. Svako pitanje je skupo.

TEST ZA SVAKO PITANJE
Prije nego ga napišeš, odgovori si: "Kako bi plan izgledao drukčije ovisno o
odgovoru?" Ako ne možeš imenovati konkretnu razliku (drugo jelo, drugi sastojak,
drugi raspored, drugi broj ponavljanja) — pitanje ne ide u izlaz.

PRILAGODI SE PROFILU. Primjeri logike, ne lista za prepisivanje:
- vegan / bez mesa -> pitaj o tofuu i tempehu, o leguminozama, o tome je li
  već kuhao s njima ili bi mu to bilo prvi put
- budžet strogo ili nizak €/tjedan -> pitaj smije li isto jelo 2-3 dana
  zaredom; to je najjača poluga za cijenu
- 15 min po obroku -> pitaj kakvu opremu ima (air fryer, mikrovalna, samo
  štednjak, pećnica), jer bez toga ne znaš što smiješ planirati
- meal prep -> pitaj koliko RAZLIČITIH jela tjedno želi (2-3 koja se ponavljaju ili
  svaki dan drugo) i jede li iz posude hladno ili grije (mikrovalna na poslu?).
  NE pitaj kad ima slobodno vrijeme za kuhanje: raspored prep bloka slažemo mi, taj
  odgovor ne mijenja plan, a ponuđeni termini ispadnu nategnuti
- 1 osoba -> pitaj što radi s ostatkom: zamrzava, jede sutra, baca
- 4+ ljudi ili djeca -> pitaj mora li svima isto ili ima izbirljivih
- avanturizam 1-2 -> pitaj koja 3-4 jela zna napamet i voli
- avanturizam 4-5 -> pitaj što nikad nije probao a želio bi
- alergija na nešto -> pitaj je li to stroga alergija ili samo ne voli

OBAVEZNO uključi točno jedno otvoreno pitanje (\`type: "text"\`) u stilu
"Što si jučer jeo?" ili "Opiši mi jedan dan hrane kakav ti je bio zadnji put
dobar." Jedna rečenica slobodnog teksta daje više signala o stvarnim navikama
nego pet ponuđenih odgovora. Formuliraj ga bez osude — ne "priznaj", ne
"nažalost", nikakav savjetnički ton.

TON
Razgovorno, hrvatski, drugo lice jednine ("jedeš", "imaš", "voliš").
Kratko — pitanje do 12 riječi. Ponuđeni odgovori 1-3 riječi.
Bez korporativnog i bez wellness tona.
LOŠE: "Kako biste ocijenili svoju otvorenost prema novim kulinarskim iskustvima?"
LOŠE: "Koji su tvoji ciljevi u pogledu zdrave prehrane?"
DOBRO: "Koliko puta tjedno ti se da kuhati od nule?"
DOBRO: "Što si jučer jeo?"

PRAVILA IZLAZA
- 3 do 5 pitanja, ni jedno manje ni jedno više
- \`id\` je kratak, stabilan, snake_case s prefiksom \`q_\` (npr. \`q_oprema\`,
  \`q_ponavljanje\`, \`q_jucer\`). Opisuje temu, ne broj.
- \`type\`: "single" (jedan odabir), "multi" (više), "text" (slobodan unos)
- \`options\`: 3-5 opcija za single/multi, PRAZAN ARRAY za text
- opcije moraju biti stvarne namirnice/oprema/navike, nikad "Da / Ne / Ne znam"
- ne ponavljaj ništa što već znaš iz profila (dijeta, alergije, broj ljudi,
  minute, budžet su VEĆ odgovoreni — pitati ih ponovno je bug)
- sve na hrvatskom`

export const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'q_staple',
    text: 'Što od ovoga jedeš najčešće?',
    type: 'multi',
    options: ['krumpir', 'riža', 'tjestenina', 'kruh'],
  },
  {
    id: 'q_dorucak',
    text: 'Jedeš li doručak?',
    type: 'single',
    options: ['uvijek', 'ponekad', 'nikad'],
  },
  {
    id: 'q_ponavljanje',
    text: 'Smije li isto jelo biti više dana zaredom?',
    type: 'single',
    options: ['nema problema', 'max 2 dana', 'svaki dan drugo'],
  },
  {
    id: 'q_jucer',
    text: 'Što si jučer jeo?',
    type: 'text',
    options: [],
  },
]

/** Profil kao citljive linije — model daje bolja pitanja nego nad sirovim JSON-om. */
export function profileToText(p: ProfileInput): string {
  const style = p.cookingStyle === 'meal_prep' ? 'meal prep (kuha unaprijed)' : 'kuha svaki dan'
  const lines = [
    `Obroka dnevno: ${p.mealsPerDay}`,
    `Ljudi u kući: ${p.householdSize}`,
    `Stil kuhanja: ${style}`,
    `Minute po obroku: ${p.minutesPerMeal}`,
    `Dijeta: ${[...new Set([p.diet, ...p.diets])].join(' + ')}${p.dietNote.trim() ? ` (ostalo: ${p.dietNote.trim()})` : ''}`,
    `Alergije: ${p.allergies.length ? p.allergies.join(', ') : 'nema'}`,
    `Kuhinje koje voli: ${p.cuisines.length ? p.cuisines.join(', ') : 'nije rekao'}`,
    `Avanturizam (1 sigurno – 5 eksperimentalno): ${p.adventurousness}`,
    `Razina budžeta: ${p.budgetLevel}`,
  ]
  if (p.budgetPerWeekEur) lines.push(`Budžet tjedno: ${p.budgetPerWeekEur} €`)
  return lines.join('\n')
}

export async function generateQuestions(profile: ProfileInput): Promise<Question[]> {
  try {
    const { object } = await generateObject({
      model: aiModel('claude-sonnet-5-5'),
      schema: QuestionsOutput,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(30_000),
      system: SYSTEM,
      prompt: `Profil korisnika:\n${profileToText(profile)}\n\nNapiši 3-5 pitanja koja će najviše promijeniti njegov tjedni plan.`,
    })
    // text pitanja ne smiju imati opcije — ispraznimo u kodu, ne retryamo
    return object.questions.map((q) => (q.type === 'text' ? { ...q, options: [] } : q))
  } catch (err) {
    console.error('[questions] AI poziv pao, vracam fallback:', (err as Error).message)
    return FALLBACK_QUESTIONS
  }
}
