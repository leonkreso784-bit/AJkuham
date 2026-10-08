import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Answer, Cuisine, Diet, Profile, Question } from '../api/types'
import { Button, Chip, Spinner, TopBar, cx, eur } from '../components/ui'
import { getState, setState } from '../store'
import { Art, type ArtName } from '../illustrations'

// Onboarding u 3 kratka ekrana (Leon, 2026-10-08: "anketa je preduga").
//   1. Osnove  — koliko vas, obroci, kako kuhaš, budžet
//   2. Ukus    — što ne jedeš (dijete + alergije + ostalo), što voliš
//   3. Za tebe — najviše 2 AI pitanja, na jednom ekranu, sve preskočivo
// Sve je unaprijed namješteno na najčešći odgovor: tko se slaže, samo tapne "Dalje".
// Oblik Profile (docs/API.md) se ne mijenja; ono što više ne pitamo dobije razuman default.

// ---- opcije ----

const MEALS: { n: Profile['mealsPerDay']; sub: string }[] = [
  { n: 2, sub: 'ručak, večera' }, { n: 3, sub: 'klasika' }, { n: 4, sub: '+ užina' }, { n: 5, sub: '+ 2 užine' },
]

// Stil kuhanja i minute po obroku spojeni u jedno pitanje.
type StyleKey = 'prep' | 'svjeze' | 'brzo'
const STYLES: { key: StyleKey; art: ArtName; tint: string; title: string; sub: string; cookingStyle: Profile['cookingStyle']; minutes: Profile['minutesPerMeal'] }[] = [
  { key: 'prep', art: 'lonac', tint: 'bg-[#E4F1DA]', title: 'Meal prep', sub: '1–2× tjedno skuham više', cookingStyle: 'meal_prep', minutes: 30 },
  { key: 'svjeze', art: 'stednjak', tint: 'bg-[#FFF0C9]', title: 'Svaki dan', sub: 'svježe, do 30 min', cookingStyle: 'svaki_dan', minutes: 30 },
  { key: 'brzo', art: 'kuhar', tint: 'bg-[#FFE3D3]', title: 'Na brzinu', sub: 'svaki dan, do 15 min', cookingStyle: 'svaki_dan', minutes: 15 },
]

// Budžet: ljudi ne znaju tjedni iznos napamet, ali znaju koliko paze. Izvor istine je € po porciji,
// pa se tjedni iznos sam skalira kad promijeniš broj ljudi ili obroka.
const TIERS: { label: string; rate: number }[] = [
  { label: 'Štedljivo', rate: 1.0 }, { label: 'Normalno', rate: 1.5 }, { label: 'Opušteno', rate: 2.5 },
]
const BUDGET_MIN = 20
const BUDGET_MAX = 400
const round5 = (n: number) => Math.round(n / 5) * 5
const clampBudget = (n: number) => Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, round5(n)))
// Pragovi odgovaraju starom slideru (45 € / 90 € za 2 osobe × 3 obroka).
const levelFor = (rate: number): Profile['budgetLevel'] => (rate < 1.2 ? 'strogo' : rate > 2.0 ? 'labavo' : 'srednje')
// Ista pretpostavka kao backend deliveryComparison.
const DELIVERY_PER_MEAL = 14.76

// "Što ne jedeš?" — više dijeta odjednom (`diets`, API.md §2). `diet` = najstroža, radi kompatibilnosti.
type DietKey = Exclude<Diet, 'sve'>
const DIET_CHIPS: [DietKey, string][] = [
  ['bez_mesa', 'Bez mesa'], ['vegan', 'Vegan'], ['bez_svinjetine', 'Bez svinjetine'],
  ['bez_laktoze', 'Bez laktoze'], ['bez_glutena', 'Bez glutena'],
]
const DIET_PRIORITY: DietKey[] = ['vegan', 'bez_mesa', 'bez_svinjetine', 'bez_glutena', 'bez_laktoze']
const ALLERGIES = ['orasi', 'kikiriki', 'jaja', 'riba', 'školjke', 'soja']

const CUISINES: [Cuisine, string][] = [
  ['domaca', 'Domaća'], ['mediteranska', 'Mediteranska'], ['talijanska', 'Talijanska'], ['azijska', 'Azijska'],
  ['meksicka', 'Meksička'], ['bliskoistocna', 'Bliskoistočna'], ['indijska', 'Indijska'], ['comfort', 'Comfort'],
]
const DEFAULT_CUISINES: Cuisine[] = ['domaca', 'mediteranska', 'talijanska']

