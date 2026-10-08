# AJkuham — za frontend tim

Ovo je sve što trebate od nas. Ne morate čekati da backend bude gotov.

## Jedino što dijelimo

**`docs/API.md`** — 12 ruta s točnim JSON-ima. To je zamrznuti kontrakt.
Mockajte te odgovore i radite ekrane. Kad backend bude live, zamijenite base URL
i to je cijela integracija.

Ako vam nešto u kontraktu fali ili je glupo oblikovano — **recite odmah**, prvi
sat je jedini trenutak kad se to mijenja bez boli.

## Pravila

- Nema logina. `POST /api/session` jednom, `sessionId` u localStorage, pa
  header `x-session-id` na svim ostalim pozivima.
- `POST /api/plan/generate` traje **20–60 s**. Treba pravo progress stanje,
  ne spinner koji se vrti u prazno. Ideja: tekst se mijenja ("čitam tvoj
  profil…", "slažem ponedjeljak…", "računam košaricu…").
- `POST /api/fridge/scan` vraća `confidence` po namirnici. Sve pod 0.6
  označite vizualno kao nesigurno. Lista **mora biti editabilna** — korisnik
  briše, mijenja količinu, dodaje ručno. Ništa se ne sprema dok ne pozovete
  `PUT /api/pantry`.
- `nutrition` može biti `null`. Ne smije puknuti ekran.
- Fotka frižidera se smije preskočiti — tada `PUT /api/pantry` s `items: []`.

## Ekrani (6)

| ruta | što radi |
|---|---|
| `/` | landing, jedan CTA |
| `/onboarding` | 6 tap ekrana + 3–5 AI pitanja |
| `/frizider` | kamera/upload → lista za potvrdu → spremi |
| `/plan` | tjedan, 7 dana, prep blokovi istaknuti |
| `/obrok/:id` | koraci, sastojci s oznakom "imaš doma", swap |
| `/kosarica` | linije, cijena, ušteda od pantry-ja, "Naruči" |

Prep blokovi su ono što aplikaciju razlikuje od generatora recepata — zaslužuju
vizualni prioritet na `/plan`, ne fusnotu.

## Dizajn

Boje, logo i tipografija su **vaša odluka** — mi vam to ne diramo. Kad logo
bude gotov, ide u repo i u README.

Jedino što molimo: tri ekrana koja idu na demo (`/frizider`, `/plan`,
`/kosarica`) moraju raditi na **telefonu**, jer se frižider fotka telefonom na
sceni.

## Što NE radite

Lidl/Wolt/Glovo, pravi checkout, usporedbu trgovina, logiranje težine,
dijeljenje, PDF. To je OUT za demo (vidi `docs/SPEC.md`).

## Kontakt točka

Backend URL i svaka promjena kontrakta javlja se u repou — commit čiji naslov
počinje s `api!:`. Ako toga nema, kontrakt je isti.
