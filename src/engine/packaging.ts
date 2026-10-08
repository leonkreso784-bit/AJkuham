import type { Unit } from '../schemas/index.js'
import type { CatalogProduct } from './cart.js'
import { convertBetween } from './units.js'

/**
 * KuhAI — sastojci -> pakiranja.
 *
 * Recept trazi 180 g, polica ima 1 kg: kupi JEDNO i ostatak (820 g) ide kroz
 * tjedan. quantity = ceil(needed / packageSize), min 1. Sve deterministicki;
 * ovo je najdosadniji i najvidljiviji dio projekta (D6).
 */

export type PackagingResult = {
  /** Koliko pakiranja kupiti. Uvijek >= 1. */
  quantity: number
  /** Potrebna kolicina, u JEDINICI PAKIRANJA. */
  neededAmount: number
  /** Visak nakon kupnje, u jedinici pakiranja: quantity*packageSize - needed. */
  leftoverAmount: number
  /** Jedinica u kojoj su needed/leftover (= product.packageUnit). */
  unit: Unit
}

/**
 * Pretvori potrebnu kolicinu sastojka u jedinicu pakiranja.
 * Vrati null ako pretvorba nema smisla (npr. kom -> g za nepoznat sastojak).
 */
export function toPackageUnit(
  neededQuantity: number,
  neededUnit: Unit,
  product: Pick<CatalogProduct, 'packageUnit'>,
  ingredientName?: string,
): number | null {
  return convertBetween(neededQuantity, neededUnit, product.packageUnit, ingredientName)
}

/**
 * Izracunaj koliko pakiranja treba za trazenu kolicinu.
 * Ako pretvorba u jedinicu pakiranja nije moguca, pretpostavi 1 pakiranje
 * (bolje jedno pakiranje nego prazna kosarica ili 10 litara ulja).
 */
export function computePackaging(
  neededQuantity: number,
  neededUnit: Unit,
  product: Pick<CatalogProduct, 'packageSize' | 'packageUnit'>,
  ingredientName?: string,
): PackagingResult {
  const size = product.packageSize > 0 ? product.packageSize : 1
  const converted = convertBetween(neededQuantity, neededUnit, product.packageUnit, ingredientName)

  if (converted == null || !Number.isFinite(converted) || converted <= 0) {
    // Ne znamo pretvoriti — kupi jedno pakiranje, needed = jedno pakiranje.
    return { quantity: 1, neededAmount: round2(size), leftoverAmount: 0, unit: product.packageUnit }
  }

  const needed = round2(converted)
  // Tolerancija 1 %: 1000.5 g uz pakiranje 1 kg ne smije ispasti 2 pakiranja.
  const quantity = Math.max(1, Math.ceil(needed / size - 0.01))
  const leftover = round2(Math.max(0, quantity * size - needed))

  return { quantity, neededAmount: needed, leftoverAmount: leftover, unit: product.packageUnit }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
