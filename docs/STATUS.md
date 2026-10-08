# AJkuham — Stanje i handoff

Zadnje ažurirano: **2026-10-08**, kraj pripremne sesije.
Gradnja **nije** počela. Priprema je zaključena.

**Sljedeća sesija kreće iz `docs/NEXT-SESSION.md`** — tamo je gotov kickoff
prompt i gotovi briefovi za sva 4 agent tracka. Ovaj dokument je stanje; onaj je
akcija.

---

## TL;DR

**Nema blokada.** Sve je napisano, temelj stoji, `tsc --noEmit` je čist, baza
radi i shema je primijenjena. Sljedeća sesija ide ravno na `docs/PLAN.md` korak
S1, s 4 agenta paralelno.

---

## Što je gotovo

### Dokumentacija
| file | sadržaj |
|---|---|
| `docs/NEXT-SESSION.md` | **copy-paste** kickoff prompt + 4 agent briefa |
| `CLAUDE.md` | pravila rada, stack, struktura, što se ne smije dirati |
| `docs/SPEC.md` | 12 sekcija; §2 objašnjava zašto očiti tok nije dovoljan |
| `docs/API.md` | **zamrznuti kontrakt**, 13 ruta s točnim JSON-ima |
| `docs/PROMPTS.md` | **gotovi produkcijski promptovi** za sva 4 AI poziva |
| `docs/DATA-MODEL.md` | 7 tablica, kanonske jedinice, pretvorbe |
| `docs/PLAN.md` | raspored po satima, agent trackovi, što se reže |
| `docs/DECISIONS.md` | 19 odluka s obrazloženjem |
| `docs/FRONTEND.md` | sve za frontend tim, uključujući nove ekrane |

### Kod — temelj, typecheck čist
| file | sadržaj |
|---|---|
| `package.json` | Hono, Drizzle, postgres.js, Zod, AI SDK, fuse.js — **instalirano** |
| `src/db/schema.ts` | 7 tablica, uključujući `urgency`, `why`, `rescue`, `budget_eur` |
| `src/db/client.ts` | postgres.js + Drizzle; radi i na Railwayu i na Neonu |
| `src/schemas/index.ts` | sve Zod sheme; AI-strane razdvojene od API-strana |
| `src/env.ts` | validacija env-a, pada s jasnom porukom |
| `tsconfig.json`, `drizzle.config.ts`, `vercel.json` | |

**Nije napisano, i to je namjerno:** `src/app.ts`, `src/server.ts`,
`src/ai/*`, `src/engine/*`, `data/konzum-products.json`. To je posao sljedeće
sesije i raspodijeljeno je na trackove.

### Alat
`.claude/statusline.js` dodaje SHAKER countdown ispred postojećeg statuslinea.
Rok je u `.claude/deadline.json` (trenutno **2026-10-08 18:48**) — promjena
vrijedi odmah i u svakoj novoj sesiji. Zeleno >3 h, žuto 1–3 h, crveno <1 h.

### Računi i servisi
| | stanje |
|---|---|
| GitHub repo | `leonkreso784-bit/AJkuham`, public, sve na `main` |
| Klara610 | **pozvana** s write pristupom — mora prihvatiti invite |
| `ANTHROPIC_API_KEY` | **radi**, testirano pravim pozivom (HTTP 200, `claude-sonnet-5-5`). U `.env`, gitignoran |
| Railway CLI | instaliran, prijavljen kao LeonKreso |
| Railway projekti | 4 stara zakazana za brisanje 2026-10-10 |
| Vercel CLI | instaliran, prijavljen kao `leonkreso784-bit` |
| Vercel projekt | `leon-kresos-projects/ajkuham`, povezan s GitHub repom |

---

## Baza — riješeno

Railway projekt **`ajkuham`** (`381157da-303a-4bad-92f3-2e43043ac9af`),
workspace `LeonKreso's Projects`, environment `production`.
Postgres 18, EU West, volume 4.9 GB.

**Shema je primijenjena** (`npm run db:push`, svih 7 tablica + foreign keyevi).

Jedna zamka za sljedeću sesiju: Railwayev `DATABASE_URL` pokazuje na
`postgres.railway.internal`, što **ne radi izvan Railwayeve mreže**. Zato je
kreiran javni TCP proxy:

```
maglev.proxy.rlwy.net:36534  ->  Postgres:5432
```

`.env` već sadrži connection string preko tog proxyja. Ako ga treba ponovno
izvući:

```bash
railway variables --service Postgres --json     # PGUSER, POSTGRES_PASSWORD, PGDATABASE
railway tcp-proxy list --service Postgres       # host i port proxyja
```

Kad backend bude deployan **na Railway**, tamo treba koristiti interni
`DATABASE_URL` (brže i bez prolaza kroz proxy); lokalno ide proxy verzija.

### Dizajn i logo
Ekipa radi, nije gotovo. **Ne blokira backend.** Kad dođe, ide u repo i README.

---

## Što se dogodilo u pripremnoj sesiji, ukratko

Proizvod je prošao kreativni preokret. Prva verzija koncepta bila je fitness
planer s makroima; druga je bila "AI meal planner" (profil → plan → košarica).
Ni jedno nije dovoljno — očiti tok stavlja sva prava ograničenja na kraj.

Zaključano je šest preokreta (`docs/DECISIONS.md` D13–D19): budžet kao ulaz,
frižider kao protagonist s rokovima, rescue-first planiranje, planiranje iz
akcija, prep blok kao paralelni timeline, i jedna brojka na kraju (usporedba s
dostavom). Plus shake kao gimmick koji dijeli kod sa swapom.

Ključno: **ništa od toga nije novi podsustav.** Sve je promjena prompta i
izlazne sheme, zato raspored ostaje 5 sati. Ako u sljedećoj sesiji netko otvori
novi modul zbog novog smjera, zadatak je pogrešno shvaćen.

---

## Što NE zaboraviti

- **Tajne idu samo u `.env`.** `ANTHROPIC_API_KEY` je u jednom trenutku bio
  upisan u `.env.example` (tracked file, javni repo) — izvučen je prije nego je
  ikad commitan. Nije procurio. `.gitignore` ima `!.env.example` da placeholder
  ostane tracked a pravi `.env` nikad ne bude.
- `docs/API.md` se mijenja **samo** commitom čiji naslov počinje s `api!:`.
- Logika pakiranja i cijene **nije AI** — deterministički kod u `src/engine/`.
  Model ne računa eure (D6). AI vraća `PlannedRescue` (imena + poruka), brojke
  dopisuje engine.
- `urgency` izvodi **kod**, ne model (D14). Model vraća samo `expiresInDays`.
- Planer dobiva **samo kategorije koje postoje u katalogu** (D7).
- Red gradnje plana je fiksan: `umire` → `skoro` → `onSale` → ostatak (D15).
- Fotke frižidera se **ne čuvaju** — zato nam ne treba object storage.
- Svi importi s `.js` ekstenzijom (ESM projekt).
- `deliveryComparison.assumption` je obavezan i ide na ekran (D18).
