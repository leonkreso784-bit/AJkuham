# AJkuham — Plan izvedbe

Backend: ~5 h. Frontend: drugi dio tima, paralelno, ne blokira nas.

## Načelo

Svaki sat mora završiti nečim što se može **pokazati**. Ako u 3. satu nemamo
rutu koja vraća pravi JSON, kasnije ga nećemo imati vremena napraviti.

Red je namjerno takav da **najrizičnija stvar ide rano** (vision), a najdosadnija
najkasnije (polish). Ako nešto mora pasti, pada polish, ne funkcija.

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
- `npm run db:seed` prošao

**Izlaz:** `SELECT count(*) FROM products` vraća 200+.

### S2 · 1:00–1:30 — Sesija, profil, pitanja
- `POST /api/session`, `PUT /api/profile`, `GET/PUT /api/pantry`
- `POST /api/questions` + `/answers` (AI, structured output)

**Izlaz:** curl prođe cijeli onboarding do pantry-ja.

### S3 · 1:30–2:30 — Vision (najrizičnije, zato rano)
- `POST /api/fridge/scan` — multipart, Claude Sonnet 5.5 s slikom
- Zod shema za `items[]` + `followUpQuestions[]`
- testirano na 3–4 prave fotke frižidera, ne na stock slikama
- fallback: ako model vrati prazno, ruta vraća `items: []` i jasan
  `followUpQuestion`, nikad 500

**Izlaz:** prava fotka tvog frižidera daje listu koja ima smisla.

### S4 · 2:30–3:45 — Planer
- `POST /api/plan/generate` — jedan `generateObject` za cijeli tjedan
- u prompt ide: profil + `taste_notes` + pantry + **lista kategorija iz kataloga**
- prep blokovi, leftover lanci, preklapanje sastojaka
- `GET /api/plan/:id`, `GET /api/meal/:id`
- fallback: ako jedan poziv timeouta, generiraj dan-po-dan

**Izlaz:** plan za 7 dana koji poštuje `mealsPerDay` i dijetu.

### S5 · 3:45–4:30 — Engine i košarica
- `engine/units.ts` — normalizacija jedinica
- `engine/packaging.ts` — pakiranja i raspodjela ostatka (deterministički)
- `engine/matcher.ts` — `fuse.js` + LLM fallback
- `engine/cart.ts` — agregacija, odbijanje pantry-ja, cijena
- `GET /api/plan/:id/cart`

**Izlaz:** košarica s realnom cijenom i **bez 10 litara ulja**.

### S6 · 4:30–5:00 — Swap, polish, deploy
- `POST /api/meal/:id/swap`
- prazna stanja, timeouti, retry na svim AI pozivima
- finalni deploy, URL predan frontend timu
- `npm run typecheck` čist

---

## Podjela na agente

Kontrakt (`docs/API.md`) je fiksan, pa su moduli neovisni i mogu ići paralelno.

| track | zadatak | ovisi o | datoteke |
|---|---|---|---|
| **A** | shema + seed kataloga | — | `src/db/*`, `data/*` |
| **B** | vision scan | kontrakt | `src/ai/vision.ts` |
| **C** | planer | A | `src/ai/planner.ts` |
| **D** | units + packaging + matcher + cart | A | `src/engine/*` |
| **Leon** | skeleton, rute, sesija/profil/pitanja, integracija, deploy | — | `src/index.ts`, `src/ai/questions.ts` |

Pravila za agente:
- svaki dira **samo svoje datoteke** — bez toga `main` puca
- nitko ne mijenja `docs/API.md` ni `src/db/schema.ts` osim tracka A
- sve Zod sheme idu u `src/schemas/` i dijele se
- svaki track završava s pozvanom rutom i vidljivim odgovorom, ne s
  "trebalo bi raditi"

## Ako kasnimo

Režemo u ovom redu:
1. swap obroka
2. `followUpQuestions` iz visiona
3. nutritivni podaci
4. adaptivna pitanja (profil ostaje samo tap-onboarding)

**Nikad ne režemo:** vision scan, tjedni plan, logika pakiranja, cijena.
To je demo.

## Demo tok (5 min)

1. Fotkam frižider telefonom na sceni → lista namirnica
2. 60 s onboardinga, tap-tap-tap
3. AI pita 3 pitanja i vidi se da su iz mojih odgovora
4. "Generiraj tjedan" → plan sa prep blokovima
5. Otvorim jedan obrok → sastojci označeni "imaš doma"
6. Košarica: cijena, i koliko je jeftinije jer frižider nije prazan
