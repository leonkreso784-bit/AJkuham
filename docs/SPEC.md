# AJkuham — Spec

Datum: 2026-10-08 · Status: radni · Rok: SHAKER demo, ~5 h backend

## 1. Problem

Planiranje hrane za tjedan je dosadno, a kupovina po planu još dosadnija.
Postojeći alati daju recepte i staju tu. Korisnik ostaje sam s pitanjem
"dobro, a što sad kupiti i koliko".

## 2. Rješenje

AJkuham prvo **upozna korisnika** (kratki tap onboarding + par AI pitanja +
fotka frižidera), pa složi **cijeli tjedan** organiziran kao meal prep, pa iz
toga napravi **košaricu u Konzumu** koja odbija ono što korisnik već ima.

## 3. Što aplikacija zna o korisniku

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

Fotka frižidera/ostave:
- vision model vrati listu namirnica s procjenom količine i `confidence`
- korisnik **potvrdi ili ispravi** — to nije skriveni nedostatak nego dio toka
- rezultat ide u `pantry_items`

## 4. Tjedni plan

- 7 dana × N obroka (N iz profila)
- svaki obrok: naslov, vrijeme kuhanja, koraci, sastojci, oznaka
  `kuhaj sad` / `iz prepa`
- **prep blokovi**: "nedjelja, 70 min — skuhaj ovo 4 stvari, pokriva pon–sri".
  Bez ovoga je aplikacija samo generator recepata.
- namjerno preklapanje sastojaka → kraća i jeftinija lista
- leftover lanci (pečena piletina → wrap → juha)
- ravnoteža: ne 5 dana tjestenine, ali ni 21 različito jelo
- akcija: swap pojedinog obroka bez ruširanja ostatka tjedna

## 5. Od plana do košarice

1. **Normalizacija** — svi sastojci u kanonske jedinice (`g`, `ml`, `kom`)
2. **Agregacija** — isti sastojak kroz tjedan se sumira
3. **Odbijanje pantry-ja** — što korisnik ima, ne kupujemo
4. **Logika pakiranja** — recept traži 180 g, pakiranje je 1 kg → kupi 1
   pakiranje i raspodijeli ostatak kroz druge obroke. Deterministički kod.
5. **Matching** — sastojak → Konzum SKU (`fuse.js`, LLM samo za ostatak)
6. **Cijena** — ukupno, po obroku, i koliko je ušteđeno zbog pantry-ja
7. **Naruči** — izvoz liste + deep link u Konzum. Bez pravog plaćanja.

## 6. Scope

### IN za demo
- onboarding (tap + adaptivna pitanja)
- fotka frižidera → vision → potvrda → pantry
- generiranje punog tjednog plana s prep blokovima
- tjedni prikaz + detalj obroka + swap obroka
- lista → pakiranja → matching → cijena
- košarica + deep link

### OUT (svjesno, ide na pitch slajd)
Lidl / Wolt / Glovo, pravi checkout i plaćanje, usporedba više trgovina,
logiranje težine i napretka, adaptivna petlja kroz tjedne, scan računa,
barkod, dijeljenje planova, PDF export, prava autentikacija.

## 7. Rizici i odgovori

| rizik | odgovor |
|---|---|
| vision pogriješi namirnicu | lista je editabilna; korisnik potvrđuje |
| planer predug / timeout | streaming; fallback na generiranje dan-po-dan |
| matcher ne nađe proizvod | generički proizvod + prosječna cijena, nikad prazno |
| košarica apsurdna (10 l ulja) | logika pakiranja je kod, ne AI |
| model izmisli sastojak | u prompt ide samo lista kategorija iz kataloga |
| internet na sceni | zadnja verzija deployana na Railwayu |

## 8. Uspjeh

Demo u 5 minuta prođe put: fotka frižidera → onboarding → tjedni plan →
košarica s cijenom — bez ručne intervencije i bez rušenja.
