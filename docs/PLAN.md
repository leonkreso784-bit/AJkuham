# AJkuham — Plan izvedbe

Backend: ~5 h. Frontend: drugi dio tima, paralelno, ne blokira nas.

## Načelo

Svaki sat mora završiti nečim što se može **pokazati**. Ako u 3. satu nemamo
rutu koja vraća pravi JSON, kasnije ga nećemo imati vremena napraviti.

Red je namjerno takav da **najrizičnija stvar ide rano** (vision), a najdosadnija
najkasnije (polish). Ako nešto mora pasti, pada polish, ne funkcija.

**Novi smjer ne mijenja raspored.** Budžet-kao-ulaz, rescue-first, akcije,
paralelni timeline, usporedba s dostavom i shake su promjene **prompta i izlazne
sheme**, ne novi moduli. Ako se za nešto od toga otvori nova datoteka u `src/`,
krenuli smo pogrešno. Raspored ostaje 5 sati.

---

## Raspored

### S0 · 0:00–0:30 — Temelj
- `npm init`, TypeScript, Hono, Drizzle, Zod, AI SDK
- Railway projekt + Postgres
- `GET /health` deployan i dostupan na javnom URL-u
- `.env.example` popunjen, `DATABASE_URL` i `ANTHROPIC_API_KEY` provjereni

**Izlaz:** javni URL koji vraća `{"ok":true}`. Bez ovoga ne idemo dalje.

### S1 · 0:30–1:00 — Shema i katalog
- `src/db/schema.ts` — svih 7 tablica iz `DATA-MODEL.md`
- `npm run db:push` prošao
- `data/konzum-products.json` — 200–250 proizvoda s pravim pakiranjima i cijenama
- **`onSale: boolean` na proizvodima** — 15–25 % kataloga na akciji, realno
  raspoređeno po kategorijama (meso, povrće, mliječno), ne random
- `npm run db:seed` prošao

**Izlaz:** `SELECT count(*) FROM products` vraća 200+, i `WHERE on_sale = true`
vraća 30+.

### S2 · 1:00–1:30 — Sesija, profil, pitanja
- `POST /api/session`, `PUT /api/profile`, `GET/PUT /api/pantry`
- `PUT /api/pantry` prima i čuva opcionalni `expiresInDays` po itemu
- `POST /api/questions` + `/answers` (AI, structured output)

**Izlaz:** curl prođe cijeli onboarding do pantry-ja.

### S3 · 1:30–2:30 — Vision s rokovima (najrizičnije, zato rano)
- `POST /api/fridge/scan` — multipart, Claude Sonnet 5.5 s slikom
- Zod shema za `items[]` + `followUpQuestions[]`
- **procjena roka**: model vraća `expiresInDays` iz vizualnog stanja i tipičnog
  roka te vrste hrane. U promptu dobije primjere kalibracije (svježi špinat 1–3
  dana, jaja 10–20, konzerva 300+).
- **`urgency` se NE traži od modela** — izvodi ga kod iz `expiresInDays`:
  `umire` ≤2, `skoro` 3–7, `ok` 8+. Model procjenjuje broj, kod presuđuje
  kategoriju.
- testirano na 3–4 prave fotke frižidera, ne na stock slikama
- fallback: ako model vrati prazno, ruta vraća `items: []` i jasan
  `followUpQuestion`, nikad 500. Ako vrati item bez roka → `urgency: "ok"`.

**Izlaz:** prava fotka tvog frižidera daje listu u kojoj je ono što ti stvarno
umire označeno kao `umire`.

### S4 · 2:30–3:45 — Planer (budžet kao ograničenje)
- `POST /api/plan/generate` — jedan `generateObject` za cijeli tjedan
- u prompt ide: profil + `taste_notes` + **pantry s rokovima i urgency** +
  **lista proizvoda na akciji** + **`budgetEur` kao tvrdo ograničenje** +
  lista kategorija iz kataloga
- **red gradnje u promptu je eksplicitan**: prvo `umire`, pa `skoro`, pa
  `onSale`, pa ostatak. To je nekoliko rečenica prompta, ne algoritam.
- **budžet**: `budgetEur` iz requesta, pa `budgetPerWeekEur` iz profila, pa
  bez ograničenja. Model dobije i približne cijene kategorija da ima od čega
  procjenjivati; `estimatedTotalEur` je njegova procjena, prava cijena dolazi
  iz `cart.ts` u S5.
- izlazna shema dobiva: `budgetEur`, `estimatedTotalEur`, `rescue`
  (`savedItems`, `savedEur`, `message`), `saleDriven`, `why` + `usesExpiring`
  po obroku
- **prep blokovi s `timeline[]`** — trake `pecnica` / `stednjak` / `ti` /
  `mikrovalna` / `air_fryer`, `startMinute` + `durationMinutes`. Jedno polje u
  istoj shemi, ne drugi poziv.
- leftover lanci, preklapanje sastojaka
- `GET /api/plan/:id`, `GET /api/meal/:id`
- fallback: ako jedan poziv timeouta, generiraj dan-po-dan; ako timeline ispadne
  prazan ili nekonzistentan, frontend pada na linearne `steps`

**Izlaz:** dva poziva s `budgetEur: 60` i `budgetEur: 35` daju **vidljivo
drukčiji tjedan**, oba počinju namirnicama koje umiru.

