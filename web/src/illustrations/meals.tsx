/* Jela — za kartice obroka. Sva su 64×64, isti obrub i sjena (vidi kit.tsx). */
import { BOWL_DOME, BOWL_RIM, BowlFront, F, Hi, Ln, P, S, Steam, circle, ell, rr } from './kit'

/** kajgana u tavi (kajgana, omlet, šakšuka…) */
export function Kajgana() {
  return (
    <>
      <S d="M39.5 42.5L43.5 38.5L58.5 53.5C59.6 54.6 59.6 56.4 58.5 57.5L57.5 58.5C56.4 59.6 54.6 59.6 53.5 58.5Z" fill={P.wood} off={2} />
      <S d={ell(27, 30, 21, 20)} fill={P.pan}>
        <F d={ell(27, 30, 16.5, 15.5)} c={P.panIn} />
        <Hi d="M11 24C12.5 18.5 16.5 14 22 12" o={0.35} />
      </S>
      <S d="M13.5 31C11.5 26 15.5 21.5 19.5 22.5C20.5 17.5 26.5 15.5 29.5 18.5C32.5 14.5 39.5 15.5 40.5 20.5C44.5 20.5 46.5 25.5 43.5 28.5C46.5 32.5 42.5 38.5 38.5 36.5C36.5 41 30 41.5 28 38.5C24 41.5 17.5 39.5 17.5 35.5C14.5 36 12.5 34 13.5 31Z" fill="#F8C944" off={2.5}>
        <Ln d="M20 29C22 26 25 25.5 27 27M31 24C33 22 36 22 37.5 24M30 33C32 31.5 35 31.5 36.5 33.5" c="#FBE08A" w={2.2} />
        <Hi d="M17 27C17.5 25.5 18.5 24.6 20 24.4" w={2} />
      </S>
      <F d={rr(22, 31.5, 3.2, 1.6, 0.8)} c={P.leafD} />
      <F d={rr(33, 27.5, 3.2, 1.6, 0.8)} c={P.leafD} />
      <F d={rr(26.5, 21.5, 3, 1.6, 0.8)} c={P.leafD} />
      <F d={rr(39, 32, 3, 1.6, 0.8)} c={P.leafD} />
    </>
  )
}

/** zobena kaša s bananom i bobicama */
export function ZobenaKasa() {
  return (
    <>
      <S d={BOWL_DOME} fill={P.oat} off={3}>
        <F d={ell(16, 27, 2, 1.2)} c="#F8E9C9" />
        <F d={ell(45, 25, 2, 1.2)} c="#F8E9C9" />
        <F d={ell(28, 17.5, 1.8, 1)} c="#D9B97F" />
        <F d={ell(48, 29, 1.6, 1)} c="#D9B97F" />
        <F d={ell(12.5, 30.5, 1.6, 1)} c="#D9B97F" />
        <Hi d="M14 24C16 20 20 17.5 25 16.5" />
      </S>
      <S d={circle(22, 25, 5.5)} fill="#FBEDB8" off={1.6} line={false}>
        <Ln d={circle(22, 25, 3.6)} c="#EED48A" w={1.4} />
        <F d={circle(22, 25, 1)} c="#C9A35E" />
      </S>
      <S d={circle(33.5, 20.5, 5.5)} fill="#FBEDB8" off={1.6} line={false}>
        <Ln d={circle(33.5, 20.5, 3.6)} c="#EED48A" w={1.4} />
        <F d={circle(33.5, 20.5, 1)} c="#C9A35E" />
      </S>
      <S d={circle(43, 25.5, 4)} fill="#C8364A" off={1.5} line={false}>
        <F d={circle(41.8, 24.3, 1.1)} c="#fff" o={0.6} />
      </S>
      <S d={circle(31.5, 29.5, 3.6)} fill="#C8364A" off={1.5} line={false}>
        <F d={circle(30.4, 28.4, 1)} c="#fff" o={0.6} />
      </S>
      <S d={circle(14.5, 29.5, 3.2)} fill="#5C557F" off={1.4} line={false}>
        <F d={circle(13.5, 28.5, 0.9)} c="#fff" o={0.5} />
      </S>
      <BowlFront />
    </>
  )
}

