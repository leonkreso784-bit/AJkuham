import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Cart as CartT } from '../api/types'
import { Button, Chip, CountUp, Pill, Shell, Spinner, Title, Toast, buzz, cx, eur, useToast } from '../components/ui'
import { useStore } from '../store'
import { Art, categoryArt, ingredientArt } from '../illustrations'

// Naručivanje ostaje u aplikaciji (Leon, 15:15): dostava ili preuzimanje s potvrdom,
// kopiranje i dijeljenje popisa. Konzum link je samo sporedna opcija, ne izlaz iz appa.
type OrderMode = 'dostava' | 'preuzimanje'
// Termin: dan (danas/sutra/prekosutra ili bilo koji datum) + vrijeme (prozor ili točan sat). Jan (mail 16:51):
// "3 opcije nisu dosta, želim jasno odabrati kad će mi namirnice biti dostavljene". Sve je neobavezno.
const DAYS = ['danas', 'sutra', 'prekosutra']
const WINDOWS = ['8–10 h', '10–12 h', '12–14 h', '14–16 h', '16–18 h', '18–20 h']
const isoToday = (plus = 0) => { const d = new Date(); d.setDate(d.getDate() + plus); return d.toISOString().slice(0, 10) }
const dateLabel = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return `${['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'][d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.` }
function slotLabel(day: number | null, date: string, win: number | null, time: string): string {
  const d = date ? dateLabel(date) : day !== null ? DAYS[day] : ''
  const t = time ? `u ${time}` : win !== null ? WINDOWS[win] : ''
  if (!d && !t) return NO_SLOT
  if (!d) return `${t}, dan po dogovoru`
  if (!t) return `${d}, vrijeme po dogovoru`
  return `${d} ${t}`
}
const CELEBRATE_MS = 2600
const NO_SLOT = 'termin po dogovoru'
const orderNo = (planId: string) => `KUH-${planId.replace(/^pl_/, '').slice(0, 6).toUpperCase()}`

