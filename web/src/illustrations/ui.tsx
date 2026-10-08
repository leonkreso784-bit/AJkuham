/* UI spot ilustracije (kamera, frižider, prazno stanje…). 64×64, isti stil. */
import { F, Hi, Ln, P, S, Steam, circle, rr } from './kit'

export function Kamera() {
  return (
    <>
      <S d={rr(10, 14, 10, 7, 2.5)} fill={P.ink} off={1} />
      <S d="M22 20L25.5 13.5C26 12.6 27 12 28 12H36C37 12 38 12.6 38.5 13.5L42 20Z" fill={P.redD} off={1.5} />
      <S d={rr(6, 18, 52, 36, 9)} fill={P.red}>
        <Hi d="M10.5 30C10.5 25.5 12.5 22.8 16 22.5" w={3} o={0.55} />
      </S>
      <S d={circle(32, 36, 13)} fill={P.cream} off={2.5} />
      <S d={circle(32, 36, 7.8)} fill={P.pan} off={2}>
        <F d={circle(29.5, 33.5, 2.2)} c="#fff" o={0.75} />
      </S>
      <S d={rr(46, 23, 7, 4.5, 2.25)} fill={P.flameL} off={1} />
    </>
  )
}

/** otvoreni frižider */
export function Frizider() {
  return (
    <>
      <S d="M43 9L54.5 13C55.4 13.3 56 14.2 56 15.2V50.8C56 51.8 55.4 52.7 54.5 53L43 57Z" fill={P.white} off={2}>
        <Ln d="M45.5 26L53.5 27.5M45.5 40L53.5 40.5" c="#E2D0BA" w={1.8} />
        <F d={rr(47, 19, 3.6, 7.5, 1.2)} c={P.blue} />
        <F d={rr(47, 33, 3.6, 7, 1.2)} c={P.leafL} />
      </S>
      <S d={rr(9, 6, 34, 52, 5)} fill={P.white}>
        <F d={rr(13, 10, 26, 44, 3)} c="#F3E7D7" />
        <Ln d="M13 24H39M13 37H39" c="#DCC7AE" w={2} />
        <Hi d="M12.5 13V20" o={0.9} />
      </S>
      <S d={rr(16, 13.5, 5, 9.5, 2)} fill={P.blue} off={1} />
      <S d={circle(27, 19.5, 3.6)} fill={P.tomato} off={1.2} />
      <S d={circle(34.5, 20.5, 2.6)} fill={P.yolk} off={1} />
      <S d="M16 35.5L24 29V35.5Z" fill={P.cheese} off={1} />
      <S d={rr(27, 29.5, 9, 6, 2)} fill={P.leaf} off={1} />
      <S d={rr(15, 42, 22, 10, 2.5)} fill="#D9E8BE" off={1.5}>
        <Ln d="M22 46.5H30" c={P.leafD} w={1.8} />
      </S>
    </>
  )
}

export function Kalendar() {
  return (
    <>
      <S d={rr(9, 13, 46, 44, 7)} fill={P.white}>
        <path d="M8 12H56V27H8Z" fill={P.red} />
        <Hi d="M13.5 18.5C14 17 15 16.3 16.5 16" o={0.5} />
      </S>
      <F d={rr(16, 32, 8, 7, 2)} c="#EBDCC7" />
      <F d={rr(28, 32, 8, 7, 2)} c="#EBDCC7" />
      <F d={rr(40, 32, 8, 7, 2)} c="#EBDCC7" />
      <F d={rr(16, 43, 8, 7, 2)} c="#EBDCC7" />
      <S d={rr(28, 43, 8, 7, 2)} fill={P.red} off={1} />
      <F d={rr(40, 43, 8, 7, 2)} c="#EBDCC7" />
      <S d={rr(19, 7, 5.5, 12, 2.75)} fill={P.pan} off={1.2} />
      <S d={rr(39.5, 7, 5.5, 12, 2.75)} fill={P.pan} off={1.2} />
    </>
  )
}

