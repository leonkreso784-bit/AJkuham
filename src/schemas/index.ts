import { z } from 'zod'

/**
 * Jedini izvor istine za oblik podataka. Ista shema validira API input
 * i sluzi kao structured-output shema za AI SDK.
 * Oblik mora odgovarati docs/API.md. Taj kontrakt je zamrznut.
 */

export const Unit = z.enum(['g', 'ml', 'kom'])
export type Unit = z.infer<typeof Unit>

export const Slot = z.enum(['dorucak', 'rucak', 'vecera', 'snack1', 'snack2'])
export type Slot = z.infer<typeof Slot>

export const MealSource = z.enum(['kuhaj_sad', 'iz_prepa'])

/**
 * Koliko je namirnici hitno. Izvedeno iz expiresInDays:
 * `umire` <=2 dana, `skoro` 3-7, `ok` 8+.
 * Postoji jer se plan gradi POCEVSI od onoga sto umire — to je srce proizvoda.
 */
export const Urgency = z.enum(['umire', 'skoro', 'ok'])
export type Urgency = z.infer<typeof Urgency>

/**
 * Traka na kojoj se nesto u prep bloku odvija paralelno.
 * `ti` je jedina traka koja trosi korisnikovu paznju — suma te trake
 * je stvarno aktivno vrijeme i uvijek je manja od ukupnih minuta bloka.
 */
export const PrepTrack = z.enum(['pecnica', 'stednjak', 'ti', 'mikrovalna', 'air_fryer'])
export type PrepTrack = z.infer<typeof PrepTrack>

export const Diet = z.enum([
  'sve',
  'bez_mesa',
  'vegan',
  'bez_svinjetine',
  'bez_laktoze',
  'bez_glutena',
])

export const Cuisine = z.enum([
  'domaca',
  'talijanska',
  'azijska',
  'meksicka',
  'mediteranska',
  'bliskoistocna',
  'indijska',
  'comfort',
])

export const ProductCategory = z.enum([
  'meso',
  'mlijecno',
  'suho',
  'svjeze',
  'zacini',
  'smrznuto',
  'pekara',
  'napitci',
])
export type ProductCategory = z.infer<typeof ProductCategory>

// --- PUT /api/profile ---

export const ProfileInput = z.object({
  mealsPerDay: z.number().int().min(2).max(5),
  householdSize: z.number().int().min(1).max(8),
  cookingStyle: z.enum(['svaki_dan', 'meal_prep']),
  minutesPerMeal: z.union([z.literal(15), z.literal(30), z.literal(45)]),
  diet: Diet,
  allergies: z.array(z.string()).default([]),
  cuisines: z.array(Cuisine).default([]),
  adventurousness: z.number().int().min(1).max(5),
  budgetLevel: z.enum(['labavo', 'srednje', 'strogo']),
  budgetPerWeekEur: z.number().positive().optional(),
})
export type ProfileInput = z.infer<typeof ProfileInput>

// --- POST /api/questions ---

export const Question = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['single', 'multi', 'text']),
  options: z.array(z.string()),
})
export type Question = z.infer<typeof Question>

/** Structured-output shema za src/ai/questions.ts */
export const QuestionsOutput = z.object({
  questions: z.array(Question).min(3).max(5),
})

export const AnswersInput = z.object({
  answers: z
    .array(
      z.object({
        id: z.string(),
        value: z.union([z.string(), z.array(z.string())]),
      }),
    )
    .min(1),
})
export type AnswersInput = z.infer<typeof AnswersInput>

// --- POST /api/fridge/scan ---

export const ScannedItem = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: Unit,
  confidence: z.number().min(0).max(1),
  /**
   * Procjena koliko dana namirnica jos ima, iz vizualnog stanja i tipicnog
   * roka te vrste hrane. Bez .optional() — vision model ovo MORA vratiti,
   * inace nema sto hraniti planer.
   */
  expiresInDays: z.number().int().min(0),
  /** Izvedeno iz expiresInDays, ali ga model vraca da frontend ne racuna. */
  urgency: Urgency,
})
export type ScannedItem = z.infer<typeof ScannedItem>

/** Structured-output shema za src/ai/vision.ts */
export const FridgeScanOutput = z.object({
  items: z.array(ScannedItem),
  followUpQuestions: z.array(z.string()).max(3),
})
export type FridgeScanOutput = z.infer<typeof FridgeScanOutput>

// --- PUT /api/pantry ---

export const PantryInput = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: Unit,
      /** Opcionalan jer rucno dodani itemi nemaju procjenu roka. */
      expiresInDays: z.number().int().min(0).optional(),
    }),
  ),
})
export type PantryInput = z.infer<typeof PantryInput>

