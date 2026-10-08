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
    }),
  ),
})
export type PantryInput = z.infer<typeof PantryInput>

// --- POST /api/plan/generate ---

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
})
export type PlannedMeal = z.infer<typeof PlannedMeal>

export const PlannedPrepBlock = z.object({
  day: z.string(),
  startHint: z.string(),
  minutes: z.number().int().positive(),
  title: z.string(),
  covers: z.array(z.string()),
})
export type PlannedPrepBlock = z.infer<typeof PlannedPrepBlock>

/** Structured-output shema za src/ai/planner.ts */
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
})
export type PlannerOutput = z.infer<typeof PlannerOutput>

/** Structured-output shema za swap jednog obroka. */
export const SingleMealOutput = PlannedMeal

export const SwapInput = z.object({
  reason: z.string().optional(),
})

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

export const Cart = z.object({
  currency: z.literal('EUR'),
  totalEur: z.number(),
  savedFromPantryEur: z.number(),
  perMealEur: z.number(),
  lines: z.array(CartLine),
  unmatched: z.array(PlannedIngredient),
  deepLink: z.string(),
})
export type Cart = z.infer<typeof Cart>