// Backend vraća 3–5 pitanja (QuestionsOutput min 3). Prikazujemo najviše 2:
// prvo ona s ponuđenim odgovorima (tap je brži od tipkanja), tekstualno samo ako fali.
const MAX_AI = 2
const pickQuestions = (qs: Question[]) =>
  [...qs.filter((q) => q.type !== 'text'), ...qs.filter((q) => q.type === 'text')].slice(0, MAX_AI)

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
const people = (n: number) => (n === 1 ? 'samo ja' : `${n} ${n >= 2 && n <= 4 ? 'osobe' : 'osoba'}`)
const filled = (v: string | string[]) => (Array.isArray(v) ? v.length > 0 : v.trim() !== '')

// ---- stanje forme <-> Profile ----

interface Form {
  householdSize: number
  mealsPerDay: Profile['mealsPerDay']
  style: StyleKey
  rate: number
  diets: DietKey[]
  dietNote: string
  allergies: string[]
  cuisines: Cuisine[]
  surprise: boolean
}

const DEFAULTS: Form = {
  householdSize: 2, mealsPerDay: 3, style: 'prep', rate: 1.5,
  diets: [], dietNote: '', allergies: [], cuisines: DEFAULT_CUISINES, surprise: false,
}

const portionsOf = (f: Form) => f.mealsPerDay * 7 * f.householdSize
const budgetOf = (f: Form) => clampBudget(portionsOf(f) * f.rate)

function toProfile(f: Form): Profile {
  const style = STYLES.find((s) => s.key === f.style) ?? STYLES[0]
  const diets = DIET_PRIORITY.filter((d) => f.diets.includes(d)) // najstroža prva
  const budget = budgetOf(f)
  return {
    mealsPerDay: f.mealsPerDay,
    householdSize: f.householdSize,
    cookingStyle: style.cookingStyle,
    minutesPerMeal: style.minutes,
    diet: diets[0] ?? 'sve',
    diets,
    dietNote: f.dietNote.trim().slice(0, 200),
    allergies: f.allergies,
    cuisines: f.cuisines,
    adventurousness: f.surprise ? 5 : 3,
    budgetLevel: levelFor(budget / portionsOf(f)),
    budgetPerWeekEur: budget,
  }
}

// Povratnik: forma se puni iz spremljenog profila (stari profili nemaju `diets`/`dietNote`).
function fromProfile(p: Profile | null): Form {
  if (!p) return DEFAULTS
  const diets = [...new Set([p.diet, ...(p.diets ?? [])])].filter((d): d is DietKey => d !== 'sve')
  return {
    householdSize: p.householdSize,
    mealsPerDay: p.mealsPerDay,
    style: p.cookingStyle === 'meal_prep' ? 'prep' : p.minutesPerMeal === 15 ? 'brzo' : 'svjeze',
    rate: p.budgetPerWeekEur ? p.budgetPerWeekEur / (p.mealsPerDay * 7 * p.householdSize) : 1.5,
    diets,
    dietNote: p.dietNote ?? '',
    allergies: p.allergies,
    cuisines: p.cuisines.length ? p.cuisines : DEFAULT_CUISINES,
    surprise: p.adventurousness >= 4,
  }
}

const STEPS = [
  { title: 'Osnove', sub: 'koliko vas, kako kuhaš, budžet', h1: 'Složimo tvoj tjedan', lead: 'Već sam namjestio ono što većina bira. Promijeni samo što ne štima.' },
  { title: 'Ukus', sub: 'što ne jedeš, što voliš', h1: 'Što ti paše?', lead: 'Označi koliko god hoćeš. Ako sve jedeš, samo dalje.' },
  { title: 'Za tebe', sub: 'dva pitanja od KuhAI-ja', h1: 'Još dvije stvari', lead: 'Pitanja samo za tebe. Nije obavezno, ali plan bude bolji.' },
]