// --- POST /api/plan/generate ---

/**
 * Body za POST /api/plan/generate. Samo API input, nikad AI output —
 * zato .optional() ovdje ne smeta.
 * budgetEur je TVRDO ogranicenje, ne filter: plan se gradi da stane u njega.
 * Ako nije poslan, pada se na budgetPerWeekEur iz profila.
 */
export const PlanGenerateInput = z.object({
  budgetEur: z.number().positive().optional(),
})
export type PlanGenerateInput = z.infer<typeof PlanGenerateInput>

/**
 * Jedan zadatak na jednoj traci prep bloka. Postoji jer je prava kuhinja
 * paralelna, a recepti su linearni samo zato sto su knjige linearne.
 * startMinute je offset od pocetka bloka, ne apsolutno vrijeme.
 */
export const TimelineEntry = z.object({
  track: PrepTrack,
  label: z.string(),
  startMinute: z.number().int().min(0),
  durationMinutes: z.number().int().positive(),
})
export type TimelineEntry = z.infer<typeof TimelineEntry>

/**
 * Sto je plan spasio od bacanja. savedEur racuna deterministicki kod iz
 * kataloga (CLAUDE.md: model ne izmislja brojeve), pa je ovo API-oblik,
 * ne AI-oblik. AI daje samo PlannedRescue.
 */
export const RescueInfo = z.object({
  savedItems: z.array(z.string()),
  savedEur: z.number(),
  message: z.string(),
})
export type RescueInfo = z.infer<typeof RescueInfo>

/**
 * Koliko je obroka gradeno oko akcija iz kataloga. `count` broji obroke,
 * `items` su imena proizvoda na akciji.
 */
export const SaleDrivenInfo = z.object({
  count: z.number().int().min(0),
  items: z.array(z.string()),
  message: z.string(),
})
export type SaleDrivenInfo = z.infer<typeof SaleDrivenInfo>

/**
 * AI-strana rescue bloka: model pise samo imena i ljudsku poruku.
 * savedEur se dopisuje poslije, iz kataloga.
 */
export const PlannedRescue = z.object({
  savedItems: z.array(z.string()),
  message: z.string(),
})
export type PlannedRescue = z.infer<typeof PlannedRescue>

/** AI-strana saleDriven bloka. `count` izvodi kod iz broja obroka. */
export const PlannedSaleDriven = z.object({
  items: z.array(z.string()),
  message: z.string(),
})
export type PlannedSaleDriven = z.infer<typeof PlannedSaleDriven>

export const PlannedIngredient = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: Unit,
})
export type PlannedIngredient = z.infer<typeof PlannedIngredient>

export const PlannedMeal = z.object({
  slot: Slot,
  title: z.string(),
  minutes: z.number().int().positive(),
  servings: z.number().int().positive(),
  source: MealSource,
  /** Indeks u prepBlocks arrayu, ili null za kuhaj_sad. */
  prepBlockIndex: z.number().int().nullable(),
  steps: z.array(z.string()).min(1),
  ingredients: z.array(PlannedIngredient).min(1),
  nutrition: z
    .object({
      kcal: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
    })
    .nullable(),
  imageHint: z.string().optional(),
  /**
   * Jedna konkretna recenica zasto je ovaj obrok tu. Nikad genericno
   * ("zdravo i ukusno") — mora se vezati na pantry ili na nesto sto je
   * korisnik rekao. Transparentan AI gradi povjerenje i izgleda pametnije
   * od istog plana bez objasnjenja.
   */
  why: z.string().min(1),
  /** Imena pantry namirnica s urgency 'umire' koje ovaj obrok trosi. */
  usesExpiring: z.array(z.string()),
})
export type PlannedMeal = z.infer<typeof PlannedMeal>

export const PlannedPrepBlock = z.object({
  day: z.string(),
  startHint: z.string(),
  minutes: z.number().int().positive(),
  title: z.string(),
  covers: z.array(z.string()),
  /**
   * Paralelni raspored. Prava kuhinja je paralelna; recepti su linearni
   * samo zato sto su knjige linearne. Suma trake 'ti' je stvarno aktivno
   * vrijeme korisnika i mora biti manja od `minutes`.
   */
  timeline: z.array(TimelineEntry).min(1),
})
export type PlannedPrepBlock = z.infer<typeof PlannedPrepBlock>

/**
 * Structured-output shema za src/ai/planner.ts.
 * Model NE racuna eure — zato ovdje idu PlannedRescue/PlannedSaleDriven
 * (imena + ljudska poruka), a brojke dopisuje src/engine/ iz kataloga.
 */