export function Kosarica() {
  return (
    <>
      <Ln d="M16 31C16 13 48 13 48 31" c={P.ink} w={8.5} />
      <Ln d="M16 31C16 13 48 13 48 31" c={P.redD} w={3.5} />
      <S d="M21 30L28 11C28.7 9.2 31.5 9.6 31.5 11.6L28.5 30Z" fill={P.bread} off={1.4}>
        <Ln d="M27 17L30 18M25.5 22L28.5 23" c={P.crumb} w={1.6} />
      </S>
      <S d="M33 30C32 23 35.5 18 41 16.5C42 22.5 39.5 27.5 36 30Z" fill={P.leaf} off={1.4} />
      <S d={circle(44.5, 28, 5)} fill={P.tomato} off={1.6} />
      <S d="M9 31H55L50.5 52.5C50.1 54.5 48.5 56 46.5 56H17.5C15.5 56 13.9 54.5 13.5 52.5Z" fill={P.red}>
        <Ln d="M22.5 37L24 50M32 37V50M41.5 37L40 50" c={P.redD} w={3} />
        <Hi d="M15 38L16.5 46" o={0.5} />
      </S>
      <S d={rr(6, 27, 52, 7, 3.5)} fill={P.redD} off={1.5}>
        <Hi d="M10 29.5H18" w={2} o={0.45} />
      </S>
    </>
  )
}

export function Pecnica() {
  return (
    <>
      <S d={rr(8, 7, 48, 50, 7)} fill={P.white}>
        <path d="M7 6H57V19H7Z" fill="#F1E3CF" />
        <Ln d="M8 19H56" c="#DCC7AE" w={2} />
        <Hi d="M12 25V33" />
      </S>
      <S d={circle(17, 13, 2.8)} fill={P.pan} off={1} />
      <S d={circle(25, 13, 2.8)} fill={P.pan} off={1} />
      <S d={rr(37, 11, 14, 4.5, 2.25)} fill={P.red} off={1} />
      <S d={rr(14, 26, 36, 25, 5)} fill={P.pan} off={2}>
        <F d={rr(17.5, 29.5, 29, 18, 3)} c="#F0A043" />
        <F d={rr(17.5, 40, 29, 7.5, 2)} c="#E28530" />
      </S>
      <S d="M22.5 41C22.5 35.5 26.8 32.5 32 32.5C37.2 32.5 41.5 35.5 41.5 41Z" fill="#B86A34" off={1.6} />
      <F d={rr(19, 41, 26, 2.5, 1.25)} c={P.pan} />
      <S d={rr(18, 22, 28, 3, 1.5)} fill={P.steel} off={1} />
    </>
  )
}

/** tava na plameniku */
export function Stednjak() {
  return (
    <>
      <Steam d="M22 21C19.5 17.5 24.5 15 22 11" />
      <Steam d="M31 20C28.5 16.5 33.5 14 31 10" />
      <S d="M41 31.5L57 26.8C58.6 26.3 60.2 27.4 60.3 29C60.4 30.2 59.6 31.3 58.5 31.6L42.5 36.5Z" fill={P.wood} off={1.5} />
      <S d="M5.5 28H46L43 38.5C42.5 40.4 40.8 41.5 38.9 41.5H12.6C10.7 41.5 9 40.4 8.5 38.5Z" fill={P.pan}>
        <Hi d="M10 31.5H18" o={0.35} />
      </S>
      <S d="M18 54C14.5 54 13 51.5 14 48.5C15 45.5 17.5 44.5 18 41.5C20.5 44 22 46 22 49C22 52 20.5 54 18 54Z" fill={P.flame} off={1.2}>
        <F d="M18 53C16.6 53 16 51.8 16.5 50.5C17 49.3 17.8 48.8 18 47.5C19.3 48.6 20 49.6 20 50.8C20 52 19.2 53 18 53Z" c={P.flameL} />
      </S>
      <S d="M26 54C22.5 54 21 51.5 22 48.5C23 45.5 25.5 44.5 26 41.5C28.5 44 30 46 30 49C30 52 28.5 54 26 54Z" fill={P.flame} off={1.2}>
        <F d="M26 53C24.6 53 24 51.8 24.5 50.5C25 49.3 25.8 48.8 26 47.5C27.3 48.6 28 49.6 28 50.8C28 52 27.2 53 26 53Z" c={P.flameL} />
      </S>
      <S d="M34 54C30.5 54 29 51.5 30 48.5C31 45.5 33.5 44.5 34 41.5C36.5 44 38 46 38 49C38 52 36.5 54 34 54Z" fill={P.flame} off={1.2}>
        <F d="M34 53C32.6 53 32 51.8 32.5 50.5C33 49.3 33.8 48.8 34 47.5C35.3 48.6 36 49.6 36 50.8C36 52 35.2 53 34 53Z" c={P.flameL} />
      </S>
      <S d={rr(8, 54, 36, 5, 2.5)} fill={P.steel} off={1.2} />
    </>
  )
}

