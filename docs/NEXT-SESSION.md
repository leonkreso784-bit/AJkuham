# KuhAI — brief za sljedeću sesiju

Copy-paste materijal. Ne treba ništa prepričavati ni iznova objašnjavati.

---

## 0. Baza je spremna — samo provjeri

Railway projekt `ajkuham` + Postgres 18 (EU West) postoji, shema je
primijenjena, `.env` ima connection string preko javnog TCP proxyja
(`maglev.proxy.rlwy.net:36534`). Interni `postgres.railway.internal` ne radi s
laptopa — zato proxy.

Provjera u 10 sekundi:

```bash
npm run db:push      # mora reći "No changes detected" ili primijeniti razliku
```

Ako `.env` fali ili je pokvaren, string se sastavlja iz:

```bash
railway variables --service Postgres --json     # PGUSER, POSTGRES_PASSWORD, PGDATABASE
railway tcp-proxy list --service Postgres       # host i port
```

→ `postgresql://<PGUSER>:<POSTGRES_PASSWORD>@<proxy-host>:<proxy-port>/<PGDATABASE>`

---

## 1. Kickoff prompt — zalijepi na početku sesije

```text
Radimo KuhAI: backend u C:\Users\leonk\Documents\SHAKER projekt.
Hackathon SHAKER, rok je u .claude/deadline.json i vidi se u statuslineu.

Pročitaj prvo, cijele i u ovom redu:
  docs/STATUS.md      gdje smo i što je blokirano
  CLAUDE.md           pravila rada i što se ne smije dirati
  docs/SPEC.md        sekcije 2 i 5-9: zašto je proizvod takav
  docs/API.md         ZAMRZNUTI kontrakt, 13 ruta
  docs/PLAN.md        raspored po satima i agent trackovi
  docs/PROMPTS.md     gotovi promptovi za sva 4 AI poziva
  src/schemas/index.ts  Zod sheme, jedini izvor istine za oblik podataka

Temelj postoji i tsc --noEmit je čist: shema baze, Zod sheme, db klijent,
env validacija. Nema napisanog nijednog src/ai/*, src/engine/* ni src/app.ts —
to je posao ove sesije.

Ne piši nikakav plan ni spec iznova, sve je napisano. Idi po docs/PLAN.md od
koraka S1. Trackove A-D pusti na agente paralelno, kako PLAN.md propisuje; ti
drži src/app.ts, rute i integraciju.

Sve na main, bez grana. docs/API.md se mijenja samo commitom čiji naslov
počinje s api!: i samo uz moju potvrdu.
```

---

## 2. Agent briefovi — zalijepi svaki kao zaseban Agent poziv

Svi dijele isti uvod, pa ga ne ponavljaj u glavi — zalijepi cijeli blok.

### Track A — katalog i seed

