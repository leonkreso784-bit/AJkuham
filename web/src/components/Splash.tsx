import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'

// Uvodna animacija pri otvaranju aplikacije — prenesena iz Documents/KuhAI/splash/index.html.
// Lonac zakuha, poklopac odskoči, "Kuh" izleti iz lonca i složi se u "Kuh[AI]".
// Jednom po sesiji; tap preskače.

const KEY = 'kuhai.splashSeen'
const S = 0.4
const POT_W = (1159 + 36) - (95 - 36)
const POT_LEFT = 95 - 36
const POT_CX = 627
const VIEW_W = 1000
const GAP = 14
const FONT = 192

const C = { cream: '#FBF4E8', brand: '#D9503F', soft: '#EC8E7F', onBrand: '#FFF6EA' }

function seen() {
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}

export default function Splash() {
  const [show, setShow] = useState(() => !seen())
  const root = useRef<HTMLDivElement>(null)
  const kuh = useRef<SVGGElement>(null)
  const done = useRef<() => void>(() => {})

  useEffect(() => {
    if (!show || !root.current) return
    let ctx: gsap.Context | undefined
    let cancelled = false

    const leave = () => {
      if (cancelled) return
      cancelled = true
      try { sessionStorage.setItem(KEY, '1') } catch { /* ignore */ }
      gsap.to(root.current, { autoAlpha: 0, duration: 0.35, ease: 'power1.in', onComplete: () => setShow(false) })
    }
    done.current = leave
    // osigurač: splash nikad ne smije zaglaviti (spor mobitel, prigušen rAF)
    const hardStop = setTimeout(leave, 5500)

    // Ne čekaj font zauvijek (slab WiFi na sceni) — najviše 700 ms, pa kreni.
    Promise.race([document.fonts.load(`900 ${FONT}px Nunito`), new Promise((r) => setTimeout(r, 700))]).then(() => {
      if (cancelled || !root.current || !kuh.current) return
      ctx = gsap.context(() => {
        // izmjeri "Kuh" i složi kompoziciju Kuh + lonac na sredinu
        const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        probe.setAttribute('font-size', String(FONT))
        probe.setAttribute('font-weight', '900')
        probe.setAttribute('font-family', 'Nunito, system-ui, sans-serif')
        kuh.current!.appendChild(probe)
        const adv = (t: string) => { probe.textContent = t; return probe.getComputedTextLength() }
        const offs = [0, adv('K'), adv('Ku')]
        const wordW = adv('Kuh')
        const widths = [adv('K'), adv('u'), adv('h')]
        probe.remove()

        const total = wordW + GAP + POT_W * S
        const left = (VIEW_W - total) / 2
        const potFinalX = left + wordW + GAP - POT_LEFT * S
        const potStartX = VIEW_W / 2 - POT_CX * S
        const letters = ['.kK', '.ku', '.kh']
        letters.forEach((sel, i) => root.current!.querySelector(sel)!.setAttribute('x', String(left + offs[i])))

        gsap.set('.potMove', { x: potStartX, y: 90 })
        gsap.set('.pot', { transformOrigin: '50% 100%' })
        gsap.set('.lid', { svgOrigin: '627 548' })
        gsap.set('.bubbles circle', { scale: 0, transformOrigin: '50% 50%' })
        gsap.set('.steam', { strokeDasharray: 1, strokeDashoffset: 1 })
        gsap.set('.progress', { opacity: 0 })
        letters.forEach((sel, i) => {
          const cx = left + offs[i] + widths[i] / 2
          gsap.set(sel, { x: VIEW_W / 2 - cx, y: 26, scale: 0.55, autoAlpha: 0, transformOrigin: '50% 100%' })
        })

        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
        // 1) lonac uskoči
        tl.from('.pot', { scale: 0.4, opacity: 0, duration: 0.6, ease: 'back.out(2)' })
        // 2) zakuhavanje
        tl.addLabel('boil', '+=0.05')
        tl.to('.pot', { scaleX: 1.035, scaleY: 0.965, duration: 0.12, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 'boil')
        tl.to('.lid', {
          keyframes: [
            { y: -18, rotation: -3, duration: 0.09 }, { y: 0, rotation: 0, duration: 0.09 },
            { y: -26, rotation: 4, duration: 0.09 }, { y: 0, rotation: 0, duration: 0.09 },
            { y: -34, rotation: -5, duration: 0.08 }, { y: 0, rotation: 0, duration: 0.08 },
            { y: -48, rotation: 6, duration: 0.08 }, { y: 0, rotation: 0, duration: 0.08 },
          ], ease: 'power1.inOut',
        }, 'boil+=0.1')
        tl.to('.bubbles circle', {
          keyframes: [{ y: -70, scale: 1, duration: 0.3 }, { y: -110, scale: 0, duration: 0.2, ease: 'power1.in' }],
          stagger: { each: 0.08, repeat: 1 },
        }, 'boil+=0.2')
        // 3) poklopac iskače, "Kuh" izlijeće
        tl.addLabel('burst', 'boil+=0.95')
        tl.to('.lid', { y: -190, x: 40, rotation: 14, duration: 0.32, ease: 'power3.out' }, 'burst')
        tl.to('.lid', { y: -70, x: 10, rotation: -9, duration: 0.6, ease: 'bounce.out' }, 'burst+=0.32')
        tl.to('.pot', { scaleX: 0.95, scaleY: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'burst')
        letters.forEach((sel, i) => {
          const o = 0.04 + i * 0.09
          tl.set(sel, { autoAlpha: 1 }, `burst+=${o}`)
          tl.to(sel, { y: -400 + i * 40, scale: 1.08, rotation: -14 + i * 6, duration: 0.42 }, `burst+=${o}`)
          tl.to(sel, { y: 0, scale: 1, rotation: 0, duration: 0.5, ease: 'bounce.out' }, `burst+=${o + 0.42}`)
          tl.to(sel, { x: 0, duration: 0.84, ease: 'power1.inOut' }, `burst+=${o}`)
        })
        tl.to('.potMove', { x: potFinalX, duration: 0.75, ease: 'power3.inOut' }, 'burst+=0.22')
        // 4) para + loader, pa odlazak
        tl.addLabel('settle', 'burst+=1.1')
        tl.to('.progress', { opacity: 1, duration: 0.3 }, 'settle')
        tl.add(() => {
          const steam = gsap.timeline({ repeat: -1 })
          gsap.utils.toArray<SVGPathElement>('.steam').forEach((p, i) => {
            steam.fromTo(p, { strokeDashoffset: 1, opacity: 1, y: 0 }, {
              keyframes: [
                { strokeDashoffset: 0, duration: 0.9, ease: 'sine.out' },
                { strokeDashoffset: -1, opacity: 0, y: -60, duration: 0.9, ease: 'sine.in' },
              ],
            }, i * 0.45)
          })
          steam.to('.lid', { y: -82, rotation: -7, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.6)
          gsap.fromTo('.progress i', { xPercent: -110 }, { xPercent: 260, duration: 1.2, repeat: -1, ease: 'power1.inOut' })
        }, 'settle-=0.3')
        tl.add(leave, 'settle+=1.2')

        if (matchMedia('(prefers-reduced-motion: reduce)').matches) tl.progress(1)
      }, root)
    })

    return () => { cancelled = true; clearTimeout(hardStop); ctx?.revert() }
  }, [show])

  if (!show) return null

  return (
    <div ref={root} onClick={() => done.current()} role="img" aria-label="KuhAI"
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center overflow-hidden" style={{ background: C.cream }}>
      {/* mobitel: kao render mod iz splash/index.html (107vw) — rubovi viewBoxa su prazni pa logo puni ekran */}
      <div className="flex w-[107vw] flex-col items-center gap-6 sm:w-[min(72vw,760px)] sm:gap-9">
        <svg viewBox="0 0 1000 600" className="h-auto w-full overflow-visible">
          <g ref={kuh} fill={C.brand} fontSize={FONT} fontWeight={900} fontFamily="Nunito, system-ui, sans-serif">
            <text className="kK" y="508">K</text>
            <text className="ku" y="508">u</text>
            <text className="kh" y="508">h</text>
          </g>
          <g className="potMove">
            <g className="pot">
              <g transform="scale(0.4)">
                <g fill="none" stroke={C.brand} strokeWidth="34" strokeLinecap="round" opacity="0.32">
                  <path className="steam" pathLength={1} d="M520 400 c-50 -45 50 -85 0 -135 c-50 -45 50 -85 0 -135" />
                  <path className="steam" pathLength={1} d="M660 380 c-50 -45 50 -85 0 -135 c-50 -45 50 -85 0 -135 c-30 -30 30 -60 0 -90" />
                  <path className="steam" pathLength={1} d="M800 400 c-50 -45 50 -85 0 -135 c-50 -45 50 -85 0 -135" />
                </g>
                <g className="bubbles" fill={C.soft}>
                  <circle cx="400" cy="590" r="34" />
                  <circle cx="520" cy="600" r="26" />
                  <circle cx="640" cy="592" r="40" />
                  <circle cx="760" cy="600" r="28" />
                  <circle cx="860" cy="594" r="32" />
                </g>
                <g fill="none" stroke={C.brand} strokeWidth="72" strokeLinecap="round">
                  <path d="M285 690 C195 615 95 625 95 728 C95 815 185 838 250 845" />
                  <path d="M969 690 C1059 615 1159 625 1159 728 C1159 815 1069 838 1004 845" />
                </g>
                <path fill={C.brand} stroke={C.cream} strokeWidth="16" paintOrder="stroke"
                  d="M295 625 L959 625 C1010 745 1032 820 1030 905 C1026 1065 940 1112 820 1124 C700 1134 554 1134 434 1124 C314 1112 228 1065 224 905 C222 820 244 745 295 625 Z" />
                <text x="627" y="1045" textAnchor="middle" fontSize="480" fontWeight={900} fontFamily="Nunito, system-ui, sans-serif" fill={C.onBrand}>AI</text>
                <rect fill={C.brand} stroke={C.cream} strokeWidth="16" paintOrder="stroke" x="222" y="552" width="810" height="92" rx="46" />
                <g className="lid">
                  <path fill={C.brand} stroke={C.cream} strokeWidth="16" paintOrder="stroke" d="M262 548 C285 452 969 452 992 548 C992 560 262 560 262 548 Z" />
                  <rect fill={C.brand} x="603" y="410" width="48" height="60" />
                  <rect fill={C.brand} stroke={C.cream} strokeWidth="14" paintOrder="stroke" x="532" y="378" width="190" height="56" rx="28" />
                </g>
              </g>
            </g>
          </g>
        </svg>
        <div className="progress h-1 w-[34%] overflow-hidden rounded" style={{ background: 'rgb(217 80 63 / 0.16)' }}>
          <i className="block h-full w-[40%] rounded" style={{ background: C.brand }} />
        </div>
      </div>
    </div>
  )
}