/** kuharska kapa (ti / profil) */
export function Kuhar() {
  return (
    <>
      <S d="M19 37C10.5 37 8 27.5 13.5 22.5C13 14 21.5 9.5 27.5 12.5C30 7 38.5 6.5 42 12C48.5 9 56.5 14.5 54 22.5C59 27 56.5 37 48 37Z" fill={P.white}>
        <Ln d="M22 26C22 22 24 19.5 27 18.5M42 26C42 22 40.5 19.8 38 18.8" c="#E6D5BF" />
        <Hi d="M15.5 25C15.5 21 17.5 18 21 16.5" w={3} />
      </S>
      <S d="M18.5 35H45.5L44.5 51.5C44.4 53.5 43 55 41 55H23C21 55 19.6 53.5 19.5 51.5Z" fill={P.white}>
        <Ln d="M26 39V51M32 39V51M38 39V51" c="#E6D5BF" />
      </S>
      <S d={rr(17, 33, 30, 6, 3)} fill={P.red} off={1.5} />
    </>
  )
}

/** dostava — skuter s kutijom */
export function Dostava() {
  return (
    <>
      <Ln d="M3 30H9M2 36H8M4 42H9" c={P.steam} w={2.5} />
      <S d={rr(10, 17, 21, 17.5, 3)} fill={P.red}>
        <path d="M9 23.5H32V27.5H9Z" fill={P.cream} />
        <Hi d="M13.5 20.5H18" w={2} o={0.5} />
      </S>
      <S d="M45 46L41 22H45.5L49.5 45Z" fill={P.pan} off={1.2} />
      <S d={rr(38.5, 18, 12, 4.5, 2.25)} fill={P.pan} off={1} />
      <S d="M9 45C9 37.5 14 34 21 34H38C39.8 34 41.2 35.2 41.6 37L43.5 45.5Z" fill={P.cream}>
        <Hi d="M13 40C14 38 16 36.8 18.5 36.5" />
      </S>
      <S d={circle(48.5, 27, 3)} fill={P.flameL} off={1} />
      <S d={circle(17, 48, 7.5)} fill={P.pan} off={2}>
        <F d={circle(17, 48, 3)} c={P.steel} />
      </S>
      <S d={circle(49, 48, 7.5)} fill={P.pan} off={2}>
        <F d={circle(49, 48, 3)} c={P.steel} />
      </S>
    </>
  )
}

/** prazno stanje — lonac s parom (eho loga) */
export function Lonac() {
  return (
    <>
      <Steam d="M47 14C43 10.5 49 7 45.5 3.5" />
      <S d="M7.5 37.5C3.5 37.5 3.5 31 7.5 31H12V37.5Z" fill={P.red} off={1.5} />
      <S d="M56.5 37.5C60.5 37.5 60.5 31 56.5 31H52V37.5Z" fill={P.red} off={1.5} />
      <S d="M11.5 31H52.5L51.3 47C50.8 52.5 46.5 56.5 40.5 56.5H23.5C17.5 56.5 13.2 52.5 12.7 47Z" fill={P.red}>
        <Hi d="M16.5 37.5V45" w={3} o={0.5} />
      </S>
      <S d={rr(8.5, 27, 47, 7, 3.5)} fill={P.redD} off={1.5} />
      <S d="M10.5 24.5C11 19 22 13 33 11.5C43 10 51.5 11 52.5 14C53 15.5 51 17 45 18.6C36 21 22 24.5 15 25.5C12 26 10.4 25.6 10.5 24.5Z" fill={P.cream} off={2} />
      <S d="M26 14L24.3 9.5C23.8 8 25 6.8 27 6.4C29.5 5.9 32 6.2 32.4 7.6C32.7 8.6 31.8 9.4 30.5 10L31 12.6Z" fill={P.cream} off={1.2} />
    </>
  )
}
