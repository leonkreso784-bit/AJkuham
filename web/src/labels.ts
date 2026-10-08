import type { Cuisine, Diet, Profile } from './api/types'

// Ljudske oznake za enume iz docs/API.md. Dijeli ih Profil ekran (i tko god još treba).
// Onboarding ima svoje kopije jer ga paralelno prepisuje druga sesija.

export const DIET_LABEL: Record<Diet, string> = {
  sve: 'Jedem sve', bez_mesa: 'Bez mesa', vegan: 'Vegan',
  bez_svinjetine: 'Bez svinjetine', bez_laktoze: 'Bez laktoze', bez_glutena: 'Bez glutena',
}
export const DIETS = Object.keys(DIET_LABEL) as Diet[]

export const CUISINE_LABEL: Record<Cuisine, string> = {
  domaca: 'Domaća', talijanska: 'Talijanska', azijska: 'Azijska', meksicka: 'Meksička',
  mediteranska: 'Mediteranska', bliskoistocna: 'Bliskoistočna', indijska: 'Indijska', comfort: 'Comfort',
}
export const CUISINES = Object.keys(CUISINE_LABEL) as Cuisine[]

export const STYLE_LABEL: Record<Profile['cookingStyle'], string> = { meal_prep: 'Meal prep', svaki_dan: 'Kuham svaki dan' }
export const BUDGET_LEVEL_LABEL: Record<Profile['budgetLevel'], string> = { labavo: 'Labavo', srednje: 'Srednje', strogo: 'Strogo' }
export const ADVENTURE_LABEL: Record<number, string> = { 1: 'Provjereno', 2: 'Uglavnom poznato', 3: 'Pola-pola', 4: 'Rado novo', 5: 'Iznenadi me' }

export const people = (n: number) => (n === 1 ? 'samo ja' : `${n} ${n >= 2 && n <= 4 ? 'osobe' : 'osoba'}`)

/** "Bez laktoze, Bez glutena, ne jedem ribu" ili "Jedem sve". */
export function dietSummary(p: Profile): string {
  const parts = [...new Set([p.diet, ...(p.diets ?? [])])].filter((d) => d !== 'sve').map((d) => DIET_LABEL[d])
  if (p.dietNote?.trim()) parts.push(p.dietNote.trim())
  return parts.length ? parts.join(', ') : DIET_LABEL.sve
}