/** tost s maslacem (tost, sendvič, wrap…) */
export function Tost() {
  const slice =
    'M15 54C13.3 54 12 52.7 12 51V31.5C7 29.5 5.3 24.3 7.2 19.5C10 12.5 20 9 32 9C44 9 54 12.5 56.8 19.5C58.7 24.3 57 29.5 52 31.5V51C52 52.7 50.7 54 49 54Z'
  const crumb =
    'M19.5 49.5C18.4 49.5 17.5 48.6 17.5 47.5V28.3C13.3 27.4 11.8 24 13 21.2C15 16.6 22.5 14 32 14C41.5 14 49 16.6 51 21.2C52.2 24 50.7 27.4 46.5 28.3V47.5C46.5 48.6 45.6 49.5 44.5 49.5Z'
  return (
    <>
      <S d={slice} fill={P.crust}>
        <F d={crumb} c={P.crumb} />
        <F d={circle(23, 40, 1.1)} c="#DDB06C" />
        <F d={circle(40, 43, 1)} c="#DDB06C" />
        <F d={circle(36, 20, 1)} c="#DDB06C" />
        <F d={circle(22, 21, 0.9)} c="#DDB06C" />
        <Hi d="M10 22C12 16.5 18 13 25 12" />
      </S>
      <S d="M24 27.5C24 26 25.3 24.8 26.8 24.8H38.2C39.7 24.8 41 26 41 27.5V34.6C41 36.1 39.7 37.3 38.2 37.3H35.5C35 39.5 33.6 40.5 32.3 40C31.4 39.6 31 38.6 31 37.3H26.8C25.3 37.3 24 36.1 24 34.6Z" fill={P.butter} off={2}>
        <Hi d="M27 28.5H31.5" w={2} />
      </S>
    </>
  )
}

/** pečeni batak (piletina) */
export function PileciBatak() {
  return (
    <>
      <S d="M31 41L37 36L47 46C49.2 43.8 53 44.3 54.6 46.8C56 49.2 54.8 51.9 52.6 52.6C53.1 54.8 51.6 57.2 49 57.2C46.1 57.2 44.4 54.1 46 51.6Z" fill={P.bone} off={2} />
      <S d="M10 28C9 17 19 9 29 10C40 11 47 19 45 29C44 34 41 37 37.5 39.5L33 43C29 46 24 46.2 19 44C13 41.5 10.5 35 10 28Z" fill={P.roast}>
        <F d={ell(32, 20, 3, 2)} c="#BF6F27" />
        <F d={ell(22, 34, 2.4, 1.6)} c="#BF6F27" />
        <F d={ell(37, 31, 1.8, 1.3)} c="#BF6F27" />
        <F d={circle(26, 26, 0.9)} c={P.leafD} />
        <F d={circle(35, 24, 0.9)} c={P.leafD} />
        <F d={circle(19, 27, 0.8)} c={P.leafD} />
        <Hi d="M14 22C15.5 17 20 13.5 25.5 13" />
      </S>
    </>
  )
}

/** varivo / juha u zdjeli, s parom */
export function Varivo() {
  return (
    <>
      <Steam d="M23 21C20 17.5 26 15 23 10.5" />
      <Steam d="M32 19C29 15 35 12 32 6.5" />
      <Steam d="M41 21C38 17.5 44 15 41 10.5" />
      <S d={BOWL_RIM} fill={P.bowlIn} off={0} />
      <S d={ell(32, 32, 21.5, 4.6)} fill="#D9733A" off={0} line={false}>
        <F d={ell(32, 33.5, 21.5, 3.5)} c="#C2612E" />
      </S>
      <S d={ell(22, 31.3, 3.4, 2)} fill={P.carrot} off={1} line={false} />
      <S d={ell(39.5, 30.3, 3.4, 2)} fill={P.carrot} off={1} line={false} />
      <S d={rr(28.5, 30.6, 5.5, 3.6, 1)} fill="#F6DC9C" off={1} line={false} />
      <F d={ell(17, 33, 1.3, 0.8)} c={P.leafD} />
      <F d={ell(45, 33, 1.3, 0.8)} c={P.leafD} />
      <F d={ell(34.5, 28.8, 1.2, 0.7)} c={P.leafD} />
      <BowlFront />
    </>
  )
}