### S5 · 3:45–4:30 — Engine i košarica
- `engine/units.ts` — normalizacija jedinica
- `engine/packaging.ts` — pakiranja i raspodjela ostatka (deterministički)
- `engine/matcher.ts` — `fuse.js` + LLM fallback
- `engine/cart.ts` — agregacija, odbijanje pantry-ja, cijena
  - `savedFromPantryEur` — sve iz pantry-ja, po katalogu
  - **`savedFromWasteEur`** — samo pantry itemi s `urgency: "umire"` koje plan
    stvarno troši (`usesExpiring`), po cijeni iz kataloga. Jedna filtrirana
    suma nad podacima koje već imamo.
  - **`withinBudget`** — `totalEur <= budgetEur`. Ako je `false`, ruta i dalje
    vraća 200 i punu košaricu; razlika je vidljiva iz `totalEur` i `budgetEur`.
  - **`deliveryComparison`** — `brojObroka × prosjekPoObrokuSDostavom`, uz
    obavezan `assumption` string. Jedno množenje i jedna konstanta, ne model.
  - `onSaleLinesCount` iz `onSale` na linijama
- `GET /api/plan/:id/cart`

**Izlaz:** košarica s realnom cijenom, **bez 10 litara ulja**, s ispisanom
uštedom od bacanja i brojkom usporedbe s dostavom.

### S6 · 4:30–5:00 — Swap, shake, polish, deploy
- `POST /api/meal/:id/swap`
- **`POST /api/plan/:planId/shake`** — odabere slučajni obrok iz plana (ne
  trenutno zamijenjeni) i pozove **istu swap funkciju**. Ruta je ~10 linija;
  ako swap radi, shake radi.
- prazna stanja, timeouti, retry na svim AI pozivima
- finalni deploy, URL predan frontend timu
- `npm run typecheck` čist

---

## Podjela na agente

Kontrakt (`docs/API.md`) je fiksan, pa su moduli neovisni i mogu ići paralelno.

| track | zadatak | ovisi o | datoteke |
|---|---|---|---|
| **A** | shema + seed kataloga, uključujući `onSale` na 15–25 % proizvoda i polje za rok u pantry-ju | — | `src/db/*`, `data/*` |
| **B** | vision scan **s procjenom `expiresInDays`**; `urgency` izvodi kod, ne model; kalibracija na pravim fotkama | kontrakt | `src/ai/vision.ts` |
| **C** | planer: **budžet kao tvrdo ograničenje**, rescue-first red gradnje, akcije iz kataloga, `why` po obroku, prep blokovi s **paralelnim `timeline[]`** | A | `src/ai/planner.ts` |
| **D** | units + packaging + matcher + cart, plus **`savedFromWasteEur`, `withinBudget`, `deliveryComparison`** (sve deterministički) | A | `src/engine/*` |
| **Leon** | skeleton, rute, sesija/profil/pitanja, **`/shake`**, integracija, deploy | — | `src/index.ts`, `src/ai/questions.ts` |

Pravila za agente:
- svaki dira **samo svoje datoteke** — bez toga `main` puca
- nitko ne mijenja `docs/API.md` ni `src/db/schema.ts` osim tracka A
- sve Zod sheme idu u `src/schemas/` i dijele se
- **nitko ne otvara novi modul za novi smjer.** Budžet, akcije i rescue su
  prompt + shema u C; brojke uštede su funkcije u D. Nova datoteka = pogrešno
  razumljen zadatak.
- svaki track završava s pozvanom rutom i vidljivim odgovorom, ne s
  "trebalo bi raditi"

## Ako kasnimo

Režemo u ovom redu:
1. **shake** (gimmick; swap ostaje, demo se radi gumbom)
2. nutritivni podaci
3. **paralelni timeline** — prep blok pada na linearne korake, blokovi ostaju
4. `followUpQuestions` iz visiona
5. `saleDriven` poruka u odgovoru (akcije i dalje ulaze u prompt, samo se ne
   hvalimo brojkom)
6. adaptivna pitanja (profil ostaje samo tap-onboarding)

**Nikad ne režemo:**
- **vision s rokovima i `urgency`** — bez toga nema uvodnog udarca
- **rescue-first plan** (`rescue.savedEur` na ekranu)
- **budžet kao ulaz** — slider je glavni interaktivni moment
- **logika pakiranja** — bez nje košarica ispadne glupa
- **usporedba s dostavom** — to je zadnja brojka koju publika pamti

To je demo. Sve ostalo je ukras.

## Demo tok (5 min)

1. **Fotkam frižider** telefonom na sceni → lista namirnica
2. Aplikacija kaže problem prva: "**špinat i jogurt ti umiru za 2 dana**"
3. 60 s onboardinga, tap-tap-tap; AI pita 3 pitanja i vidi se da su iz mojih
   odgovora
4. **Slider na 35 €** → "Generiraj tjedan" → plan koji **počinje** špinatom i
   jogurtom, s `why` na svakom obroku
5. **Spustim slider** → ponovni generate → **tjedan se preuredi pred publikom**
6. Otvorim prep blok → **tri trake**: pećnica, štednjak, ti. "70 min bloka, ti
   stojiš 25."
7. **Protresem telefon** → obrok se zamijeni
8. Košarica: **"58 € doma vs 310 € preko dostave — 252 € uštede"** uz ispisanu
   pretpostavku, plus "spasio si 4 namirnice · 11,20 €"
