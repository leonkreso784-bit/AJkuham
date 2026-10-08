import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.js'
import * as schema from './schema.js'

/**
 * postgres.js je namjerno izabran jer radi i na Railwayu i na Neonu
 * bez promjene koda. Mijenja se samo DATABASE_URL.
 */
const sql = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  ssl: env.DATABASE_URL.includes('localhost') ? false : 'require',
})

export const db = drizzle(sql, { schema })
export { schema, sql }
