// Oblici iz backend docs/API.md (zamrznuti kontrakt).

export type Diet = 'sve' | 'bez_mesa' | 'vegan' | 'bez_svinjetine' | 'bez_laktoze' | 'bez_glutena'
export type Cuisine = 'domaca' | 'talijanska' | 'azijska' | 'meksicka' | 'mediteranska' | 'bliskoistocna' | 'indijska' | 'comfort'

export interface Profile {
  mealsPerDay: 2 | 3 | 4 | 5
  householdSize: number
  cookingStyle: 'svaki_dan' | 'meal_prep'
  minutesPerMeal: 15 | 30 | 45
  diet: Diet
  allergies: string[]
  cuisines: Cuisine[]
  adventurousness: number
  budgetLevel: 'labavo' | 'srednje' | 'strogo'
  budgetPerWeekEur?: number
}

export interface Question {
  id: string
  text: string
  type: 'single' | 'multi' | 'text'
  options: string[]
}
export interface Answer { id: string; value: string | string[] }

export type Unit = 'g' | 'ml' | 'kom'
export type Urgency = 'umire' | 'skoro' | 'ok'

export interface ScannedItem {
  name: string
  quantity: number
  unit: Unit
  confidence: number
  expiresInDays: number
  urgency: Urgency
}
export interface ScanResult { items: ScannedItem[]; followUpQuestions: string[] }
export interface PantryItem { name: string; quantity: number; unit: Unit; expiresInDays?: number }

export type Slot = 'dorucak' | 'rucak' | 'vecera' | 'snack1' | 'snack2'
export type Track = 'pecnica' | 'stednjak' | 'ti' | 'mikrovalna' | 'air_fryer'

export interface PlanMeal {
  id: string
  slot: Slot
  title: string
  minutes: number
  source: 'kuhaj_sad' | 'iz_prepa'
  prepBlockId: string | null
  servings: number
  imageHint: string
  why: string
  usesExpiring: string[]
}
export interface PrepBlock {
  id: string
  day: string
  startHint: string
  minutes: number
  title: string
  covers: string[]
  mealIds: string[]
  timeline?: { track: Track; label: string; startMinute: number; durationMinutes: number }[]
}
export interface Plan {
  planId: string
  weekStart: string
  budgetEur: number | null
  estimatedTotalEur: number
  rescue: { savedItems: string[]; savedEur: number; message: string }
  saleDriven: { count: number; items: string[]; message: string }
  prepBlocks: PrepBlock[]
  days: { date: string; dayName: string; meals: PlanMeal[] }[]
}

export interface MealDetail {
  id: string
  title: string
  slot: Slot
  minutes: number
  servings: number
  source: 'kuhaj_sad' | 'iz_prepa'
  steps: string[]
  ingredients: { name: string; quantity: number; unit: Unit; inPantry: boolean; expiring: boolean }[]
  why: string
  usesExpiring: string[]
  nutrition: { kcal: number; protein: number; carbs: number; fat: number } | null
}

export interface CartLine {
  productId: string
  productName: string
  category: string
  packageSize: number
  packageUnit: Unit
  quantity: number
  unitPriceEur: number
  lineTotalEur: number
  onSale: boolean
  neededAmount: number
  leftoverAmount: number
  matchedIngredients: string[]
  matchQuality: 'exact' | 'fuzzy' | 'generic'
}
export interface Cart {
  currency: 'EUR'
  totalEur: number
  savedFromPantryEur: number
  savedFromWasteEur: number
  perMealEur: number
  budgetEur: number | null
  withinBudget: boolean
  deliveryComparison: { deliveryEur: number; savedEur: number; assumption: string }
  onSaleLinesCount: number
  lines: CartLine[]
  unmatched: { name: string; quantity: number; unit: Unit }[]
  deepLink: string
}
