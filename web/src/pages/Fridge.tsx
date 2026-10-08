import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Unit, Urgency } from '../api/types'
import { Button, Pill, Shell, Spinner, Title, cx } from '../components/ui'
import { setState } from '../store'
import { Art, ingredientArt } from '../illustrations'

interface Row {
  key: number
  name: string
  quantity: number
  unit: Unit
  expiresInDays?: number
  confidence: number
}

const urgencyOf = (d?: number): Urgency => (d == null ? 'ok' : d <= 2 ? 'umire' : d <= 7 ? 'skoro' : 'ok')
const daysLabel = (d?: number) => (d == null ? 'bez roka' : d === 0 ? 'danas' : `${d} ${d === 1 ? 'dan' : 'dana'}`)
const URGENCY_TEXT: Record<Urgency, string> = { umire: 'text-hot', skoro: 'text-warn', ok: 'text-muted' }
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const GROUPS: { u: Urgency; title: string; sub: string }[] = [
  { u: 'umire', title: 'Treba potrošiti odmah', sub: 'ide prvo u plan' },
  { u: 'skoro', title: 'Ovaj tjedan', sub: 'ističe kroz par dana' },
  { u: 'ok', title: 'Ima vremena', sub: '' },
]

let k = 0

export default function Fridge() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [phase, setPhase] = useState<'pick' | 'scan' | 'review'>('pick')
  const [rows, setRows] = useState<Row[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // sken "živi": odgovor stigne odjednom, a mi ga otkrivamo namirnicu po namirnicu prije reviewa
  const [found, setFound] = useState<Row[]>([])
  const [revealed, setRevealed] = useState(0)

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(null)
    setPhoto(URL.createObjectURL(f))
    setPhase('scan')
    setFound([]); setRevealed(0)
    try {
      const res = await api.scan(f)
      const fresh: Row[] = res.items.map((i) => ({ ...i, key: ++k }))
      setFollowUps(res.followUpQuestions)
      setFound(fresh)
      for (let i = 1; i <= fresh.length; i++) {
        await wait(i === 1 ? 350 : 230)
        setRevealed(i)
      }
      if (fresh.length) await wait(750)
      setRows((prev) => [...prev, ...fresh])
      setFound([]); setRevealed(0)
      setPhase('review')
    } catch (e) {
      setErr((e as Error).message)
      setPhase(rows.length ? 'review' : 'pick')
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const remove = (key: number) => setRows((r) => r.filter((x) => x.key !== key))
  const addManual = () => { setRows((r) => [...r, { key: ++k, name: '', quantity: 1, unit: 'kom', confidence: 1 }]); setPhase('review') }

  async function save(items: Row[]) {
    setBusy(true); setErr(null)
    try {
      const pantry = items.filter((r) => r.name.trim()).map(({ name, quantity, unit, expiresInDays }) => ({ name: name.trim(), quantity, unit, expiresInDays }))
      await api.putPantry(pantry)
      setState({ plan: null, pantry })
      nav('/plan')
    } catch (e) {
      setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  const dying = rows.filter((r) => urgencyOf(r.expiresInDays) === 'umire').length

  return (
    <Shell tabs>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />

      {phase === 'pick' && (
        <div className="mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
          <div>
            <Title sub="Slikaj frižider, a mi prepoznamo što imaš i što treba uskoro potrošiti.">Moj frižider</Title>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#F3CFA8] bg-[#FFF3E6] px-6 py-10 text-center transition-colors hover:bg-[#FFEEDC] lg:py-20"
            >
              <span className="mb-1 grid size-16 place-items-center rounded-xl bg-white lg:size-20"><Art name="kamera" className="size-12 lg:size-14" /></span>
              <b className="text-[17px] font-extrabold lg:text-xl">Slikaj ili učitaj sliku frižidera</b>
              <span className="text-sm text-muted lg:text-base">Dovoljna je jedna slika otvorenog frižidera.</span>
            </button>
            <p className="mt-3 text-center text-xs text-muted lg:text-left">Fotka se ne čuva, spremamo samo listu namirnica.</p>
          </div>
          <div className="mt-6 flex flex-col gap-2 lg:mt-[5.5rem] lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:p-5">
            <p className="mb-2 hidden font-extrabold lg:block">Nemaš sliku pri ruci?</p>
            <Button variant="soft" onClick={addManual}>Upiši ručno</Button>
            <Button variant="ghost" onClick={() => save([])} disabled={busy}>{busy ? <Spinner /> : 'Preskoči, kreni od nule'}</Button>
          </div>
        </div>
      )}

      {phase === 'scan' && (
        <div className="mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
          <div>
            {found.length
              ? <Title sub="Čitam rokove i slažem po hitnosti.">Našao sam {found.length} {found.length === 1 ? 'namirnicu' : found.length < 5 ? 'namirnice' : 'namirnica'}</Title>
              : <Title sub="Čitam namirnice i rokove.">Prepoznajem…</Title>}
            <div className="relative overflow-hidden rounded-2xl bg-ink">
              {photo && <img src={photo} alt="" className="block max-h-80 w-full object-cover opacity-80 lg:max-h-[28rem]" />}
              {!found.length && <div className="absolute inset-x-0 h-0.5 animate-scan bg-white shadow-[0_0_16px_4px_rgb(255_255_255/0.7)]" />}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-ink/75 px-3 py-1.5 text-sm font-bold text-white tabular-nums">
                {found.length ? <>{revealed} / {found.length}</> : <><Spinner className="size-4 border-2" /> čitam rokove…</>}
              </div>
            </div>
            {/* mobitel: nađene namirnice iskaču ispod fotke */}
            <ul className="mt-3 flex flex-col gap-2 lg:hidden">
              {found.slice(0, revealed).map((r) => <FoundRow key={r.key} r={r} />)}
            </ul>
          </div>
          {/* desktop: desni stupac, nađene iskaču u prazna mjesta */}
          <ul className="hidden flex-col gap-2 pt-[5.5rem] lg:flex">
            {found.slice(0, revealed).map((r) => <FoundRow key={r.key} r={r} />)}
            {Array.from({ length: Math.max(0, (found.length || 5) - revealed) }).map((_, i) => (
              <li key={`s${i}`} aria-hidden className="h-14 animate-pulse rounded-2xl border border-line bg-white" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </ul>
        </div>
      )}

      {phase === 'review' && (
        <div className="mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start lg:gap-10">
          {/* lijevo (desktop, ljepljivo): naslov, fotka, akcije */}
          <aside className="lg:sticky lg:top-24">
            <Title sub="Ispravi što je krivo. Ništa se ne sprema dok ne potvrdiš.">
              {dying > 0 ? <>Spašavamo <span className="text-hot">{dying}</span> {dying === 1 ? 'namirnicu' : 'namirnice'}</> : 'Što imaš doma'}
            </Title>
            {photo && <img src={photo} alt="Tvoj frižider" className="mb-4 hidden aspect-[4/3] w-full rounded-2xl object-cover lg:block" />}
            <div className="hidden lg:block">
              <Actions onPhoto={() => fileRef.current?.click()} onAdd={addManual} onSave={() => save(rows)} busy={busy} />
            </div>
          </aside>

          <div>
            {GROUPS.map(({ u, title, sub }) => {
              const list = rows.filter((r) => urgencyOf(r.expiresInDays) === u)
              if (!list.length) return null
              return (
                <section key={u} className="mb-6">
                  <h2 className="mb-2 flex items-baseline gap-2">
                    <span className={cx('font-extrabold', u === 'umire' && 'text-hot')}>{title} ({list.length})</span>
                    {sub && <span className="text-sm text-muted">{sub}</span>}
                  </h2>
                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                    {list.map((r) => <ItemRow key={r.key} r={r} onChange={(p) => update(r.key, p)} onRemove={() => remove(r.key)} />)}
                  </div>
                </section>
              )
            })}

            {followUps.map((q) => (
              <div key={q} className="mb-2 flex items-center gap-3 rounded-2xl bg-[#FFF3E6] p-4">
                <p className="flex-1 text-[15px] font-bold">{q}</p>
                <button className="shrink-0 text-sm font-extrabold text-brand" onClick={addManual}>Dodaj</button>
              </div>
            ))}

            <div className="mt-4 lg:hidden">
              <Actions onPhoto={() => fileRef.current?.click()} onAdd={addManual} onSave={() => save(rows)} busy={busy} />
            </div>
          </div>
        </div>
      )}

      {err && <p className="mx-auto mt-4 max-w-xl rounded-xl bg-hot-bg p-3 text-sm font-bold text-hot lg:max-w-none">{err}</p>}
    </Shell>
  )
}

// Ista tri gumba: ispod liste na mobitelu, u ljepljivom stupcu na desktopu.
function Actions({ onPhoto, onAdd, onSave, busy }: { onPhoto: () => void; onAdd: () => void; onSave: () => void; busy: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" className="text-[15px]" onClick={onPhoto}>Još jedna slika</Button>
        <Button variant="soft" className="text-[15px]" onClick={onAdd}>Dodaj ručno</Button>
      </div>
      <Button className="mt-3 w-full" onClick={onSave} disabled={busy}>
        {busy ? <Spinner /> : 'Složi mi tjedan'}
      </Button>
    </>
  )
}

// Jedna nađena namirnica dok sken "živi": ilustracija, ime, rok. Bez uređivanja, to dolazi u reviewu.
function FoundRow({ r }: { r: Row }) {
  const u = urgencyOf(r.expiresInDays)
  return (
    <li className={cx('flex h-14 animate-pop items-center gap-3 rounded-2xl border px-3',
      u === 'umire' ? 'border-[#F7C9B4] bg-hot-bg' : 'border-line bg-white')}>
      <Art name={ingredientArt(r.name)} className="size-8 shrink-0" />
      <b className="min-w-0 flex-1 truncate font-extrabold first-letter:uppercase">{r.name}</b>
      {r.confidence < 0.6 && <Pill tone="warn">nisam siguran</Pill>}
      <span className={cx('shrink-0 text-sm font-extrabold tabular-nums', URGENCY_TEXT[u])}>{daysLabel(r.expiresInDays)}</span>
    </li>
  )
}

const DAY_BTN = 'grid size-8 place-items-center rounded-full bg-cream font-bold transition-colors hover:bg-[#FFE9CF]'

function ItemRow({ r, onChange, onRemove }: { r: Row; onChange: (p: Partial<Row>) => void; onRemove: () => void }) {
  const u = urgencyOf(r.expiresInDays)
  const unsure = r.confidence < 0.6
  return (
    <div className={cx(
      'rounded-2xl border p-3',
      u === 'umire' ? 'border-[#F7C9B4] bg-hot-bg' : 'bg-white',
      unsure ? 'border-dashed border-[#E2B66B]' : u !== 'umire' && 'border-line',
    )}>
      <div className="flex items-center gap-2">
        <Art name={ingredientArt(r.name)} className="size-8 shrink-0" />
        <input value={r.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="namirnica" aria-label="Namirnica"
          className="min-w-0 flex-1 bg-transparent text-[16px] font-extrabold outline-none placeholder:font-semibold placeholder:text-muted/60" />
        {unsure && <Pill tone="warn">Nisam siguran</Pill>}
        <button onClick={onRemove} aria-label="Ukloni" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-black/5">✕</button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center rounded-full border border-line bg-white pl-1">
          <input type="number" inputMode="decimal" min={0} value={r.quantity} onChange={(e) => onChange({ quantity: +e.target.value })} aria-label="Količina"
            className="w-14 bg-transparent py-1 text-center font-bold tabular-nums outline-none" />
          <select value={r.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })} aria-label="Jedinica" className="bg-transparent pr-2 text-sm font-bold text-muted outline-none">
            <option value="g">g</option><option value="ml">ml</option><option value="kom">kom</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className={DAY_BTN} onClick={() => onChange({ expiresInDays: Math.max(0, (r.expiresInDays ?? 7) - 1) })} aria-label="Dan manje">−</button>
          <span className={cx('min-w-[4.25rem] text-center text-sm font-extrabold tabular-nums', URGENCY_TEXT[u])}>
            {daysLabel(r.expiresInDays)}
          </span>
          <button className={DAY_BTN} onClick={() => onChange({ expiresInDays: (r.expiresInDays ?? 6) + 1 })} aria-label="Dan više">+</button>
        </div>
      </div>
    </div>
  )
}