```text
Radiš na KuhAI backendu: C:\Users\leonk\Documents\SHAKER projekt.
Hackathon, vrijeme kritično. Komentari hrvatski, kod engleski.
Pročitaj prvo: CLAUDE.md, docs/DATA-MODEL.md, docs/SPEC.md sekcija 8,
src/db/schema.ts, src/schemas/index.ts.

TVOJE DATOTEKE, ne diraj ništa drugo (drugi agenti rade paralelno):
  data/konzum-products.json
  src/db/seed.ts

1) data/konzum-products.json — 220-250 proizvoda iz hrvatskog asortimana.
Oblik: { id, name, category, keywords[], packageSize, packageUnit, priceEur, onSale }

- category STRIKTNO iz ProductCategory enuma u src/schemas/index.ts
- packageUnit je g, ml ili kom
- packageSize je PRAVA veličina pakiranja kakva se prodaje (jaja 10 kom,
  mlijeko 1000 ml, riža 1000 g, jogurt 180 g, ulje 1000 ml). To je najvažnije
  polje u cijelom fajlu — logika pakiranja i cijela uvjerljivost košarice
  ovise o njemu.
- priceEur realna hrvatska cijena 2026, bez apsurda
- keywords su hrvatski pojmovi kojima bi recept nazvao taj sastojak, i s
  dijakritikom i bez. Izdašno, 3-8 pojmova. To je ulaz za fuzzy matching.
- onSale na 15-25% proizvoda, realno raspoređeno po kategorijama, NE random
  flag. Planer gradi tjedan oko akcija (odluka D16), pa akcije moraju biti
  takve da se iz njih može složiti jelo.
- POKRIVENOST je kritična, katalog mora pokriti realne tjedne jelovnike:
  mesa (piletina, svinjetina, junetina, mljeveno, slanina, kobasice), riba
  (tuna konzerva, losos, bakalar smrznuti), jaja, mliječno (mlijeko, jogurt,
  sir, svježi sir, pavlaka, maslac, mozzarella, parmezan), ugljikohidrati
  (riža, tjestenina više vrsta, krumpir, kruh, tortilje, kuskus, bulgur, zob),
  mahunarke (leća, slanutak, grah konzerva), povrće (luk, češnjak, mrkva,
  paprika, tikvice, brokula, cvjetača, špinat, kupus, salata, krastavci,
  rajčica svježa i konzerva, passata), voće (banane, jabuke, limun, avokado,
  bobičasto smrznuto), orašasti (orasi, bademi, kikiriki maslac), ulja i octevi,
  začini (sol, papar, slatka paprika, origano, bosiljak, curry, cimet, kumin),
  ostalo (kečap, majoneza, senf, soja sos, med, tahini, kokosovo mlijeko,
  kvasac, brašno, šećer, tofu, tempeh).

2) src/db/seed.ts — tsx skripta:
- import 'dotenv/config' na vrhu
- čita JSON preko node:fs + JSON.parse (ne resolveJsonModule)
- validira svaki red lokalnom Zod shemom u seed.ts; NE mijenjaj src/schemas/index.ts
- računa perUnitEur = priceEur / packageSize, 6 decimala
- delete(products) pa insert u batchevima od 100
- importi s .js ekstenzijom (ESM projekt): '../db/client.js', './schema.js'
- numeric kolone: prosljeđuj String(x)
- ispis: ukupno + broj po kategoriji + broj na akciji
- validacija padne -> ispiši KOJI red i zašto, process.exit(1)

NE TRAŽI PRAVE CIJENE. Postoji crawler za službene hrvatske cjenike
(cijene-api) i svjesno ga ne koristimo — odluka D20. Cijene izmišljaš, ali
realno. Ono što MORA biti točno je packageSize, ne cijena do centa: publika ne
provjerava cijene, provjerava izgleda li košarica razumno.

Na kraju OBAVEZNO: npx tsc --noEmit mora biti exit 0, i pokreni npm run db:seed
(baza radi, Railway Postgres preko proxyja je u .env). Ne commitaj, ne pushaj.

Javi: broj proizvoda, broj po kategoriji, broj na akciji, je li tsc čist.
```

### Track B — vision

