# KuhAI — Spec

Datum: 2026-10-08 · Status: radni · Rok: SHAKER demo, ~5 h backend

## 1. Problem

Planiranje hrane za tjedan je dosadno, a kupovina po planu još dosadnija.
Postojeći alati daju recepte i staju tu. Korisnik ostaje sam s pitanjem
"dobro, a što sad kupiti i koliko".

## 2. Zašto očiti tok nije dovoljan

Očiti tok je: profil → plan → košarica. Ograničenja su mu **izlaz**: složiš
tjedan, pa na kraju vidiš cijenu i vidiš da ti je špinat propao. To je ono što
radi svaki meal planner na tržištu i zato ga nitko ne koristi drugi tjedan.

Problem je redoslijed, ne kvaliteta recepata. Čovjek koji planira tjedan ne
počinje od recepta. Počinje od tri stvari:

- koliko para ima
- što mu već umire u frižideru
- što je ovaj tjedan na akciji

Sve tri su u očitom toku na kraju, kao posljedica. Mi ih stavljamo na početak,
kao ulaz. To je cijeli preokret i iz njega izlazi svih šest stvari ispod:

| | staro | novo |
|---|---|---|
| budžet | izračunan na kraju | **tvrdo ograničenje na ulazu** (§6) |
| frižider | inventar za odbijanje od cijene | **polazna točka plana** (§5) |
| akcije | nema ih | ulaze u planer prompt (§6) |
| prep | linearni koraci | **paralelni timeline s trakama** (§7) |
| cijena | "58 €" | 58 € **vs 310 € preko dostave** (§8) |
| izmjena obroka | swap gumb | swap + **shake** (§9) |

**Ovo nije šest novih podsustava.** Svih šest je drukčija interpretacija onoga
što je i onako na rasporedu: budžet i akcije su rečenica u promptu plus polje u
shemi, rokovi su dva polja u vision shemi, timeline je polje u prep bloku,
usporedba s dostavom je jedno množenje u `cart.ts`, shake dijeli kod sa swapom.
Zato novi smjer stane u istih 5 sati. Ako bi za nešto od ovoga trebao novi
modul, znači da smo pogrešno razumjeli zadatak.

## 3. Rješenje

KuhAI prvo **upozna korisnika** (kratki tap onboarding + par AI pitanja +
fotka frižidera s procjenom rokova), pa iz **budžeta, onoga što umire i onoga
što je na akciji** složi **cijeli tjedan** organiziran kao meal prep, pa iz
toga napravi **košaricu u Konzumu** koja odbija ono što korisnik već ima — i
jedan broj koji kaže koliko je to jeftinije od dostave.

## 4. Što aplikacija zna o korisniku

Fiksno, tap-only (cilj: pod 90 sekundi):
- broj obroka dnevno (2 / 3 / 3+2 snacka / fleksibilno)
- broj ljudi u domaćinstvu
- kuha svaki dan ili meal prep 2–3× tjedno
- vrijeme po obroku (15 / 30 / 45+ min)
- prehrana: sve / bez mesa / vegan / bez svinjetine / bez laktoze / bez glutena
- alergije (slobodan tekst)
- kuhinje koje voli (kartice: domaća, talijanska, azijska, meksička,
  mediteranska, bliskoistočna, indijska, comfort)
- avanturizam (slider: sigurno ↔ eksperimentalno)
- budžet: labavo / srednje / strogo + €/tjedan

Adaptivno, AI generira 3–5 pitanja iz gornjih odgovora. Primjeri:
- "Što od ovoga jedeš najčešće: krumpir, riža, tjestenina, kruh?"
- "Jedeš li doručak uopće?"
- "Što si jeo jučer?" (iz jedne rečenice se izvuče hrpa signala)
- ako vegan → "jesi li ok s tofuom i tempehom?"
- ako strogi budžet → "smiješ li isto jelo 3 dana zaredom?"
- ako 15 min → "imaš li air fryer / mikrovalnu / samo štednjak?"

