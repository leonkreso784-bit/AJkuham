# KuhAI — brief za sesiju spajanja frontenda i backenda

Dva dijela. **Backend dio** piše backend sesija (ovo ispod). **Frontend dio** dopisuje
frontend sesija na dnu, pod svojim naslovom. Stanje backenda u detalje: `docs/STATUS.md`.

Rok: **18:48** (`.claude/deadline.json`, vidi se u statuslineu).

---

# BACKEND DIO (napisala backend sesija, 2026-10-08 ~13:55)

## 0. Što je istina u ovom trenutku

- Backend je **live** na https://kuhai-api-production.up.railway.app, kod je na `main`.
- Frontend app je u **`C:\Users\leonk\Documents\KuhAI\app`** (Vite + React), nije git repo.
  Spojen je na produkciju preko `app/.env.local` (`VITE_API_URL=https://kuhai-api-production.up.railway.app`).
- **Cijeli happy path prošao u browseru protiv produkcije** (onboarding → slikanje
  frižidera → plan → shake → swap → košarica) u 133 s, bez pada na mock.
- **Jedini pravi incident danas: Anthropic API kredit je u ~13:20 pao na nulu.**
  Backend tada ne pada, ali plan izlazi statičan, a shake/swap vraćaju stari obrok sa
  `swapFailed: true`. Leon kaže da je ključ isti i da je riješeno; zadnji puni test
  vidi dolje u 0.1.
- Backend sad ima **preklopnik providera** (`src/ai/model.ts`): `AI_PROVIDER=google` +
  `GOOGLE_GENERATIVE_AI_API_KEY` prebacuje svih 6 AI poziva na Gemini bez promjene
  koda. **Nije testirano s pravim Gemini ključem** (Leon je zalijepio link umjesto
  ključa). Default ostaje Claude. Koristiti samo ako Anthropic kredit opet padne.

### 0.1 Zadnji puni test na produkciji

13:58, krediti natrag: **98/99 prošlo**. Jedini fail: plan na 35 € izašao 64,37 €
(poznati D13 budžet, ali 84 % preko; kandidat za "tighten" ako bude vremena).
Skripta: `node scripts/backend-tests.mjs` (99 provjera, ~3 min, 4 generatea od kojih 2 paralelno).
Detalji u `docs/STATUS.md`, sekcija "Treći krug".

## 1. Kickoff prompt za sesiju spajanja — zalijepi na početku

```text
Radimo KuhAI, hackathon SHAKER, rok u .claude/deadline.json.
Backend: C:\Users\leonk\Documents\SHAKER projekt (ovaj repo, live na Railwayu).
Frontend: C:\Users\leonk\Documents\KuhAI\app (Vite + React, nije git).

Pročitaj prvo, u ovom redu:
  docs/NEXT-SESSION.md   oba dijela, backend i frontend
  docs/STATUS.md         stanje backenda, zamke, treći krug testova
  docs/API.md            ZAMRZNUTI kontrakt, 13 ruta
  C:\Users\leonk\Documents\KuhAI\app\src\api\client.ts   kako frontend zove backend

Pravila:
- docs/API.md se mijenja samo commitom koji počinje s api!: i uz Leonovu potvrdu
- backend deploy samo uz najavu: railway up zamijeni kontejner i API je ~30 s na 502
- redoslijed za svaku backend promjenu: npm run typecheck, pozovi rutu, commit na main,
  push, railway up --service kuhai-api -d, javi kad je gore
- ako nešto "ne radi", prvo curl /health, pa railway logs --service kuhai-api,
  pa tek onda dirati kod (checklista u sekciji 2)
- frontend fajlove ne spremaj dok traje demo prolaz: Vite HMR reloada stranicu i
  prekida fetch koji traje (plan/generate 60-90 s)

Lokalno: PORT=3001 npm run dev za backend (3000 je zauzet drugim projektom),
frontend npx vite --port 5174 u KuhAI/app.
```

## 2. Ako "backend ne radi" — checklista

1. `curl -s https://kuhai-api-production.up.railway.app/health` → `{"ok":true}` znači
   da nije pao. Pitaj: koja ruta, koji status, koliko je trajalo.
2. `railway logs --service kuhai-api`. Traži:
   - `credit balance is too low` → **Anthropic kredit**. Nije bug. Ili uplata na
     console.anthropic.com, ili `AI_PROVIDER=google` + Gemini ključ na Railwayu
     (vidi 4).
   - `[app] neuhvacena greska` → pravi 500, reproduciraj curl-om.
   - `[planner] ... (2/4 uspjela)` → dio tjedna je statičan, provjeri zašto su
     dijelovi pali (obično isto: kredit ili timeout).
