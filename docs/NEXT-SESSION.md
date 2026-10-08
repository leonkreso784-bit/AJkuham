# KuhAI — brief za sljedeću sesiju

Copy-paste. Stanje je u `docs/STATUS.md`; ovo je akcija.

---

## 0. Gdje smo (2026-10-08, ~13:00)

- Backend je **gotov, deployan i testiran na produkciji**: svih 13 ruta, vision
  s pravom fotkom, 4 rubna profila, swap i shake.
- Live: **https://kuhai-api-production.up.railway.app** (`/health`)
- Frontend se razvija u drugoj sesiji protiv tog URL-a.
- Rok: **18:48** (`.claude/deadline.json`, vidi se u statuslineu).

Provjera u 10 sekundi:

```bash
curl -s https://kuhai-api-production.up.railway.app/health   # {"ok":true,...}
npm run typecheck                                              # mora biti čist
```

---

## 1. Kickoff prompt — zalijepi na početku sesije

```text
Radimo KuhAI backend: C:\Users\leonk\Documents\SHAKER projekt.
Hackathon SHAKER, rok je u .claude/deadline.json i vidi se u statuslineu.

Pročitaj prvo, cijele i u ovom redu:
  docs/STATUS.md      gdje smo, što je testirano, zamke
  CLAUDE.md           pravila rada i što se ne smije dirati
  docs/API.md         ZAMRZNUTI kontrakt, 13 ruta
  src/app.ts          sve rute (Hono), ovdje je spoj svega

Backend je gotov i live na https://kuhai-api-production.up.railway.app.
Frontend se razvija paralelno u drugoj sesiji protiv tog URL-a.

Tvoj posao sad je PODRŠKA INTEGRACIJI I DEMU, ne gradnja:
- ako frontend javi grešku, prvo `railway logs --service kuhai-api`, pa reproduciraj curl-om
- NE radi deploy bez najave: `railway up` zamijeni kontejner i API je ~30 s
  nedostupan (502) — frontend to vidi kao "backend se crashao"
- sve promjene: npm run typecheck, pozovi rutu, commit na main, push,
  pa tek onda `railway up --service kuhai-api -d` i javi kad je gore
- docs/API.md se mijenja samo commitom koji počinje s api!: i uz moju potvrdu

Lokalno: PORT=3001 npm run dev (3000 je zauzet drugim procesom).
Smoke skripte i uzorci: docs/samples/*.json su pravi odgovori s produkcije.
```

---

## 2. Ako se "backend crasha" — checklista

1. `curl -s https://kuhai-api-production.up.railway.app/health` — ako vraća
   `{"ok":true}`, backend nije pao. Pitaj frontend koju rutu, koji status i
   koliko je trajalo.
2. `railway logs --service kuhai-api` — traži `[app] neuhvacena greska`,
   `[planner]`, `[scan]`. Svaki AI poziv ima fallback; 500 je rijedak.
3. `railway deployment list --service kuhai-api` — ako je zadnji deploy u
   zadnjih par minuta, frontend je pogodio prozor zamjene kontejnera.
4. Timeouti: `POST /api/plan/generate` traje **60–90 s**, `/fridge/scan`
   10–16 s, swap/shake 10–20 s. Frontend fetch mora imati timeout ≥ 120 s.
5. 400 `VALIDATION_ERROR` s porukom je frontend greška u bodyju, ne crash.
   Poruka kaže koje polje.

---

## 3. Što je gdje

| | |
|---|---|
| rute | `src/app.ts` |
| pitanja / vision / planer | `src/ai/questions.ts`, `src/ai/vision.ts`, `src/ai/planner.ts` |
| engine (nije AI) | `src/engine/{units,packaging,matcher,cart}.ts`, provjere `npx tsx src/engine/__check.ts` |
| katalog | `data/konzum-products.json`, `npm run db:seed` |
| uzorci odgovora | `docs/samples/*.json` |
| deploy | `railway up --service kuhai-api -d`, logovi `railway logs --service kuhai-api` |

---

## 4. Poznate stvari koje NISU bugovi

- Plan na 35 € izađe ~50 €: cijela pakiranja i začini. `withinBudget: false`
  s razlikom je po dizajnu (D13). Opcija ako Leon želi: pravilo u promptu da
  model ne navodi sol/papar/ulje (reže 3–5 €).
- `saleDriven.count` je visok (13–17 od 21) jer riža/mlijeko s akcije ulaze u
  većinu obroka. Brojka je točna po definiciji, ali ako smeta, brojati samo
  obroke s mesnim/svježim sidrom.
- Svaki `generate` radi novi `planId`; stari planovi ostaju u bazi.

## 5. Ako kasnimo

Reže se u ovom redu: shake → nutritivni podaci → paralelni timeline →
`followUpQuestions` → `saleDriven` poruka → adaptivna pitanja.

**Nikad se ne reže:** vision s rokovima, rescue-first plan, budžet kao ulaz,
logika pakiranja, usporedba s dostavom. Sve to radi.