## 5. Frižider nije inventar, on je protagonist

Vision ne radi popis zaliha. Radi **popis onoga što je u opasnosti.**

- vision model vrati listu namirnica s procjenom količine, `confidence`,
  te **`expiresInDays`** (procjena iz vizualnog stanja i tipičnog roka te vrste
  hrane) i izvedeni **`urgency`**: `umire` (≤2 dana), `skoro` (3–7), `ok` (8+)
- korisnik **potvrdi ili ispravi** — to nije skriveni nedostatak nego dio toka,
  i rok je polje koje se ispravlja isto kao količina
- rezultat ide u `pantry_items`

Zašto rok, a ne samo naziv: hrvatsko domaćinstvo baci 70–80 kg hrane godišnje.
Ta hrana se ne baci jer je nitko nije htio pojesti, nego jer nitko nije na
vrijeme znao da ona ide. Aplikacija koja zna rok može **planirati oko njega**;
aplikacija koja zna samo naziv može ga u najboljem slučaju odbiti od računa.

Posljedica po cijeloj aplikaciji:
- plan se gradi **počevši od onoga što `umire`** (§6)
- svaki obrok nosi `usesExpiring` — koje namirnice spašava
- na ekranu stoji brojka: "Spasio si 4 namirnice · 11,20 € koje bi završilo u
  smeću" (`rescue.savedItems`, `rescue.savedEur`)

To je brojka koju publika osjeti jer je svi imaju u svom frižideru.

## 6. Tjedni plan: ograničenje je ulaz

### Budžet je ograničenje, ne rezultat

`POST /api/plan/generate` prima `budgetEur`. To nije filter nad gotovim planom,
nego **tvrdo ograničenje unutar kojeg se plan gradi**. Pitanje nije "koliko će
me ovaj tjedan koštati", nego **"imam 35 € i ovaj frižider — daj mi najbolji
tjedan"**.

Iz toga ispada glavni interaktivni moment: frontend ima slider koji ponovno
zove `generate`. Korisnik spusti sa 60 € na 35 € i **tjedan se preuredi pred
publikom** — meso se povuče, leftover lanci se produže, akcije dobiju veću
težinu. Ništa u kategoriji ne radi budžet kao primarni input.

Ako plan ne stane u budžet, to se **kaže** (`withinBudget: false` + razlika u
košarici), ne sakrije.

### Rescue-first

Red gradnje plana u promptu je fiksan:

1. namirnice s `urgency: "umire"` — raspoređuju se u prve dane tjedna
2. namirnice s `urgency: "skoro"`
3. proizvodi s `onSale: true` iz kataloga
4. ostatak, uz profil i ravnotežu

Obrnuti red daje plan koji slučajno koristi špinat u četvrtak, kad je špinat već
u smeću.

### Planiraj iz akcije, ne iz recepta

Katalog ima `onSale`. Ta lista ulazi u planer prompt isto kao i pantry. Bake ne
planiraju pa kupuju — vide što je na akciji pa smisle tjedan. Plan vraća
`saleDriven` (koliko je obroka građeno oko akcija i kojih), jer inače korisnik
ne vidi da se to dogodilo.

Kod je jedan dodatak u prompt. Premisa proizvoda se mijenja.

### Ostalo

- 7 dana × N obroka (N iz profila)
- svaki obrok: naslov, vrijeme kuhanja, koraci, sastojci, oznaka
  `kuhaj sad` / `iz prepa`
