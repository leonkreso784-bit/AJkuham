# KuhAI — brief za sljedeću sesiju (backend + frontend)

Jedan fajl, tri dijela: **KICKOFF** (zalijepi), **BACKEND DIO** (§0–7, backend sesija),
**FRONTEND DIO** (F0–F8, frontend sesija). Stanje backenda u detalje: `docs/STATUS.md`.

Rok: **18:48** (`.claude/deadline.json`, vidi se u statuslineu).

---

## KICKOFF — zalijepi ovo na početku sljedeće sesije (jedna sesija radi oboje)

```text
Radimo KuhAI, hackathon SHAKER. Rok je u .claude/deadline.json i vidi se u statuslineu.
Ova sesija radi i BACKEND i FRONTEND.

Backend:  C:UsersleonkDocumentsSHAKER projekt  (git, main, live na Railwayu)
          https://kuhai-api-production.up.railway.app  (/health)
Frontend: C:UsersleonkDocumentsKuhAIapp  (Vite 8 + React 19 + TS + Tailwind v4
          + react-router 8 + gsap). NIJE u gitu, nema backupa.

Pročitaj prvo, u ovom redu:
  docs/NEXT-SESSION.md      oba dijela: BACKEND (§0–7) i FRONTEND (F0–F8)
  docs/STATUS.md            stanje backenda, zamke, treći krug testova
  docs/API.md               ZAMRZNUTI kontrakt, 13 ruta
  docs/FRONTEND.md          4 demo trenutka koje UI mora prenijeti
  KuhAI/app/src/api/client.ts   kako frontend zove backend (timeouti + mock fallback)
  KuhAI/app/src/index.css       dizajn tokeni
  KuhAI/app/src/components/ui.tsx  Shell, TopBar, TabBar, Button, Chip, CountUp

PRVI KORAK: pitaj me za F7. Frontend treba u git: prijedlog je preseliti ga u ovaj
repo kao web/ (bez node_modules, dist, .env.local) i commitati na main. To mijenja
pravilo iz CLAUDE.md "repo je backend", zato traži moju potvrdu.

BACKEND pravila:
- docs/API.md se mijenja samo commitom koji počinje s api!: i uz moju potvrdu.
- Deploy samo uz najavu: railway up zamijeni kontejner, pa je API ~30 s na 502.
- Redoslijed za svaku promjenu: npm run typecheck → pozovi rutu → commit na main
  → push → railway up --service kuhai-api -d → javi kad je gore.
- Kad "nešto ne radi": prvo curl /health, pa railway logs --service kuhai-api,
  tek onda kod (checklista u §2). "credit balance is too low" = Anthropic kredit,
  nije bug (preklopnik na Gemini u §4).
- Lokalno: PORT=3001 npm run dev (3000 je zauzet).
- Testovi: node scripts/backend-tests.mjs [baseUrl] (99 provjera, ~3 min).

FRONTEND pravila:
- Vizualne promjene i promjene logike rade se odvojeno; API/state/rute ne dirati usput.
- Dizajn je dogovoren (F3): bez emojija, bez uppercase "kicker" labela, jedan crveni
  CTA po ekranu, Tailwind klase u markupu (ne custom CSS), clay samo kao dašak.
- Responzivno: < 1024 px mobilni layout, >= 1024 px desktop. Svaku promjenu
  pogledaj na 1440 i 390 px (Playwright screenshot u
  "C:UsersleonkDocumentsSHAKER projekt.playwright-mcp\", jedini dopušten folder).
- Nakon svake promjene: npm run build čist, pa pogledaj ekran. "Trebalo bi raditi" ne vrijedi.
- Za veći Tailwind posao koristi tailwind agenta. Ilustracije su u src/illustrations,
  nove crtaj u istom stilu (F3).
- Ne spremaj frontend fajlove dok traje demo prolaz (HMR prekida plan/generate).
- Dev server: npx vite --port 5180 --strictPort --host u KuhAI/app (F0).
```

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

## 1. Kickoff prompt

Spojen s frontend dijelom u jedan **KICKOFF** na vrhu ovog fajla. Ovdje više nema zasebnog.

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

# FRONTEND DIO (napisala frontend sesija, 2026-10-08 ~14:05)

## F0. Gdje je i kako se pali

- Kod: **`C:\Users\leonk\Documents\KuhAI\app`**. **Nije u gitu**, nema ni jednog
  commita ni backupa (vidi F7, prva odluka).
- Stack: Vite 8 + React 19 + TypeScript + **Tailwind v4** (tokeni u `@theme`
  u `src/index.css`, nema `tailwind.config`), react-router 8, gsap (splash).
- `.env.local`: `VITE_API_URL=https://kuhai-api-production.up.railway.app`.
  Bez te varijable sve ide na mock (`src/api/mock.ts`) i header pokazuje "Demo način".