```text
Radiš na KuhAI backendu: C:\Users\leonk\Documents\SHAKER projekt.
Hackathon, vrijeme kritično. Komentari hrvatski, kod engleski.
Pročitaj prvo: CLAUDE.md, docs/API.md sekcija 5, docs/PROMPTS.md sekcija 2
(prompt je GOTOV, koristi ga, ne izmišljaj svoj), docs/SPEC.md sekcija 5,
src/schemas/index.ts (FridgeScanOutput, ScannedItem, Urgency).

TVOJA DATOTEKA, ne diraj ništa drugo: src/ai/vision.ts

Izvezi:
  export async function scanFridge(images: { data: Uint8Array; mediaType: string }[]): Promise<FridgeScanOutput>
  export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

- generateObject iz 'ai', anthropic('claude-sonnet-5-5'), schema FridgeScanOutput
- prompt iz docs/PROMPTS.md sekcija 2, doslovno
- slike kao multi-modal content: { type: 'image', image: img.data, mediaType }
- maxRetries: 2

VAŽNO — urgency izvodi KOD, ne model (odluka D14): model vraća expiresInDays
(broj), a ti presuđuješ kategoriju: <=2 umire, 3-7 skoro, 8+ ok. Ako model ne
vrati rok, stavi urgency 'ok' i expiresInDays null-safe default.

OTPORNOST, ovo je demo i ne smije pasti:
- generateObject baci -> uhvati, logiraj, vrati
  { items: [], followUpQuestions: ['Nisam uspio pročitati fotku — možeš mi reći što imaš doma?'] }
- filtriraj iteme s quantity <= 0 ili praznim name
- name na lowercase i trim
- dedupliciraj: isto ime + ista jedinica -> saberi količine, uzmi višu confidence
  i NIŽI expiresInDays (pesimistično je točnije)

Ne testiraj pravim API pozivom (ne troši kredite). npx tsc --noEmit mora biti
exit 0. Ako nisi siguran u oblik AI SDK poziva, provjeri node_modules/ai —
ne piši po sjećanju. Ne commitaj, ne pushaj.

Javi: potpis, je li tsc čist, koje si fallbackove ugradio.
```

### Track C — planer

```text
Radiš na KuhAI backendu: C:\Users\leonk\Documents\SHAKER projekt.
Hackathon, vrijeme kritično. Komentari hrvatski, kod engleski.
Pročitaj prvo, CIJELE: CLAUDE.md, docs/API.md sekcija 8, docs/PROMPTS.md
sekcija 3 (prompt je GOTOV i nosi cijelu filozofiju proizvoda — koristi ga
doslovno), docs/SPEC.md sekcije 5-7, docs/DECISIONS.md D13-D17,
src/schemas/index.ts (PlannerOutput i sve Planned* sheme).

TVOJA DATOTEKA, ne diraj ništa drugo: src/ai/planner.ts

Izvezi:
  export async function generateWeekPlan(input: PlannerInput): Promise<PlannerOutput>
  export async function generateSingleMeal(input: SwapContext): Promise<PlannedMeal>

PlannerInput nosi: profil, tasteNotes, pantry s urgency, lista onSale proizvoda,
lista dostupnih kategorija kataloga, budgetEur (nullable).

Tri stvari koje NE SMIJEŠ pogriješiti:
1. Red gradnje je fiksan i ide u prompt eksplicitno: umire -> skoro -> onSale
   -> ostatak. Bez propisanog reda model stavi špinat u četvrtak, a tada je
   špinat u smeću (D15).
2. Model smije koristiti SAMO sastojke iz dostupnih kategorija kataloga. Lista
   ulazi u prompt. Bez toga izmisli nešto što se ne može kupiti (D7).
3. Model NE računa eure. Vraća PlannedRescue/PlannedSaleDriven (imena +
   ljudska poruka); savedEur i count dopisuje src/engine/ (D6).

FALLBACK, obavezan: ako jedan poziv za cijeli tjedan timeouta ili padne,
generiraj dan-po-dan (7 manjih poziva) i spoji. Prep blokovi se tada izvode iz
spojenog rezultata. Plan koji je sporo stigao je beskonačno bolji od 500.

npx tsc --noEmit mora biti exit 0. Ne troši kredite na testiranje punog tjedna.
Ne commitaj, ne pushaj.

Javi: potpise, kako si riješio fallback, je li tsc čist.
```

### Track D — engine

