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

---

## Otvoreno

- **`ANTHROPIC_API_KEY`** — treba potvrditi da postoji API kredit (ne Claude
  Code pretplata). Ako ne, ide AI Gateway ili OpenRouter: isti kod, druga env
  varijabla.
- **Dizajn i logo** — ekipa radi, dolazi kasnije. Backend ne blokira.
- **Postojeći Railway projekti** — Leon je tražio brisanje; čeka se lista i
  njegova potvrda prije ikakvog brisanja.
