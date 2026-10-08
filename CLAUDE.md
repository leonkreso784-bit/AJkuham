# KuhAI — CLAUDE.md

AI koji te upozna i složi ti **cijeli tjedan hrane** — plan, meal prep blokove i
košaricu u Konzumu. Hackathon projekt (SHAKER, 2026-10-08).

Ime: **KuhAI** ("kuhaj" + AI). U kodu i tekstu: **KuhAI**. Staro ime AJkuham je napušteno 2026-10-08.

## Što je ovo, u jednoj rečenici

Korisnik prođe kratki razgovorni onboarding, slika frižider, kaže koliko obroka
dnevno treba — dobije tjedni jelovnik organiziran kao meal prep i listu/košaricu
koja odbija ono što već ima doma.

**Nije** fitness/makro aplikacija. Makroi su opcionalni detalj, ne okvir.

## Granice ovog repozitorija

Repo ima dva dijela (odluka Leona, 2026-10-08 ~14:05):

- **korijen** = backend: API + baza + AI pipeline. Deploy na Railway.
- **`web/`** = frontend (Vite + React). Zaseban `package.json`, vlastiti
  `node_modules`. Govori s backendom **samo** preko REST-a iz `docs/API.md`.
  Nema dijeljenog koda između korijena i `web/`; tipovi u `web/src/api/types.ts`
  se ručno drže usklađeni s API.md.

Frontend pravila (dizajn, responzivnost, dev server) su u `docs/NEXT-SESSION.md`,
dio FRONTEND (F0–F8).

## Stack

| | |
|---|---|
| jezik | TypeScript, Node 24, ESM |
| API | Hono |
| baza | Postgres (Railway) + Drizzle ORM |
| validacija | Zod — **ista shema** za API input i AI structured output |
| AI | AI SDK (`ai`) + Claude Sonnet 5.5 (planer, vision) |
| matching | `fuse.js` nad seedanim katalogom |
| deploy | Railway |

## Pravila rada u ovom repou

- **Sve na `main`.** Bez grana, bez PR-ova. Hackathon.
- **`docs/API.md` je zamrznut kontrakt.** Frontend radi protiv njega. Mijenja se
  samo uz izričitu Leonovu potvrdu i commit koji to kaže u naslovu.
- **Zod sheme su jedini izvor istine za oblik podataka.** Ne piši TypeScript
  tipove ručno — izvedi ih iz Zoda (`z.infer`).
- **Logika pakiranja i cijena NIJE AI.** To je deterministički kod u
  `src/engine/`. Model ne smije izmišljati brojeve koji idu u košaricu.
- **Planer smije koristiti samo sastojke koji postoje u katalogu.** Lista
  dopuštenih kategorija ide u prompt. Bez toga matcher puca.
- **Fotke frižidera se ne čuvaju.** Upload → vision → spremi prepoznatu listu →
  baci fotku. Zato nam ne treba object storage.
- Ništa ne piše direktno u `products` osim seed skripte.
- Svaki AI poziv ima `maxRetries` i fallback. Demo ne smije pasti na praznom
  odgovoru modela.

## Struktura

```
src/
  index.ts          Hono app, routes
  db/schema.ts      Drizzle tablice
  db/seed.ts        seed Konzum kataloga iz data/
  ai/questions.ts   adaptivna pitanja
  ai/vision.ts      fotka → namirnice
  ai/planner.ts     profil + pantry → tjedni plan
  engine/units.ts   normalizacija jedinica
  engine/packaging.ts  sastojci → pakiranja (deterministički)
  engine/matcher.ts    sastojak → SKU (fuse.js + LLM fallback)
  engine/cart.ts       košarica + cijena
  schemas/          Zod sheme (dijeljene)
data/
  konzum-products.json
docs/
  NEXT-SESSION.md   POČNI OVDJE — kickoff prompt i briefovi za agente
  STATUS.md         stanje, blokade
  PROMPTS.md        gotovi promptovi za sve AI pozive
  SPEC.md           što gradimo i što ne
  API.md            ZAMRZNUTI kontrakt za frontend
  DATA-MODEL.md     tablice i jedinice
  PLAN.md           raspored po satima + podjela na agente
  DECISIONS.md      zašto je nešto odlučeno tako
  FRONTEND.md       što frontend tim treba znati
  SWIPE.md          spec za swipe kartice (kvačica / X, flip = recept), čeka odluke
web/                FRONTEND (Vite 8 + React 19 + Tailwind v4), vlastiti package.json
  src/main.tsx      rute + Splash
  src/pages/        Landing, Onboarding, Fridge, Plan, Meal, Cart
  src/components/   ui.tsx (Shell, TopBar, Button…), MealImage, Splash
  src/api/          client.ts (timeouti + mock fallback), types.ts, mock.ts
  src/illustrations/  SVG ilustracije (bez emojija)
  src/store.ts      profile/plan/pantry u localStorage
  .env.local        VITE_API_URL (nije u gitu; vidi web/.env.example)
```

## Komande

```bash
# backend (korijen)
npm run dev        # lokalni API, watch (PORT=3001, 3000 je zauzet)
npm run db:push    # Drizzle shema → Postgres
npm run db:seed    # napuni katalog
npm run typecheck

# frontend (web/)
cd web
npx vite --port 5180 --strictPort --host   # dev; --host da ga vidi mobitel
npm run build                              # tsc -b + vite build, mora biti čist
npm run lint                               # oxlint
```

## Env

Vidi `.env.example`. Bez `ANTHROPIC_API_KEY` i `DATABASE_URL` ništa ne radi.

## Prije nego kažeš "gotovo"

Backend: pokreni `npm run typecheck` i pozovi ruku rute koju si dirao.
Frontend: `npm run build` u `web/` čist, pa pogledaj ekran (1440 i 390 px).
Nema "trebalo bi raditi" — ili si vidio odgovor, ili nije gotovo.
