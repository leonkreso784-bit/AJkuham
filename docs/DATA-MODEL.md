# KuhAI — Data model

Postgres na Railwayu, Drizzle ORM. Sheme žive u `src/db/schema.ts`.

## Kanonske jedinice

Cijeli sustav interno zna **samo tri jedinice**:

| jedinica | za što |
|---|---|
| `g` | sve po masi |
| `ml` | sve po volumenu |
| `kom` | sve što se broji (jaja, glavica kupusa, konzerva) |

Sve što AI vrati (`žlica`, `šaka`, `kg`, `dl`, `pakiranje`) prolazi kroz
`src/engine/units.ts` i pretvara se u gornje. Tablica konverzija je u kodu,
ne u bazi — mora biti čitljiva i testabilna.

Pretvorbe koje moraju postojati od prvog dana:

```
kg -> g      ×1000
dag -> g     ×10
l -> ml       ×1000
dl -> ml      ×100
žlica -> ml   ×15
žličica -> ml ×5
šalica -> ml  ×240
prstohvat -> g ×1
```

Za sastojke gdje volumen nije masa (brašno, riža) držimo grubu gustoću u
`units.ts`. Nije znanstveno točno i ne mora biti — košarica se zaokružuje na
pakiranja pa greška od 10 % ništa ne mijenja.

## Tablice

### `sessions`
Anonimna sesija umjesto autentikacije.

| kolona | tip | napomena |
|---|---|---|
| `id` | text PK | `ses_` + nanoid |
| `created_at` | timestamptz | default now() |

### `profiles`
Jedan red po sesiji. Sadrži i tap-odgovore i izvedeni taste profil.

| kolona | tip | napomena |
|---|---|---|
| `session_id` | text PK, FK sessions | |
| `meals_per_day` | int | |
| `household_size` | int | |
| `cooking_style` | text | `svaki_dan` / `meal_prep` |
| `minutes_per_meal` | int | |
| `diet` | text | enum iz API.md |
| `allergies` | jsonb | string[] |
| `cuisines` | jsonb | string[] |
| `adventurousness` | int | 1–5 |
| `budget_level` | text | |
| `budget_per_week_eur` | numeric | nullable |
| `taste_notes` | text | **slobodni tekst koji AI piše i čita** |
| `likes` | jsonb | string[] — izvedeno iz odgovora i swapova |
| `dislikes` | jsonb | string[] |
| `equipment` | jsonb | string[] — tava, pećnica, air fryer, … |
| `qa` | jsonb | sirovi odgovori na adaptivna pitanja |
| `updated_at` | timestamptz | |

`taste_notes` je namjerno slobodan tekst. Planer ga dobije kao dio prompta.
To je ono što aplikaciju čini "pametnom" s vremenom — struktura ne hvata
"voli hrskavo, mrzi gnjecavo, obožava češnjak".

### `pantry_items`
Što korisnik ima doma. PUT /api/pantry briše i ponovno upisuje cijeli set.

| kolona | tip |
|---|---|
| `id` | text PK (`pi_`) |
| `session_id` | text FK |
| `name` | text |
| `quantity` | numeric |
| `unit` | text (`g`/`ml`/`kom`) |
| `source` | text (`vision` / `manual`) |
| `expires_in_days` | integer nullable — procjena iz visiona |
| `urgency` | text nullable — `umire` / `skoro` / `ok` |
| `created_at` | timestamptz |

`urgency` je izvedeno iz `expires_in_days` (`umire` ≤2, `skoro` 3–7, `ok` 8+),
ali se sprema jer ga frontend čita direktno. **Plan se gradi počevši od onoga
što `umire`** — to je srce proizvoda, ne filter na kraju.

### `plans`

| kolona | tip |
|---|---|
| `id` | text PK (`pl_`) |
| `session_id` | text FK |
| `week_start` | date |
| `prep_blocks` | jsonb |
| `budget_eur` | numeric nullable — tvrdo ograničenje s kojim je plan generiran |
| `estimated_total_eur` | numeric nullable |
| `rescue` | jsonb nullable — `{ savedItems, savedEur, message }` |
| `sale_driven` | jsonb nullable — `{ count, items, message }` |
| `created_at` | timestamptz |

`prep_blocks` je jsonb jer je čisto prezentacijska struktura i nikad se ne
pretražuje po njoj. **`timeline` s paralelnim trakama živi unutra** — ne treba
mu zasebna tablica.

`rescue` i `sale_driven` se spremaju jer su rezultat jednog skupog AI poziva
plus izračuna iz kataloga; ne želimo ih vrtjeti na svaki GET.

### `meals`

| kolona | tip |
|---|---|
| `id` | text PK (`m_`) |
| `plan_id` | text FK |
| `day_index` | int (0–6) |
| `slot` | text (`dorucak`/`rucak`/`vecera`/`snack1`/`snack2`) |
| `title` | text |
| `minutes` | int |
| `servings` | int |
| `source` | text (`kuhaj_sad`/`iz_prepa`) |
| `prep_block_id` | text nullable |
| `steps` | jsonb (string[]) |
| `nutrition` | jsonb nullable |
| `image_hint` | text nullable |
| `why` | text — jedna rečenica zašto je obrok tu |
| `uses_expiring` | jsonb (string[]) — koje namirnice koje umiru troši |
| `replaced_meal_id` | text nullable — trag swapa |

### `meal_ingredients`

| kolona | tip |
|---|---|
| `id` | serial PK |
| `meal_id` | text FK |
| `name` | text — normalizirano ime |
| `quantity` | numeric |
| `unit` | text (`g`/`ml`/`kom`) |
| `raw` | text — kako je model originalno napisao, za debug |

### `products`
Seedani Konzum katalog. **Piše samo seed skripta.**

| kolona | tip | napomena |
|---|---|---|
| `id` | text PK (`p_`) |
| `name` | text | kako stoji na polici |
| `category` | text | `meso`, `mliječno`, `suho`, `svježe`, `začini`, `smrznuto`, `pekara`, `napitci` |
| `keywords` | jsonb | string[] — ulaz za fuzzy matching |
| `package_size` | numeric | npr. 1000 |
| `package_unit` | text | `g`/`ml`/`kom` |
| `price_eur` | numeric | |
| `on_sale` | boolean | |
| `per_unit_eur` | numeric | izvedeno, za usporedbu vrijednosti |

Košarica se **ne sprema**. Izračuna se iz `plans` + `pantry_items` +
`products` pri svakom GET-u. Nema što ići iz sinkronizacije.

## Zašto ovako malo tablica

Sedam tablica, nula join tabela, nula enum tipova u bazi (enumi su Zod u kodu).
Svaka tablica koja ne postoji je tablica koja ne može puknuti u 23. satu.
