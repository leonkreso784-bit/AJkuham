# KuhAI — API kontrakt

**ZAMRZNUTO.** Frontend radi protiv ovoga. Promjena samo uz Leonovu potvrdu i commit čiji naslov počinje s `api!:`.

Base URL (dev): `http://localhost:3000`
Base URL (prod): Railway URL — dopisati kad deploy prođe.

Sve je JSON (`Content-Type: application/json`) osim `/api/fridge/scan`.
Autentikacija: **nema je**. Umjesto nje `sessionId` koji se dobije na početku i šalje u headeru `x-session-id` na svim ostalim rutama.

Greške su uvijek:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "ljudski opis" } }
```

Kodovi: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `AI_ERROR` (502), `SERVER_ERROR` (500).

---

## 1. POST /api/session

Kreira anonimnu sesiju. Frontend zove jednom i sprema `sessionId` u localStorage.

**Request:** prazan body

**Response 200**

```json
{ "sessionId": "ses_a1b2c3d4" }
```

---

## 2. PUT /api/profile

Sprema odgovore iz tap-onboardinga. Idempotentno.

**Request**

```json
{
  "mealsPerDay": 3,
  "householdSize": 2,
  "cookingStyle": "meal_prep",
  "minutesPerMeal": 30,
  "diet": "sve",
  "allergies": ["orasi"],
  "cuisines": ["domaca", "talijanska", "azijska"],
  "adventurousness": 3,
  "budgetLevel": "srednje",
  "budgetPerWeekEur": 60
}
```

| polje | tip | dopuštene vrijednosti |
|---|---|---|
| `mealsPerDay` | int | 2, 3, 4, 5 |
| `householdSize` | int | 1–8 |
| `cookingStyle` | enum | `svaki_dan`, `meal_prep` |
| `minutesPerMeal` | int | 15, 30, 45 |
| `diet` | enum | `sve`, `bez_mesa`, `vegan`, `bez_svinjetine`, `bez_laktoze`, `bez_glutena` |
| `diets` | enum[] | *(dodano 2026-10-08 15:30)* više dijeta odjednom, isti enum; opcionalno, default `[]`. `diet` ostaje = prva/najstroža. Sve su tvrde ograničenje. |
| `dietNote` | string | *(dodano 2026-10-08 15:30)* "Ostalo": slobodni tekst do 200 znakova, npr. "ne jedem ribu"; opcionalno, default `""`. Ide planeru doslovno. |
| `allergies` | string[] | slobodno, može biti prazno |
| `cuisines` | string[] | `domaca`, `talijanska`, `azijska`, `meksicka`, `mediteranska`, `bliskoistocna`, `indijska`, `comfort` |
| `adventurousness` | int | 1–5 (1 = sigurno, 5 = eksperimentalno) |
| `budgetLevel` | enum | `labavo`, `srednje`, `strogo` |
| `budgetPerWeekEur` | number | opcionalno |

**Response 200**

```json
{ "ok": true }
```

---

## 3. POST /api/questions

Vraća adaptivna pitanja generirana iz profila. Zvati nakon PUT /api/profile.

**Request:** prazan body

**Response 200**

```json
{
  "questions": [
    {
      "id": "q_staple",
      "text": "Što od ovoga jedeš najčešće?",
      "type": "multi",
      "options": ["krumpir", "riža", "tjestenina", "kruh"]
    },
    {
      "id": "q_breakfast",
      "text": "Jedeš li doručak?",
      "type": "single",
      "options": ["uvijek", "ponekad", "nikad"]
    },
    {
      "id": "q_yesterday",
      "text": "Što si jeo jučer?",
      "type": "text",
      "options": []
    }
  ]
}
```

`type`: `single` (jedan odabir), `multi` (više), `text` (slobodan unos).
Vraća 3–5 pitanja. `id` je stabilan string koji frontend vraća natrag.

---

## 4. POST /api/questions/answers

**Request**

```json
{
  "answers": [
    { "id": "q_staple", "value": ["krumpir", "tjestenina"] },
    { "id": "q_breakfast", "value": "ponekad" },
    { "id": "q_yesterday", "value": "burger i pomfrit" }
  ]
}
```

`value` je string ili string[].

**Response 200**

```json
{ "ok": true }
```

---

## 5. POST /api/fridge/scan

Fotka frižidera/ostave u prepoznate namirnice. **Fotka se ne čuva.**

**Request:** `multipart/form-data`, polje `image` (jpeg/png/webp, max 8 MB).
Može se pozvati više puta (frižider, zamrzivač, ostava).

**Response 200**

```json
{
  "items": [
    { "name": "jaja", "quantity": 6, "unit": "kom", "confidence": 0.93, "expiresInDays": 12, "urgency": "ok" },
    { "name": "jogurt", "quantity": 400, "unit": "g", "confidence": 0.71, "expiresInDays": 2, "urgency": "umire" },
    { "name": "špinat", "quantity": 150, "unit": "g", "confidence": 0.68, "expiresInDays": 1, "urgency": "umire" },
    { "name": "kupus", "quantity": 0.5, "unit": "kom", "confidence": 0.55, "expiresInDays": 7, "urgency": "skoro" }
  ],
  "followUpQuestions": [
    "Koliko ti je riže ostalo, pola kile ili skoro ništa?"
  ]
}
```

`confidence` je 0–1. Frontend prikaže sve, a ispod 0.6 vizualno označi kao nesigurno. Lista je **editabilna** — ništa se ne sprema dok se ne pozove PUT /api/pantry.

`expiresInDays` je **procjena** koliko dana namirnica još ima, iz vizualnog stanja i tipičnog roka te vrste hrane. `urgency` je izvedeno: `umire` (≤2 dana), `skoro` (3–7), `ok` (8+).

**Ovo je srce proizvoda, ne dekoracija.** Plan se gradi počevši od onoga što `umire`. Frontend mora te iteme vizualno istaknuti — korisnik mora vidjeti da ga aplikacija spašava od bacanja hrane.

---

## 6. PUT /api/pantry

Sprema potvrđenu listu. Zamjenjuje cijeli pantry (ne dodaje na postojeći).

**Request**

```json
{
  "items": [
    { "name": "jaja", "quantity": 6, "unit": "kom", "expiresInDays": 12 },
    { "name": "jogurt", "quantity": 400, "unit": "g", "expiresInDays": 2 }
  ]
}
```

`unit`: `g`, `ml`, `kom`. `expiresInDays` je opcionalan (ručno dodani itemi ga nemaju).

**Response 200**

```json
{ "ok": true, "count": 2 }
```

---

## 7. GET /api/pantry

**Response 200**

```json
{
  "items": [
    { "id": "pi_1", "name": "jaja", "quantity": 6, "unit": "kom" }
  ]
}
```

---

## 8. POST /api/plan/generate

Generira tjedni plan. **Najdulji poziv — računaj 20–60 s.** Frontend MORA pokazati progress stanje.

**Request** (sve opcionalno)

```json
{ "budgetEur": 35 }
```

| polje | tip | značenje |
|---|---|---|
| `budgetEur` | number | **Tvrdo ograničenje, ne filter.** Plan se gradi da stane u taj budžet. Ako nije poslan, koristi se `budgetPerWeekEur` iz profila; ako ni toga nema, nema ograničenja. |

**Budžet kao ulaz je namjerno obrnut tok.** Frontend treba slider koji ponovno
zove ovu rutu — korisnik spusti s 60 € na 35 € i tjedan se preuredi. To je
glavni interaktivni moment proizvoda.

**Response 200**

```json
{
  "planId": "pl_x1y2",
  "weekStart": "2026-10-12",
  "budgetEur": 35,
  "estimatedTotalEur": 33.8,
  "rescue": {
    "savedItems": ["špinat", "jogurt", "pola kupusa", "mrkva"],
    "savedEur": 11.2,
    "message": "Špinat i jogurt ti umiru za 2 dana — stavio sam ih u ponedjeljak i utorak."
  },
  "saleDriven": {
    "count": 3,
    "items": ["svinjski file", "tikvice"],
    "message": "Svinjski file je -30% ovaj tjedan, iskoristio sam ga tri puta."
  },
  "prepBlocks": [
    {
      "id": "pb_1",
      "day": "nedjelja",
      "startHint": "18:00",
      "minutes": 70,
      "title": "Veliki prep",
      "covers": ["ponedjeljak", "utorak", "srijeda"],
      "mealIds": ["m_1", "m_4", "m_7"],
      "timeline": [
        {
          "track": "pecnica",
          "label": "Piletina",
          "startMinute": 0,
          "durationMinutes": 45
        },
        {
          "track": "stednjak",
          "label": "Riža",
          "startMinute": 10,
          "durationMinutes": 20
        },
        {
          "track": "ti",
          "label": "Nasjeckaj povrće",
          "startMinute": 0,
          "durationMinutes": 10
        },
        {
          "track": "ti",
          "label": "Pakiraj u posude",
          "startMinute": 50,
          "durationMinutes": 15
        }
      ]
    }
  ],
  "days": [
    {
      "date": "2026-10-12",
      "dayName": "ponedjeljak",
      "meals": [
        {
          "id": "m_1",
          "slot": "dorucak",
          "title": "Kajgana sa špinatom",
          "minutes": 12,
          "source": "kuhaj_sad",
          "prepBlockId": null,
          "servings": 2,
          "imageHint": "kajgana u tavi",
          "why": "Špinat ti umire za 2 dana, a rekao si da voliš češnjak.",
          "usesExpiring": ["špinat"]
        }
      ]
    }
  ]
}
```

`slot`: `dorucak`, `rucak`, `vecera`, `snack1`, `snack2`.
`source`: `kuhaj_sad` ili `iz_prepa`.
`days` ima točno 7 elemenata. Broj obroka po danu = `mealsPerDay` iz profila.
`imageHint` je kratki opis za placeholder ili generiranje slike — frontend ga smije ignorirati.

### Nova polja i zašto postoje

**`rescue`** — što je plan spasio od bacanja. `savedEur` je vrijednost tih
namirnica iz kataloga. Ovo je brojka koja ide velikim fontom na ekran.

**`saleDriven`** — koliko je obroka građeno oko akcija iz kataloga. Premisa
nije "planiraj pa kupi", nego "vidi što je na akciji pa smisli tjedan" — tako
kuhaju ljudi, a nijedna aplikacija to ne radi.

**`why`** na svakom obroku — jedna rečenica zašto je taj obrok tu. Transparentan
AI gradi povjerenje i izgleda pametnije od istog plana bez objašnjenja. Nikad
nije `null`.

**`usesExpiring`** — imena pantry namirnica s `urgency: "umire"` koje ovaj obrok
troši. Frontend time označi obroke koji spašavaju hranu.

**`prepBlocks[].timeline`** — paralelni raspored priprema. `track` je jedan od
`pecnica`, `stednjak`, `ti`, `mikrovalna`, `air_fryer`. `startMinute` je offset
od početka prep bloka. Frontend ovo renderira kao trake jednu pod drugom —
recepti su linearni jer su knjige linearne, prava kuhinja je paralelna.
Suma `durationMinutes` na traci `ti` je stvarno aktivno vrijeme korisnika i
uvijek je manja od `minutes` cijelog bloka.

---

## 9. GET /api/plan/:planId

Isti oblik kao odgovor na POST /api/plan/generate.

---

## 10. GET /api/meal/:mealId

**Response 200**

```json
{
  "id": "m_1",
  "title": "Kajgana s kupusom",
  "slot": "dorucak",
  "minutes": 12,
  "servings": 2,
  "source": "kuhaj_sad",
  "steps": [
    "Nasjeckaj kupus na tanke rezance.",
    "Zagrij tavu, dodaj ulje i kupus, pirjaj 5 min.",
    "Razmuti jaja, ulij, posoli i miješaj 2 min."
  ],
  "ingredients": [
    { "name": "jaja", "quantity": 4, "unit": "kom", "inPantry": true, "expiring": false },
    { "name": "špinat", "quantity": 150, "unit": "g", "inPantry": true, "expiring": true },
    { "name": "kupus", "quantity": 200, "unit": "g", "inPantry": false, "expiring": false }
  ],
  "why": "Špinat ti umire za 2 dana, a rekao si da voliš češnjak.",
  "usesExpiring": ["špinat"],
  "nutrition": { "kcal": 420, "protein": 28, "carbs": 12, "fat": 29 }
}
```

`nutrition` je **opcionalno** i može biti `null`. Frontend ne smije pasti ako ga nema.
`why` je uvijek prisutan. `expiring: true` znači da je sastojak iz pantry-ja i
da `umire` — frontend ga označi drugom bojom.

---

## 11. POST /api/meal/:mealId/swap

Zamjenjuje jedan obrok drugim, čuvajući profil i približnu cijenu.

**Request**

```json
{ "reason": "ne jede mi se kupus" }
```

`reason` je opcionalan.

**Response 200:** isti oblik kao GET /api/meal/:mealId, ali s **novim `id`**. Frontend zamijeni obrok na tom mjestu u danu.

---

## 12. GET /api/plan/:planId/cart

**Response 200**

```json
{
  "currency": "EUR",
  "totalEur": 58.4,
  "savedFromPantryEur": 9.2,
  "savedFromWasteEur": 11.2,
  "perMealEur": 2.78,
  "budgetEur": 60,
  "withinBudget": true,
  "deliveryComparison": {
    "deliveryEur": 310.0,
    "savedEur": 251.6,
    "assumption": "21 obrok preko dostave, prosjek 14,76 € po obroku s dostavom i naknadama"
  },
  "onSaleLinesCount": 5,
  "lines": [
    {
      "productId": "p_142",
      "productName": "Pileći file 1 kg",
      "category": "meso",
      "packageSize": 1000,
      "packageUnit": "g",
      "quantity": 1,
      "unitPriceEur": 7.99,
      "lineTotalEur": 7.99,
      "onSale": true,
      "neededAmount": 820,
      "leftoverAmount": 180,
      "matchedIngredients": ["pileći file"],
      "matchQuality": "exact"
    }
  ],
  "unmatched": [
    { "name": "šafran", "quantity": 1, "unit": "g" }
  ],
  "deepLink": "https://www.konzum.hr/..."
}
```

`matchQuality`: `exact`, `fuzzy`, `generic`.
`unmatched` su sastojci za koje nema proizvoda — frontend ih prikaže kao "dokupi sam". Košarica nikad nije prazna zbog neuspjelog matcha.

**`deliveryComparison`** je završni udarac demoa: jedan broj koji kaže koliko
je tjedan kuhan doma jeftiniji od istog broja obroka preko dostave. `assumption`
mora biti ispisan na ekranu — brojka bez pretpostavke je marketing, brojka s
pretpostavkom je argument.

**`savedFromWasteEur`** je vrijednost namirnica koje bi se bacile a plan ih je
iskoristio. Različito od `savedFromPantryEur` (sve što imaš doma, bez obzira na
rok). Obje brojke idu na ekran.

**`withinBudget`** — ako je `false`, frontend to mora pokazati jasno, s razlikom.
Plan koji ne stane u budžet nije bug, ali korisnik to mora znati.

---

## 13. POST /api/plan/:planId/shake

Zamijeni jedan slučajni obrok. Ista logika kao swap, bez odabira obroka.

**Request:** prazan body

**Response 200**

```json
{
  "replacedMealId": "m_7",
  "meal": { "...": "isti oblik kao GET /api/meal/:mealId" }
}
```

Frontend ovo veže na `devicemotion` — **protreseš telefon, obrok se mijenja.**
Hackathon se zove SHAKER; gimmick je trivijalan, a publika ga pamti.

---

## 14. POST /api/taste/candidates

*(dodano 2026-10-08 ~14:50, Leon potvrdio; swipe kartice kvačica / X)*

Deck jela koja korisnik ocjenjuje na karticama prije nego se složi tjedan. AI, 2 paralelna
poziva, **15–30 s**; frontend timeout 60 s. Kandidati se **ne spremaju**: nema
`GET /api/meal/:id` za njih, recept je u kartici.

**Request** (body smije biti prazan)

```json
{ "count": 10 }
```

`count` 4–12, default 10.

**Response 200**

```json
{
  "cards": [
    {
      "id": "cand_a1b2c3d4e5",
      "title": "Pečeni batak s krumpirom",
      "slot": "vecera",
      "minutes": 40,
      "servings": 2,
      "source": "kuhaj_sad",
      "steps": ["...", "..."],
      "ingredients": [{ "name": "pileći batak", "quantity": 500, "unit": "g", "inPantry": false, "expiring": false }],
      "why": "Batak je na akciji, a rekao si da voliš pečeno.",
      "usesExpiring": [],
      "nutrition": null,
      "imageHint": "pečeni batak na limu"
    }
  ]
}
```

Isti oblik kao GET /api/meal/:mealId, plus `imageHint`. Dijeta i alergije su već
provjerene na backendu. Ako AI padne, deck se dopuni statičnim jelima; nikad manje od 4.

---

## 15. POST /api/taste

*(dodano 2026-10-08 ~14:50)*

Što je korisnik odabrao na karticama. **Naslovi** jela (`title`), ne id-evi. Zamjenjuje
prethodni izbor. Planer, swap i shake to čitaju: odabrana jela idu u tjedan (po mogućnosti
doslovno), odbijena se ne pojavljuju.

**Request**

```json
{ "liked": ["Pečeni batak s krumpirom", "Varivo od leće"], "disliked": ["Kajgana s paprikom"] }
```

**Response 200**

```json
{ "ok": true, "likedCount": 2, "dislikedCount": 1 }
```

Red poziva: `PUT /api/pantry` → `POST /api/taste/candidates` → korisnik bira →
`POST /api/taste` → `POST /api/plan/generate`. Preskakanje kartica je dopušteno (planer
radi i bez izbora).

---

## Red poziva (happy path za frontend)

```
POST /api/session
PUT  /api/profile
POST /api/questions            -> prikaži pitanja
POST /api/questions/answers
POST /api/fridge/scan          -> prikaži listu, istakni ono što UMIRE
PUT  /api/pantry
POST /api/plan/generate        -> progress, pa tjedni prikaz + rescue brojka
GET  /api/plan/:id/cart        -> košarica + usporedba s dostavom
```

Fotka frižidera se smije **preskočiti** — tada se pozove PUT /api/pantry s `items: []`.

Budžet slider ponovno zove `POST /api/plan/generate` s novim `budgetEur`.
Shake zove `POST /api/plan/:id/shake`.