/** odrezak s grill linijama i ružmarinom */
export function Odrezak() {
  const steak =
    'M9 33C8 22 18 14 30 14.5C42 15 54 19.5 55.5 30.5C56.8 41 48 49.5 36 49.5C28 49.5 25 45 19 44.5C13 44 9.4 39 9 33Z'
  return (
    <>
      <S d={steak} fill={P.steak}>
        <Ln d="M9 33C8 22 18 14 30 14.5C42 15 54 19.5 55.5 30.5" c={P.fat} w={8} />
        <Ln d="M21 38L32 24" c="#6F351D" w={3} />
        <Ln d="M29 42L41 26" c="#6F351D" w={3} />
        <Ln d="M38 44L49 29" c="#6F351D" w={3} />
        <Hi d="M12 25C14 21 17.5 18.5 22 17.3" />
      </S>
      <Ln d="M36 25L56 11" c={P.leafD} w={2.4} />
      <Ln d="M40 22.2L38 17.8M44.5 19L42.8 14.6M49 15.9L47.6 11.6M53 13.1L52 9.2M42 20.8L44.4 25M46.5 17.6L48.9 21.8M51 14.5L53.2 18.4" c={P.leaf} w={2.4} />
    </>
  )
}

/** tjestenina u zdjeli s umakom i bosiljkom */
export function Spageti() {
  return (
    <>
      <S d={BOWL_DOME} fill={P.pasta} off={3}>
        <Ln d="M12 30C14 22 22 22 24 28" c="#D9A13E" />
        <Ln d="M20 21C24 17 30 18 30 23" c="#D9A13E" />
        <Ln d="M36 19C40 17 46 19 46 24" c="#D9A13E" />
        <Ln d="M40 31C42 26 50 25 52 31" c="#D9A13E" />
        <Ln d="M26 32C28 28 34 28 36 32" c="#D9A13E" />
        <Ln d="M14 33C17 28 22 29 22 34M45 21C49 20 53 24 52 28M30 21C32 19 35 19.5 36 22" c="#D9A13E" />
        <Hi d="M13.5 24C15.5 20 19.5 17.5 24 16.5" />
      </S>
      <S d="M23 22.5C22.5 18.5 27 16 32 16.3C37.5 16.6 41.5 18.5 41 22.5C40.6 26 36.5 27.5 32 27.3C27.2 27.1 23.4 26 23 22.5Z" fill="#D8432F" off={2}>
        <F d={circle(28, 20, 1.2)} c="#fff" o={0.55} />
      </S>
      <S d="M33 21C34.5 16.5 38.5 14.3 43 14.8C42 19 38 21.6 33 21Z" fill={P.leaf} off={1.2} />
      <BowlFront />
    </>
  )
}

/** zelena salata u zdjeli */
export function Salata() {
  return (
    <>
      <S d="M8.5 32C7 26.5 10 21.5 15 21.5C15 15.5 22 12.5 26 15.5C28 10.5 36 10.5 38 14.5C42 11.5 49.5 14.5 48.5 21C53.5 21 57 26 55.5 32L55 39H9Z" fill={P.leaf}>
        <Ln d="M17 30L20 24M45 28L42 22.5M31 22L31 16" c={P.leafD} />
        <Hi d="M12 25C13 23 14.5 22 16.5 21.8" />
      </S>
      <S d="M22 31C20.5 25 23.5 19.5 28.5 18C30.5 23 28 28.5 22 31Z" fill={P.leafL} off={1.5} />
      <S d={circle(36.5, 25.5, 5)} fill={P.leafD} off={1.5}>
        <F d={circle(36.5, 25.5, 3.4)} c="#DCEBB6" />
        <F d={circle(36.5, 25.5, 0.8)} c={P.leafL} />
      </S>
      <S d={circle(16, 28.5, 4.4)} fill={P.tomato} off={1.6}>
        <F d={circle(16, 28.5, 2.6)} c="#F28A6E" />
        <F d={circle(15, 28, 0.6)} c="#FCE3A8" />
        <F d={circle(17, 29.3, 0.6)} c="#FCE3A8" />
      </S>
      <S d={circle(46.5, 28, 4.4)} fill={P.tomato} off={1.6}>
        <F d={circle(46.5, 28, 2.6)} c="#F28A6E" />
        <F d={circle(45.6, 27.4, 0.6)} c="#FCE3A8" />
        <F d={circle(47.4, 28.7, 0.6)} c="#FCE3A8" />
      </S>
      <BowlFront />
    </>
  )
}

