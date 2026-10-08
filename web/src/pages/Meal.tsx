import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import type { MealDetail } from '../api/types'
import { Button, Pill, SLOT_LABEL, Spinner, TopBar, cx, foodTint } from '../components/ui'
import { Art, ingredientArt, mealArt } from '../illustrations'
import { mealPhoto } from '../food'
import { getState, setState } from '../store'
import { replaceMeal } from './Plan'

const REASONS = ['ne jede mi se ovo', 'nemam vremena', 'nešto lakše', 'bez mesa danas']

export default function Meal() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [meal, setMeal] = useState<MealDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    let live = true
    setMeal(null)
    setPhotoFailed(false)
    api.meal(id).then((m) => live && setMeal(m)).catch((e) => live && setErr((e as Error).message))
    return () => { live = false }
  }, [id])

  async function swap(reason?: string) {
    setSwapping(true); setErr(null)
    try {
      const m = await api.swap(id, reason)
      const plan = getState().plan
      if (plan) setState({ plan: replaceMeal(plan, id, m) })
      setSwapOpen(false)
      nav(`/obrok/${m.id}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    } finally { setSwapping(false) }
  }

  if (!meal) {
    return (
      <div className="min-h-dvh bg-bg">
        <TopBar nav className="hidden lg:block" />
        <div className="grid min-h-[70dvh] place-items-center">
          {err ? <p className="font-bold text-hot">{err}</p> : <Spinner className="size-8 text-brand" />}
        </div>
      </div>
    )
  }

  const photo = photoFailed ? null : mealPhoto(meal.title)
  const toBuy = meal.ingredients.filter((i) => !i.inPantry).length

  return (
    <div className="min-h-dvh bg-bg pb-32 lg:pb-16">
      <TopBar nav className="hidden lg:block" />

      <div className="mx-auto max-w-xl lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:gap-12 lg:px-8 lg:pt-10">
        {/* lijevo (desktop, ljepljivo): fotka */}
        <div className="lg:sticky lg:top-24">
          {photo ? (
            <div className="relative">
              <img src={photo} alt={meal.title} onError={() => setPhotoFailed(true)}
                className="h-72 w-full animate-pop rounded-b-[2rem] object-cover lg:aspect-[4/3] lg:h-auto lg:rounded-3xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black/25 to-transparent lg:rounded-t-3xl" />
              <button onClick={() => nav(-1)} aria-label="Natrag"
                className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-white text-lg font-bold shadow-card">←</button>
              {/* naljepnica: veže fotku s ilustracijama u ostatku aplikacije */}
              <span className={cx('absolute -bottom-7 left-5 grid size-16 place-items-center rounded-2xl border-4 border-bg shadow-card lg:-bottom-8 lg:left-6 lg:size-20', foodTint(meal.title))}>
                <Art name={mealArt(meal.title)} className="size-11 lg:size-14" />
              </span>
            </div>
          ) : (
            <div className="px-5 pt-5 lg:px-0 lg:pt-0">
              <div className={cx('relative grid h-48 place-items-center rounded-3xl lg:aspect-[4/3] lg:h-auto', foodTint(meal.title))}>
                <Art name={mealArt(meal.title)} className="size-36 animate-pop lg:size-56" />
                <button onClick={() => nav(-1)} aria-label="Natrag"
                  className="absolute top-3 left-3 grid size-10 place-items-center rounded-full bg-white text-lg font-bold shadow-card">←</button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 lg:px-0">
          <p className={cx('text-sm text-muted lg:mt-0', photo ? 'mt-10' : 'mt-5')}>
            {SLOT_LABEL[meal.slot]} · {meal.minutes} min · {meal.servings} porcije
            {meal.source === 'iz_prepa' && <> · <span className="font-bold text-fresh">iz prepa</span></>}
          </p>
          <h1 className="mt-0.5 text-[26px] leading-tight font-black tracking-tight text-balance lg:text-[40px]">{meal.title}</h1>

          <p className="mt-4 rounded-2xl bg-[#FFF3E6] p-4 text-[15px] leading-snug lg:text-base">
            <b className="font-extrabold">Zašto ovo: </b>{meal.why}
          </p>

          {meal.nutrition && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {([['kcal', meal.nutrition.kcal, ''], ['protein', meal.nutrition.protein, 'g'], ['UH', meal.nutrition.carbs, 'g'], ['masti', meal.nutrition.fat, 'g']] as const).map(([l, v, u]) => (
                <div key={l} className="rounded-xl border border-line bg-white py-2 text-center">
                  <b className="block font-extrabold tabular-nums">{v}{u}</b>
                  <span className="text-xs text-muted">{l}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 hidden lg:block">
            <Button variant="soft" className="px-6" onClick={() => setSwapOpen(true)}>Ne jede mi se ovo</Button>
          </div>

          <h2 className="mt-8 mb-2 flex items-baseline justify-between">
            <span className="text-xl font-black tracking-tight">Sastojci</span>
            {toBuy > 0 && <span className="text-sm text-muted">{toBuy} za kupiti</span>}
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
            {meal.ingredients.map((i) => (
              <li key={i.name} className="flex items-center gap-3 py-3">
                <Art name={ingredientArt(i.name)} className="size-8 shrink-0" />
                <span className="flex-1 text-[15px] font-bold">{i.name} <span className="font-normal text-muted">{i.quantity} {i.unit}</span></span>
                {i.expiring ? <Pill tone="hot">ističe, iskoristi</Pill> : i.inPantry ? <Pill tone="fresh">imaš doma</Pill> : <Pill tone="muted">kupiti</Pill>}
              </li>
            ))}
          </ul>

          <h2 className="mt-8 mb-2 text-xl font-black tracking-tight">Koraci</h2>
          <ol className="flex flex-col gap-2">
            {meal.steps.map((s, i) => {
              const on = done.has(i)
              return (
                <li key={i}>
                  <button onClick={() => setDone((d) => { const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                    className={cx('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors', on ? 'border-transparent bg-cream/60' : 'border-line bg-white hover:border-[#E6D3BF]')}>
                    <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold', on ? 'bg-fresh text-white' : 'bg-cream text-ink')}>{on ? '✓' : i + 1}</span>
                    <span className={cx('pt-0.5 text-[15px] leading-snug', on && 'text-muted line-through')}>{s}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          {err && <p className="mt-4 rounded-xl bg-hot-bg p-3 text-sm font-bold text-hot">{err}</p>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-bg from-60% to-transparent pt-6 pb-[max(env(safe-area-inset-bottom),16px)] lg:hidden">
        <div className="mx-auto max-w-xl px-5">
          <Button variant="soft" className="w-full" onClick={() => setSwapOpen(true)}>Ne jede mi se ovo</Button>
        </div>
      </div>

      {swapOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 lg:items-center lg:p-6" onClick={() => !swapping && setSwapOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Zamijeni jelo"
            className="w-full max-w-xl animate-pop rounded-t-3xl bg-bg p-5 pb-8 lg:max-w-md lg:rounded-3xl lg:p-6 lg:shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line lg:hidden" />
            <h3 className="text-xl font-black tracking-tight">Nema problema.</h3>
            <p className="mb-4 text-muted">Zašto? Pomaže nam da pogodimo bolje.</p>
            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button key={r} disabled={swapping} onClick={() => swap(r)}
                  className="rounded-2xl border border-line bg-white p-4 text-left font-bold first-letter:uppercase hover:border-[#E6D3BF]">{r}</button>
              ))}
              <Button className="mt-2" disabled={swapping} onClick={() => swap()}>
                {swapping ? <><Spinner /> Tražim zamjenu…</> : 'Samo mi daj nešto drugo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