export const PlannerOutput = z.object({
  prepBlocks: z.array(PlannedPrepBlock),
  days: z
    .array(
      z.object({
        dayName: z.string(),
        meals: z.array(PlannedMeal).min(1),
      }),
    )
    .length(7),
  rescue: PlannedRescue,
  saleDriven: PlannedSaleDriven,
})
export type PlannerOutput = z.infer<typeof PlannerOutput>

/** Structured-output shema za swap jednog obroka. Koristi se i za /shake. */
export const SingleMealOutput = PlannedMeal

export const SwapInput = z.object({
  reason: z.string().optional(),
})

/**
 * Sastojak u detalju obroka. `expiring` znaci: iz pantry-ja I umire —
 * frontend ga oboji drugacije jer je to obrok koji spasava hranu.
 */
export const MealDetailIngredient = PlannedIngredient.extend({
  inPantry: z.boolean(),
  expiring: z.boolean(),
})
export type MealDetailIngredient = z.infer<typeof MealDetailIngredient>

// --- GET /api/plan/:id/cart ---

export const CartLine = z.object({
  productId: z.string(),
  productName: z.string(),
  category: z.string(),
  packageSize: z.number(),
  packageUnit: Unit,
  quantity: z.number().int().positive(),
  unitPriceEur: z.number(),
  lineTotalEur: z.number(),
  onSale: z.boolean(),
  neededAmount: z.number(),
  leftoverAmount: z.number(),
  matchedIngredients: z.array(z.string()),
  matchQuality: z.enum(['exact', 'fuzzy', 'generic']),
})
export type CartLine = z.infer<typeof CartLine>

/**
 * Zavrsni udarac demoa: koliko je tjedan kuhan doma jeftiniji od istog
 * broja obroka preko dostave. `assumption` MORA biti ispisan na ekranu —
 * brojka bez pretpostavke je marketing, brojka s pretpostavkom je argument.
 */
export const DeliveryComparison = z.object({
  deliveryEur: z.number(),
  savedEur: z.number(),
  assumption: z.string(),
})
export type DeliveryComparison = z.infer<typeof DeliveryComparison>

export const Cart = z.object({
  currency: z.literal('EUR'),
  totalEur: z.number(),
  /** Sve sto korisnik ima doma, bez obzira na rok. */
  savedFromPantryEur: z.number(),
  /** Samo ono sto bi se BACILO a plan ga je iskoristio. Druga brojka. */
  savedFromWasteEur: z.number(),
  perMealEur: z.number(),
  budgetEur: z.number().nullable(),
  /**
   * false nije bug, ali korisnik to mora vidjeti, s razlikom.
   * Tihi fail je gori od plana koji priznaje da ne stane.
   */
  withinBudget: z.boolean(),
  deliveryComparison: DeliveryComparison,
  onSaleLinesCount: z.number().int().min(0),
  lines: z.array(CartLine),
  unmatched: z.array(PlannedIngredient),
  deepLink: z.string(),
})
export type Cart = z.infer<typeof Cart>

// --- POST /api/taste/candidates i POST /api/taste (swipe kartice, API.md §14-15) ---

/**
 * Kandidati za swipe: model vraca nekoliko cijelih jela (s receptom) koja
 * korisnik ocjenjuje kvacicom / X-om. Nije plan, nista se ne sprema.
 */
export const CandidatesInput = z.object({
  count: z.number().int().min(4).max(12).default(10),
})
export type CandidatesInput = z.infer<typeof CandidatesInput>

/** Structured-output shema za jedan poziv kandidata (pola decka). */
export const CandidatesOutput = z.object({
  meals: z.array(PlannedMeal).min(1).max(8),
})
export type CandidatesOutput = z.infer<typeof CandidatesOutput>

/**
 * Sto je korisnik odabrao na karticama. Naslovi jela, ne id-evi: kandidati
 * se ne spremaju, a planer ionako cita naslove. Zamjenjuje prethodni izbor.
 */
export const TasteInput = z.object({
  liked: z.array(z.string().trim().min(1)).max(30).default([]),
  disliked: z.array(z.string().trim().min(1)).max(30).default([]),
})
export type TasteInput = z.infer<typeof TasteInput>

// --- POST /api/plan/:planId/shake ---

/**
 * Protreses telefon, obrok se mijenja. Hackathon se zove SHAKER;
 * gimmick je trivijalan (devicemotion + postojeca swap logika),
 * a publika ga pamti.
 */
export const ShakeResult = z.object({
  replacedMealId: z.string(),
  meal: z.unknown(),
})
export type ShakeResult = z.infer<typeof ShakeResult>
