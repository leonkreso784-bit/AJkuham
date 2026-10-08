# KuhAI

> AI koji te upozna i složi ti cijeli tjedan hrane — plan, meal prep i košaricu.

Ime: **KuhAI** — "kuhaj" + AI u jednoj riječi.

Hackathon projekt, SHAKER 2026.

**Live API:** https://kuhai-api-production.up.railway.app (`/health`)

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

TypeScript · Node 24 · Hono · Postgres · Drizzle · Zod · AI SDK + Claude Sonnet 5.5

## Dokumentacija

| file | što je unutra |
|---|---|
| [`docs/NEXT-SESSION.md`](docs/NEXT-SESSION.md) | **počni ovdje** — kickoff prompt i briefovi za agente |
| [`docs/STATUS.md`](docs/STATUS.md) | stanje: što je gotovo, što je blokirano |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) | gotovi produkcijski promptovi za sve AI pozive |
| [`CLAUDE.md`](CLAUDE.md) | pravila rada u repou, struktura, što se ne smije |
| [`docs/SPEC.md`](docs/SPEC.md) | što gradimo, što je IN/OUT za demo, rizici |
| [`docs/API.md`](docs/API.md) | **zamrznuti kontrakt** — 13 ruta |
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
