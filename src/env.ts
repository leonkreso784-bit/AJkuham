import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL nije postavljen'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY nije postavljen'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.message).join('\n  - ')
  throw new Error(`Env nije u redu:\n  - ${missing}\n\nPopuni .env (vidi .env.example).`)
}

export const env = parsed.data