```text
Radiš na KuhAI backendu: C:\Users\leonk\Documents\SHAKER projekt.
Hackathon, vrijeme kritično. Komentari hrvatski, kod engleski.
Pročitaj prvo: CLAUDE.md, docs/API.md sekcija 12, docs/DATA-MODEL.md
(kanonske jedinice i tablica pretvorbi), docs/SPEC.md sekcija 8,
docs/DECISIONS.md D6 i D18, src/schemas/index.ts (Cart, CartLine,
DeliveryComparison).

TVOJE DATOTEKE, ne diraj ništa drugo:
  src/engine/units.ts
  src/engine/packaging.ts
  src/engine/matcher.ts
  src/engine/cart.ts

NIŠTA OVDJE NIJE AI. Sve je deterministički kod. Ako model računa košaricu,
prije ili poslije dobijemo 10 litara ulja za jedan tjedan, i to je
najvidljiviji način da demo ispadne glup (D6).

units.ts — normalizacija u g/ml/kom. Tablica pretvorbi je u
docs/DATA-MODEL.md; implementiraj je. Za volumen->masa (brašno, riža) drži
grubu gustoću u kodu. Nije znanstveno točno i ne mora biti — zaokružuje se na
pakiranja pa greška od 10% ništa ne mijenja.

packaging.ts — sastojci -> pakiranja. Traži 180 g, pakiranje 1 kg: kupi jedno
i raspodijeli ostatak kroz tjedan. Vrati neededAmount i leftoverAmount po
liniji. Ovo je tehnički najdosadniji i najvidljiviji dio projekta.

matcher.ts — sastojak -> SKU. fuse.js nad products.keywords. Prag -> matchQuality
exact/fuzzy. Ne nađeš -> generic (prosječna cijena kategorije), NIKAD prazna
košarica. Što ni tako ne prođe ide u cart.unmatched.

cart.ts — agregacija kroz tjedan, odbijanje pantry-ja, cijena:
- savedFromPantryEur: sve što korisnik ima doma
- savedFromWasteEur: SAMO ono što bi se bacilo a plan ga je iskoristio.
  Računaj iz meal.usesExpiring x katalog. Ne naduvavaj — to je druga brojka
  od savedFromPantryEur i obje idu na ekran.
- withinBudget: totalEur <= budgetEur. false nije bug, ali mora biti vidljiv
  s razlikom; tihi fail je gori.
- deliveryComparison: množenje i konstanta, nikad procjena modela. assumption
  je OBAVEZAN string koji ide na ekran — brojka bez pretpostavke je marketing,
  s pretpostavkom je argument (D18).
- onSaleLinesCount, perMealEur, deepLink

npx tsc --noEmit mora biti exit 0. Ovo je jedini dio gdje se isplati napisati
par brzih provjera nad izmišljenim ulazima — pakiranja i cijene se ne smiju
testirati tek na demu. Ne commitaj, ne pushaj.

Javi: što radi svaki modul, i jedan primjer izračuna pakiranja s brojkama.
```

---

## 3. Što držiš ti (ne daj agentu)

`src/app.ts` (Hono rute), `src/server.ts`, `src/ai/questions.ts`, integracija,
deploy. To je spoj svega i ne dijeli se.

Red: `/health` → sesija/profil → pantry → spoji vision → spoji planer →
spoji engine → swap/shake → deploy.

## 4. Pravila koja agentima stalno bježe

- Svi importi s `.js` ekstenzijom — ESM projekt.
- Nitko ne dira `src/schemas/index.ts` ni `src/db/schema.ts` osim tracka A.
- Nitko ne otvara novi modul za novi smjer; novi smjer je prompt + shema.
- `npx tsc --noEmit` prije nego kažu da su gotovi.
- Ne commitaju i ne pushaju — to ide kroz tebe.

## 5. Ako kasnimo

Reže se u ovom redu: shake → nutritivni podaci → paralelni timeline (fallback
na linearne `steps`) → `followUpQuestions` → `saleDriven` poruka → adaptivna
pitanja.

**Nikad se ne reže:** vision s rokovima, rescue-first plan, budžet kao ulaz,
logika pakiranja, usporedba s dostavom. To je demo.
