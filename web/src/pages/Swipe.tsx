import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { TasteCard } from '../api/types'
import { Button, Pill, Shell, Title, buzz, cx } from '../components/ui'
import { MealImage } from '../components/MealImage'
import { Art, ingredientArt } from '../illustrations'
import { getState, setState } from '../store'

// "Što ti se jede?": kartice s jelima, kvačica ili X, flip na tap = recept. Samo gumbi, bez drag geste.
type Dir = 'left' | 'right'
const LEAVE_MS = 350

const porcije = (n: number) => (n === 1 ? '1 porcija' : n < 5 ? `${n} porcije` : `${n} porcija`)

export default function Swipe() {
  const nav = useNavigate()
  const [cards, setCards] = useState<TasteCard[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [leaving, setLeaving] = useState<Dir | null>(null)
  const [finishing, setFinishing] = useState(false)
  const timer = useRef(0)

  const load = useCallback(async () => {
    setErr(null); setCards(null); setIdx(0); setFlipped(false)
    try {
      const { cards } = await api.candidates()
      if (!cards.length) throw new Error('Nisam uspio složiti jela za biranje.')
      setState({ taste: { liked: [], disliked: [] } })
      setCards(cards)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    load()
    return () => clearTimeout(timer.current)
  }, [load])

  // Ukus šaljemo backendu, brišemo stari plan da se složi iznova s novim ukusom, pa na tjedan.
  const finish = useCallback(async () => {
    if (finishing) return
    setFinishing(true)
    const { liked, disliked } = getState().taste
    try {
      if (liked.length || disliked.length) await api.taste(liked, disliked)
    } catch (e) {
      console.warn('[KuhAI] ukus nije spremljen:', e)
    }
    setState({ plan: null })
    nav('/plan')
  }, [finishing, nav])

  function answer(dir: Dir) {
    if (!cards || leaving || finishing) return
    const card = cards[idx]
    if (!card) return
    buzz(40)
    const t = getState().taste
    setState({ taste: dir === 'right' ? { ...t, liked: [...t.liked, card.title] } : { ...t, disliked: [...t.disliked, card.title] } })
    setLeaving(dir)
    timer.current = window.setTimeout(() => {
      setLeaving(null)
      setFlipped(false)
      if (idx + 1 >= cards.length) finish()
      else setIdx(idx + 1)
    }, LEAVE_MS)
  }

  if (err && !cards) {
    return (
      <Shell tabs>
        <div className="mx-auto max-w-xl">
          <Title sub="Kvačica za ono što bi jeo, X za ono što ne bi.">Što ti se jede ovaj tjedan?</Title>
          <div className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="mb-4 font-bold text-hot">{err}</p>
            <Button variant="ink" className="w-full" onClick={() => nav('/plan')}>Preskoči, složi tjedan</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={load}>Probaj opet</Button>
          </div>
        </div>
      </Shell>
    )
  }

  if (!cards || finishing) {
    return (
      <Shell tabs>
        <div className="mx-auto max-w-xl">
          <Title sub="Kvačica za ono što bi jeo, X za ono što ne bi. Tapni karticu za recept.">Što ti se jede ovaj tjedan?</Title>
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-line bg-white px-6 py-9 text-center">
            <img src="/logo.png" alt="" className="mb-5 size-16 animate-wobble rounded-2xl [animation-iteration-count:infinite]" />
            <p className="text-lg leading-snug font-extrabold text-balance">
              {finishing ? 'Pamtim što voliš…' : 'Biram ti jela po frižideru i akcijama, traje do minute…'}
            </p>
            <p className="mt-2 text-sm text-muted">{finishing ? 'Idemo složiti tjedan.' : 'Pravi recepti, ne generički. Zato malo traje.'}</p>
          </div>
        </div>
      </Shell>
    )
  }

  const total = cards.length
  // Dva gumba jasno odvojena, svaki sa svojom oznakom ispod (Leon 15:50: "šašavo spojeni").
  const noBtn = (cls?: string) => (
    <div className={cx('flex flex-col items-center gap-1.5', cls)}>
      <button onClick={() => answer('left')} aria-label="Ne bih ovo"
        className="grid size-[4.5rem] shrink-0 place-items-center rounded-full border-2 border-line bg-white shadow-card transition-[transform,border-color] hover:border-[#E6D3BF] active:translate-y-px">
        <Art name="iks" className="size-10" />
      </button>
      <span className="text-sm font-extrabold text-muted">Ne bih</span>
    </div>
  )
  const yesBtn = (cls?: string) => (
    <div className={cx('flex flex-col items-center gap-1.5', cls)}>
      <button onClick={() => answer('right')} aria-label="Bih ovo"
        className="grid size-[4.5rem] shrink-0 place-items-center rounded-full bg-brand shadow-cta transition-[transform,background-color] hover:bg-brand-dark active:translate-y-px">
        <Art name="kvacica" className="size-10" />
      </button>
      <span className="text-sm font-extrabold text-brand">Bih</span>
    </div>
  )

  return (
    <Shell tabs>
      <div className="mx-auto max-w-xl lg:max-w-4xl">
        <Title sub="Kvačica za ono što bi jeo, X za ono što ne bi. Tapni karticu za recept.">Što ti se jede ovaj tjedan?</Title>

        <p className="mb-3 text-center text-sm font-bold text-muted tabular-nums" aria-live="polite">{Math.min(idx + 1, total)} / {total}</p>

        <div className="lg:flex lg:items-center lg:justify-center lg:gap-14">
          {noBtn('hidden lg:flex')}

          {/* stog: gornja + dvije ispod; renderiramo od najdonje da gornja bude zadnja u DOM-u */}
          <div className="relative mx-auto h-[23rem] w-full max-w-sm lg:h-[32rem] lg:w-[26rem] lg:max-w-none">
            {[2, 1, 0].map((k) => {
              const card = cards[idx + k]
              if (!card) return null
              return (
                <Card key={card.id} card={card} depth={k}
                  flipped={k === 0 && flipped}
                  leaving={k === 0 ? leaving : null}
                  onFlip={() => k === 0 && !leaving && setFlipped((f) => !f)} />
              )
            })}
          </div>

          {yesBtn('hidden lg:flex')}
        </div>

        {/* mobitel: gumbi ispod stoga, razmaknuti; stog ima 2 kartice ispod gornje pa treba zraka */}
        <div className="mt-7 flex items-start justify-center gap-20 lg:hidden">
          {noBtn()}
          {yesBtn()}
        </div>

        <div className="mx-auto mt-5 flex max-w-sm flex-col gap-1 lg:mt-8 lg:gap-2">
          <Button variant="ink" className="w-full" onClick={finish}>Dosta mi je, složi tjedan</Button>
          <Button variant="ghost" className="w-full" onClick={() => nav('/plan')}>Preskoči</Button>
        </div>
      </div>
    </Shell>
  )
}

// pomak mora biti veći od pola smanjenja visine, inače donje kartice ne vire ispod gornje
const DEPTH = ['translate-y-0 scale-100', 'translate-y-5 scale-95', 'translate-y-10 scale-90']

function Card({ card, depth, flipped, leaving, onFlip }: { card: TasteCard; depth: number; flipped: boolean; leaving: Dir | null; onFlip: () => void }) {
  const face = 'absolute inset-0 overflow-hidden rounded-3xl border border-line bg-white shadow-card backface-hidden [-webkit-backface-visibility:hidden]'
  return (
    <div
      className={cx('absolute inset-0 perspective-[1400px] transition-transform duration-300 ease-out',
        DEPTH[depth],
        leaving === 'left' && 'animate-swipe-left',
        leaving === 'right' && 'animate-swipe-right')}
      style={{ zIndex: 3 - depth }}
      aria-hidden={depth !== 0}
    >
      <div className={cx('relative size-full transition-transform duration-500 transform-3d', flipped && 'rotate-y-180')}>
        {/* prednja strana */}
        <button type="button" onClick={onFlip} tabIndex={depth === 0 ? 0 : -1}
          className={cx(face, 'flex flex-col text-left')} aria-label={`${card.title}, tapni za recept`}>
          <MealImage title={card.title} hint={card.imageHint} className="h-[52%] w-full shrink-0 lg:h-[55%]" artClassName="size-1/2" />
          <span className="flex min-h-0 flex-1 flex-col px-5 pt-3 pb-3 lg:pt-4 lg:pb-4">
            <span className="block text-[22px] leading-tight font-black tracking-tight text-balance">{card.title}</span>
            <span className="mt-1 block text-sm text-muted">{card.minutes} min · {porcije(card.servings)}</span>
            {card.usesExpiring.length > 0 && (
              <span className="mt-2 block"><Pill tone="hot">spašava {card.usesExpiring.join(', ')}</Pill></span>
            )}
            <span className="mt-2 line-clamp-2 block text-[15px] leading-snug">{card.why}</span>
            <span className="mt-auto block pt-2 text-xs font-bold text-muted">Tapni za recept</span>
          </span>
        </button>

        {/* poleđina: recept */}
        <div className={cx(face, 'rotate-y-180')} onClick={onFlip} role="button" tabIndex={-1} aria-label="Natrag na jelo">
          <div className="h-full overflow-y-auto px-5 pt-5 pb-6 [scrollbar-width:thin]">
            <h3 className="text-xl leading-tight font-black tracking-tight text-balance">{card.title}</h3>
            <p className="mt-0.5 text-sm text-muted">{card.minutes} min · {porcije(card.servings)}</p>

            <h4 className="mt-4 mb-1.5 font-extrabold">Sastojci</h4>
            <ul className="divide-y divide-line rounded-2xl border border-line px-3">
              {card.ingredients.map((i) => (
                <li key={i.name} className="flex items-center gap-2.5 py-2">
                  <Art name={ingredientArt(i.name)} className="size-7 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{i.name} <span className="font-normal text-muted">{i.quantity} {i.unit}</span></span>
                  {i.expiring ? <Pill tone="hot">ističe</Pill> : i.inPantry ? <Pill tone="fresh">imaš doma</Pill> : <Pill tone="muted">kupiti</Pill>}
                </li>
              ))}
            </ul>

            <h4 className="mt-4 mb-1.5 font-extrabold">Koraci</h4>
            <ol className="flex flex-col gap-1.5">
              {card.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-cream/60 p-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold">{i + 1}</span>
                  <span className="pt-0.5 text-sm leading-snug">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-center text-xs font-bold text-muted">Tapni za natrag</p>
          </div>
        </div>
      </div>
    </div>
  )
}
