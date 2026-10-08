import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Cart as CartT } from '../api/types'
import { Button, CountUp, Pill, Shell, Spinner, Title, cx, eur } from '../components/ui'
import { useStore } from '../store'
import { Art, categoryArt, ingredientArt } from '../illustrations'


export default function Cart() {
  const nav = useNavigate()
  const planId = useStore((s) => s.plan?.planId)
  const [cart, setCart] = useState<CartT | null>(null)
  const [err, setErr] = useState<string | null>(null)

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

  const total = (
    <>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4 lg:mt-3 lg:border-t-0 lg:pt-1">
        <span className="text-lg font-black">Ukupno</span>
        <span className="text-2xl font-black tracking-tight tabular-nums">{eur(cart.totalEur)}</span>
      </div>
      <a href={cart.deepLink} target="_blank" rel="noreferrer"
        className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand px-5 text-base font-extrabold text-white shadow-cta transition-[transform,background-color] hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-px lg:mt-4">
        Naruči preko Konzuma
      </a>
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
