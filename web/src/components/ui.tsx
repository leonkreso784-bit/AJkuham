import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useFallback, usingMock } from '../api/client'
import { Art, type ArtName } from '../illustrations'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

// Jedan crveni CTA po ekranu (brand). soft = bijeli sekundarni s rubom, ghost = samo tekst.
type BtnVariant = 'brand' | 'ink' | 'soft' | 'ghost'
const BTN: Record<BtnVariant, string> = {
  brand: 'bg-brand text-white shadow-cta hover:bg-brand-dark',
  ink: 'bg-ink text-white',
  soft: 'border border-line bg-white text-ink hover:border-[#E6D3BF]',
  ghost: 'text-ink hover:bg-white',
}

export function Button({ variant = 'brand', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...rest}
      className={cx(
        BTN[variant],
        'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-extrabold transition-[transform,background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-px',
        className,
      )}
    />
  )
}

export function Chip({ on, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={on}
      className={cx(
        'rounded-full border px-4 py-2.5 text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-[#E6D3BF]',
        className,
      )}
    />
  )
}

const STEP_BTN = 'grid size-10 place-items-center rounded-full bg-cream text-lg font-bold text-ink transition-colors hover:bg-[#FFE9CF] active:translate-y-px'

export function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-line bg-white p-1">
      <button className={STEP_BTN} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Manje">−</button>
      <span className="min-w-8 text-center text-lg font-extrabold tabular-nums">{value}{suffix}</span>
      <button className={STEP_BTN} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Više">+</button>
    </div>
  )
}

export function Pill({ tone, children }: { tone: 'fresh' | 'hot' | 'warn' | 'muted' | 'brand'; children: ReactNode }) {
  const t = {
    fresh: 'bg-fresh-bg text-fresh',
    hot: 'bg-hot-bg text-hot',
    warn: 'bg-warn-bg text-warn',
    muted: 'bg-cream text-muted',
    brand: 'bg-brand/10 text-brand',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap', t)}>{children}</span>
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-[26px] leading-tight font-black tracking-tight text-balance lg:text-[34px]">{children}</h1>
      {sub && <p className="mt-1 text-[15px] text-muted lg:text-base">{sub}</p>}
    </header>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-5 animate-spin rounded-full border-[3px] border-current border-r-transparent', className)} />
}

// Gornja traka. Mobitel: kompaktni logo. lg+: ljepljiva traka preko cijele širine, s navigacijom kad je `nav`.
export function TopBar({ nav = false, className }: { nav?: boolean; className?: string }) {
  const fallback = useFallback()
  return (
    <header className={cx('lg:sticky lg:top-0 lg:z-20 lg:border-b lg:border-line lg:bg-bg/90 lg:backdrop-blur', className)}>
      <div className="mx-auto flex max-w-[38.5rem] items-center gap-3 px-5 pt-5 pb-2 lg:max-w-6xl lg:gap-4 lg:px-8 lg:py-3">
        <img src="/logo.png" alt="" className="size-11 rounded-xl lg:size-10" />
        <div className="flex-1 lg:flex lg:flex-none lg:items-baseline lg:gap-3">
          <div className="font-display text-lg leading-none font-bold tracking-tight">Kuh<span className="text-brand">AI</span></div>
          <div className="mt-1 text-[13px] text-muted lg:mt-0 lg:text-sm">AI smišlja, ti kuhaš.</div>
        </div>
        {nav && (
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Glavna navigacija">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to}
                className={({ isActive }) => cx('flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-bold transition-colors',
                  isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-white hover:text-ink')}>
                {({ isActive }) => (
                  <>
                    <Art name={t.ico} className={cx('size-6 transition', !isActive && 'opacity-50 grayscale')} />
                    {t.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
        {!nav && <span className="hidden flex-1 lg:block" />}
        {usingMock && <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-muted">Demo način</span>}
        {!usingMock && fallback && <span className="rounded-full bg-warn-bg px-2.5 py-1 text-xs font-bold text-warn" title="Backend nije odgovorio, prikazujem demo podatke">Demo podaci</span>}
      </div>
    </header>
  )
}

// Okvir stranice: puna širina, sadržaj u max-w-6xl. Ispod lg se ponaša kao mobilna aplikacija s donjom trakom.
export function Shell({ children, tabs = false }: { children: ReactNode; tabs?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg">
      <TopBar nav={tabs} />
      <main className={cx('mx-auto max-w-6xl px-5 pt-4 lg:px-8 lg:pt-10', tabs ? 'pb-28 lg:pb-16' : 'pb-10')}>{children}</main>
      {tabs && <TabBar />}
    </div>
  )
}

const TABS: { to: string; label: string; ico: ArtName }[] = [
  { to: '/frizider', label: 'Frižider', ico: 'frizider' },
  { to: '/plan', label: 'Tjedan', ico: 'kalendar' },
  { to: '/kosarica', label: 'Košarica', ico: 'kosarica' },
]

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-[38.5rem]">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cx('flex flex-1 flex-col items-center gap-0.5 pt-2.5 pb-2 text-xs font-bold', isActive ? 'text-brand' : 'text-muted')
            }
          >
            {({ isActive }) => (
              <>
                <Art name={t.ico} className={cx('size-7 transition', !isActive && 'opacity-45 grayscale')} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

const TINTS = ['bg-[#FFE3D3]', 'bg-[#E4F1DA]', 'bg-[#FFF0C9]', 'bg-[#F9DCE0]', 'bg-[#E1ECF7]', 'bg-[#EDE3F6]']
export function foodTint(title: string) {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

// Brojka se "zavrti" do vrijednosti (ease-out). Poštuje prefers-reduced-motion.
export function CountUp({ value, format = eur, ms = 1100 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setShown(a + (value - a) * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{format(shown)}</>
}

export const eur = (n: number) => n.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// Kratka poruka pri dnu (iznad donje trake na mobitelu). Nestaje sama; roditelj drži stanje preko useToast().
export interface ToastMsg { text: string; tone?: 'ink' | 'hot' }
export function useToast(ms = 2800) {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const timer = useRef(0)
  const show = useCallback((text: string, tone: ToastMsg['tone'] = 'ink') => {
    clearTimeout(timer.current)
    setToast({ text, tone })
    timer.current = window.setTimeout(() => setToast(null), ms)
  }, [ms])
  useEffect(() => () => clearTimeout(timer.current), [])
  return [toast, show] as const
}

export function Toast({ msg }: { msg: ToastMsg | null }) {
  if (!msg) return null
  return (
    <div role="status" aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 flex justify-center px-5 lg:bottom-8">
      <div className={cx('animate-toast max-w-xl rounded-2xl px-4 py-3 text-[15px] leading-snug font-bold text-white shadow-card',
        msg.tone === 'hot' ? 'bg-hot' : 'bg-ink')}>
        {msg.text}
      </div>
    </div>
  )
}

// Kratka vibracija gdje je podržana (Android Chrome). iOS Safari nema navigator.vibrate pa tiho preskače.
export function buzz(pattern: number | number[] = 80) {
  try { navigator.vibrate?.(pattern) } catch { /* nije podržano */ }
}

export const SLOT_LABEL: Record<string, string> = {
  dorucak: 'Doručak', rucak: 'Ručak', vecera: 'Večera', snack1: 'Užina', snack2: 'Užina',
}
