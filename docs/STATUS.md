# KuhAI — Stanje i handoff

Zadnje ažurirano: **2026-10-08, ~12:40**, sredina hackathona.
Backend je **gotov, deployan i testiran od kraja do kraja.**

---

## TL;DR

| | |
|---|---|
| Live API | **https://kuhai-api-production.up.railway.app** (`/health` → `{"ok":true}`) |
| Rute | svih 13 iz `docs/API.md`, pozvane uživo na produkciji |
| `npm run typecheck` | čist |
| Katalog | 249 proizvoda, 53 na akciji, seedano u Railway Postgres |
| Plan generate | **60–90 s** (4 paralelna poziva), frontend mora imati progress |
| Ime | **KuhAI** (preimenovano iz AJkuham 2026-10-08) |

Sve je na `main` i pushano na GitHub (`leonkreso784-bit/AJkuham` — repo ostaje
pod starim imenom).

---

## Što je napravljeno u sesiji gradnje

### Kod
| file | što |
|---|---|
| `src/app.ts` | Hono app, 13 ruta, CORS, greške u obliku iz API.md, sesija iz `x-session-id` |
| `src/server.ts` | lokalni/Railway Node server (`npm run dev`, `npm start`) |
| `api/index.ts` | Vercel ulaz (`hono/vercel`), rezerva ako Railway padne |
| `src/ai/questions.ts` | adaptivna pitanja, statični fallback od 4 pitanja |
| `src/ai/vision.ts` | fotka → namirnice, `urgency` izvodi kod, nikad ne baca |
| `src/ai/planner.ts` | tjedan u **4 paralelna dijela** (pon-uto, sri-čet, pet-sub, ned) sa sidrima; fallback dan-po-dan → statični obroci; swap/shake |
| `src/engine/units.ts` | pretvorbe jedinica, gustoće, mase komada |
| `src/engine/packaging.ts` | sastojak → pakiranja, `neededAmount` / `leftoverAmount` |
| `src/engine/matcher.ts` | fuse.js nad keywords, `exact`/`fuzzy`/`generic`, nikad prazna košarica |
| `src/engine/cart.ts` | agregacija, odbijanje pantry-ja, `savedFromWasteEur`, `withinBudget`, `deliveryComparison` |
| `src/engine/__check.ts` | ~60 brzih provjera (`npx tsx src/engine/__check.ts`) |
| `data/konzum-products.json` + `src/db/seed.ts` | katalog i seed |

### Što je provjereno uživo (produkcija)
- `POST /api/questions`: 5 pitanja, točno jedno `text`, pitanja ovise o profilu
  (meal prep → termin i posude; alergija orasi → koliko strogo; budžet → ponavljanje)
- `POST /api/plan/generate` s budžetom 35 €: špinat i jogurt (umire) potrošeni u
  pon/uto, oba u `rescue.savedItems`, svaki obrok ima konkretan `why`, 3 prep
  bloka s `timeline` gdje je traka `ti` 25–40 % minuta bloka
- 60 € vs 35 € daje **vidljivo drukčiji tjedan**: 8 mesnih obroka s pilećim
  prsima vs 4 mesna s batkom, jaja i riža
- `GET /cart`: realna pakiranja (1 kg riže, ne 10 l ulja), `withinBudget: false`
  kad ne stane, `deliveryComparison` s `assumption`
- swap i shake vraćaju novi obrok s novim `id`, isti slot

---

## Zamke i odluke iz gradnje

- **Jedan poziv za cijeli tjedan ne radi.** 21 obrok na hrvatskom prelazi
  24k izlaznih tokena i traje 4+ min, pa pukne s "could not parse". Zato
  planer radi 4 paralelna poziva sa sidrima (isti akcijski proizvodi i
  nosači u svakom dijelu, `umire` samo u prvom). `PLANNER_MODE=week` vraća
  stari način ako netko želi eksperimentirati.
- **Budžet se ne poštuje do eura.** Model nema cijene; dobiva razinu štednje
  izvedenu iz €/porciji (kod računa) i grubu orijentaciju cijena. Plan na 35 €
  izađe ~50–60 € jer se kupuju cijela pakiranja. `withinBudget: false` i razlika
  su vidljivi — to je po dizajnu (D13), ne bug.
- **Port 3000 je na Leonovom laptopu zauzet** drugim Next.js procesom. Lokalno
  pokreći s `PORT=3001 npm run dev`.
- **curl na Windowsu šalje cp1250** kad se JSON piše inline s dijakritikom —
  za ručne testove body stavi u UTF-8 datoteku i šalji `-d @file`. Iz browsera
  nema tog problema.
- **Railway**: servis `kuhai-api` u projektu `ajkuham`, `DATABASE_URL` je
  referenca `${{Postgres.DATABASE_URL}}` (interni host), `ANTHROPIC_API_KEY`
  postavljen. Deploy: `railway up --service kuhai-api -d`. Lokalno `.env` i
  dalje ide preko javnog proxyja `maglev.proxy.rlwy.net:36534`.
- **`docs/API.md` nije diran.** Linija "Base URL (prod)" čeka Leonov `api!:`
  commit; URL je zasad u `docs/FRONTEND.md` i README-u.
- Tekst pitanja se čuva u `profiles.qa` pod ključem `q_text:<id>` da planer
  dobije "pitanje: odgovor" bez nove tablice.
- Swap briše stari obrok i ubacuje novi na isto mjesto (`replacedMealId` čuva
  trag), pa `GET /api/plan/:id` odmah pokazuje zamjenu.

---

## Što bi se još dalo (ako ima vremena)

1. Test visiona na pravim fotkama frižidera — prompt i ruta su spremni,
   `curl -F image=@fotka.jpg`, nije još pozvano s pravom slikom
2. Kraći plan: `steps` ograničiti na 4 kratka koraka u promptu → ~40 s
3. `cijene-api` za prave cijene (D20), tek nakon svega ostalog

## Što se ne reže

Vision s rokovima, rescue-first plan, budžet kao ulaz, logika pakiranja,
usporedba s dostavom. Sve to radi.
