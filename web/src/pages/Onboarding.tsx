import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Answer, Cuisine, Diet, Profile, Question } from '../api/types'
import { Button, Chip, Shell, cx, eur } from '../components/ui'
import { setState } from '../store'
import { Art } from '../illustrations'

// Onboarding kao razgovor: KuhAI pita, tvoji odgovori ostaju u chatu.
// Pitanja s jednim odgovorom idu dalje na tap — bez "Dalje" gumba.

const DIETS: [Diet, string][] = [
  ['sve', 'Jedem sve'], ['bez_mesa', 'Bez mesa'], ['vegan', 'Vegan'],
  ['bez_svinjetine', 'Bez svinjetine'], ['bez_laktoze', 'Bez laktoze'], ['bez_glutena', 'Bez glutena'],
]
const CUISINES: [Cuisine, string][] = [
  ['domaca', 'Domaća'], ['talijanska', 'Talijanska'], ['azijska', 'Azijska'], ['meksicka', 'Meksička'],
  ['mediteranska', 'Mediteranska'], ['bliskoistocna', 'Bliskoistočna'], ['indijska', 'Indijska'], ['comfort', 'Comfort'],
]
const ALLERGIES = ['orasi', 'kikiriki', 'jaja', 'riba', 'školjke', 'soja']
const ADVENTURE: [number, string][] = [[1, 'Provjereno'], [3, 'Pola-pola'], [5, 'Iznenadi me']]
const MEALS_SUB: Record<number, string> = { 2: 'brzo i jednostavno', 3: 'klasika', 4: '+ užina', 5: '+ dvije užine' }
// Ista pretpostavka kao backend deliveryComparison.
const DELIVERY_PER_MEAL = 14.76

const label = <T,>(list: [T, string][], v: T) => list.find(([k]) => k === v)?.[1] ?? String(v)
const people = (n: number) => (n === 1 ? 'samo ja' : `${n} ${n >= 2 && n <= 4 ? 'osobe' : 'osoba'}`)

