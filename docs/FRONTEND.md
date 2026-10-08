# AJkuham — za frontend tim

Ovo je sve što trebate od nas. Ne morate čekati da backend bude gotov.

## Jedino što dijelimo

**`docs/API.md`** — 13 ruta s točnim JSON-ima. To je zamrznuti kontrakt.
Mockajte te odgovore i radite ekrane. Kad backend bude live, zamijenite base URL
i to je cijela integracija.

Ako vam nešto u kontraktu fali ili je glupo oblikovano — **recite odmah**, prvi
sat je jedini trenutak kad se to mijenja bez boli.

Pročitajte i `docs/SPEC.md` sekcije 2 i 5–9. Tamo je objašnjeno *zašto* su ekrani
takvi; bez toga se lako napravi lijep ali pogrešan frontend.

## Što ovu aplikaciju razlikuje (i što frontend mora prenijeti)

Ovo nije "AI daje recepte". Razlika je u **smjeru**: ograničenja su ulaz, ne
izvještaj na kraju. Četiri stvari nose demo i sve četiri su vizualne:

1. **Frižider koji umire.** Namirnice s `urgency: "umire"` moraju gorjeti na
   ekranu. Korisnik mora vidjeti da ga aplikacija spašava od bacanja hrane.
2. **Budžet slider koji pregrađuje tjedan.** Spustiš 60 € na 35 € i plan se
   preuredi. To je jedini moment u kojem publika vidi proizvod kako *misli*.
3. **Prep timeline s paralelnim trakama.** Ne lista koraka — trake.
4. **Jedna brojka na kraju.** Koliko je jeftinije od dostave.

## Pravila

- Nema logina. `POST /api/session` jednom, `sessionId` u localStorage, pa
  header `x-session-id` na svim ostalim pozivima.
- `POST /api/plan/generate` traje **20–60 s**. Treba pravo progress stanje,
  ne spinner koji se vrti u prazno. Ideja: tekst se mijenja ("čitam tvoj
  profil…", "gledam što ti umire u frižideru…", "slažem ponedjeljak…").
- `POST /api/fridge/scan` vraća `confidence` po namirnici. Sve pod 0.6
  označite vizualno kao nesigurno. Lista **mora biti editabilna** — korisnik
  briše, mijenja količinu, **mijenja procijenjeni rok**, dodaje ručno. Ništa se
  ne sprema dok ne pozovete `PUT /api/pantry`.
- `nutrition` može biti `null`. `why` je uvijek prisutan.
- Fotka frižidera se smije preskočiti — tada `PUT /api/pantry` s `items: []`.
- Budžet slider ponovno zove `POST /api/plan/generate` s novim `budgetEur`.
  **Debounce obavezno** — poziv traje do minute, ne smije se slati na svaki
  piksel pomaka. Potvrda ("Primijeni") je bolja od automatskog slanja.
- Ako `cart.withinBudget` je `false`, to se mora jasno vidjeti, s razlikom.
  Plan koji ne stane u budžet nije bug, ali korisnik to mora znati.
- `deliveryComparison.assumption` **mora biti ispisan na ekranu**. Brojka bez
  pretpostavke je marketing.

## Ekrani (6)

| ruta | što radi |
|---|---|
| `/` | landing, jedan CTA |
| `/onboarding` | 6 tap ekrana + 3–5 AI pitanja |
| `/frizider` | kamera/upload → lista za potvrdu, **rokovi istaknuti i editabilni** → spremi |
| `/plan` | tjedan, 7 dana, **budžet slider**, prep blokovi, `rescue` brojka na vrhu |
| `/obrok/:id` | koraci, sastojci s "imaš doma" i "umire", `why`, swap |
| `/kosarica` | linije, cijena, ušteda od pantry-ja i od otpada, usporedba s dostavom |

### `/frizider` — detalji
Grupiraj po `urgency`: prvo `umire`, pa `skoro`, pa `ok`. Itemi koji umiru
dobivaju jasnu vizualnu oznaku i broj dana. `followUpQuestions` prikaži kao
kratka pitanja ispod liste; odgovori idu u `PUT /api/pantry` kao ispravke
količina.

### `/plan` — detalji
Na vrhu `rescue.message` i `rescue.savedEur` — to je prva stvar koju korisnik
pročita. `saleDriven.message` kao druga linija. Obroci s nepraznim
`usesExpiring` dobivaju oznaku. Prep blokovi nisu fusnota, oni su istaknuti —
to je ono što aplikaciju razlikuje od generatora recepata.

### Prep timeline — kako renderirati
`prepBlocks[].timeline` je lista `{ track, label, startMinute, durationMinutes }`.
Trake su `pecnica`, `stednjak`, `ti`, `mikrovalna`, `air_fryer`. Renderiraj kao
vodoravne trake jednu pod drugom, s vremenskom osi u minutama:

```
PEĆNICA   ████████████████ piletina (45 min)
ŠTEDNJAK      ██████ riža      ████ leća
TI        ██ sjeckaj  ░░        ██ pakiraj  ░░
          0        15        30        45    60   70
```

Traka `ti` je jedina koja troši korisnikovu pažnju — njezina suma je stvarno
aktivno vrijeme i **mora biti vidljivo manja** od ukupnog trajanja bloka. Ta
razlika je cijela poanta ("blok traje 70 min, ti stojiš 25").

Ako `timeline` fali ili je nekonzistentan, padni na linearne `steps` iz
`GET /api/meal/:id`. Degradacija je predviđena, ali nije default.

### Shake
`POST /api/plan/:planId/shake` zamijeni jedan slučajni obrok. Veži na
`devicemotion` — **protreseš telefon, obrok se mijenja.** Traži korisničku
dozvolu za senzore na iOS-u. Ako senzor nije dostupan, ostavi dugme.

## Dizajn

Boje, logo i tipografija su **vaša odluka** — mi vam to ne diramo. Kad logo
bude gotov, ide u repo i README.

Jedino što molimo: ekrani koji idu na demo (`/frizider`, `/plan`, `/kosarica`)
moraju raditi na **telefonu**, jer se frižider fotka telefonom na sceni, a
shake traži telefon u ruci.

## Što NE radite

Lidl/Wolt/Glovo, pravi checkout, usporedbu trgovina, live cijene i akcije,
logiranje težine, praćenje potrošnje, notifikacije roka, dijeljenje, PDF.
Sve je OUT za demo (vidi `docs/SPEC.md`, sekcija 10).

## Kontakt točka

Backend URL i svaka promjena kontrakta javlja se u repou — commit čiji naslov
počinje s `api!:`. Ako toga nema, kontrakt je isti.