```bash
cd C:\Users\leonk\Documents\KuhAI\app
npx vite --port 5180 --strictPort --host   # dev; --host da ga vidi mobitel
npm run build                              # tsc -b + vite build, MORA biti čist
npm run lint                               # oxlint: 0 errora (warningi su stari)
```

Dev server iz frontend sesije vrti na **5180** (backend kickoff gore spominje 5174,
oba porta rade, samo da se ne pokrene dvaput). Mobitel na istom Wi-Fi-ju:
`http://<IP računala>:5180/`. Kamera i shake rade samo na pravom mobitelu.

## F1. Kickoff prompt

Spojen s backend dijelom u jedan **KICKOFF** na vrhu ovog fajla.

## F2. Struktura

| | |
|---|---|
| rute | `src/main.tsx` (6 ruta + `<Splash />`) |
| ekrani | `src/pages/{Landing,Onboarding,Fridge,Plan,Meal,Cart}.tsx` |
| zajedničko | `src/components/ui.tsx` (Shell, TopBar, TabBar, Button, Chip, Stepper, Pill, Title, CountUp, eur) |
| fotke jela | `src/food.ts` + `src/components/MealImage.tsx`, slike `public/food/*.jpg` |
| splash | `src/components/Splash.tsx` |
| ilustracije | `src/illustrations/*` (43 SVG), galerija `http://localhost:5180/illustrations.html` (samo dev, ne ide u build) |
| API | `src/api/client.ts`, `src/api/types.ts`, `src/api/mock.ts` |
| state | `src/store.ts` (profile, plan, pantry u `localStorage kuhai.state`) |

## F3. Dizajn — dogovoreno, ne mijenjati bez Leona

- **Referenca:** Janovi ekrani `C:\Users\leonk\Documents\KuhAI\inspiracija\01–04.png`.
  Mirno: krem pozadina (`bg-cream`/`bg-bg`), bijele kartice s tankim toplim rubom
  (`border-line`), tamnosmeđi pill za odabrano (`bg-ink`), jedan crveni CTA.
- **Boje** (`@theme`): brand `#D0161B`, brand-dark `#A91115`, cream `#FFF4E6`,
  bg `#FFFBF6`, ink `#2B1D16`, muted `#8A6F60`, line `#F0E4D6`, fresh (zelena),
  hot (narančasta za "umire"), warn (žuta za nesigurno).
- **Clay je samo dašak:** `shadow-cta` na crvenom gumbu, `shadow-card` na 2–3
  ključne kartice (rescue €, usporedba s dostavom). Sve ostalo ravne kartice s rubom.
- **Fontovi:** Nunito svuda (bold/black za naslove). Unbounded samo wordmark
  "KuhAI" + jedna hero brojka (rescue €).
- **Nema emojija nigdje.** Leon ih je izričito odbio kao "AI-generirano".
  - Ilustracije: `<Art name="..." className="size-10" />`, `mealArt(title)`,
    `ingredientArt(name)`, `categoryArt(category)`. Stil: debeli zaobljeni oblici,
    obrub 2.5 u ink boji, jedan sloj sjene dolje-desno, highlight gore-lijevo,
    viewBox 64. Fallback: `tanjur` (jelo), `vrecica` (namirnica).
  - Fotke jela: TheMealDB, 11 kategorija (ključ = `mealArt` ime). Bez fotke ili
    ako se ne učita → ilustracija u pastelnoj pločici.
- **Splash** je dizajnerova animacija iz `Documents/KuhAI/splash/index.html`
  prenesena 1:1 u React (lonac zakuha → "Kuh" izleti → Kuh[AI] + para). Na
  mobitelu 107vw kao u dizajnerovom render modu.

## F4. Što postoji (build čist, sve viđeno u browseru)