const TAPS = 8
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export default function Onboarding() {
  const nav = useNavigate()
  const [p, setP] = useState<Profile>({
    mealsPerDay: 3, householdSize: 2, cookingStyle: 'meal_prep', minutesPerMeal: 30, diet: 'sve',
    allergies: [], cuisines: [], adventurousness: 3, budgetLevel: 'srednje', budgetPerWeekEur: 60,
  })
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }))

  const [phase, setPhase] = useState<'taps' | 'thinking' | 'ai' | 'summary'>('taps')
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [allergyDraft, setAllergyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [phase, step, qi])

  async function startAi(profile: Profile) {
    setPhase('thinking'); setErr(null)
    try {
      await api.putProfile(profile)
      setState({ profile, plan: null })
      const { questions } = await api.questions()
      setQuestions(questions)
      setQi(0)
      setPhase(questions.length ? 'ai' : 'summary')
    } catch (e) {
      setErr((e as Error).message)
      setPhase('summary')
    }
  }

  function next(profile = p) {
    if (editing) { setEditing(false); setPhase('summary'); return }
    if (step + 1 < TAPS) setStep(step + 1)
    else startAi(profile)
  }

  // Tap = odgovor + dalje (kratka pauza da se vidi odabir).
  function tap(patch: Partial<Profile>) {
    const np = { ...p, ...patch }
    setP(np)
    setTimeout(() => next(np), 220)
  }

  function nextQuestion() {
    if (qi + 1 < questions.length) setQi(qi + 1)
    else setPhase('summary')
  }

  function edit(k: number) {
    setEditing(true); setStep(k); setPhase('taps')
  }

  async function confirm() {
    setBusy(true); setErr(null)
    try {
      await api.putProfile(p)
      setState({ profile: p, plan: null })
      const list: Answer[] = Object.entries(answers).map(([id, value]) => ({ id, value }))
      if (list.length) await api.answers(list)
      nav('/frizider')
    } catch (e) {
      setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  const portions = p.mealsPerDay * 7 * p.householdSize
  const perPortion = (p.budgetPerWeekEur ?? 0) / portions

  // ---- pitanja ----
  const asks: { bot: ReactNode; answer: string; input: ReactNode; cta?: { label: string; disabled?: boolean } }[] = [
    {
      bot: <>Bok! Ja sam KuhAI i složit ću ti cijeli tjedan hrane. Za početak: <b>koliko obroka dnevno</b> pojedeš?</>,
      answer: `${p.mealsPerDay} obroka dnevno`,
      input: (
        <div className="grid grid-cols-2 gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => tap({ mealsPerDay: n as Profile['mealsPerDay'] })}
              className={cx('rounded-2xl border bg-white px-4 py-3 text-left transition-colors active:translate-y-px', p.mealsPerDay === n && step > 0 ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-[#E6D3BF]')}>
              <span className="block text-2xl font-black">{n}</span>
              <span className="text-sm text-muted">{MEALS_SUB[n]}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      bot: <>Za <b>koliko vas</b> kuham?</>,
      answer: people(p.householdSize),
      input: (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => <Chip key={n} onClick={() => tap({ householdSize: n })}>{n === 1 ? 'Samo ja' : `${n}`}</Chip>)}
        </div>
      ),
    },
    {
      bot: <>Kako ti više paše kuhati?</>,
      answer: p.cookingStyle === 'meal_prep' ? 'Meal prep' : 'Svaki dan svježe',
      input: (
        <div className="grid gap-2">
          {([
            ['meal_prep', 'lonac', 'bg-[#E4F1DA]', 'Meal prep', 'Jednom-dvaput tjedno skuham više, ostalo podgrijem.'],
            ['svaki_dan', 'stednjak', 'bg-[#FFF0C9]', 'Svaki dan svježe', 'Kratko kuhanje svaki dan.'],
          ] as const).map(([v, art, tint, t, d]) => (
            <button key={v} onClick={() => tap({ cookingStyle: v })}
              className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-3.5 text-left transition-colors hover:border-[#E6D3BF] active:translate-y-px">
              <span className={cx('grid size-14 shrink-0 place-items-center rounded-xl', tint)}><Art name={art} className="size-11" /></span>
              <span>
                <b className="block font-extrabold">{t}</b>
                <span className="text-sm text-muted">{d}</span>
              </span>
            </button>
          ))}
        </div>
      ),
    },
    {
      bot: p.cookingStyle === 'meal_prep'
        ? <>Odlično, meal prep štedi i vrijeme i novac. Kad ipak kuhaš na brzinu, <b>koliko minuta</b> imaš?</>
        : <>Koliko <b>minuta</b> imaš za jedan obrok?</>,
      answer: `${p.minutesPerMeal} min po obroku`,
      input: (
        <div className="flex gap-2">
          {([15, 30, 45] as const).map((m) => <Chip key={m} className="flex-1" onClick={() => tap({ minutesPerMeal: m })}>{m} min</Chip>)}
        </div>
      ),
    },
    {
      bot: <>Kako jedeš?</>,
      answer: label(DIETS, p.diet),
      input: (
        <div className="flex flex-wrap gap-2">
          {DIETS.map(([v, l]) => <Chip key={v} onClick={() => tap({ diet: v })}>{l}</Chip>)}
        </div>
      ),
    },
    {
      bot: <>Ima li nešto na što si <b>alergičan</b>? Toga neće biti ni u tragovima.</>,
      answer: p.allergies.length ? `Alergije: ${p.allergies.join(', ')}` : 'Nemam alergija',
      cta: { label: p.allergies.length ? 'Dalje' : 'Nemam alergija' },
      input: (
        <>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...ALLERGIES, ...p.allergies])].map((a) => (
              <Chip key={a} on={p.allergies.includes(a)}
                onClick={() => setP((x) => ({ ...x, allergies: toggle(x.allergies, a) }))}>{a}</Chip>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => {
            e.preventDefault()
            const v = allergyDraft.trim().toLowerCase()
            if (v && !p.allergies.includes(v)) set({ allergies: [...p.allergies, v] })
            setAllergyDraft('')
          }}>
            <input value={allergyDraft} onChange={(e) => setAllergyDraft(e.target.value)} placeholder="Nešto drugo…"
              className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2.5 text-[15px] outline-none focus:border-ink" />
            <button className="rounded-full border border-line bg-white px-4 font-bold hover:border-[#E6D3BF] disabled:opacity-40" disabled={!allergyDraft.trim()}>Dodaj</button>
          </form>
        </>
      ),
    },
    {
      bot: <>Što <b>voliš jesti</b>? Odaberi koliko god hoćeš.</>,
      answer: `${p.cuisines.map((c) => label(CUISINES, c)).join(', ')} · ${label(ADVENTURE, p.adventurousness)}`,
      cta: { label: 'Dalje', disabled: !p.cuisines.length },
      input: (
        <>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map(([v, l]) => (
              <Chip key={v} on={p.cuisines.includes(v)}
                onClick={() => setP((x) => ({ ...x, cuisines: toggle(x.cuisines, v) }))}>{l}</Chip>
            ))}
          </div>
          <p className="mt-4 mb-2 text-sm font-bold text-muted">A koliko si avanturist?</p>
          <div className="flex gap-2">
            {ADVENTURE.map(([v, l]) => <Chip key={v} on={p.adventurousness === v} className="flex-1 px-2 text-sm whitespace-nowrap" onClick={() => set({ adventurousness: v })}>{l}</Chip>)}
          </div>
        </>
      ),
    },
    {
      bot: <>I za kraj: koliki je <b>tjedni budžet</b> za hranu? Tjedan slažem da stane u to.</>,
      answer: `${p.budgetPerWeekEur} € tjedno`,
      cta: { label: 'To je to' },
      input: (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-black tracking-tight tabular-nums">{p.budgetPerWeekEur} €</span>
            <span className="text-sm text-muted">za {portions} porcija</span>
          </div>
          <input type="range" min={20} max={150} step={5} value={p.budgetPerWeekEur} aria-label="Budžet"
            onChange={(e) => { const v = +e.target.value; set({ budgetPerWeekEur: v, budgetLevel: v < 45 ? 'strogo' : v > 90 ? 'labavo' : 'srednje' }) }}
            className="mt-3 w-full accent-brand" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-fresh-bg px-2 py-2">
              <b className="block text-fresh tabular-nums">{eur(perPortion)}</b>
              <span className="block text-xs leading-tight text-fresh">po porciji doma</span>
            </div>
            <div className="rounded-xl bg-cream px-2 py-2">
              <b className="block tabular-nums">~{eur(DELIVERY_PER_MEAL)}</b>
              <span className="block text-xs leading-tight text-muted">po obroku s dostavom</span>
            </div>
          </div>
        </div>
      ),
    },
  ]

  const tapsDone = phase === 'taps' ? step : TAPS
  const historyUpTo = editing ? step : tapsDone
  const current = phase === 'taps' ? asks[step] : null
  const q = phase === 'ai' ? questions[qi] : null
  const qAnswered = phase === 'summary' ? questions.length : phase === 'ai' ? qi : 0

  // "Što znam o tebi" — raste s odgovorima
  const known = [
    tapsDone > 0 && `${p.mealsPerDay} obroka`,
    tapsDone > 1 && people(p.householdSize),
    tapsDone > 2 && (p.cookingStyle === 'meal_prep' ? 'meal prep' : 'svaki dan'),
    tapsDone > 3 && `${p.minutesPerMeal} min`,
    tapsDone > 4 && p.diet !== 'sve' && label(DIETS, p.diet).toLowerCase(),
    tapsDone > 5 && p.allergies.length > 0 && `bez: ${p.allergies.join(', ')}`,
    tapsDone > 6 && p.cuisines.map((c) => label(CUISINES, c).toLowerCase()).join(', '),
    tapsDone > 7 && `${p.budgetPerWeekEur} €/tj`,
  ].filter(Boolean) as string[]

  const ctaBar =
    current?.cta ? <Button className="w-full" disabled={current.cta.disabled} onClick={() => next()}>{current.cta.label}</Button>
    : q && q.type !== 'single' ? (
      <div className="flex gap-3">
        <Button variant="soft" className="flex-1" onClick={nextQuestion}>Preskoči</Button>
        <Button className="flex-[2]" onClick={nextQuestion}
          disabled={q.type === 'multi' ? !((answers[q.id] as string[] | undefined)?.length) : !String(answers[q.id] ?? '').trim()}>Dalje</Button>
      </div>
    )
    : q ? <Button variant="soft" className="w-full" onClick={nextQuestion}>Preskoči</Button>
    : phase === 'summary' ? <Button className="w-full" onClick={confirm} disabled={busy}>{busy ? 'Spremam…' : 'Slikaj frižider'}</Button>
    : null

  return (
    <Shell>
      <div className="mx-auto max-w-xl lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-12">
        <div className="min-w-0">
          {/* Što znam o tebi — mobitel: traka na vrhu */}
          <div className="sticky top-0 z-10 -mx-5 mb-4 border-b border-line bg-bg px-5 py-2.5 lg:hidden">
            <div className="flex items-center gap-3">
              <button onClick={() => nav('/')} aria-label="Natrag" className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-white font-bold">←</button>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {known.length === 0
                  ? <span className="text-sm text-muted">Upoznajmo se, traje minutu.</span>
                  : known.map((k) => <span key={k} className="shrink-0 animate-pop rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-line">{k}</span>)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:gap-4">
            {asks.slice(0, historyUpTo).map((a, k) => (
              <Exchange key={k} bot={a.bot}>
                <UserBubble onEdit={phase === 'taps' || phase === 'summary' ? () => edit(k) : undefined}>{a.answer}</UserBubble>
              </Exchange>
            ))}

            {current && (
              <Exchange bot={current.bot} key={`ask-${step}`}>
                <div className="ml-10 animate-pop">{current.input}</div>
              </Exchange>
            )}

            {!editing && phase !== 'taps' && (
              <>
                <Bot>{phase === 'thinking' ? <Typing /> : <>Super, skužio sam. Još par pitanja samo za tebe.</>}</Bot>
                {questions.slice(0, qAnswered).map((x) => (
                  <Exchange key={x.id} bot={x.text}>
                    <UserBubble muted={!answers[x.id] || (Array.isArray(answers[x.id]) && !answers[x.id].length)}>
                      {Array.isArray(answers[x.id]) ? (answers[x.id] as string[]).join(', ') || 'preskočeno' : (answers[x.id] as string) || 'preskočeno'}
                    </UserBubble>
                  </Exchange>
                ))}
                {q && (
                  <Exchange bot={q.text} key={q.id}>
                    <div className="ml-10 animate-pop">
                      {q.type === 'text' ? (
                        <textarea rows={2} autoFocus placeholder="Napiši ukratko…" value={(answers[q.id] as string) ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                          className="w-full resize-none rounded-2xl border border-line bg-white p-3.5 text-[16px] outline-none placeholder:text-muted/70 focus:border-ink" />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((o) => {
                            const cur = answers[q.id]
                            const on = q.type === 'multi' ? ((cur as string[]) ?? []).includes(o) : cur === o
                            return (
                              <Chip key={o} on={on} onClick={() => {
                                if (q.type === 'single') { setAnswers((a) => ({ ...a, [q.id]: o })); setTimeout(nextQuestion, 220); return }
                                const list = (cur as string[]) ?? []
                                setAnswers((a) => ({ ...a, [q.id]: list.includes(o) ? list.filter((x) => x !== o) : [...list, o] }))
                              }}>{o}</Chip>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </Exchange>
                )}
              </>
            )}

            {phase === 'summary' && (
              <Exchange bot={<>Evo što sam skužio o tebi. Ako nešto ne štima, samo promijeni.</>}>
                <div className="ml-10 animate-pop divide-y divide-line rounded-2xl border border-line bg-white">
                  {([
                    ['Obroci', `${p.mealsPerDay} dnevno · ${people(p.householdSize)}`, 0],
                    ['Kuhanje', `${p.cookingStyle === 'meal_prep' ? 'Meal prep' : 'Svaki dan'} · do ${p.minutesPerMeal} min`, 2],
                    ['Prehrana', `${label(DIETS, p.diet)}${p.allergies.length ? ` · bez: ${p.allergies.join(', ')}` : ''}`, 4],
                    ['Voliš', p.cuisines.map((c) => label(CUISINES, c)).join(', '), 6],
                    ['Budžet', `${p.budgetPerWeekEur} € tjedno · ${eur(perPortion)}/porcija`, 7],
                  ] as const).map(([k, v, s]) => (
                    <button key={k} onClick={() => edit(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/50">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted">{k}</span>
                        <span className="block leading-snug font-bold">{v}</span>
                      </span>
                      <span className="text-sm font-bold text-brand">Promijeni</span>
                    </button>
                  ))}
                </div>
              </Exchange>
            )}

            {err && <p className="rounded-xl bg-hot-bg p-3 text-sm font-bold text-hot">{err}</p>}
            <div ref={end} className="h-28" />
          </div>
        </div>

        {/* Što znam o tebi — desktop: profil koji raste sa strane */}
        <aside className="sticky top-24 hidden rounded-2xl border border-line bg-white p-5 lg:block">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold">Što znam o tebi</h2>
            <span className="text-sm text-muted tabular-nums">{Math.min(tapsDone, TAPS)}/{TAPS}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(Math.min(tapsDone, TAPS) / TAPS) * 100}%` }} />
          </div>
          {known.length === 0
            ? <p className="mt-4 text-sm text-muted">Upoznajmo se, traje minutu. Odgovori se slažu ovdje.</p>
            : (
              <ul className="mt-4 flex flex-col gap-2">
                {known.map((k) => (
                  <li key={k} className="flex animate-pop items-start gap-2 text-[15px] font-bold">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-fresh" />{k}
                  </li>
                ))}
              </ul>
            )}
          <button onClick={() => nav('/')} className="mt-5 text-sm font-bold text-muted hover:text-ink">← Natrag na početnu</button>
        </aside>
      </div>

      {ctaBar && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-bg from-70% to-transparent pt-6 pb-[max(env(safe-area-inset-bottom),16px)]">
          <div className="mx-auto max-w-6xl px-5 lg:px-8">
            <div className="mx-auto max-w-xl lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
              <div className="lg:pl-10"><div className="lg:max-w-md">{ctaBar}</div></div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Bot({ children }: { children: ReactNode }) {
  return (
    <div className="flex animate-pop items-end gap-2">
      <img src="/logo.png" alt="" className="size-8 shrink-0 rounded-lg" />
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 leading-snug">{children}</div>
    </div>
  )
}

function Exchange({ bot, children }: { bot: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Bot>{bot}</Bot>
      {children}
    </div>
  )
}

function UserBubble({ children, onEdit, muted }: { children: ReactNode; onEdit?: () => void; muted?: boolean }) {
  return (
    <div className="flex justify-end">
      <button onClick={onEdit} disabled={!onEdit} title={onEdit ? 'Promijeni' : undefined}
        className={cx('max-w-[80%] animate-pop rounded-2xl rounded-br-md px-4 py-2.5 text-left font-bold disabled:opacity-100',
          muted ? 'bg-line text-muted' : 'bg-ink text-white', onEdit && 'cursor-pointer hover:opacity-90')}>
        {children}
      </button>
    </div>
  )
}

function Typing() {
  return (
    <span className="flex gap-1 py-1.5" aria-label="KuhAI piše">
      {[0, 150, 300].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-muted/60" style={{ animationDelay: `${d}ms` }} />)}
    </span>
  )
}
