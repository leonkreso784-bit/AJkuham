# AJkuham

> AI koji te upozna i složi ti cijeli tjedan hrane — plan, meal prep i košaricu.

Ime se čita **"aj kuham"** i **"AI kuham"**.

Hackathon projekt, SHAKER 2026.

---

## Što radi

1. Kratki razgovorni onboarding — koliko obroka dnevno, što voliš, što ne jedeš
2. **Slikaš frižider** → AI prepozna što imaš doma
3. AI pita još par pitanja koja mu stvarno trebaju
4. Dobiješ **cijeli tjedan hrane** organiziran kao meal prep
5. Iz plana se složi **košarica u Konzumu** koja odbija ono što već imaš

Nije fitness aplikacija. Makroi su detalj, ne okvir.

## Repo

Ovo je **backend**: API, baza, AI pipeline.
Frontend radi drugi dio tima i govori s nama samo preko `docs/API.md`.

## Stack

TypeScript · Node 24 · Hono · Postgres (Railway) · Drizzle · Zod · AI SDK + Claude Sonnet 5.5

## Dokumentacija

| file | što je unutra |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | pravila rada u repou, struktura, što se ne smije |
| [`docs/SPEC.md`](docs/SPEC.md) | što gradimo, što je IN/OUT za demo, rizici |
| [`docs/API.md`](docs/API.md) | **zamrznuti kontrakt** — 12 ruta |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | tablice, kanonske jedinice, pretvorbe |
| [`docs/PLAN.md`](docs/PLAN.md) | raspored po satima, podjela na agente |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | zašto je nešto odlučeno tako |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | sve što frontend tim treba |

## Pokretanje

```bash
npm install
cp .env.example .env     # popuni DATABASE_URL i ANTHROPIC_API_KEY
npm run db:push
npm run db:seed
npm run dev
```

```bash
curl localhost:3000/health
```

## Tim

- **Leon Krešo** — backend, AI pipeline
- **Klara Katić** — frontend
- + frontend

## Pravila

Sve ide na `main`. Bez grana, bez PR-ova.
`docs/API.md` se mijenja samo commitom čiji naslov počinje s `api!:`.
