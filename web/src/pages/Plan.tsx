import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/client'
import type { MealDetail, Plan as PlanT, PlanMeal, PrepBlock, Track } from '../api/types'
import { Button, CountUp, SLOT_LABEL, Shell, Spinner, Toast, buzz, cx, eur, useToast } from '../components/ui'
import { MealImage } from '../components/MealImage'
import { getState, setState, useStore } from '../store'

const CUISINE_LABEL: Record<string, string> = {
  domaca: 'domaće kuhinje', talijanska: 'talijanske', azijska: 'azijske', meksicka: 'meksičke',
  mediteranska: 'mediteranske', bliskoistocna: 'bliskoistočne', indijska: 'indijske', comfort: 'comfort hrane',
}

// Poruke dok AI slaže tjedan — građene iz korisnikovih podataka, ne generičke.
function progressLines(budget?: number): string[] {
  const { profile: p, pantry } = getState()
  const lines: string[] = []
  if (p) lines.push(`Kuham za ${p.householdSize} ${p.householdSize === 1 ? 'osobu' : 'osobe'}, ${p.mealsPerDay} obroka dnevno…`)
  const dying = pantry.filter((i) => i.expiresInDays != null && i.expiresInDays <= 2).map((i) => i.name)
  if (dying.length) lines.push(`Vidim da ti ${dying.slice(0, 2).join(' i ')} ${dying.length === 1 ? 'umire' : 'umiru'} — to ide prvo.`)
  else if (pantry.length) lines.push(`Gledam što imaš doma — ${pantry.length} namirnica…`)
  else lines.push('Krećem od nule, bez frižidera…')
  lines.push('Tražim što je na akciji u Konzumu…')
  if (p?.cookingStyle === 'meal_prep') lines.push('Planiram meal prep: kuhaš dvaput, jedeš cijeli tjedan…')
  else if (p) lines.push(`Biram jela do ${p.minutesPerMeal} minuta…`)
  if (p?.cuisines.length) lines.push(`Ubacujem malo ${CUISINE_LABEL[p.cuisines[0]] ?? 'tvoje kuhinje'}…`)
  const b = budget ?? p?.budgetPerWeekEur
  if (b) lines.push(`Pakiram sve u ${b} €…`)
  lines.push('Još malo, kušam…')
  return lines
}

const DAY_SHORT = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

export function toPlanMeal(m: MealDetail, prev: PlanMeal): PlanMeal {
  return { ...prev, id: m.id, title: m.title, minutes: m.minutes, why: m.why, usesExpiring: m.usesExpiring, source: m.source, servings: m.servings }
}

export function replaceMeal(plan: PlanT, oldId: string, m: MealDetail): PlanT {
  return {
    ...plan,
    days: plan.days.map((d) => ({ ...d, meals: d.meals.map((x) => (x.id === oldId ? toPlanMeal(m, x) : x)) })),
  }
}