| ekran | što radi |
|---|---|
| splash | jednom po sesiji (`sessionStorage kuhai.splashSeen`), tap preskače, font čeka max 0,7 s, tvrdi stop 5,5 s |
| `/` | landing. Desktop: hero u dva stupca s nagnutim karticama fotki i "Spašeno 11,20 €" |
| `/onboarding` | **chat**: KuhAI pita u oblačićima (avatar = logo), odgovori ostaju kao poruke, klik na odgovor = promijeni. Tap = dalje kod single izbora. 8 pitanja → `PUT /profile` → "tipka…" → AI pitanja (`POST /questions`) → sažetak "Evo što sam skužio o tebi" s "Promijeni" → `POST /questions/answers` → `/frizider`. "Što znam o tebi" raste: traka na mobitelu, bočna kartica na desktopu. Budžet pokazuje € po porciji vs ~14,76 € dostava |
| `/frizider` | kamera/upload → scan animacija → lista po urgency (Treba potrošiti odmah / Ovaj tjedan / Ima vremena), svaka namirnica s ilustracijom, confidence < 0.6 = isprekidani rub + "Nisam siguran", sve editabilno (ime, količina, jedinica, ± dani, briši), ručni unos, followUp pitanja → `PUT /pantry`. Preskoči → `items: []` |
| `/plan` | generate s **personaliziranim porukama** iz profila i pantry-ja ("Vidim da ti jogurt i špinat umiru…") + 7 dana koji se pune. Rescue € (count-up) prvi, sale poruka, budžet slider + "Pregradi tjedan za X €", dani, kartice s fotkama, prep timeline (trake po uređaju + "Ti:" legenda + "blok traje X, ti stojiš Y, ostalo radi <uređaj>"), shake (devicemotion + gumb "Protresi"). Desktop: sticky lijevi stupac + mreža fotki |
| `/obrok/:id` | velika fotka + naljepnica-ilustracija, why, nutrition (null-safe), sastojci s ilustracijama i stanjima (imaš doma / ističe / kupiti), koraci (tap = gotovo), swap s razlogom (bottom sheet / dijalog na desktopu) |
| `/kosarica` | "Jeftinije od dostave" (count-up) + assumption ispisan, 3 brojke (po obroku / već imaš doma / spašeno od bacanja), withinBudget s razlikom, linije s ilustracijama i "akcija", unmatched "Dokupi sam", ukupno, Konzum CTA. Desktop: sticky sažetak desno |

Responzivno provjereno na 375 / 390 / 768 / 1024 / 1440 px, bez horizontalnog scrolla.

## F5. Integracija s backendom — zamke

- **Fallback:** svaka greška ili timeout u `client.ts` → mock. Vidljivo kao
  narančasta oznaka **"Demo podaci"** u headeru (`useFallback()`), uz
  `[KuhAI] backend nije odgovorio` u konzoli. Siva "Demo način" = nema `VITE_API_URL`.
- **Timeouti** (`client.ts`, usklađeni s backendom): generate **150 s**,
  questions/scan/swap/shake **60 s**, ostalo 20 s. Ako backend postane sporiji,
  digni ovdje. Inače pozornica dobije mock plan umjesto pravog.
- **Plan loading tempo** (`Plan.tsx`, `Generating`): poruka svakih 7 s, napredak
  asimptotski s tau 40 s. Usklađeno na 60–90 s generate.
- **Stari mock plan u `localStorage`** → backend vrati 404 za mock id (`m_101`) →
  fallback. Za čist demo: obriši `kuhai.state` i `kuhai.sessionId` (Clear site data).
- **`swapFailed: true`** (kredit na nuli) frontend trenutno ne pokazuje, shake
  izgleda kao da ništa nije napravio. Kandidat za mali popravak (F6, točka 2).

## F6. Sljedeće, po vrijednosti za demo / vremenu

1. **Sken "živi":** dok traje scan, namirnice iskaču jedna po jedna s ilustracijom
   i rokom (`Fridge.tsx`, faza `scan`). ~30 min
2. **Shake feedback:** `navigator.vibrate(80)`, kartica se okrene, toast
   "Zamijenio sam X za Y". Na `swapFailed` toast "Nisam uspio, probaj opet"
   (`Plan.tsx` `shake`, `Meal.tsx` `swap`). ~20 min
3. **Prijelazi** između ruta (View Transitions API) + fotka iz kartice "naraste"
   u hero recepta. ~20 min
4. **PWA manifest** + ikona lonca: dodaj na početni zaslon, bez trake preglednika
   na sceni. ~15 min
5. Skeletoni umjesto spinnera (Meal, Cart). Mobilni landing dobije fotke kao
   desktop. Brojač na košarici u navigaciji. "Poništi" kod brisanja namirnice.
6. Slabije ilustracije: `peceni-krumpir`, `kupus`, `frizider` (tab ikona).
7. Fotke su generičke po kategoriji ("Kajgana" dobije omlet). Za demo ok.

## F7. Otvorene odluke za Leona

- **Frontend u git — PRVO.** Prijedlog: premjestiti `Documents/KuhAI/app` u ovaj
  repo kao `web/` (bez `node_modules`, `dist`, `.env.local`), commit na `main`.
  To mijenja pravilo iz CLAUDE.md "ovaj repo je backend", pa treba Leonova potvrda.
  Alternativa: zaseban repo. Dok se ne odluči, nema povijesti ni backupa.
- Deploy frontenda (Vercel ili Railway static) nije napravljen. Za demo je dovoljan
  `vite --host` + mobitel na istoj mreži, ali hackathon Wi-Fi zna blokirati.

## F8. Ostalo u `C:\Users\leonk\Documents\KuhAI\`

- `splash/`: izvor splash animacije (`index.html`, GSAP) + `out/kuhai-loading*.mp4` (video verzija)
- `video/`: promo video po Klarinom scenariju (doomscroll → STOP. KUHAJ. → app). Nije dio aplikacije
- `inspiracija/`: Janovi ekrani, referenca dizajna
- `splash/assets/logo-original.png`, `app/public/logo.png`: logo
