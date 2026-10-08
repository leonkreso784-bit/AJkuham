import type { CSSProperties, JSX } from 'react'
import * as I from './ingredients'
import * as M from './meals'
import * as U from './ui'

/** sve ilustracije po imenu (kebab-case, ASCII) */
export const ART = {
  // jela
  kajgana: M.Kajgana,
  'zobena-kasa': M.ZobenaKasa,
  tost: M.Tost,
  'pileci-batak': M.PileciBatak,
  varivo: M.Varivo,
  odrezak: M.Odrezak,
  spageti: M.Spageti,
  salata: M.Salata,
  'peceni-krumpir': M.PeceniKrumpir,
  'riza-zdjela': M.RizaZdjela,
  wok: M.Wok,
  tanjur: M.Tanjur,
  // namirnice / kategorije
  jaja: I.Jaja,
  mlijeko: I.Mlijeko,
  sir: I.Sir,
  jogurt: I.Jogurt,
  maslac: I.Maslac,
  rajcica: I.Rajcica,
  luk: I.Luk,
  cesnjak: I.Cesnjak,
  paprika: I.Paprika,
  spinat: I.Spinat,
  mrkva: I.Mrkva,
  kupus: I.Kupus,
  tikvica: I.Tikvica,
  krumpir: I.Krumpir,
  limun: I.Limun,
  riza: I.Riza,
  tjestenina: I.Tjestenina,
  grah: I.Grah,
  meso: I.Meso,
  piletina: I.Piletina,
  kruh: I.Kruh,
  vrecica: I.Vrecica,
  // UI
  kamera: U.Kamera,
  frizider: U.Frizider,
  kalendar: U.Kalendar,
  kosarica: U.Kosarica,
  pecnica: U.Pecnica,
  stednjak: U.Stednjak,
  kuhar: U.Kuhar,
  dostava: U.Dostava,
  lonac: U.Lonac,
} as const

export type ArtName = keyof typeof ART

export const MEAL_ARTS = [
  'kajgana', 'zobena-kasa', 'tost', 'pileci-batak', 'varivo', 'odrezak',
  'spageti', 'salata', 'peceni-krumpir', 'riza-zdjela', 'wok', 'tanjur',
] as const satisfies readonly ArtName[]

export const INGREDIENT_ARTS = [
  'jaja', 'mlijeko', 'sir', 'jogurt', 'maslac', 'rajcica', 'luk', 'cesnjak', 'paprika',
  'spinat', 'mrkva', 'kupus', 'tikvica', 'krumpir', 'limun', 'riza', 'tjestenina', 'grah',
  'meso', 'piletina', 'kruh', 'vrecica',
] as const satisfies readonly ArtName[]

export const UI_ARTS = [
  'kamera', 'frizider', 'kalendar', 'kosarica', 'pecnica', 'stednjak', 'kuhar', 'dostava', 'lonac',
] as const satisfies readonly ArtName[]

/** Inline SVG ilustracija. Veličina ide kroz className (npr. "size-12").
 *  Bez `title` je dekorativna (aria-hidden). */
export function Art({
  name,
  className,
  title,
  style,
}: {
  name: ArtName
  className?: string
  title?: string
  style?: CSSProperties
}): JSX.Element {
  const Body = ART[name] ?? ART.vrecica
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <Body />
    </svg>
  )
}