export default function Plan() {
  const nav = useNavigate()
  const plan = useStore((s) => s.plan)
  const profile = useStore((s) => s.profile)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [budget, setBudget] = useState<number>(plan?.budgetEur ?? profile?.budgetPerWeekEur ?? 60)
  const [day, setDay] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [genBudget, setGenBudget] = useState<number | undefined>(undefined)
  const [toast, showToast] = useToast()

  const generate = useCallback(async (b?: number) => {
    setLoading(true); setErr(null); setGenBudget(b)
    try {
      const p = await api.generate(b)
      setState({ plan: p })
      if (p.budgetEur != null) setBudget(p.budgetEur)
    } catch (e) {
      setErr((e as Error).message)
    } finally { setLoading(false) }
  }, [])

  const started = useRef(false)
  useEffect(() => {
    if (!getState().plan && !started.current) {
      started.current = true
      generate(getState().profile?.budgetPerWeekEur)
    }
  }, [generate])

  const shake = useCallback(async () => {
    const p = getState().plan
    if (!p || shaking) return
    setShaking(true)
    try {
      const { replacedMealId, meal } = await api.shake(p.planId)
      if (meal.swapFailed) {
        // backend nije našao zamjenu i vratio je stari obrok; bez ovoga shake izgleda kao da ništa nije napravio
        buzz([40, 60, 40])
        showToast('Nisam uspio naći zamjenu, protresi još jednom.', 'hot')
        return
      }
      const old = p.days.flatMap((d) => d.meals).find((m) => m.id === replacedMealId)
      const next = replaceMeal(p, replacedMealId, meal)
      setState({ plan: next })
      const idx = next.days.findIndex((d) => d.meals.some((m) => m.id === meal.id))
      if (idx >= 0) setDay(idx)
      buzz(80)
      showToast(old ? `Zamijenio sam ${old.title} za ${meal.title}.` : `Novo jelo: ${meal.title}.`)
      setFlash(meal.id)
      // na mobitelu je nova kartica često ispod ruba ekrana, dovedi je u kadar dok se okreće
      setTimeout(() => document.getElementById(`meal-${meal.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
      setTimeout(() => setFlash(null), 1600)
    } catch (e) {
      setErr((e as Error).message)
    } finally { setShaking(false) }
  }, [shaking, showToast])

  useShake(shake)

  if (!plan || (loading && !plan)) {
    return (
      <Shell tabs>
        <div className="mx-auto max-w-xl">
          {err ? (
            <div className="rounded-2xl border border-line bg-white p-6 text-center">
              <p className="mb-4 font-bold text-hot">{err}</p>
              <Button onClick={() => generate(budget)}>Probaj opet</Button>
            </div>
          ) : (
            <Generating budget={genBudget} />
          )}
        </div>
      </Shell>
    )
  }

  const today = plan.days[day]
  const dirty = budget !== plan.budgetEur

  return (
    <Shell tabs>
      {loading && <div className="fixed inset-0 z-30 grid place-items-center bg-bg/80 px-6 backdrop-blur-sm"><div className="w-full max-w-md"><Generating budget={genBudget} /></div></div>}

      <div className="mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* lijevo (desktop, ljepljivo): spašeno, budžet, košarica */}
        <aside className="lg:sticky lg:top-24">
          {/* 1. rescue — prva stvar koju korisnik pročita */}
          <section className="mb-3 rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="text-sm font-bold text-muted">Spašeno od bacanja ovaj tjedan</p>
            <div className="mt-1 font-display text-[40px] leading-none font-bold tracking-tight text-fresh tabular-nums"><CountUp value={plan.rescue.savedEur} /></div>
            <p className="mt-3 leading-snug font-bold">{plan.rescue.message}</p>
            {plan.rescue.savedItems.length > 0 && (
              <p className="mt-1 text-sm text-muted">{plan.rescue.savedItems.join(', ')}</p>
            )}
          </section>

          {plan.saleDriven.count > 0 && (
            <p className="mb-3 rounded-xl bg-[#FFF3E6] px-4 py-3 text-sm font-bold text-warn">{plan.saleDriven.message}</p>
          )}

          {/* 2. budžet slider — tjedan se pregrađuje */}
          <section className="mb-8 rounded-2xl border border-line bg-white p-4 lg:mb-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-extrabold">Budžet za tjedan</h2>
              <span className="text-sm text-muted">plan: {eur(plan.estimatedTotalEur)}</span>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <span className={cx('w-20 text-2xl font-black tabular-nums', dirty && 'text-brand')}>{budget} €</span>
              <input type="range" min={20} max={150} step={5} value={budget} onChange={(e) => setBudget(+e.target.value)} className="min-w-0 flex-1 accent-brand" aria-label="Budžet" />
            </div>
            {dirty && (
              <Button variant="ink" className="mt-3 w-full animate-pop" onClick={() => generate(budget)} disabled={loading}>
                Pregradi tjedan za {budget} €
              </Button>
            )}
          </section>

          <div className="hidden lg:block"><Button className="w-full" onClick={() => nav('/kosarica')}>Pogledaj košaricu</Button></div>
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* 3. prep blokovi (mobitel: prije tjedna; desktop: ispod) */}
          {plan.prepBlocks.length > 0 && (
            <section className="mb-8 lg:order-2 lg:mt-12 lg:mb-0">
              <h2 className="text-xl font-black tracking-tight lg:text-2xl">Meal prep</h2>
              <p className="mb-3 text-[15px] text-muted">Kuhaš dvaput tjedno, jedeš cijeli tjedan.</p>
              <div className="flex flex-col gap-3 lg:gap-4">
                {plan.prepBlocks.map((b) => <PrepCard key={b.id} b={b} />)}
              </div>
            </section>
          )}

          {/* 4. dani */}
          <section className="lg:order-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight lg:text-[34px] lg:leading-tight">Tvoj tjedan</h2>
              <button onClick={shake} disabled={shaking}
                className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-bold hover:border-[#E6D3BF]">
                {shaking && <Spinner className="size-3.5 border-2" />} Protresi
              </button>
            </div>
            <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:pb-0">
              {plan.days.map((d, i) => {
                const saves = d.meals.some((m) => m.usesExpiring.length)
                return (
                  <button key={d.date} onClick={() => setDay(i)} aria-pressed={i === day}
                    className={cx('relative flex w-13 shrink-0 flex-col items-center rounded-2xl border py-2 transition-colors lg:w-auto lg:flex-1 lg:py-2.5',
                      i === day ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-[#E6D3BF]')}>
                    <span className={cx('text-xs font-bold capitalize lg:text-sm', i === day ? 'text-white/70' : 'text-muted')}>
                      <span className="xl:hidden">{d.dayName.slice(0, 3)}</span>
                      <span className="hidden xl:inline">{d.dayName}</span>
                    </span>
                    <span className="text-lg font-black tabular-nums">{new Date(d.date).getDate()}</span>
                    {saves && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-hot" aria-label="spašava namirnice" />}
                  </button>
                )
              })}
            </div>

            <h3 className="mb-2 font-extrabold capitalize lg:hidden">{today.dayName}</h3>
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
              {today.meals.map((m) => <MealCard key={m.id} m={m} flash={flash === m.id} />)}
            </div>
          </section>

          {err && <p className="mt-4 rounded-xl bg-hot-bg p-3 text-sm font-bold text-hot lg:order-3">{err}</p>}

          <div className="mt-8 lg:hidden"><Button className="w-full" onClick={() => nav('/kosarica')}>Pogledaj košaricu</Button></div>
        </div>
      </div>
      <Toast msg={toast} />
    </Shell>
  )
}

function Generating({ budget }: { budget?: number }) {
  const [lines] = useState(() => progressLines(budget))
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSec((x) => x + 0.25), 250)
    return () => clearInterval(id)
  }, [])
  const i = Math.min(Math.floor(sec / 7), lines.length - 1)
  // asimptotski: nikad 100 % dok odgovor ne stigne (pravi backend: 60–90 s)
  const pct = 1 - Math.exp(-sec / 40)
  const filled = Math.floor(pct * 7.6)
  return (
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-line bg-white px-6 py-9 text-center">
      <img src="/logo.png" alt="" className="mb-5 size-16 animate-wobble rounded-2xl [animation-iteration-count:infinite]" />
      <p key={i} className="min-h-14 animate-pop text-lg leading-snug font-extrabold text-balance">{lines[i]}</p>
      <div className="mt-4 grid w-full grid-cols-7 gap-1.5" aria-label="Slažem dane">
        {DAY_SHORT.map((d, k) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <span className={cx('h-9 w-full rounded-lg transition-colors duration-500', k < filled ? 'bg-brand' : k === filled ? 'animate-pulse bg-brand-soft' : 'bg-line')} />
            <span className={cx('text-[11px] font-bold', k < filled ? 'text-ink' : 'text-muted')}>{d}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Slažem 7 dana po tvojoj mjeri, traje do minute.</p>
    </div>
  )
}

const TRACK: Record<Track, { label: string; bar: string }> = {
  pecnica: { label: 'Pećnica', bar: 'bg-[#F9D3A6] text-[#7A4A12]' },
  stednjak: { label: 'Štednjak', bar: 'bg-[#F8CFC2] text-[#8A2E14]' },
  mikrovalna: { label: 'Mikro', bar: 'bg-[#D3E3F4] text-[#244A6E]' },
  air_fryer: { label: 'Air fryer', bar: 'bg-[#DCEACB] text-[#3B5A1E]' },
  ti: { label: 'Ti', bar: 'bg-brand text-white' },
}
const TRACK_ORDER: Track[] = ['pecnica', 'stednjak', 'air_fryer', 'mikrovalna', 'ti']

function PrepCard({ b }: { b: PrepBlock }) {
  const tl = b.timeline ?? []
  const total = Math.max(b.minutes, ...tl.map((x) => x.startMinute + x.durationMinutes))
  const active = tl.filter((x) => x.track === 'ti').reduce((s, x) => s + x.durationMinutes, 0)
  const tracks = TRACK_ORDER.filter((t) => tl.some((x) => x.track === t))
  // uređaj koji radi najduže — on "kuha umjesto tebe"
  const worker = tracks.filter((t) => t !== 'ti')
    .map((t) => [t, tl.filter((x) => x.track === t).reduce((s, x) => s + x.durationMinutes, 0)] as const)
    .sort((x, y) => y[1] - x[1])[0]?.[0]

  return (
    <div className="rounded-2xl border border-line bg-white p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted capitalize">{b.day} · {b.startHint}</p>
          <h3 className="font-extrabold">{b.title}</h3>
          <p className="text-sm text-muted">Pokriva: {b.covers.join(', ')}</p>
        </div>
        <span className="shrink-0 rounded-xl bg-cream px-3 py-1.5 text-sm font-extrabold tabular-nums">{b.minutes} min</span>
      </div>

      {tl.length > 0 && (
        <>
          <div className="mt-4 flex flex-col gap-1.5">
            {tracks.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className={cx('w-16 shrink-0 text-xs font-bold lg:w-20 lg:text-sm', t === 'ti' ? 'text-brand' : 'text-muted')}>{TRACK[t].label}</span>
                <div className="relative h-7 flex-1 rounded-lg bg-cream lg:h-9">
                  {tl.filter((x) => x.track === t).map((x, i) => (
                    <div key={i}
                      className={cx('absolute inset-y-0.5 flex items-center overflow-hidden rounded-md px-1.5 text-[11px] leading-none font-bold whitespace-nowrap lg:px-2 lg:text-xs', TRACK[t].bar)}
                      style={{ left: `${(x.startMinute / total) * 100}%`, width: `${(x.durationMinutes / total) * 100}%` }}
                      title={`${x.label} · ${x.durationMinutes} min`}
                    >{x.durationMinutes / total >= 0.17 ? x.label : ''}</div>
                  ))}
                </div>
              </div>
            ))}
            <div className="ml-[4.5rem] flex justify-between text-[11px] text-muted tabular-nums lg:ml-[5.5rem] lg:text-xs">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f}>{Math.round(total * f)}</span>)}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            <span className="font-bold text-brand">Ti:</span>{' '}
            {tl.filter((x) => x.track === 'ti').map((x) => `${x.label} ${x.durationMinutes} min`).join(' · ')}
          </p>
          <p className="mt-3 rounded-xl bg-fresh-bg px-3 py-2.5 text-sm leading-snug text-fresh">
            Blok traje <b>{b.minutes} min</b>, a ti stojiš samo <b>{active} min</b>. Ostalo radi {worker ? TRACK[worker].label.toLowerCase() : 'kuhinja'}.
          </p>
        </>
      )}
    </div>
  )
}

function MealCard({ m, flash }: { m: PlanMeal; flash: boolean }) {
  return (
    <Link to={`/obrok/${m.id}`} id={`meal-${m.id}`}
      className={cx('flex items-center gap-3.5 rounded-2xl border border-line bg-white p-3 transition-colors hover:border-[#E6D3BF] active:translate-y-px lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-hidden lg:p-0',
        flash && 'animate-flip ring-2 ring-brand/40')}>
      <MealImage title={m.title} hint={m.imageHint} className="size-16 shrink-0 rounded-xl lg:aspect-[4/3] lg:h-auto lg:w-full lg:rounded-none" artClassName="size-3/4 lg:size-1/2" />
      <span className="min-w-0 flex-1 lg:px-4 lg:pt-3 lg:pb-4">
        <span className="block text-sm text-muted">{SLOT_LABEL[m.slot]}</span>
        <b className="block truncate leading-tight font-extrabold lg:text-[17px] lg:whitespace-normal">{m.title}</b>
        <span className="mt-0.5 block truncate text-sm text-muted lg:whitespace-normal">
          {m.minutes} min
          {m.source === 'iz_prepa' && <> · <span className="font-bold text-fresh">iz prepa</span></>}
          {m.usesExpiring.length > 0 && <> · <span className="font-bold text-hot">spašava {m.usesExpiring.join(', ')}</span></>}
        </span>
      </span>
      <span className="text-xl text-[#D9C4AE] lg:hidden" aria-hidden>›</span>
    </Link>
  )
}

// Protreseš telefon → shake. iOS traži dozvolu na prvi dodir.
function useShake(onShake: () => void) {
  const cb = useRef(onShake)
  cb.current = onShake
  useEffect(() => {
    let last = 0
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      const g = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
      const now = Date.now()
      if (g > 24 && now - last > 2500) { last = now; cb.current() }
    }
    const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
    const enable = () => window.addEventListener('devicemotion', handler)
    if (DM?.requestPermission) {
      const ask = () => DM.requestPermission!().then((r) => r === 'granted' && enable()).catch(() => {})
      window.addEventListener('click', ask, { once: true })
      return () => { window.removeEventListener('click', ask); window.removeEventListener('devicemotion', handler) }
    }
    enable()
    return () => window.removeEventListener('devicemotion', handler)
  }, [])
}
