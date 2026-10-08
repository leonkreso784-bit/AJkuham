# Swipe kartice: kvačica / X — spec i plan

Zapisano 2026-10-08 ~14:30 po Leonovoj poruci iz sesije. **Nije integrirano ni u
frontend ni u backend.** Ovo je priprema: što se gradi, što treba odlučiti, koliko traje.

## Što Leon želi (njegovim riječima, uređeno)

- Izbor hrane u stilu Tindera, ali **bez obveznog swipea**: dva gumba, **kvačica desno**
  (sviđa mi se) i **X lijevo** (ne). Kartica **animirano odlazi** na desnu ili lijevu stranu.
- Korisnik bira jela koja mu se sviđaju. **Na tome se temelji njegov izbor i što želi
  jesti**, dakle to je signal ukusa za planer, ne samo kozmetika.
- **Okret kartice** (tap) pokazuje poleđinu s **cijelim receptom** (sastojci + koraci).

## Odluke za Leona (dok ne kaže drugačije, radimo po pretpostavci)

| # | pitanje | opcije | pretpostavka |
|---|---|---|---|
| 1 | Gdje u toku? | **A)** nakon frižidera, prije plana: "Što ti se jede ovaj tjedan?", deck kandidata, likes idu planeru. **B)** na gotovom planu: deck od obroka plana, X = swap, kvačica = ostaje. | **A** (jer "na temelju toga se bazira izbor"), **B** je fallback bez promjene API-ja |
| 2 | Odakle kartice? | **A)** nova ruta koja vraća 8–12 kandidata s receptom (AI, ~10–20 s). **B)** obroci već generiranog plana (postoji `GET /api/meal/:id`). | ovisi o 1 |
| 3 | Koliko kartica? | 8 / 10 / 12 | **10** (oko minute) |
| 4 | Mora li sve ocijeniti? | da / ne | **ne**: gumb "Dosta mi je, složi tjedan" u svakom trenutku |
| 5 | Treba li i gesta (drag)? | samo gumbi / gumbi + drag | gumbi obavezno, drag ako stigne (pointer events, bez biblioteke) |

## Frontend (`web/`)

- **Ruta** `/biram` (`src/pages/Swipe.tsx`), u toku između `/frizider` i `/plan`.
  Fridge `save()` navigira na `/biram` umjesto `/plan`; "Preskoči" na Swipe ekranu ide na `/plan`.
- **SwipeDeck**: stog od 3 kartice (gornja + dvije ispod, `scale-95`/`scale-90`, blagi
  offset). Ispod: **X lijevo** (`soft` gumb, okrugli), **kvačica desno** (`brand`, jedini
  crveni CTA na ekranu). Brojač "4 / 10" iznad.
- **Animacija odlaska**: `translateX(±120%) rotate(±12deg)` + fade, 350 ms (gsap već
  postoji u projektu, ili CSS keyframes `swipe-left` / `swipe-right` u `index.css`).
  Sljedeća kartica dolazi na vrh `scale 0.95 → 1`.
- **Flip**: tap na karticu → `rotateY(180deg)` s `perspective`, 500 ms, `backface-visibility: hidden`.
  Poleđina = recept: naslov, minute, porcije, sastojci s ilustracijama (kao u `Meal.tsx`,
  pill "imaš doma / ističe / kupiti"), koraci numerirani. Scroll unutar poleđine.
  Gumbi X / kvačica ostaju ispod i rade i kad je kartica okrenuta.
- **Prednja strana**: fotka (`MealImage`), naslov, "{minute} min", pill "spašava X" ako
  koristi namirnicu koja ističe, jedna rečenica `why`. Mali hint "Tapni za recept".
- **Stanje**: `store.ts` dobiva `taste: { liked: string[]; disliked: string[] }`
  (naslovi jela, jer id-evi kandidata ne moraju završiti u planu). Sprema se u
  `kuhai.state`. Na kraju decka šalje se backendu (Faza 2) ili se samo koristi lokalno (Faza 1).
- **Ilustracije**: dvije nove u `src/illustrations/ui.tsx` u istom stilu: `kvacica`, `iks`.
  Bez emojija (F3).
- **Responzivno**: mobitel kartica `w-full max-w-sm`, visina ~`28rem`; desktop kartica
  `w-[26rem]` centrirana, gumbi sa strane kartice umjesto ispod.
- **Mock**: `mock.ts` dobiva `candidates()` s 10 kartica (iz postojećih mock obroka).
- **Procjena**: 60–90 min uključujući screenshot na 390 i 1440 px.

## Backend

### Faza 1: bez promjene `docs/API.md` (može odmah, nula backend posla)

Varijanta **B**: deck nad gotovim planom.

- Kartice = `plan.days[].meals` (14–21 obrok). Flip = `GET /api/meal/:id` (postoji).
- **X** = `POST /api/meal/:id/swap` s `reason: "ne jede mi se ovo"` (postoji), nova kartica
  zamjenjuje staru u planu (`replaceMeal`). **Kvačica** = ništa, ide dalje.
- Ukus se ne pamti preko sesije, ali plan na kraju jest "ono što je korisnik odobrio".

### Faza 2: nove rute (treba `api!:` commit i Leonovu izričitu potvrdu)

- `POST /api/taste/candidates` → `{ cards: MealDetail[] }`: 8–12 jela po profilu i
  pantryju, **s receptom**. Implementacija: isti `generateSingleMeal` kao swap, paralelno
  u 2–3 poziva po 4 jela, `maxRetries` + fallback na statičnih 10 recepata iz
  `docs/samples`. Trajanje ~10–20 s; frontend pokazuje "Biram ti kandidate…".
  Alternativa za brzinu: pokrenuti generiranje kandidata **dok korisnik slika frižider**
  (frontend zove odmah nakon `PUT /profile`, pa kad dođe na `/biram` kartice su spremne).
- `POST /api/taste` body `{ liked: string[]; disliked: string[] }` → `{ ok: true }`.
  Sprema se u `sessions` (nova kolona `taste jsonb`, `npm run db:push`).
- **Planer** (`src/ai/planner.ts`): u prompt ide blok "Korisnik voli: …; ne voli: …".
  Liked jela imaju prednost da uđu u plan (po mogućnosti doslovno), disliked se izbjegavaju.
  Swap i shake (`src/app.ts`) također izbjegavaju disliked.
- **Zod**: `src/schemas/taste.ts`, tipovi preko `z.infer`. Isti oblik za API i AI output.
- **Procjena**: candidates 45 min (AI poziv + fallback + test), taste 20 min,
  planer 15 min, deploy 5 min. Ukupno ~1,5 h backend + 1,5 h frontend.

## Rizici

- Još jedan AI poziv u toku prije plana (+10–20 s). Ublažava: generiranje kandidata
  paralelno sa slikanjem frižidera, ili statični katalog recepata umjesto AI-ja.
- Rok je **18:48**. Ako Leon potvrdi Fazu 2 do **~15:30**, stiže. Inače Faza 1 (deck nad
  planom) daje isti vizualni efekt na demu bez dodira backenda.
- Frontend flip + animacija odlaska moraju raditi na pravom mobitelu (iOS Safari
  `backface-visibility` i `perspective` na roditelju). Provjeriti na telefonu, ne samo u Playwrightu.

## Redoslijed

1. Leon odgovori na odluke 1 i 2 (ostalo ide po pretpostavci).
2. Frontend: `SwipeDeck` s mock podacima, flip, animacije, 390/1440 screenshot.
3. Backend Faza 2 ako je potvrđena, inače spajanje na plan (Faza 1).
4. Prolaz na telefonu, pa commit i deploy.