- **`why` na svakom obroku** — jedna rečenica zašto je taj obrok tu ("špinat ti
  umire za 2 dana, a rekao si da voliš češnjak"). Nikad `null`. Transparentan
  AI gradi povjerenje i isti plan izgleda pametnije s objašnjenjem nego bez.
- namjerno preklapanje sastojaka → kraća i jeftinija lista
- leftover lanci (pečena piletina → wrap → juha)
- ravnoteža: ne 5 dana tjestenine, ali ni 21 različito jelo
- akcija: swap pojedinog obroka bez ruširanja ostatka tjedna

## 7. Prep mode je dirigentska partitura

Prep blok nije lista koraka. Prep blok je **paralelni raspored s trakama**:
`pecnica`, `stednjak`, `ti`, `mikrovalna`, `air_fryer`. Svaki unos ima
`startMinute` (offset od početka bloka) i `durationMinutes`, i frontend ih
renderira kao trake jednu pod drugom.

Recepti su linearni jer su knjige linearne. Prava kuhinja je paralelna: dok
piletina 45 minuta stoji u pećnici, ti u 10 minuta nasjeckaš povrće i riža se
kuha. Linearni koraci to vrijeme sakriju i meal prep ispadne skuplji nego što je.

Posljedica koja se mjeri: suma `durationMinutes` na traci `ti` je **stvarno
aktivno vrijeme korisnika** i uvijek je manja od `minutes` cijelog bloka.
"Nedjelja, 70 min — od toga ti stojiš 25" je drukčija ponuda od "nedjelja, 70
min".

Bez prep blokova aplikacija je samo generator recepata. Bez paralelnog timelinea
prep blok je samo dugi recept.

## 8. Od plana do košarice

1. **Normalizacija** — svi sastojci u kanonske jedinice (`g`, `ml`, `kom`)
2. **Agregacija** — isti sastojak kroz tjedan se sumira
3. **Odbijanje pantry-ja** — što korisnik ima, ne kupujemo
4. **Logika pakiranja** — recept traži 180 g, pakiranje je 1 kg → kupi 1
   pakiranje i raspodijeli ostatak kroz druge obroke. Deterministički kod.
5. **Matching** — sastojak → Konzum SKU (`fuse.js`, LLM samo za ostatak)
6. **Cijena** — ukupno, po obroku, `savedFromPantryEur` (sve što imaš doma),
   `savedFromWasteEur` (ono što bi se bacilo), `withinBudget` + razlika
7. **Usporedba s dostavom** — završni udarac
8. **Naruči** — izvoz liste + deep link u Konzum. Bez pravog plaćanja.

### Jedan broj kao završni udarac

Košarica vraća `deliveryComparison`: 58 € kuhano doma vs 310 € preko dostave,
ušteda 252 €. Publika pamti brojku, ne feature liste — a ovo je jedina brojka u
proizvodu koja je dovoljno velika da ostane u glavi nakon demoa.

`assumption` ("21 obrok preko dostave, prosjek 14,76 € po obroku s dostavom i
naknadama") **MORA biti ispisan na ekranu.** Brojka bez pretpostavke je
marketing; brojka s pretpostavkom je argument. Ako se netko iz publike ne slaže
s 14,76 €, neka se ne slaže s pretpostavkom — to je razgovor koji želimo.

## 9. Shake to swap

Hackathon se zove SHAKER. `POST /api/plan/:id/shake` zamijeni jedan slučajni
obrok; frontend to veže na `devicemotion`. **Protreseš telefon, obrok se
mijenja.**

Tehnički je to swap bez odabira obroka — dijeli cijelu logiku s
`/api/meal/:id/swap`. Gimmick je trivijalan, a publika ga pamti i ime
natjecanja prestaje biti slučajnost.

## 10. Scope

### IN za demo
- onboarding (tap + adaptivna pitanja)
- fotka frižidera → vision **s procjenom roka i `urgency`** → potvrda → pantry
- **budžet kao ulaz** u generiranje plana (slider ponovno generira tjedan)
- **rescue-first plan**: gradi se od onoga što umire; `rescue.savedEur` na ekranu
- **planiranje iz akcija** (`onSale` u promptu, `saleDriven` u odgovoru)
- `why` na svakom obroku
- generiranje punog tjednog plana s prep blokovima i **paralelnim timelineom**
- tjedni prikaz + detalj obroka + swap obroka
- **shake → zamjena slučajnog obroka**
- lista → pakiranja → matching → cijena
- košarica + `savedFromWasteEur` + `withinBudget` + **usporedba s dostavom**
- deep link

### OUT (svjesno, ide na pitch slajd)
Lidl / Wolt / Glovo, pravi checkout i plaćanje, usporedba više trgovina,
live cijene i live akcije (katalog je seedan), praćenje potrošnje kroz tjedne,
logiranje težine i napretka, adaptivna petlja kroz tjedne, scan računa,
barkod, dijeljenje planova, PDF export, prava autentikacija, notifikacije
"ovo ti sutra umire".

## 11. Rizici i odgovori

| rizik | odgovor |
|---|---|
| vision pogriješi namirnicu | lista je editabilna; korisnik potvrđuje |
| **model loše procijeni rok** | `expiresInDays` je polje u editabilnoj listi kao i količina; korisnik ispravlja, `urgency` se preračuna. Procjena je bolja od nikakve informacije, ali nije zadnja riječ. |
| **vision ne vrati rok** | `expiresInDays` je opcionalan → `urgency: "ok"`; plan radi, samo nema rescue brojku |
| **budžet nemoguće zadovoljiti** | `withinBudget: false` + jasno ispisana razlika. Nikad tihi fail i nikad plan koji laže da je u budžetu. |
| **budžet slider spamira generate** | poziv traje 20–60 s; frontend debounce i otkazivanje prethodnog zahtjeva, backend ne drži stanje između poziva |
| planer predug / timeout | streaming; fallback na generiranje dan-po-dan |
| **timeline nekonzistentan** (trake se preklapaju, `ti` duži od bloka) | timeline je prikaz, ne izvršavanje — frontend ima fallback na linearne korake iz `meal.steps`; krivi offset je ružan, ne fatalan |
| matcher ne nađe proizvod | generički proizvod + prosječna cijena, nikad prazno |
| košarica apsurdna (10 l ulja) | logika pakiranja je kod, ne AI |
| **usporedba s dostavom izgleda izmišljeno** | `assumption` je obavezan i ide na ekran; brojka se izvodi iz broja obroka, ne iz okruglog broja |
| **`savedFromWasteEur` naduto** | računa se samo iz namirnica s `urgency: "umire"` koje plan stvarno troši (`usesExpiring`), po cijeni iz kataloga — ne po procjeni modela |
| model izmisli sastojak | u prompt ide samo lista kategorija iz kataloga |
| **shake vrati isti obrok** | swap logika isključuje trenutni obrok; u najgorem slučaju gimmick ne impresionira, ništa ne puca |
| internet na sceni | zadnja verzija deployana na Railwayu |

## 12. Uspjeh

Demo u 5 minuta prođe ovaj put, bez ručne intervencije i bez rušenja:

1. **Fotka frižidera** na sceni → lista namirnica
2. → "**špinat i jogurt ti umiru za 2 dana**" — aplikacija prva kaže problem
3. 60 s onboardinga, tap-tap-tap + 3 AI pitanja koja se vide da su iz odgovora
4. **Slider na 35 €** → generiraj → tjedan koji počinje špinatom i jogurtom
5. **Spustim slider** → tjedan se **preuredi pred publikom**
6. **Prep timeline**: nedjelja, 70 min, tri trake — ti stojiš 25 min
7. **Protresem telefon** → obrok se zamijeni
8. Košarica → **"58 € doma vs 310 € preko dostave — 252 € uštede"** + ispisana
   pretpostavka, i "spasio si 11,20 € hrane"

Mjerilo nije "sve rute rade". Mjerilo je da publika nakon demoa pamti dvije
stvari: da im aplikacija zna što im umire u frižideru, i onu zadnju brojku.
