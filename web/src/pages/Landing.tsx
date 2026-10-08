import { useNavigate } from 'react-router'
import { Button, TopBar, cx } from '../components/ui'
import { useStore } from '../store'
import { Art, type ArtName } from '../illustrations'

const STEPS = [
  ['kamera', 'bg-[#FFE3D3]', 'Slikaj frižider', 'Prepoznamo što imaš i što uskoro ističe.'],
  ['kalendar', 'bg-[#E4F1DA]', 'Tjedan složen', 'Jelovnik i meal prep u dva bloka.'],
  ['kosarica', 'bg-[#FFF0C9]', 'Košarica gotova', 'Samo ono što fali, u Konzumu.'],
] as const satisfies readonly (readonly [ArtName, string, string, string])[]

// Desktop vizual: kartice jela u dva pomaknuta stupca, blago nakošene kao da su ostavljene na stolu.
const STACK = [
  [
    { src: '/food/spageti.jpg', day: 'Ponedjeljak', title: 'Špageti s rajčicom', meta: '20 min', mark: 'spašava rajčice', tilt: '-rotate-2' },
    { src: '/food/salata.jpg', day: 'Srijeda', title: 'Salata od kupusa', meta: '10 min', mark: 'spašava kupus', tilt: 'rotate-1' },
  ],
  [
    { src: '/food/pileci-batak.jpg', day: 'Utorak', title: 'Piletina iz pećnice', meta: '45 min', mark: 'iz prepa', tilt: 'rotate-2' },
  ],
]

function StackCard({ c }: { c: (typeof STACK)[number][number] }) {
  return (
    <figure className={cx('rounded-3xl border border-line bg-white p-2.5 shadow-card', c.tilt)}>
      <img src={c.src} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
      <figcaption className="px-1.5 pt-2.5 pb-1">
        <span className="block text-sm text-muted">{c.day}</span>
        <b className="block leading-tight font-extrabold">{c.title}</b>
        <span className="text-sm text-muted">{c.meta} · <span className={cx('font-bold', c.mark === 'iz prepa' ? 'text-fresh' : 'text-hot')}>{c.mark}</span></span>
      </figcaption>
    </figure>
  )
}

export default function Landing() {
  const nav = useNavigate()
  const hasPlan = useStore((s) => !!s.plan)
  const hasProfile = useStore((s) => !!s.profile)

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <TopBar className="hidden lg:block" />

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-12 pb-8 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-16">
        <div className="flex flex-1 flex-col lg:flex-none">
          <div className="flex items-center gap-4 lg:hidden">
            <img src="/logo.png" alt="KuhAI logo" className="size-20 rounded-[1.4rem] shadow-[0_10px_24px_-10px_rgb(208_22_27/0.6)]" />
            <div>
              <div className="font-display text-[32px] leading-none font-bold tracking-tight">Kuh<span className="text-brand">AI</span></div>
              <div className="mt-1.5 text-sm text-muted">AI smišlja, ti kuhaš.</div>
            </div>
          </div>

          <p className="mt-10 text-[15px] text-muted lg:mt-0 lg:text-base">20 min scrollaš recepte… pa naručiš za 20 €.</p>
          <h1 className="mt-1 text-[32px] leading-[1.1] font-black tracking-tight text-balance lg:mt-2 lg:text-[56px] lg:leading-[1.05]">
            Slikaj frižider. Dobij cijeli tjedan hrane.
          </h1>
          <p className="mt-3 text-[17px] text-muted lg:mt-5 lg:text-xl">Meal prep i košarica u Konzumu, bez bacanja.</p>

          <ol className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white lg:max-w-md">
            {STEPS.map(([ico, tint, title, sub]) => (
              <li key={title} className="flex items-center gap-4 p-4">
                <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${tint}`}><Art name={ico} className="size-9" /></span>
                <span>
                  <b className="block font-extrabold">{title}</b>
                  <span className="text-sm text-muted">{sub}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-auto flex flex-col gap-3 pt-10 lg:mt-8 lg:flex-row lg:pt-0">
            <Button className="lg:px-10" onClick={() => nav('/onboarding')}>Kreni kuhati</Button>
            {hasPlan ? (
              <Button variant="soft" className="lg:px-8" onClick={() => nav('/plan')}>
                Nastavi na moj tjedan
              </Button>
            ) : hasProfile && (
              <Button variant="soft" className="lg:px-8" onClick={() => nav('/frizider')}>
                Nastavi, odabiri su zapamćeni
              </Button>
            )}
          </div>
        </div>

        <div className="relative hidden lg:block" aria-hidden>
          <div className="absolute inset-x-6 inset-y-10 rounded-[3rem] bg-cream" />
          <div className="relative grid grid-cols-2 gap-6 px-4">
            <div className="flex flex-col gap-6">
              {STACK[0].map((c) => <StackCard key={c.src} c={c} />)}
            </div>
            <div className="flex flex-col gap-6 pt-20">
              {STACK[1].map((c) => <StackCard key={c.src} c={c} />)}
              <div className="rotate-1 rounded-3xl border border-line bg-white p-5 shadow-card">
                <p className="text-sm font-bold text-muted">Spašeno od bacanja</p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-fresh">11,20 €</p>
                <p className="mt-1 text-sm text-muted">špinat, jogurt, pola kupusa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
