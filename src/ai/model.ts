import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { APICallError, defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from 'ai'

/**
 * Jedno mjesto gdje se bira AI provider. Svi pozivi (planer, pitanja, vision)
 * idu kroz aiModel(), pa se provider mijenja env varijablom, bez dodira u kod.
 *
 *   AI_PROVIDER=anthropic   Claude (default ako postoji ANTHROPIC_API_KEY)
 *   AI_PROVIDER=google      Gemini preko GOOGLE_GENERATIVE_AI_API_KEY (ili GEMINI_API_KEY)
 *
 * Bez AI_PROVIDER: Google ako ima samo Google kljuc, inace Anthropic.
 * Automatski prelazak: ako je provider Anthropic, a postoji i Google kljuc, svaki Claude poziv
 * koji padne (nema kredita, 5xx, preopterecen) odmah se ponovi na Geminiju. Kod pada koji ce
 * se sigurno ponoviti (kredit, kljuc, rate limit) Claude se preskace COOLDOWN_MS.
 * Model za Google: GOOGLE_MODEL (default gemini-3.8-flash — 2.5 vise nije dostupan novim kljucevima; brzi od Pro, a 4 paralelna
 * dijela planera vec traju 60-90 s na Claudeu).
 */

const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
if (googleKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) process.env.GOOGLE_GENERATIVE_AI_API_KEY = googleKey

export type Provider = 'anthropic' | 'google'

export const PROVIDER: Provider = (() => {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (forced === 'google' || forced === 'anthropic') return forced
  if (googleKey && !process.env.ANTHROPIC_API_KEY) return 'google'
  return 'anthropic'
})()

export const GOOGLE_MODEL = process.env.GOOGLE_MODEL?.trim() || 'gemini-3.8-flash'

let announced = false

/** claudeId je model koji bi se koristio na Anthropicu; na Googleu se ignorira i ide GOOGLE_MODEL. */
export function aiModel(claudeId: string): LanguageModel {
  if (!announced) {
    announced = true
    console.log(`[ai] provider=${PROVIDER} model=${PROVIDER === 'google' ? GOOGLE_MODEL : claudeId}`)
  }
  if (PROVIDER === 'google') return googleModel
  return googleKey ? withGeminiFallback(claudeId) : anthropic(claudeId)
}

const COOLDOWN_MS = Number(process.env.AI_FALLBACK_COOLDOWN_MS ?? 10 * 60_000)
let claudeDownUntil = 0

/** Greske koje se nece popraviti za par sekundi: nema kredita, los kljuc, rate limit, preopterecen. */
function isStickyFailure(err: unknown): boolean {
  if (!APICallError.isInstance(err)) return false
  const code = err.statusCode ?? 0
  return [401, 402, 403, 429, 529].includes(code) || /credit balance|billing/i.test(err.responseBody ?? err.message)
}

function withGeminiFallback(claudeId: string): LanguageModel {
  return wrapLanguageModel({
    model: anthropic(claudeId),
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        if (Date.now() < claudeDownUntil) return googleModel.doGenerate(params)
        try {
          return await doGenerate()
        } catch (err) {
          if (params.abortSignal?.aborted) throw err
          // RetryError iz SDK-a nosi pravu gresku u lastError
          const cause = (err as { lastError?: unknown }).lastError ?? err
          if (isStickyFailure(cause)) claudeDownUntil = Date.now() + COOLDOWN_MS
          const msg = cause instanceof Error ? cause.message : String(cause)
          console.warn(`[ai] Claude pao (${msg.slice(0, 120)}), prelazim na ${GOOGLE_MODEL}` +
            (claudeDownUntil > Date.now() ? ` i preskacem Claude ${COOLDOWN_MS / 60_000} min` : ''))
          return googleModel.doGenerate(params)
        }
      },
    },
  })
}

// Gemini 3.x razmislja prije odgovora i ti tokeni jedu isti maxOutputTokens, pa se JSON
// planera zna prekinuti na pola ("could not parse the response"). 'low' to drzi malim.
const googleModel = wrapLanguageModel({
  model: google(GOOGLE_MODEL),
  middleware: defaultSettingsMiddleware({
    settings: { providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } } },
  }),
})
