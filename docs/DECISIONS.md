# AJkuham — Odluke

Kratki zapis **zašto** je nešto odlučeno, da se ne vraćamo na isto u 5. satu.

---

### D1 — Ime: AJkuham
Čita se "aj kuham" i "AI kuham" u istoj riječi. Hrvatski, mladalački,
objašnjava se sam u dvije sekunde. Odbačeni: Klopa, Gusto, Spiza, Nana.

### D2 — Nije fitness aplikacija
Prva verzija koncepta bila je makro/fitness planer. Odbačeno: cilj je planer
koji **zna osobu** i složi tjedan hrane. Makroi su opcionalni detalj u detalju
obroka, ne okvir proizvoda. Fitness cilj ostaje moguć input, ne premisa.

### D3 — Railway, ne Supabase
Jedini pravi argument za Supabase bio je Storage za fotke frižidera. Ali fotke
**ne čuvamo** — upload, vision, spremi prepoznatu listu, baci fotku. Time
Storage nestaje iz jednadžbe. Ostaje Postgres + jedan API servis, što je
Railway u 10 minuta, bez Deno Edge Functions i bez dva dashboarda.

### D4 — Backend i frontend su odvojeni, dijele samo `docs/API.md`
Frontend radi drugi dio tima (Lovable ili ne — nebitno nam). Nitko ne kopira
kod. Kontrakt se zamrzava u prvih 30 minuta i od te minute frontend može raditi
protiv mockanih odgovora bez da nas čeka. Integracija na kraju je 20 minuta,
ne 2 sata.

### D5 — Nema autentikacije
Anonimna sesija (`sessionId` u localStorage, header `x-session-id`). Login ekran
na petominutnom demu ne donosi ništa, a jede 45 minuta. Produkcijski bi ovdje
išao pravi auth.

### D6 — Logika pakiranja i cijene nije AI
Deterministički kod u `src/engine/`. Ako model računa košaricu, prije ili
poslije dobijemo 10 litara ulja za jedan tjedan. To je najvidljiviji način da
demo ispadne glup. Model radi kreativnost i strukturu; brojeve radi kod.

### D7 — Planer smije koristiti samo kategorije iz kataloga
Lista dostupnih kategorija ide u prompt. Bez tog ograničenja model izmisli
sastojak koji se ne može kupiti i matcher nema što napraviti. Jedno ograničenje
rješava većinu problema mapiranja.

### D8 — Košarica se ne sprema u bazu
Izračuna se iz plana, pantry-ja i kataloga na svaki GET. Nema stanja koje može
ostati zastarjelo nakon swapa obroka.

### D9 — Katalog je seedani JSON, ne live scrape
~200–250 proizvoda odabranih da pokriju realne tjedne jelovnike, s pravim
cijenama i **pravim veličinama pakiranja**. Live scraping je fragilan i nije
vrijedan rizika na demu. Produkcijski bi išlo partnerstvo ili scheduled scrape.

### D10 — Fotka frižidera je IN za demo
Najveći wow moment i uvodni hook demoa, ne bonus na kraju. Rizik nesigurnog
prepoznavanja rješava se time da je lista editabilna — korisnik potvrđuje, i to
je prikazano kao feature ("provjeri, pa potvrdi"), ne kao nedostatak.

### D11 — Sve na `main`, bez grana
Hackathon. Grane i PR-ovi su režija koja ne donosi ništa u 9 sati.

### D12 — Zod je jedini izvor istine za oblik podataka
Ista shema validira API input i služi kao structured-output shema za AI SDK.
TypeScript tipovi se izvode s `z.infer`, ne pišu ručno.

### D13 — Budžet je ulaz u planer, ne izračun na kraju
`POST /api/plan/generate` prima `budgetEur` kao **tvrdo ograničenje**. Obrnuti
tok ("složi plan, pa vidi cijenu") daje plan koji korisnik odbaci jer ga ne može
platiti, i onda nema što s njim. Ovako je pitanje "imam 35 €, daj mi najbolji
tjedan" — a slider koji ponovno generira tjedan je jedini moment u demu u kojem
publika vidi proizvod kako **misli**. Ako plan ne stane, `withinBudget: false` i
vidljiva razlika; tihi fail je gori od lošeg plana.

### D14 — Vision procjenjuje rok, i taj rok diktira plan
`expiresInDays` + izvedeni `urgency` nisu dodatno polje nego **svrha scana**.
Inventar bez roka može samo odbiti stvari od računa; inventar s rokom može
planirati oko njih. Hrvatsko domaćinstvo baci 70–80 kg hrane godišnje, i to ne
jer je nitko ne želi, nego jer nitko ne zna da ide. Rok procjenjuje model (broj),
kategoriju presuđuje kod (`umire` ≤2 / `skoro` 3–7 / `ok` 8+) — ne dajemo modelu
da izmišlja granice. Pogrešna procjena nije rizik jer je rok polje u editabilnoj
listi, isto kao količina.

