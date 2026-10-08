/* Dev-only galerija: http://localhost:5180/illustrations.html
   Ne ulazi u produkcijski build (vite build gradi samo index.html). */
import { StrictMode, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { Art, INGREDIENT_ARTS, MEAL_ARTS, UI_ARTS, categoryArt, ingredientArt, mealArt, type ArtName } from './index'

const INK = '#2B1D16'
const MUTED = '#8A6F60'
const font: CSSProperties = { fontFamily: 'Nunito, system-ui, sans-serif', color: INK }

const GROUPS: [string, readonly ArtName[]][] = [
  ['Jela', MEAL_ARTS],
  ['Namirnice / kategorije', INGREDIENT_ARTS],
  ['UI', UI_ARTS],
]
const PASTELS = ['#FFE3D6', '#FFF0C9', '#E3F2E1', '#FDE2E2', '#EFE6FF', '#FFEBD2']

function Cell({ name, size, bg }: { name: ArtName; size: number; bg: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: size + 22 }}>
      <div style={{ background: bg, padding: 8, borderRadius: 12 }}>
        <Art name={name} style={{ width: size, height: size, display: 'block' }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textAlign: 'center' }}>{name}</div>
    </div>
  )
}

function SizeBlock({ size }: { size: number }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 18, margin: '0 0 10px' }}>{size}px</h2>
      {(['#FFF4E6', '#FFFFFF'] as const).map((bg) => (
        <div key={bg} style={{ background: bg, border: '1px solid #F0E4D6', borderRadius: 16, padding: 12, marginBottom: 10 }}>
          {GROUPS.map(([label, names]) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, margin: '2px 0 6px' }}>
                {label} · {bg === '#FFFFFF' ? 'bijela' : 'krem'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {names.map((n) => (
                  <Cell key={n} name={n} size={size} bg={bg} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

/** kako će izgledati u UI-ju: pastelni zaobljeni kvadrat kao u dizajnu */
function InContext() {
  const all = [...MEAL_ARTS, ...INGREDIENT_ARTS, ...UI_ARTS]
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 18, margin: '0 0 10px' }}>U kontekstu (56px pločica, 40px crtež)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, background: '#FFFBF6', padding: 12, borderRadius: 16 }}>
        {all.map((n, i) => (
          <div key={n} style={{ width: 56, height: 56, borderRadius: 16, background: PASTELS[i % PASTELS.length], display: 'grid', placeItems: 'center' }}>
            <Art name={n} title={n} style={{ width: 40, height: 40 }} />
          </div>
        ))}
      </div>
    </section>
  )
}

const SAMPLE_MEALS = [
  'Carbonara na brzinu', 'Šakšuka', 'Omlet sa špinatom i sirom', 'Quesadilla s grahom i kukuruzom',
  'Piletina s rižom i povrćem', 'Zobena kaša s bananom', 'Varivo od leće', 'Svinjski file s povrćem',
  'Pečeni krumpir s jogurtom', 'Wok s piletinom', 'Grčka salata', 'Rižoto s gljivama', 'Nešto čudno',
]
const SAMPLE_ING = [
  'Jaja', 'jaje', 'Mlijeko', 'Vrhnje za kuhanje', 'Sir', 'Parmezan', 'Jogurt', 'Maslac', 'Rajčica', 'rajcice',
  'Pelati', 'Luk', 'Mladi luk', 'Češnjak', 'Paprika', 'Špinat', 'Mrkva', 'Kupus', 'Tikvica', 'Krumpir', 'Limun',
  'Riža', 'Tjestenina', 'Grah (konzerva)', 'Leća', 'Tuna', 'Mljeveno meso', 'Slanina', 'Piletina', 'Pileća prsa',
  'Kruh', 'Tortilje', 'Gljive', 'Kukuruz',
]
const SAMPLE_CAT = ['meso', 'povrće', 'žitarice', 'mahunarke', 'jaja', 'mliječno', 'voće', 'pekarski proizvodi', 'začini']

function MatchDemo() {
  const row = (label: string, art: ArtName) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#fff', borderRadius: 10, border: '1px solid #F0E4D6' }}>
      <Art name={art} style={{ width: 32, height: 32 }} />
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 800 }}>{label}</div>
        <div style={{ color: MUTED }}>{art}</div>
      </div>
    </div>
  )
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6, marginBottom: 12 }
  return (
    <section>
      <h2 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 18, margin: '0 0 10px' }}>Matcheri</h2>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>mealArt()</div>
      <div style={grid}>{SAMPLE_MEALS.map((t) => row(t, mealArt(t)))}</div>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>ingredientArt()</div>
      <div style={grid}>{SAMPLE_ING.map((t) => row(t, ingredientArt(t)))}</div>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>categoryArt()</div>
      <div style={grid}>{SAMPLE_CAT.map((t) => row(t, categoryArt(t)))}</div>
    </section>
  )
}

function Gallery() {
  return (
    <main style={{ ...font, maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 24, margin: '4px 0 16px' }}>KuhAI ilustracije</h1>
      <InContext />
      <SizeBlock size={120} />
      <SizeBlock size={64} />
      <SizeBlock size={48} />
      <MatchDemo />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
