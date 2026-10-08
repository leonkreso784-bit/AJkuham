import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Cuisine, Diet, Profile as ProfileT } from '../api/types'
import { Button, Chip, Shell, Spinner, Stepper, Title, Toast, buzz, cx, eur, useToast } from '../components/ui'
import { Art } from '../illustrations'
import { ADVENTURE_LABEL, BUDGET_LEVEL_LABEL, CUISINES, CUISINE_LABEL, DIETS, DIET_LABEL, STYLE_LABEL, dietSummary, people } from '../labels'
import { getState, setState, useStore } from '../store'

// Profil (Leon, 15:45): korisnik vidi što je izabrao i mijenja na licu mjesta.
// Nema nove baze: sve ide kroz postojeći PUT /api/profile (i POST /api/taste za jela),
// a lokalno živi u localStorage kao i dosad. Plan se ne regenerira sam — na planu je "Pregradi tjedan".

const ALLERGY_OPTS = ['orasi', 'kikiriki', 'jaja', 'riba', 'školjke', 'soja', 'gluten', 'laktoza']
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
const DELIVERY_PER_MEAL = 14.76

export default function Profile() {
  const nav = useNavigate()
  const saved = useStore((s) => s.profile)
  const taste = useStore((s) => s.taste)
  const [p, setP] = useState<ProfileT | null>(saved ? { ...saved, diets: saved.diets ?? [], dietNote: saved.dietNote ?? '' } : null)
  const [busy, setBusy] = useState(false)
  const [allergyDraft, setAllergyDraft] = useState('')
  const [toast, showToast] = useToast()

  if (!p || !saved) {
    return (
      <Shell tabs>
        <div className="mx-auto max-w-xl">
          <Title sub="Još se nismo upoznali.">Tvoj profil</Title>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-8 text-center">
            <span className="grid size-16 place-items-center rounded-xl bg-[#FFF0C9]"><Art name="kuhar" className="size-12" /></span>
            <p className="font-extrabold">Par pitanja i složim ti tjedan.</p>
            <Button className="mt-2 w-full" onClick={() => nav('/onboarding')}>Upoznajmo se</Button>
          </div>
        </div>
      </Shell>
    )
  }

  const set = (patch: Partial<ProfileT>) => setP((x) => (x ? { ...x, ...patch } : x))
  const dirty = JSON.stringify(p) !== JSON.stringify({ ...saved, diets: saved.diets ?? [], dietNote: saved.dietNote ?? '' })
  const portions = p.mealsPerDay * 7 * p.householdSize
  const perPortion = (p.budgetPerWeekEur ?? 0) / portions

  async function save() {
    if (!p) return
    setBusy(true)
    try {
      await api.putProfile(p)
      setState({ profile: p })
      buzz(60)
      showToast(getState().plan ? 'Spremljeno. Na planu klikni "Pregradi tjedan" da se primijeni.' : 'Spremljeno.')
    } catch (e) {
      showToast((e as Error).message, 'hot')
    } finally { setBusy(false) }
  }

  async function removeTaste(kind: 'liked' | 'disliked', title: string) {
    const next = { ...taste, [kind]: taste[kind].filter((t) => t !== title) }
    setState({ taste: next })
    try { await api.taste(next.liked, next.disliked) } catch { /* lokalno je već maknuto */ }
  }

  function reset() {
    if (!window.confirm('Obrisati profil, frižider i plan na ovom uređaju i krenuti ispočetka?')) return
    try { localStorage.removeItem('kuhai.state'); localStorage.removeItem('kuhai.sessionId') } catch { /* nema storagea */ }
    window.location.assign('/onboarding')
  }

  return (
    <Shell tabs>
      <div className="mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* lijevo (desktop, ljepljivo): sažetak */}
        <aside className="lg:sticky lg:top-24">
          <Title sub="Ovo znam o tebi. Promijeni što hoćeš, pamtim na ovom uređaju.">Tvoj profil</Title>
          <section className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-[#FFF0C9]"><Art name="kuhar" className="size-9" /></span>
              <div>
                <p className="font-extrabold">{people(p.householdSize)}, {p.mealsPerDay} obroka dnevno</p>
                <p className="text-sm text-muted">{STYLE_LABEL[p.cookingStyle]} · do {p.minutesPerMeal} min</p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Prehrana</dt><dd className="font-bold">{dietSummary(p)}{p.allergies.length ? ` · bez: ${p.allergies.join(', ')}` : ''}</dd>
              <dt className="text-muted">Voliš</dt><dd className="font-bold">{p.cuisines.length ? p.cuisines.map((c) => CUISINE_LABEL[c]).join(', ') : 'nisi rekao'} · {ADVENTURE_LABEL[p.adventurousness] ?? p.adventurousness}</dd>
              <dt className="text-muted">Budžet</dt><dd className="font-bold">{p.budgetPerWeekEur ? `${p.budgetPerWeekEur} € tjedno` : BUDGET_LEVEL_LABEL[p.budgetLevel]}</dd>
              {taste.liked.length > 0 && <><dt className="text-muted">Odabrao</dt><dd className="font-bold">{taste.liked.length} {taste.liked.length === 1 ? 'jelo' : taste.liked.length < 5 ? 'jela' : 'jela'}</dd></>}
            </dl>
          </section>
          <div className="hidden lg:block">
            <Button className="w-full" onClick={save} disabled={!dirty || busy}>{busy ? <Spinner /> : 'Spremi promjene'}</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={reset}>Kreni ispočetka</Button>
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          <Card title="Obroci i kućanstvo">
            <Row label="Obroka dnevno"><Stepper value={p.mealsPerDay} min={2} max={5} onChange={(n) => set({ mealsPerDay: n as ProfileT['mealsPerDay'] })} /></Row>
            <Row label="Koliko vas"><Stepper value={p.householdSize} min={1} max={8} onChange={(n) => set({ householdSize: n })} /></Row>
          </Card>

          <Card title="Kako kuhaš">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STYLE_LABEL) as ProfileT['cookingStyle'][]).map((s) => <Chip key={s} on={p.cookingStyle === s} onClick={() => set({ cookingStyle: s })}>{STYLE_LABEL[s]}</Chip>)}
            </div>
            <p className="mt-3 mb-2 text-sm font-bold text-muted">Minuta po obroku</p>
            <div className="flex flex-wrap gap-2">
              {([15, 30, 45] as const).map((m) => <Chip key={m} on={p.minutesPerMeal === m} onClick={() => set({ minutesPerMeal: m })}>{m} min</Chip>)}
            </div>
          </Card>

          <Card title="Prehrana">
            <div className="flex flex-wrap gap-2">
              {DIETS.map((d) => (
                <Chip key={d} on={d === 'sve' ? p.diets.length === 0 : p.diets.includes(d)}
                  onClick={() => { const diets = d === 'sve' ? [] : toggle(p.diets, d as Diet); set({ diets, diet: diets[0] ?? 'sve' }) }}>{DIET_LABEL[d]}</Chip>
              ))}
            </div>
            <input value={p.dietNote ?? ''} onChange={(e) => set({ dietNote: e.target.value.slice(0, 200) })} placeholder="Ostalo: npr. ne jedem ribu" aria-label="Ostalo o prehrani"
              className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-muted/60 focus:border-ink" />
            <p className="mt-3 mb-2 text-sm font-bold text-muted">Alergije</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...ALLERGY_OPTS, ...p.allergies])].map((a) => <Chip key={a} on={p.allergies.includes(a)} onClick={() => set({ allergies: toggle(p.allergies, a) })}>{a}</Chip>)}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const a = allergyDraft.trim().toLowerCase(); if (a && !p.allergies.includes(a)) set({ allergies: [...p.allergies, a] }); setAllergyDraft('') }}>
              <input value={allergyDraft} onChange={(e) => setAllergyDraft(e.target.value)} placeholder="Dodaj alergen" aria-label="Dodaj alergen"
                className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-2.5 text-[15px] font-bold outline-none focus:border-ink" />
              <button type="submit" className="rounded-2xl bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-40" disabled={!allergyDraft.trim()}>Dodaj</button>
            </form>
          </Card>

          <Card title="Što voliš">
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => <Chip key={c} on={p.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(p.cuisines, c as Cuisine) })}>{CUISINE_LABEL[c]}</Chip>)}
            </div>
            <p className="mt-3 mb-2 text-sm font-bold text-muted">Koliko novog</p>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 5].map((a) => <Chip key={a} on={p.adventurousness === a} onClick={() => set({ adventurousness: a })}>{ADVENTURE_LABEL[a]}</Chip>)}
            </div>
          </Card>

          <Card title="Budžet">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BUDGET_LEVEL_LABEL) as ProfileT['budgetLevel'][]).map((b) => <Chip key={b} on={p.budgetLevel === b} onClick={() => set({ budgetLevel: b })}>{BUDGET_LEVEL_LABEL[b]}</Chip>)}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <span className="w-20 text-2xl font-black tabular-nums">{p.budgetPerWeekEur ?? 60} €</span>
              <input type="range" min={20} max={150} step={5} value={p.budgetPerWeekEur ?? 60} onChange={(e) => set({ budgetPerWeekEur: +e.target.value })} className="min-w-0 flex-1 accent-brand" aria-label="Budžet tjedno" />
            </div>
            {p.budgetPerWeekEur != null && (
              <p className="mt-1 text-sm text-muted">{eur(perPortion)} po porciji, dostava je oko {eur(DELIVERY_PER_MEAL)}.</p>
            )}
          </Card>

          <Card title="Jela koja si odabrao">
            {taste.liked.length === 0 && taste.disliked.length === 0 ? (
              <p className="text-sm text-muted">Još nisi prošao kartice.</p>
            ) : (
              <>
                {taste.liked.length > 0 && <TasteList tone="fresh" label="Bih" items={taste.liked} onRemove={(t) => removeTaste('liked', t)} />}
                {taste.disliked.length > 0 && <TasteList tone="hot" label="Ne bih" items={taste.disliked} onRemove={(t) => removeTaste('disliked', t)} />}
              </>
            )}
            <Button variant="soft" className="mt-3 w-full" onClick={() => nav('/biram')}>Biraj jela ponovno</Button>
          </Card>

          <div className="lg:hidden">
            <Button className="w-full" onClick={save} disabled={!dirty || busy}>{busy ? <Spinner /> : 'Spremi promjene'}</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={reset}>Kreni ispočetka</Button>
          </div>
        </div>
      </div>
      <Toast msg={toast} />
    </Shell>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 lg:p-5">
      <h2 className="mb-3 font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-bold">{label}</span>
      {children}
    </div>
  )
}

function TasteList({ tone, label, items, onRemove }: { tone: 'fresh' | 'hot'; label: string; items: string[]; onRemove: (t: string) => void }) {
  return (
    <div className="mb-2">
      <p className={cx('mb-1 text-xs font-extrabold', tone === 'fresh' ? 'text-fresh' : 'text-hot')}>{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((t) => (
          <li key={t} className={cx('flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-bold', tone === 'fresh' ? 'bg-fresh-bg text-fresh' : 'bg-hot-bg text-hot')}>
            {t}
            <button onClick={() => onRemove(t)} aria-label={`Makni ${t}`} className="grid size-6 place-items-center rounded-full hover:bg-black/5">✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