3. `railway deployment list --service kuhai-api` → ako je zadnji deploy u zadnjih
   par minuta, frontend je pogodio prozor zamjene kontejnera.
4. Timeouti na frontendu su u `client.ts`: generate 150 s, questions/scan/swap/shake 60 s,
   ostalo 20 s. Backend: generate 60–90 s, scan 10–16 s, shake/swap 10–25 s.
5. `400 VALIDATION_ERROR` s porukom je greška u bodyju, poruka imenuje polje.
6. `ECONNRESET` / "Failed to fetch" usred dugog poziva s hackathon Wi-Fi-ja (10.90.x)
   se dogodio jednom od ~10 generatea. Na demu telefon na mobilne podatke.

## 3. Što frontend sesija treba znati o klijentu (već napravljeno u app repou)

- `client.ts`: na svaku grešku tiho pada na mock iz `mock.ts`. Od 13:02 to je
  **vidljivo**: `useFallback()` hook i narančasta oznaka **"Demo podaci"** u headeru
  (`Shell` u `components/ui.tsx`). "Demo način" (siva) znači da `VITE_API_URL` nije
  postavljen uopće.
- **Pazi**: kad backend vrati 200 sa statičnim planom (kredit na nuli), oznaka se NE
  pali, jer to nije greška. Prepoznaje se po generičkim naslovima obroka i po tome
  što shake vrati isti obrok (`meal.swapFailed === true`). Ako hoćeš, frontend može
  na `swapFailed` pokazati "Nisam uspio, probaj opet" umjesto tihog ništa.
- `sessionId` je u `localStorage` pod `kuhai.sessionId`, plan i profil pod
  `kuhai.state`. Za svjež demo: obriši oboje.
- Brojka "Jeftinije od dostave" se animira (`CountUp`); u headless screenshotu je
  bila usred animacije. Provjeri na telefonu da se dovrti do kraja.

## 4. Preklopnik providera (Claude ↔ Gemini)

`src/ai/model.ts`. Env na Railwayu:

```text
AI_PROVIDER=google                       # ili anthropic (default)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...     # https://aistudio.google.com/apikey, 39 znakova
GOOGLE_MODEL=gemini-2.5-flash            # opcionalno
```

Postavljanje: `railway variables --service kuhai-api --set AI_PROVIDER=google --set GOOGLE_GENERATIVE_AI_API_KEY=...`
pa redeploy (`railway up --service kuhai-api -d`). Prije toga **obavezno lokalno**:
`.env` s istim varijablama, `PORT=3001 npm run dev`, pa `node backend-tests.mjs http://localhost:3001`.
Gemini nije isproban sa Zod shemama planera; prvi generate pokazuje prolazi li.

## 5. Što je gdje

| | |
|---|---|
| rute | `src/app.ts` |
| provider | `src/ai/model.ts` |
| pitanja / vision / planer | `src/ai/questions.ts`, `src/ai/vision.ts`, `src/ai/planner.ts` |
| engine (nije AI) | `src/engine/{units,packaging,matcher,cart}.ts`, provjere `npx tsx src/engine/__check.ts` |
| katalog | `data/konzum-products.json`, `npm run db:seed` |
| uzorci odgovora | `docs/samples/*.json` |
| backend testovi (99 provjera) | `scripts/backend-tests.mjs` → `node scripts/backend-tests.mjs [baseUrl]` |
| frontend e2e (headless Chromium) | `scripts/e2e.mjs` → vidi zaglavlje skripte; treba `vite build` + `vite preview`, ne dev server |
| deploy | `railway up --service kuhai-api -d`, logovi `railway logs --service kuhai-api` |

## 6. Poznate stvari koje NISU bugovi

- Plan na 35 € izađe ~50 €, na 60 € ~66 €: cijela pakiranja i začini. `withinBudget: false`
  s razlikom je po dizajnu (D13). Košarica to kaže tekstom.
- `saleDriven.count` je visok jer riža/mlijeko s akcije ulaze u većinu obroka.
- Svaki `generate` radi novi `planId`; stari planovi ostaju u bazi.
- `rescue.savedEur` na planu i `savedFromWasteEur` u košarici se razlikuju nakon
  shakea/swapa, jer se košarica računa iznova svaki put.

## 7. Ako kasnimo

Reže se u ovom redu: shake → nutritivni podaci → paralelni timeline →
`followUpQuestions` → `saleDriven` poruka → adaptivna pitanja.

**Nikad se ne reže:** vision s rokovima, rescue-first plan, budžet kao ulaz,
logika pakiranja, usporedba s dostavom. Sve to radi.

---

# FRONTEND DIO

_(dopisuje frontend sesija)_