/** pečeni krumpirići (kriške s korom) i ružmarin */
export function PeceniKrumpir() {
  const flesh = '#F4C452'
  const roastSpot = '#DE9A34'
  return (
    <>
      <Steam d="M27 15C24.5 11.5 29.5 9.5 27 5.5" />
      <Steam d="M37 14C34.5 10.5 39.5 8.5 37 4.5" />
      <S d="M7 28L37 19C40.5 29.5 21 39 7 28Z" fill={flesh}>
        <Ln d="M37 19C40.5 29.5 21 39 7 28" c={P.skin} w={5} />
        <F d={ell(20, 26, 2, 1.2)} c={roastSpot} />
        <Hi d="M11 27.5L19 25" w={2} />
      </S>
      <S d="M29 23L58 29C53 40.5 32 37 29 23Z" fill={flesh}>
        <Ln d="M58 29C53 40.5 32 37 29 23" c={P.skin} w={5} />
        <F d={ell(45, 28.5, 2, 1.2)} c={roastSpot} />
      </S>
      <S d="M8 38L54 36C50 52.5 15 54 8 38Z" fill={flesh}>
        <Ln d="M54 36C50 52.5 15 54 8 38" c={P.skin} w={5} />
        <F d={ell(23, 41, 2.2, 1.3)} c={roastSpot} />
        <F d={ell(40, 40.5, 1.8, 1.1)} c={roastSpot} />
        <Hi d="M13 39.5L22 39.1" />
      </S>
      <Ln d="M33 40L50 32" c={P.leafD} w={2.2} />
      <Ln d="M36 38.6L34.6 35.4M40 36.7L38.6 33.5M44 34.8L42.8 31.7M38 37.6L39.6 40.8M42 35.7L43.6 38.9M46 33.9L47.6 37" c={P.leaf} w={2.2} />
      <F d={circle(28, 42, 0.9)} c={P.white} />
      <F d={circle(16, 41, 0.8)} c={P.white} />
      <F d={circle(33, 25, 0.8)} c={P.white} />
    </>
  )
}

/** zdjela riže sa štapićima */
export function RizaZdjela() {
  return (
    <>
      <S d="M35 24L55 5.5C55.7 4.8 56.8 4.8 57.5 5.5C58.2 6.2 58.2 7.3 57.5 8L38 27Z" fill={P.wood} off={1.2} />
      <S d="M39 26.5L59 12C59.8 11.4 60.9 11.6 61.4 12.4C61.9 13.2 61.7 14.3 60.9 14.8L41 29.5Z" fill={P.wood} off={1.2} />
      <S d={BOWL_DOME} fill={P.rice} off={3}>
        <Ln d="M15 27L17 26M22 21L24 20.6M30 18L32 18.2M38 21L40 21.6M46 26L47.6 27.2M27 26L29 25.6M36 28L38 28.4M19 31L21 30.5M43 32L45 32.4" c="#DCCBB2" w={1.8} />
        <Hi d="M13.5 24C15.5 20 19.5 17.5 24 16.5" />
      </S>
      <S d={circle(34, 21.5, 3)} fill={P.leaf} off={1} line={false}>
        <F d={circle(34, 21.5, 1.4)} c={P.leafL} />
      </S>
      <S d={circle(27, 24.5, 2.7)} fill={P.leaf} off={1} line={false}>
        <F d={circle(27, 24.5, 1.2)} c={P.leafL} />
      </S>
      <S d={circle(40, 25.5, 2.4)} fill={P.leaf} off={1} line={false}>
        <F d={circle(40, 25.5, 1.1)} c={P.leafL} />
      </S>
      <BowlFront />
    </>
  )
}