### D15 — Plan se gradi rescue-first, u fiksnom redu
Red u promptu je eksplicitan: `umire` → `skoro` → `onSale` → ostatak. Bez
propisanog reda model raspodijeli špinat u četvrtak, a tada je špinat već u
smeću — plan koji "koristi pantry" nije isto što i plan koji **spašava** pantry.
`rescue.savedEur` postoji da se ta razlika vidi na ekranu, jer inače je
nevidljiva.

### D16 — Akcije iz kataloga ulaze u planer prompt
`onSale` lista ide u prompt isto kao pantry. Ljudi ne planiraju pa kupuju — vide
što je na akciji pa smisle tjedan, i nijedan planer to ne radi. Cijena izmjene je
jedna rečenica prompta i jedno polje u odgovoru (`saleDriven`); cijena
izostavljanja je da smo još jedan generator recepata s cjenikom. Zato katalog
mora imati realno raspoređen `onSale` već u seedu (D9), ne random flag.

### D17 — Prep blok je paralelni timeline, ne lista koraka
`prepBlocks[].timeline` ima trake (`pecnica`, `stednjak`, `ti`, …) s
`startMinute` i `durationMinutes`. Recepti su linearni jer su knjige linearne;
prava kuhinja je paralelna i linearni koraci **sakriju** da ti od 70 minuta bloka
stojiš 25. Ta brojka je argument za meal prep, a traka na ekranu je jedini vizual
u kategoriji koji nitko ne radi. Padne li timeline, frontend ima linearne
`steps` — degradacija je predviđena, ali nije default.

### D18 — Jedna brojka na kraju: usporedba s dostavom
`deliveryComparison` u košarici. Publika ne pamti feature liste, pamti "58 € vs
310 €". `assumption` je **obavezan i ide na ekran**: brojka bez pretpostavke je
marketing, brojka s pretpostavkom je argument, i ako se netko ne slaže, neka se
ne slaže s pretpostavkom. Brojka je množenje u `cart.ts`, nikad procjena modela —
vrijedi D6.

### D20 — Katalog ostaje izmišljen, iako postoji pravi izvor
Pronađen je `cijene-api` (github.com/senko/cijene-api): Python crawler za
**službene cjenike** hrvatskih lanaca, koje su trgovci obvezni javno
objavljivati po Odluci NN 75/2025. Podržava Konzum, Lidl, Plodine, Spar, Tommy,
Kaufland, Studenac, dm i još ~20 lanaca. Nema hostani API — crawler se vrti
lokalno i ispljune CSV.

**Svjesno ga ne koristimo za demo.** Prave cijene bi bile jači argument od
realnih, i otvorile bi usporedbu Konzum vs Lidl skoro besplatno. Ali: output
treba prevesti u naš format, a veličine pakiranja su u cjenicima zapisane
unutar naziva proizvoda, pa traže parsiranje s nepredvidivim rubnim
slučajevima. To je 30–50 minuta s neizvjesnošću, a publika ne provjerava
cijene — provjerava izgleda li košarica razumno, a to rješava `packageSize`,
ne tačnost cijene do centa.

Ako ostane vremena nakon S6, ovo je prva stvar koju vrijedi dodati: crawler se
vrti **jednom, offline**, rezultat se commita kao `data/konzum-products.json`.
Na demu nikad nema Pythona ni mrežnog poziva prema trgovinama.

### D19 — Shake ostaje, ali je prvi na rezu
Natjecanje se zove SHAKER; `POST /api/plan/:id/shake` je ~10 linija koje zovu
istu swap funkciju, pa ga nema smisla ne imati. Ali nije nosiv: ako kasnimo, pada
prvi, prije nutritivnih podataka i prije timelinea. Gimmick koji dijeli kod s
pravom funkcijom je besplatan; gimmick koji traži vlastiti kod se ne radi.

---

## Otvoreno

- **Hosting i baza** — **jedino što blokira kod.** Railway je plaćen ali CLI i
  dalje javlja istekao trial; vjerojatno plan nije na workspaceu
  `LeonKreso's Projects`. Rezerva je Neon preko Vercela, besplatan, zaustavljen
  na prihvaćanju uvjeta u browseru. Točne komande za oba puta su u
  `docs/STATUS.md`. `postgres.js` je izabran upravo zato što radi s oba — mijenja
  se samo `DATABASE_URL`.
- **Dizajn i logo** — ekipa radi, dolazi kasnije. Backend ne blokira.

## Zatvoreno nakon pripremne sesije

- `ANTHROPIC_API_KEY` **radi** — testiran pravim pozivom, HTTP 200,
  `claude-sonnet-5-5`. Nije u repou, živi u `.env`.
- Stari Railway projekti obrisani (zakazano za 2026-10-10) nakon Leonove
  potvrde.
- Klara610 pozvana na repo s write pristupom.
