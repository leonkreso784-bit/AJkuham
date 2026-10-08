/* KuhAI ilustracije — zajednički alat.
   Pravila stila (vrijede za SVE ilustracije):
   - viewBox 0 0 64 64, ravni oblici, jedan ink obrub iste debljine (SW) svuda
   - svaki oblik ima JEDAN sloj sjene: tamniji polumjesec dolje-desno (S radi to sam)
   - mali bijeli highlight gore-lijevo (Hi), unutarnji detalji tanjom linijom (DW)
   - boje samo iz P, tople i blago desaturirane */
import { useId, type ReactNode } from 'react'

export const INK = '#2B1D16'
/** debljina obruba — ista u cijelom setu */
export const SW = 2.5
/** debljina unutarnjih detalja */
export const DW = 2

export const P = {
  ink: INK,
  red: '#D0161B',
  redD: '#A91115',
  cream: '#FFF4E6',
  white: '#FFFCF7',
  bowl: '#FBF1E4',
  bowlIn: '#EBD8C0',
  tomato: '#E2503E',
  pepper: '#D63A2C',
  yolk: '#F5B027',
  leaf: '#6FA748',
  leafD: '#4C8636',
  leafL: '#A9CC6C',
  cabbage: '#B5D27F',
  carrot: '#EE862D',
  bread: '#DE9C55',
  crust: '#C47C3B',
  crumb: '#F3D29A',
  potato: '#DCAE6D',
  skin: '#B57A40',
  oat: '#EED6A6',
  meat: '#D85E50',
  steak: '#AE613A',
  fat: '#F6DCCB',
  chicken: '#F3B6A2',
  roast: '#D7893A',
  bone: '#F7EDDD',
  onion: '#D89A55',
  garlic: '#F5EEE3',
  cheese: '#F6C143',
  cheeseL: '#FCDB7C',
  butter: '#F8DB78',
  lemon: '#F7D04A',
  pan: '#4D3D35',
  panIn: '#66544A',
  wood: '#B97A47',
  steel: '#D3CBC2',
  blue: '#86ACCB',
  kraft: '#DDB47D',
  paper: '#F4E8D6',
  pasta: '#F2C565',
  rice: '#FFFDF9',
  bean: '#8E3B2C',
  steam: '#C9B4A2',
  flame: '#F39A2B',
  flameL: '#FBD15B',
}

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** linearno miješanje dvije hex boje */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  const out = x.map((v, i) => Math.round(v + (y[i] - v) * t))
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** sjena = boja pomaknuta prema toploj tamno-smeđoj (nikad siva) */
export const shadeOf = (c: string) => mix(c, '#5C2416', 0.2)

/* ---------- path helperi (sve kao "d" stringovi da S može klipati) ---------- */
const n = (v: number) => +v.toFixed(2)

export const circle = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0Z`

export const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${n(2 * rx)} 0a${rx} ${ry} 0 1 0 ${n(-2 * rx)} 0Z`

export const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${n(x + r)} ${y}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}` +
  `A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${r} ${r} 0 0 1 ${x} ${n(y + h - r)}` +
  `V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${y}Z`

/** jaje: šiljatiji vrh, širi donji dio */
export const egg = (cx: number, t: number, w: number, h: number) => {
  const r = w / 2
  return (
    `M${cx} ${t}C${n(cx + r * 0.85)} ${t} ${n(cx + r)} ${n(t + h * 0.42)} ${n(cx + r)} ${n(t + h * 0.62)}` +
    `C${n(cx + r)} ${n(t + h * 0.86)} ${n(cx + r * 0.56)} ${n(t + h)} ${cx} ${n(t + h)}` +
    `C${n(cx - r * 0.56)} ${n(t + h)} ${n(cx - r)} ${n(t + h * 0.86)} ${n(cx - r)} ${n(t + h * 0.62)}` +
    `C${n(cx - r)} ${n(t + h * 0.42)} ${n(cx - r * 0.85)} ${t} ${cx} ${t}Z`
  )
}

/* ---------- primitivi ---------- */

/** Oblik s ink obrubom i jednim slojem sjene dolje-desno.
 *  children se crtaju unutar oblika (klipano) — za šare, rupe, trake. */
export function S({
  d,
  fill,
  shade,
  off = 3.5,
  line = true,
  children,
}: {
  d: string
  fill: string
  shade?: string
  off?: number
  line?: boolean
  children?: ReactNode
}) {
  const id = 'ka' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <path d={d} fill={shade ?? shadeOf(fill)} />
        <path d={d} fill={fill} transform={`translate(${-off} ${-off})`} />
        {children}
      </g>
      {line && (
        <path d={d} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" />
      )}
    </>
  )
}

/** mali highlight gore-lijevo */
export function Hi({ d, w = 2.5, o = 0.75 }: { d: string; w?: number; o?: number }) {
  return <path d={d} fill="none" stroke="#fff" strokeOpacity={o} strokeWidth={w} strokeLinecap="round" />
}

/** unutarnja linija/detalj */
export function Ln({ d, c = INK, w = DW, o }: { d: string; c?: string; w?: number; o?: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={c}
      strokeWidth={w}
      strokeOpacity={o}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

/** ravna mrlja bez obruba (pjege, rupe, sjemenke) */
export function F({ d, c, o }: { d: string; c: string; o?: number }) {
  return <path d={d} fill={c} fillOpacity={o} />
}

/** para — isti potez svuda (lonac, varivo, krumpir) */
export function Steam({ d }: { d: string }) {
  return <Ln d={d} c={P.steam} w={2.5} />
}

/* ---------- zdjela (zajednička za jela) ---------- */

export const BOWL_RIM = ell(32, 31, 25, 6.5)
const BOWL_BODY = 'M7 31A25 6.5 0 0 0 57 31C57 45 46 54 32 54C18 54 7 45 7 31Z'
/** kupola hrane iznad ruba zdjele; donji dio skriva prednja stijenka */
export const BOWL_DOME = 'M8.5 31C9 20.5 19 14.5 32 14.5C45 14.5 55 20.5 55.5 31L55 39H9Z'

export function BowlFront() {
  return (
    <>
      <S d={rr(22, 49, 20, 7, 3)} fill={P.bowl} off={2} />
      <S d={BOWL_BODY} fill={P.bowl}>
        <Ln d="M7.5 37A25 6.5 0 0 0 56.5 37" c={P.red} w={3.2} />
        <Hi d="M12.5 41C14 44.5 16.5 47.5 19.5 49" />
      </S>
    </>
  )
}