export default function Onboarding() {
  const nav = useNavigate()
  const [f, setF] = useState<Form>(() => fromProfile(getState().profile))
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }))
  const [step, setStep] = useState(0)
  const [noteOpen, setNoteOpen] = useState(() => f.dietNote !== '')
  const [mealsTyped, setMealsTyped] = useState('')

  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // AI pitanja po profilu (ključ = JSON profila). Model treba ~10 s, pa se pitanja traže već
  // kad korisnik uđe na korak 2: većina tamo ništa ne mijenja i na koraku 3 su već spremna.
  const loads = useRef(new Map<string, Promise<Question[]>>())
  const prefetched = useRef(false)
  const shownFor = useRef('')

  const profile = toProfile(f)
  const profileKey = JSON.stringify(profile)
  const portions = portionsOf(f)
  const budget = budgetOf(f)

  function loadQuestions(key: string) {
    let pr = loads.current.get(key)
    if (!pr) {
      const p = JSON.parse(key) as Profile
      pr = (async () => {
        await api.putProfile(p)
        setState({ profile: p, plan: null })
        const res = await api.questions()
        return pickQuestions(res.questions)
      })().catch(() => [] as Question[]) // pitanja nisu nužna: bez njih se ide dalje
      loads.current.set(key, pr)
    }
    return pr
  }

  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  // Korak 2: jedan unaprijedni zahtjev s onim što znamo (ne na svaki tap čipa).
  useEffect(() => {
    if (step === 0) prefetched.current = false
    if (step === 1 && !prefetched.current) { prefetched.current = true; void loadQuestions(profileKey) }
  }, [step, profileKey])

  // Korak 3: pitanja za konačni profil (iz predmemorije ako se ništa nije promijenilo).
  useEffect(() => {
    if (step !== 2) return
    let live = true
    if (shownFor.current !== profileKey) { setQuestions(null); setAnswers({}) }
    void loadQuestions(profileKey).then((qs) => {
      if (!live) return
      shownFor.current = profileKey
      setQuestions(qs)
    })
    return () => { live = false }
  }, [step, profileKey])

  // Kraj (ili "Preskoči" bilo gdje): spremi profil, odgovore ako ih ima, i ravno na frižider.
  async function finish(withAnswers: boolean) {
    setBusy(true); setErr(null)
    try {
      await api.putProfile(profile)
      setState({ profile, plan: null })
      const list: Answer[] = withAnswers
        ? Object.entries(answers).filter(([, v]) => filled(v)).map(([id, v]) => ({ id, value: Array.isArray(v) ? v : v.trim() }))
        : []
      if (list.length) await api.answers(list)
      nav('/frizider')
    } catch (e) {
      setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  const back = () => (step === 0 ? nav('/') : setStep(step - 1))
  const S = STEPS[step]
  const avoids = f.diets.length + f.allergies.length + (f.dietNote.trim() ? 1 : 0)

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar className="hidden lg:block" />
      <main className="mx-auto max-w-xl px-5 pb-36 lg:max-w-6xl lg:px-8 lg:pt-12 lg:pb-16">
        <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-14">
          {/* Lijevo: naslov (+ koraci i sažetak na desktopu). Mobitel: traka natrag · napredak · preskoči. */}
          <aside className="lg:sticky lg:top-28">
            <div className="sticky top-0 z-10 -mx-5 flex items-center gap-3 bg-bg/95 px-5 py-3 backdrop-blur lg:hidden">
              <button onClick={back} aria-label="Natrag"
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-lg font-bold">←</button>
              <div className="flex flex-1 gap-1.5" aria-label={`Korak ${step + 1} od 3`}>
                {STEPS.map((s, i) => (
                  <span key={s.title} className={cx('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-brand' : 'bg-line')} />
                ))}
              </div>
              {step < 2 && <SkipLink busy={busy} onClick={() => finish(false)} />}
            </div>

            <p className="mt-2 text-sm font-extrabold text-brand lg:mt-0">Korak {step + 1} od 3 · pola minute</p>
            <h1 className="mt-1 text-[26px] leading-tight font-black tracking-tight text-balance lg:text-[38px]">{S.h1}</h1>
            <p className="mt-1.5 text-[15px] text-muted lg:text-base">{S.lead}</p>

            <ol className="mt-8 hidden flex-col gap-1 lg:flex">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <button onClick={() => setStep(i)} disabled={i >= step}
                    className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors disabled:opacity-100',
                      i === step ? 'bg-white ring-1 ring-line' : i < step && 'hover:bg-white')}>
                    <span className={cx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-black',
                      i < step ? 'bg-fresh text-white' : i === step ? 'bg-brand text-white' : 'bg-line text-muted')}>
                      {i < step ? '✓' : i + 1}
                    </span>
                    <span>
                      <b className={cx('block leading-tight font-extrabold', i > step && 'text-muted')}>{s.title}</b>
                      <span className="text-sm text-muted">{s.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-6 hidden rounded-2xl bg-cream p-4 lg:block">
              <p className="text-sm text-muted">Tvoj tjedan</p>
              <p className="mt-0.5 font-display text-2xl font-bold tracking-tight tabular-nums">{portions} porcija</p>
              <p className="text-sm text-muted">{people(f.householdSize)} · {f.mealsPerDay} obroka dnevno · {budget} €</p>
            </div>
            <div className="mt-4 hidden items-center justify-between lg:flex">
              <button onClick={() => nav('/')} className="text-sm font-bold text-muted hover:text-ink">← Početna</button>
              {step < 2 && <SkipLink busy={busy} onClick={() => finish(false)} />}
            </div>
          </aside>

          <div className="mt-6 min-w-0 lg:mt-0">
            {step === 0 && (
              <div key="s0" className="grid animate-pop gap-4 lg:grid-cols-2 lg:gap-5">
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-extrabold">Za koliko vas kuham?</h2>
                      <p className="text-sm text-muted">{people(f.householdSize)}</p>
                    </div>
                    <Stepper value={f.householdSize} min={1} max={8} label="osoba" onChange={(n) => set({ householdSize: n })} />
                  </div>
                  <hr className="my-4 border-line" />
                  <h2 className="font-extrabold">Obroka dnevno</h2>
                  <Segmented className="mt-2.5" label="Obroka dnevno" value={f.mealsPerDay} onChange={(n) => { set({ mealsPerDay: n }); setMealsTyped('') }}
                    options={MEALS.map((m) => ({ value: m.n, label: String(m.n), sub: m.sub }))} />
                  {/* Leon (14:40): broj se mora moći i upisati; granica je ona iz API.md, 2 do 5. */}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <label htmlFor="meals-typed" className="text-sm font-bold text-muted">Ili upiši broj (2 do 5)</label>
                    <input id="meals-typed" type="number" inputMode="numeric" min={2} max={5} step={1} value={mealsTyped} placeholder={String(f.mealsPerDay)}
                      onChange={(e) => { const v = e.target.value; setMealsTyped(v); const n = Number(v); if (Number.isInteger(n) && n >= 2 && n <= 5) set({ mealsPerDay: n as Profile['mealsPerDay'] }) }}
                      className="w-16 rounded-xl border border-line bg-bg px-2 py-1.5 text-center text-lg font-black tabular-nums outline-none focus:border-ink" />
                  </div>
                  {mealsTyped !== '' && !(Number.isInteger(Number(mealsTyped)) && Number(mealsTyped) >= 2 && Number(mealsTyped) <= 5) && (
                    <p className="mt-1 text-right text-xs font-bold text-hot">Može između 2 i 5 obroka dnevno.</p>
                  )}
                </Card>

                <Card>
                  <h2 className="font-extrabold">Kako kuhaš?</h2>
                  <div className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kako kuhaš">
                    {STYLES.map((s) => {
                      const on = f.style === s.key
                      return (
                        <button key={s.key} role="radio" aria-checked={on} onClick={() => set({ style: s.key })}
                          className={cx('flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 pt-3 pb-2.5 text-center transition-colors active:translate-y-px',
                            on ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-[#E6D3BF]')}>
                          <span className={cx('grid size-12 place-items-center rounded-xl', s.tint)}><Art name={s.art} className="size-9" /></span>
                          <b className="text-[15px] leading-tight font-extrabold">{s.title}</b>
                          <span className="text-xs leading-tight text-muted">{s.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                </Card>

                <Card className="lg:col-span-2">
                  <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-8">
                    <div>
                      <h2 className="font-extrabold">Tjedni budžet za hranu</h2>
                      <Segmented className="mt-2.5" label="Koliko paziš na novac"
                        value={TIERS.find((t) => Math.abs(t.rate - f.rate) < 0.001)?.rate ?? -1}
                        onChange={(rate) => set({ rate })}
                        options={TIERS.map((t) => ({ value: t.rate, label: t.label }))} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 lg:mt-0">
                      <div className="min-w-0">
                        <p className="font-display text-[30px] leading-none font-bold tracking-tight tabular-nums">{budget} €</p>
                        <p className="mt-1.5 text-sm text-muted">
                          <b className="text-fresh">{eur(budget / portions)}</b> po porciji · dostava ~{eur(DELIVERY_PER_MEAL)}
                        </p>
                      </div>
                      <Stepper value={budget} min={BUDGET_MIN} max={BUDGET_MAX} step={5} label="budžet, 5 €" hideValue
                        onChange={(b) => set({ rate: b / portions })} />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {step === 1 && (
              <div key="s1" className="grid animate-pop gap-4 lg:grid-cols-2 lg:gap-5">
                <Card>
                  <h2 className="font-extrabold">Što ne jedeš?</h2>
                  <p className="text-sm text-muted">{avoids ? 'Toga neće biti ni u tragovima.' : 'Ništa označeno: jedeš sve.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DIET_CHIPS.map(([d, l]) => (
                      <Chip key={d} on={f.diets.includes(d)} onClick={() => set({ diets: toggle(f.diets, d) })}>{l}</Chip>
                    ))}
                    <Chip on={noteOpen} onClick={() => { if (noteOpen) set({ dietNote: '' }); setNoteOpen(!noteOpen) }}>Ostalo</Chip>
                  </div>
                  {noteOpen && (
                    <input value={f.dietNote} onChange={(e) => set({ dietNote: e.target.value.slice(0, 200) })} autoFocus
                      placeholder="npr. ne jedem ribu, bez šećera…" aria-label="Ostalo o prehrani"
                      className="mt-2 w-full animate-pop rounded-2xl border border-line bg-bg px-4 py-3 text-[16px] outline-none placeholder:text-muted/70 focus:border-ink" />
                  )}
                  <p className="mt-4 mb-2 text-sm font-bold text-muted">Alergije</p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([...ALLERGIES, ...f.allergies])].map((a) => (
                      <Chip key={a} on={f.allergies.includes(a)} onClick={() => set({ allergies: toggle(f.allergies, a) })}>{a}</Chip>
                    ))}
                  </div>
                  <AddAllergy onAdd={(v) => { if (!f.allergies.includes(v)) set({ allergies: [...f.allergies, v] }) }} />
                </Card>

                <Card>
                  <h2 className="font-extrabold">Što voliš jesti?</h2>
                  <p className="text-sm text-muted">Najčešće sam već označio, makni ili dodaj.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CUISINES.map(([c, l]) => (
                      <Chip key={c} on={f.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(f.cuisines, c) })}>{l}</Chip>
                    ))}
                  </div>
                  <button role="switch" aria-checked={f.surprise} onClick={() => set({ surprise: !f.surprise })}
                    className={cx('mt-4 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                      f.surprise ? 'border-brand bg-brand/5' : 'border-dashed border-[#E6D3BF] hover:border-ink')}>
                    <span className="min-w-0 flex-1">
                      <b className="block font-extrabold">Iznenadi me</b>
                      <span className="text-sm text-muted">Ubaci i jela koja još nisi probao.</span>
                    </span>
                    <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', f.surprise ? 'bg-brand' : 'bg-line')}>
                      <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', f.surprise ? 'left-6' : 'left-1')} />
                    </span>
                  </button>
                </Card>
              </div>
            )}

            {step === 2 && (
              <div key="s2" className="animate-pop">
                <div className="mb-4 flex items-end gap-2">
                  <img src="/logo.png" alt="" className="size-8 shrink-0 rounded-lg" />
                  <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 leading-snug" aria-live="polite">
                    {questions === null ? 'Gledam što si mi rekao…' : questions.length ? 'Super, skužio sam. Ovo bi mi još pomoglo.' : 'Super, imam sve što trebam. Idemo na frižider.'}
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                  {questions === null
                    ? [0, 1].map((k) => (
                      <Card key={k} className="animate-pulse">
                        <div className="h-5 w-3/4 rounded-full bg-line" />
                        <div className="mt-4 flex flex-wrap gap-2">
                          {[80, 64, 96, 56].map((w) => <span key={w} className="h-10 rounded-full bg-cream" style={{ width: w }} />)}
                        </div>
                      </Card>
                    ))
                    : questions.map((q) => (
                      <Card key={q.id}>
                        <h2 className="font-extrabold">{q.text}</h2>
                        {q.type === 'text' ? (
                          <textarea rows={2} placeholder="Napiši ukratko…" aria-label={q.text} value={(answers[q.id] as string | undefined) ?? ''}
                            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            className="mt-3 w-full resize-none rounded-2xl border border-line bg-bg p-3.5 text-[16px] outline-none placeholder:text-muted/70 focus:border-ink" />
                        ) : (
                          <>
                            {q.type === 'multi' && <p className="text-sm text-muted">Može više odgovora.</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {q.options.map((o) => {
                                const cur = answers[q.id]
                                const on = q.type === 'multi' ? ((cur as string[] | undefined) ?? []).includes(o) : cur === o
                                return (
                                  <Chip key={o} on={on} onClick={() => setAnswers((a) => ({
                                    ...a,
                                    [q.id]: q.type === 'multi' ? toggle((a[q.id] as string[] | undefined) ?? [], o) : on ? '' : o,
                                  }))}>{o}</Chip>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {err && <p className="mt-4 rounded-xl bg-hot-bg p-3 text-sm font-bold text-hot">{err}</p>}

            {/* CTA: mobitel ljepljivo dolje, desktop ispod kartica */}
            <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(env(safe-area-inset-bottom),16px)] lg:static lg:mt-8 lg:bg-none lg:p-0">
              <div className="mx-auto flex max-w-xl gap-3 lg:mx-0 lg:max-w-none lg:items-center lg:justify-end">
                {step > 0 && <Button variant="ghost" className="max-lg:hidden lg:mr-auto" onClick={back}>← Natrag</Button>}
                {step === 2 && (
                  <Button variant="soft" className="flex-1 lg:flex-none lg:px-8" disabled={busy} onClick={() => finish(false)}>Preskoči</Button>
                )}
                {step < 2 ? (
                  <Button className="w-full lg:w-auto lg:px-16" onClick={() => setStep(step + 1)}>Dalje</Button>
                ) : (
                  <Button className="flex-[2] lg:flex-none lg:px-12" disabled={busy} onClick={() => finish(true)}>
                    {busy ? <><Spinner /> Spremam…</> : 'Slikaj frižider'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ---- male komponente ----

function SkipLink({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy} title="Složi s ovim postavkama i idi na frižider"
      className="shrink-0 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-extrabold text-ink hover:border-[#E6D3BF]">
      Preskoči
    </button>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-3xl border border-line bg-white p-5 shadow-card', className)}>{children}</section>
}

const STEP_BTN = 'grid size-10 place-items-center rounded-full bg-cream text-lg font-bold text-ink transition-colors hover:bg-[#FFE9CF] active:translate-y-px'

function Stepper({ value, min, max, step = 1, label, hideValue, onChange }: { value: number; min: number; max: number; step?: number; label: string; hideValue?: boolean; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white p-1">
      <button className={STEP_BTN} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Manje (${label})`}>−</button>
      {!hideValue && <span className="min-w-8 text-center text-lg font-extrabold tabular-nums">{value}</span>}
      <button className={STEP_BTN} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`Više (${label})`}>+</button>
    </div>
  )
}

function Segmented<T extends number>({ options, value, onChange, label, className }: {
  options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; label: string; className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-cream p-1', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cx('rounded-xl px-1 py-2 text-center transition-colors', on ? 'bg-white shadow-card ring-1 ring-line' : 'text-ink/75 hover:bg-white/60')}>
            <span className={cx('block font-extrabold', o.sub ? 'text-xl leading-tight' : 'text-[15px]')}>{o.label}</span>
            {o.sub && <span className="block text-[11px] leading-tight text-muted">{o.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Rijetka alergija: "+ Drugo" otvara polje, upisano postaje čip (tvrda zabrana kao i ostale).
function AddAllergy({ onAdd }: { onAdd: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const v = draft.trim().toLowerCase()
    if (v) onAdd(v)
    setDraft('')
  }
  if (!open) {
    return <button onClick={() => setOpen(true)} className="mt-2 text-sm font-extrabold text-brand hover:text-brand-dark">+ Druga alergija</button>
  }
  return (
    <form className="mt-2 flex animate-pop gap-2" onSubmit={submit}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="npr. sezam" aria-label="Druga alergija"
        className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2.5 text-[16px] outline-none focus:border-ink" />
      <button className="rounded-full border border-line bg-white px-4 font-bold hover:border-[#E6D3BF] disabled:opacity-40" disabled={!draft.trim()}>Dodaj</button>
    </form>
  )
}
