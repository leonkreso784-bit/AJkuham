# AJkuham — Stanje i handoff

Zadnje ažurirano: **2026-10-08**, kraj pripremne sesije.
Gradnja **nije** počela. Ovo je ulazna točka za sljedeću sesiju.

---

## TL;DR za sljedeću sesiju

Temelj je postavljen i `tsc --noEmit` je čist. Fali **jedno**: radna
`DATABASE_URL`. Dva klika to rješavaju (vidi *Blokade*). Nakon toga se ide
ravno na `docs/PLAN.md`, korak S1.

---

## Što je gotovo

### Dokumentacija (commitana, na `main`)
| file | sadržaj |
|---|---|
| `CLAUDE.md` | pravila rada, stack, struktura, što se ne smije dirati |
| `docs/SPEC.md` | scope, IN/OUT za demo, rizici |
| `docs/API.md` | **zamrznuti kontrakt**, 12 ruta s točnim JSON-ima |
| `docs/DATA-MODEL.md` | 7 tablica, kanonske jedinice, pretvorbe |
| `docs/PLAN.md` | raspored po satima, 4 agent tracka, što režemo |
| `docs/DECISIONS.md` | 12 odluka s obrazloženjem |
| `docs/FRONTEND.md` | sve za frontend tim |

### Kod (temelj, typecheck čist)
| file | sadržaj |
|---|---|
| `package.json` | Hono, Drizzle, postgres.js, Zod, AI SDK, fuse.js, tsx — **instalirano** |
| `tsconfig.json` | strict, ESM, `@/*` alias na `src/*` |
| `src/env.ts` | Zod validacija env-a, pada s jasnom porukom |
| `src/db/schema.ts` | svih 7 tablica iz `DATA-MODEL.md` |
| `src/db/client.ts` | postgres.js + Drizzle; radi i na Railwayu i na Neonu |
| `src/schemas/index.ts` | **sve Zod sheme** — API input i AI structured output |
| `drizzle.config.ts` | `db:push` spreman |
| `vercel.json` | pripremljen, koristi se samo ako hosting ostane Vercel |

### Računi i vanjski servisi
| | stanje |
|---|---|
| GitHub repo | `leonkreso784-bit/AJkuham`, public, sve na `main` |
| Klara610 | **pozvana** s write pristupom — mora prihvatiti invite |
| `ANTHROPIC_API_KEY` | **radi**, testirano (HTTP 200, `claude-sonnet-5-5`). U `.env`, gitignoran |
| Railway CLI | instaliran (v5.63.4), prijavljen kao LeonKreso |
| Railway projekti | 4 stara (MOBIX ×2, tourism-geo, +1) **zakazana za brisanje 2026-10-10** |
| Vercel CLI | instaliran (v63.1.0), prijavljen kao `leonkreso784-bit` |
| Vercel projekt | `leon-kresos-projects/ajkuham` kreiran i povezan s GitHub repom |

---

## Blokade — riješiti prije koda

### 1. Baza (OBAVEZNO, blokira sve)

Hosting nije razriješen. Dva puta, oba trebaju jedan klik:

**Put A — Railway** (ono što dokumentacija pretpostavlja)
Leon je platio plan, ali CLI i dalje javlja
`Your trial has expired. Please select a plan to continue.`
Vjerojatni uzrok: plan je vezan na osobni account, a ne na **workspace
"LeonKreso's Projects"** (`7f104d7d-91e5-402a-ae58-e1cc7bb7d96b`). To su na
Railwayu dvije odvojene stvari.
→ Provjeriti na railway.com da je workspace na plaćenom planu, pa:
```bash
railway init --name ajkuham --workspace "7f104d7d-91e5-402a-ae58-e1cc7bb7d96b" --json
railway add --database postgres --json
railway variables   # izvuci DATABASE_URL
```

**Put B — Neon preko Vercela** (besplatno, radi odmah)
Zaustavljeno na prihvaćanju uvjeta u browseru:
https://vercel.com/leon-kresos-projects/~/integrations/accept-terms/neon?source=cli
→ Nakon klika:
```bash
vercel --non-interactive integration add neon --no-claim --name ajkuham-db
vercel env pull --yes
```

Kod je isti u oba slučaja — mijenja se samo `DATABASE_URL` u `.env`.
`postgres.js` je izabran upravo zato što radi s oba.

### 2. Dizajn i logo
Ekipa radi, nije gotovo. **Ne blokira backend.** Kad dođe, ide u repo i README.

---

## Prvi koraci sljedeće sesije

```bash
# 1. baza (vidi Blokade gore), pa:
npm run db:push        # shema -> Postgres
# 2. onda S1 iz docs/PLAN.md: seed kataloga
```

Zatim po `docs/PLAN.md`: S1 katalog → S2 sesija/profil/pitanja → S3 vision →
S4 planer → S5 engine/košarica → S6 swap/polish/deploy.

## Agent trackovi — spremni za paralelno

Kontrakt (`docs/API.md`) i Zod sheme (`src/schemas/index.ts`) postoje, pa su
moduli neovisni i mogu ići paralelno. Nijedan agent ne smije dirati tuđe
datoteke ni `src/schemas/index.ts` / `src/db/schema.ts`.

| track | datoteke | što radi |
|---|---|---|
| **A** | `data/konzum-products.json`, `src/db/seed.ts` | 220–250 proizvoda s PRAVIM veličinama pakiranja i cijenama + seed skripta |
| **B** | `src/ai/vision.ts` | `scanFridge(images) -> FridgeScanOutput`, Sonnet 5.5 multimodal, fallback na prazan `items` |
| **C** | `src/ai/planner.ts` | `generateObject` sa `PlannerOutput`, u prompt ide profil + `tasteNotes` + pantry + **kategorije iz kataloga** |
| **D** | `src/engine/units.ts`, `packaging.ts`, `matcher.ts`, `cart.ts` | normalizacija jedinica, pakiranja (deterministički), fuse.js matching, cijena |
| **Leon** | `src/app.ts`, `src/server.ts`, `src/ai/questions.ts` | Hono rute, sesija/profil/pantry, integracija, deploy |

U pripremnoj sesiji su trackovi A i B bili pokrenuti pa zaustavljeni prije nego
su dirali ikakav file. Ništa nedovršeno nije ostalo u repou.

---

## Što NE zaboraviti

- **Tajne idu samo u `.env`.** `ANTHROPIC_API_KEY` je u jednom trenutku bio
  upisan u `.env.example` (tracked file, javni repo) — izvučen je prije nego je
  ikad commitan. Ključ nije procurio, ali `.gitignore` sad ima `!.env.example`
  da placeholder ostane tracked a stvarni `.env` nikad ne bude.
- `docs/API.md` se mijenja **samo** commitom čiji naslov počinje s `api!:`.
- Logika pakiranja i cijene **nije AI** — deterministički kod u `src/engine/`.
  Inače demo pokaže 10 litara ulja za jedan tjedan.
- Planer dobiva **samo kategorije koje postoje u katalogu**. Bez tog
  ograničenja izmisli sastojak koji se ne može kupiti.
- Fotke frižidera se **ne čuvaju** — upload, vision, spremi listu, baci fotku.
  Zato nam ne treba object storage.
- Svi importi moraju imati `.js` ekstenziju (ESM projekt, `"type": "module"`).
- `fridge scan` je IN za demo i uvodni je hook, ne bonus na kraju.
