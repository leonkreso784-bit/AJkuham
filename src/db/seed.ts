import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { ProductCategory, Unit } from '../schemas/index.js'
import { db, sql } from './client.js'
import { products } from './schema.js'

/**
 * KuhAI — seed Konzum kataloga iz data/konzum-products.json.
 * Jedino mjesto koje smije pisati u `products` (CLAUDE.md).
 * Pokreni: npm run db:seed
 */

/**
 * Lokalna shema reda u JSON-u. Namjerno zivi ovdje, ne u src/schemas —
 * katalog je interni format seeda, ne API kontrakt.
 */
const ProductRow = z.object({
  id: z.string().regex(/^p_\d{3,}$/, 'id mora biti oblika p_001'),
  name: z.string().min(1),
  category: ProductCategory,
  keywords: z.array(z.string().min(1)).min(1),
  packageSize: z.number().positive(),
  packageUnit: Unit,
  priceEur: z.number().positive(),
  onSale: z.boolean(),
})
type ProductRow = z.infer<typeof ProductRow>

const BATCH_SIZE = 100

const here = dirname(fileURLToPath(import.meta.url))
const jsonPath = resolve(here, '../../data/konzum-products.json')

function loadRows(): ProductRow[] {
  // Citamo preko fs, ne resolveJsonModule — da seed ne ovisi o tsconfig-u.
  const raw: unknown = JSON.parse(readFileSync(jsonPath, 'utf8'))
  if (!Array.isArray(raw)) {
    console.error(`Katalog nije JSON array: ${jsonPath}`)
    process.exit(1)
  }

  const rows: ProductRow[] = []
  const seenIds = new Set<string>()
  for (let i = 0; i < raw.length; i++) {
    const parsed = ProductRow.safeParse(raw[i])
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((iss) => `  - ${iss.path.join('.') || '(root)'}: ${iss.message}`)
        .join('\n')
      console.error(`Red ${i} (${JSON.stringify(raw[i])}) nije prosao validaciju:\n${issues}`)
      process.exit(1)
    }
    if (seenIds.has(parsed.data.id)) {
      console.error(`Red ${i}: duplicirani id ${parsed.data.id}`)
      process.exit(1)
    }
    seenIds.add(parsed.data.id)
    rows.push(parsed.data)
  }
  return rows
}

async function main() {
  const rows = loadRows()

  // numeric kolone idu kao string — postgres.js ne pretvara number u numeric sam.
  const values = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    keywords: r.keywords,
    packageSize: String(r.packageSize),
    packageUnit: r.packageUnit,
    priceEur: String(r.priceEur),
    onSale: r.onSale,
    perUnitEur: (r.priceEur / r.packageSize).toFixed(6),
  }))

  await db.delete(products)
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    await db.insert(products).values(values.slice(i, i + BATCH_SIZE))
  }

  const byCategory: Record<string, number> = {}
  let onSale = 0
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
    if (r.onSale) onSale++
  }

  console.log(`Seed gotov: ${rows.length} proizvoda`)
  for (const cat of ProductCategory.options) {
    console.log(`  ${cat.padEnd(10)} ${byCategory[cat] ?? 0}`)
  }
  console.log(`  na akciji  ${onSale} (${((100 * onSale) / rows.length).toFixed(1)} %)`)
}

main()
  .then(async () => {
    await sql.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Seed pao:', err)
    await sql.end().catch(() => {})
    process.exit(1)
  })
