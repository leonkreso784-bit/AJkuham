import { z } from 'zod'

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL nije postavljen'),
    // Neobavezan ako ide Gemini (vidi src/ai/model.ts); jedan od dva ključa mora postojati.
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .refine((e) => e.ANTHROPIC_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY || e.GEMINI_API_KEY, {
    message: 'nema AI ključa: postavi ANTHROPIC_API_KEY ili GOOGLE_GENERATIVE_AI_API_KEY',
  })

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.message).join('\n  - ')
  throw new Error(`Env nije u redu:\n  - ${missing}\n\nPopuni .env (vidi .env.example).`)
}

export const env = parsed.data