export default function Cart() {
  const nav = useNavigate()
  const planId = useStore((s) => s.plan?.planId)
  const [cart, setCart] = useState<CartT | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  // Leon (16:35): ništa unaprijed odabrano, termin neobavezan. Potvrda bez biranja = dostava, termin po dogovoru.
  const [mode, setMode] = useState<OrderMode | null>(null)
  const [day, setDay] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [win, setWin] = useState<number | null>(null)
  const [time, setTime] = useState('')
  const [order, setOrder] = useState<{ no: string; mode: OrderMode; slot: string } | null>(null)
  // Leon (16:15): nakon potvrde "neka animacija kao da se naručilo" — kratki ekran s kvačicom, pa nestane sam.
  const [celebrate, setCelebrate] = useState(false)
  const celebrateTimer = useRef(0)
  useEffect(() => () => clearTimeout(celebrateTimer.current), [])
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (!planId) return
    let live = true
    setCart(null)
    api.cart(planId).then((c) => live && setCart(c)).catch((e) => live && setErr((e as Error).message))
    return () => { live = false }
  }, [planId])

  if (!planId) {
    return (
      <Shell tabs>
        <div className="mx-auto max-w-xl">
          <Title sub="Samo ono što ti fali za tjedan.">Košarica</Title>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-8 text-center">
            <span className="grid size-16 place-items-center rounded-xl bg-[#FFF0C9]"><Art name="kosarica" className="size-12" /></span>
            <p className="font-extrabold">Košarica nastaje iz plana.</p>
            <Button className="mt-2 w-full" onClick={() => nav('/frizider')}>Kreni od frižidera</Button>
          </div>
        </div>
      </Shell>
    )
  }

  if (!cart) {
    return <Shell tabs><div className="grid min-h-[50dvh] place-items-center">{err ? <p className="font-bold text-hot">{err}</p> : <Spinner className="size-8 text-brand" />}</div></Shell>
  }

  const over = cart.budgetEur != null ? cart.totalEur - cart.budgetEur : 0

  // Popis za kopiranje / dijeljenje: proizvodi s količinom i cijenom, ono što nema u katalogu, ukupno.
  const listText = () => [
    'KuhAI — popis za tjedan',
    ...cart.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ''}${l.productName} — ${eur(l.lineTotalEur)}`),
    ...(cart.unmatched.length ? ['Dokupi sam:', ...cart.unmatched.map((u) => `${u.name} (${u.quantity} ${u.unit})`)] : []),
    `Ukupno: ${eur(cart.totalEur)}`,
  ].join('\n')
  const copyList = async () => {
    try { await navigator.clipboard.writeText(listText()); buzz(40); showToast('Popis je kopiran.') }
    catch { showToast('Ne mogu kopirati na ovom uređaju.', 'hot') }
  }
  const shareList = async () => {
    if (!navigator.share) return copyList()
    try { await navigator.share({ title: 'KuhAI popis', text: listText() }) } catch { /* korisnik odustao */ }
  }
  const confirmOrder = () => {
    const m: OrderMode = mode ?? 'dostava'
    const o = { no: orderNo(planId), mode: m, slot: slotLabel(day, date, win, time) }
    setOrder(o); buzz([40, 60, 40])
    setCelebrate(true)
    clearTimeout(celebrateTimer.current)
    celebrateTimer.current = window.setTimeout(() => setCelebrate(false), CELEBRATE_MS)
    // bez toasta: animacija i zeleni blok ispod već kažu isto
  }

  const total = (
    <>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4 lg:mt-3 lg:border-t-0 lg:pt-1">
        <span className="text-lg font-black">Ukupno</span>
        <span className="text-2xl font-black tracking-tight tabular-nums">{eur(cart.totalEur)}</span>
      </div>
      {order ? (
        <div className="mt-5 animate-pop rounded-2xl bg-fresh-bg p-4 text-fresh lg:mt-4">
          <p className="font-extrabold">Narudžba {order.no} primljena</p>
          <p className="mt-0.5 text-sm">{order.mode === 'dostava' ? 'Dostava' : 'Preuzimanje'} · {order.slot} · {cart.lines.length} proizvoda · {eur(cart.totalEur)}</p>
          <button className="mt-2 text-sm font-bold underline" onClick={() => setOrderOpen(true)}>Promijeni</button>
        </div>
      ) : (
        <Button className="mt-5 w-full lg:mt-4" onClick={() => setOrderOpen(true)}>Naruči namirnice</Button>
      )}
    </>
  )

  return (
    <Shell tabs>
      <div className="mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
        <div className="lg:col-start-1 lg:row-start-1">
          <Title sub={`${cart.lines.length} proizvoda iz Konzuma · ${cart.onSaleLinesCount} na akciji`}>Košarica</Title>
        </div>

        {/* desno (desktop, ljepljivo): usporedba, budžet, ukupno, CTA */}
        <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {/* Završni udarac: usporedba s dostavom */}
          <section className="mb-3 rounded-2xl border border-line bg-white shadow-card">
            <div className="p-5">
              <p className="text-sm font-bold text-muted">Jeftinije od dostave</p>
              <div className="mt-1 text-4xl leading-none font-black tracking-tight text-fresh tabular-nums"><CountUp value={cart.deliveryComparison.savedEur} ms={1400} /></div>
              <p className="mt-3 text-[15px]">
                Dostava <b className="tabular-nums">{eur(cart.deliveryComparison.deliveryEur)}</b>
                <span className="mx-1.5 text-muted">vs.</span>
                ti kuhaš <b className="tabular-nums">{eur(cart.totalEur)}</b>
              </p>
              <p className="mt-1 text-xs leading-snug text-muted">Pretpostavka: {cart.deliveryComparison.assumption}</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
              <Stat v={eur(cart.perMealEur)} l="po obroku" />
              <Stat v={eur(cart.savedFromPantryEur)} l="već imaš doma" tone="fresh" />
              <Stat v={eur(cart.savedFromWasteEur)} l="spašeno od bacanja" tone="hot" />
            </div>
          </section>

          {cart.budgetEur != null && (
            <p className={cx('mb-6 rounded-xl px-4 py-3 text-sm leading-snug font-bold lg:mb-0', cart.withinBudget ? 'bg-fresh-bg text-fresh' : 'bg-hot-bg text-hot')}>
              {cart.withinBudget
                ? <>Stane u budžet od {eur(cart.budgetEur)}. Ostaje ti {eur(cart.budgetEur - cart.totalEur)}.</>
                : <>Prelazi budžet od {eur(cart.budgetEur)} za {eur(over)}. Spusti budžet na planu ili zamijeni koji obrok.</>}
            </p>
          )}

          <div className="hidden lg:block">{total}</div>
        </aside>

        <div className="lg:col-start-1 lg:row-start-2">
          <ul className="divide-y divide-line lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:px-5">
            {cart.lines.map((l) => {
              const fromName = ingredientArt(l.matchedIngredients[0] ?? l.productName)
              const art = fromName === 'vrecica' ? categoryArt(l.category) : fromName
              return (
                <li key={l.productId} className="flex items-center gap-3 py-3 lg:gap-4 lg:py-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream lg:size-12"><Art name={art} className="size-8 lg:size-9" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <b className="truncate leading-tight font-extrabold">{l.quantity > 1 && `${l.quantity}× `}{l.productName}</b>
                      {l.onSale && <Pill tone="brand">akcija</Pill>}
                    </div>
                    <span className="text-sm text-muted">
                      treba {l.neededAmount} {l.packageUnit}
                      {l.leftoverAmount > 0 && <> · ostaje {l.leftoverAmount} {l.packageUnit}</>}
                    </span>
                  </div>
                  <b className="font-extrabold whitespace-nowrap tabular-nums">{eur(l.lineTotalEur)}</b>
                </li>
              )
            })}
          </ul>

          {cart.unmatched.length > 0 && (
            <div className="mt-3 rounded-2xl bg-warn-bg/60 p-4">
              <p className="font-extrabold">Dokupi sam</p>
              <p className="mb-2 text-sm text-muted">Ovo nema u katalogu.</p>
              <ul className="text-[15px]">
                {cart.unmatched.map((u) => <li key={u.name}>{u.name} <span className="text-muted">· {u.quantity} {u.unit}</span></li>)}
              </ul>
            </div>
          )}

          <div className="lg:hidden">{total}</div>
        </div>
      </div>

      <Toast msg={toast} />

      {celebrate && order && (
        <div className="fixed inset-0 z-40 grid animate-pop place-items-center bg-ink/55 p-6" role="status" aria-live="polite"
          onClick={() => { clearTimeout(celebrateTimer.current); setCelebrate(false) }}>
          <div className="w-full max-w-xs rounded-3xl bg-white px-6 pt-8 pb-6 text-center shadow-card">
            <div className="relative mx-auto size-24">
              <span className="absolute inset-0 rounded-full bg-fresh/30 animate-order-ring" />
              <span className="absolute inset-0 rounded-full bg-fresh/30 animate-order-ring [animation-delay:0.35s]" />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-fresh animate-order-pop">
                <Art name="kvacica" className="size-12" />
              </span>
            </div>
            <p className="mt-5 text-2xl leading-tight font-black tracking-tight animate-pop [animation-delay:0.3s] [animation-fill-mode:both]">Narudžba poslana</p>
            <p className="mt-1.5 text-muted text-balance animate-pop [animation-delay:0.45s] [animation-fill-mode:both]">
              {order.no} · {order.mode === 'dostava' ? 'dostava' : 'preuzimanje'} · {order.slot}
            </p>
            <div className="mx-auto mt-5 flex items-center justify-center gap-3 animate-pop [animation-delay:0.6s] [animation-fill-mode:both]">
              <Art name="kosarica" className="size-9 animate-wobble [animation-delay:0.6s]" />
              <span className="text-sm font-bold text-muted">{cart.lines.length} proizvoda · {eur(cart.totalEur)}</span>
            </div>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-fresh animate-order-bar" />
            </div>
          </div>
        </div>
      )}

      {orderOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 lg:items-center lg:p-6" onClick={() => setOrderOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Naruči namirnice"
            className="w-full max-w-xl animate-pop rounded-t-3xl bg-bg p-5 pb-[max(env(safe-area-inset-bottom),20px)] lg:max-w-md lg:rounded-3xl lg:p-6 lg:shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line lg:hidden" />
            <h3 className="text-xl font-black tracking-tight">Kako ćeš do namirnica?</h3>
            <p className="mb-4 text-muted">{cart.lines.length} proizvoda · {eur(cart.totalEur)}</p>

            <div className="grid grid-cols-2 gap-2">
              {(['dostava', 'preuzimanje'] as OrderMode[]).map((m) => (
                <button key={m} onClick={() => setMode(mode === m ? null : m)} aria-pressed={mode === m}
                  className={cx('rounded-2xl border bg-white p-4 text-left transition-colors', mode === m ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-[#E6D3BF]')}>
                  <span className="flex items-center gap-2"><Art name={m === 'dostava' ? 'kosarica' : 'vrecica'} className="size-7" /><b className="font-extrabold">{m === 'dostava' ? 'Dostava doma' : 'Preuzmi u trgovini'}</b></span>
                  <span className="mt-1 block text-sm text-muted">{m === 'dostava' ? 'Konzum dostava, sve iz košarice' : 'Spremno i spakirano'}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 mb-2 text-sm font-bold text-muted">Koji dan? <span className="font-normal">Nije obavezno.</span></p>
            <div className="flex flex-wrap items-center gap-2">
              {DAYS.map((d, i) => <Chip key={d} on={!date && day === i} onClick={() => { setDate(''); setDay(day === i ? null : i) }}>{d}</Chip>)}
              <label className={cx('flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold transition-colors', date ? 'border-ink bg-ink text-white' : 'border-line bg-white')}>
                <span>{date ? dateLabel(date) : 'drugi datum'}</span>
                <input type="date" aria-label="Drugi datum" min={isoToday()} max={isoToday(30)} value={date}
                  onChange={(e) => { setDate(e.target.value); if (e.target.value) setDay(null) }}
                  className={cx('w-5 bg-transparent text-[16px] outline-none', date ? 'text-white' : 'text-ink')} />
              </label>
            </div>
            <p className="mt-3 mb-2 text-sm font-bold text-muted">U koje vrijeme?</p>
            <div className="flex flex-wrap items-center gap-2">
              {WINDOWS.map((w, i) => <Chip key={w} on={!time && win === i} onClick={() => { setTime(''); setWin(win === i ? null : i) }}>{w}</Chip>)}
              <label className={cx('flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold transition-colors', time ? 'border-ink bg-ink text-white' : 'border-line bg-white')}>
                <span>{time ? `u ${time}` : 'točan sat'}</span>
                <input type="time" aria-label="Točan sat" step={900} value={time}
                  onChange={(e) => { setTime(e.target.value); if (e.target.value) setWin(null) }}
                  className={cx('w-5 bg-transparent text-[16px] outline-none', time ? 'text-white' : 'text-ink')} />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">{mode === 'preuzimanje' ? 'Preuzimanje' : 'Dostava'}: {slotLabel(day, date, win, time)}</p>

            <Button className="mt-5 w-full" onClick={() => { confirmOrder(); setOrderOpen(false) }}>
              {mode === null ? 'Naruči' : mode === 'dostava' ? 'Potvrdi dostavu' : 'Potvrdi preuzimanje'}
            </Button>
            {mode === null && <p className="mt-2 text-center text-xs text-muted">Bez odabira ide dostava, termin dogovorimo.</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="soft" className="min-h-12 text-[15px]" onClick={copyList}>Kopiraj popis</Button>
              <Button variant="soft" className="min-h-12 text-[15px]" onClick={shareList}>Podijeli popis</Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              Demo narudžba, ne šalje se trgovini. <a href={cart.deepLink} target="_blank" rel="noreferrer" className="font-bold underline">Otvori u Konzumu</a>
            </p>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Stat({ v, l, tone }: { v: string; l: string; tone?: 'fresh' | 'hot' }) {
  return (
    <div className="px-2 py-3 text-center">
      <b className={cx('block font-extrabold tabular-nums', tone === 'fresh' && 'text-fresh', tone === 'hot' && 'text-hot')}>{v}</b>
      <span className="mt-0.5 block text-xs leading-tight text-muted">{l}</span>
    </div>
  )
}
