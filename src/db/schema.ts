import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Tablice prate docs/DATA-MODEL.md. Mijenja ih samo track A.
 * Enumi su namjerno `text` — validacija je Zod u src/schemas, ne baza.
 */

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const profiles = pgTable('profiles', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  mealsPerDay: integer('meals_per_day').notNull().default(3),
  householdSize: integer('household_size').notNull().default(1),
  cookingStyle: text('cooking_style').notNull().default('meal_prep'),
  minutesPerMeal: integer('minutes_per_meal').notNull().default(30),
  diet: text('diet').notNull().default('sve'),
  allergies: jsonb('allergies').$type<string[]>().notNull().default([]),
  cuisines: jsonb('cuisines').$type<string[]>().notNull().default([]),
  adventurousness: integer('adventurousness').notNull().default(3),
  budgetLevel: text('budget_level').notNull().default('srednje'),
  budgetPerWeekEur: numeric('budget_per_week_eur'),
  /** Slobodni tekst koji AI pise i cita. Ovo je srce personalizacije. */
  tasteNotes: text('taste_notes').notNull().default(''),
  likes: jsonb('likes').$type<string[]>().notNull().default([]),
  dislikes: jsonb('dislikes').$type<string[]>().notNull().default([]),
  equipment: jsonb('equipment').$type<string[]>().notNull().default([]),
  /** Sirovi odgovori na adaptivna pitanja. */
  qa: jsonb('qa').$type<Record<string, string | string[]>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pantryItems = pgTable('pantry_items', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: numeric('quantity').notNull(),
  unit: text('unit').notNull(),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  /** Cisto prezentacijska struktura, nikad se ne pretrazuje po njoj. */
  prepBlocks: jsonb('prep_blocks').$type<unknown[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const meals = pgTable('meals', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  slot: text('slot').notNull(),
  title: text('title').notNull(),
  minutes: integer('minutes').notNull(),
  servings: integer('servings').notNull().default(1),
  source: text('source').notNull().default('kuhaj_sad'),
  prepBlockId: text('prep_block_id'),
  steps: jsonb('steps').$type<string[]>().notNull().default([]),
  nutrition: jsonb('nutrition').$type<{
    kcal: number
    protein: number
    carbs: number
    fat: number
  } | null>(),
  imageHint: text('image_hint'),
  /** Trag swapa: koji obrok je ovaj zamijenio. */
  replacedMealId: text('replaced_meal_id'),
})

export const mealIngredients = pgTable('meal_ingredients', {
  id: serial('id').primaryKey(),
  mealId: text('meal_id')
    .notNull()
    .references(() => meals.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: numeric('quantity').notNull(),
  unit: text('unit').notNull(),
  /** Kako je model originalno napisao kolicinu, za debug. */
  raw: text('raw'),
})

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  /** Ulaz za fuzzy matching. */
  keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
  packageSize: numeric('package_size').notNull(),
  packageUnit: text('package_unit').notNull(),
  priceEur: numeric('price_eur').notNull(),
  onSale: boolean('on_sale').notNull().default(false),
  perUnitEur: numeric('per_unit_eur'),
})