/** wok s povrćem */
export function Wok() {
  return (
    <>
      <S d={circle(41, 10.5, 3.4)} fill={P.carrot} off={1} line={false} />
      <S d="M17 14C19 10.5 23.5 9.3 27 10.8L26 13.6C23.8 12.7 21.2 13.2 19.8 15.3Z" fill={P.pepper} off={0.8} line={false} />
      <Ln d="M31 9C32.5 7 34.5 6.5 36.5 7" c={P.steam} w={2.2} />
      <S d="M49 34.5L58.5 30.3C60 29.7 61.6 30.6 61.8 32.1C62 33.3 61.3 34.4 60.2 34.8L50.5 38.8Z" fill={P.wood} off={1.5} />
      <S d={ell(29, 31, 23, 6)} fill={P.panIn} off={0} />
      <S d="M9.5 33C9 26 14 20.5 21 20.5C25 16.5 33.5 16.5 36.5 20.5C43 19.5 49.5 24.5 48.5 33L48 39H10Z" fill={P.pasta} off={2}>
        <Ln d="M14 30C17 25 22 25 24 29M33 25C36 22 41 22.5 43 26" c="#DDA544" w={1.6} />
      </S>
      <S d="M14 31.5C11.5 31.5 10.5 28.2 12.5 26.5C12 23 15.5 21 18 22.6C19.5 19.5 24 19.6 25 22.8C28 22.8 29 26.6 26.6 28.2L25.8 31.5Z" fill={P.leaf} off={1.5} line={false}>
        <F d={circle(16, 25.5, 1.2)} c={P.leafL} />
        <F d={circle(21.5, 23.5, 1.2)} c={P.leafL} />
      </S>
      <S d="M28 30C29 23.5 34.5 20.5 41.5 21.5L41.1 25.2C36 24.7 32.6 26.7 31.7 30.6Z" fill={P.pepper} off={1.2} line={false} />
      <S d="M34 32C35.7 28 39.7 26.2 44.5 27L44 30.3C40.7 29.8 38.3 30.9 37.3 33Z" fill="#F2B33D" off={1.2} line={false} />
      <S d={ell(45, 31.3, 3.8, 2.6)} fill={P.carrot} off={1} line={false} />
      <S d={ell(21, 31.4, 3.6, 2.4)} fill={P.carrot} off={1} line={false} />
      <S d="M6 31A23 6 0 0 0 52 31C51.3 42.5 42 50.5 29 50.5C16 50.5 6.7 42.5 6 31Z" fill={P.pan}>
        <Hi d="M10.5 38C12 42 15 45 19 47" o={0.35} />
      </S>
    </>
  )
}

/** prazan tanjur s priborom — fallback za jela */
export function Tanjur() {
  return (
    <>
      <S d={circle(33, 32, 19)} fill={P.bowl} off={3}>
        <Ln d={circle(33, 32, 13.5)} c="#E9D7BF" w={2} />
        <Ln d={circle(33, 32, 16.3)} c={P.red} w={1.4} />
        <Hi d="M18 26C19.5 21.5 23 18 27.5 16.5" />
      </S>
      <S d="M3.5 9.5V19C3.5 22 4.8 23.6 6 24V51.5C6 52.9 6.8 54 7.8 54C8.8 54 9.6 52.9 9.6 51.5V24C10.8 23.6 12.1 22 12.1 19V9.5Z" fill={P.steel} off={1.5}>
        <Ln d="M6.4 9V17.5M9.2 9V17.5" c={P.ink} w={1.6} />
      </S>
      <S d="M55 9.5C59.5 11.5 60.7 19.5 60.2 28.5L59.8 30.5V51.5C59.8 52.9 59 54 57.9 54C56.8 54 56 52.9 56 51.5V30.5H55Z" fill={P.steel} off={1.5} />
    </>
  )
}
