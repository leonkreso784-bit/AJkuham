import { useSyncExternalStore } from 'react'
import { mock } from './mock'
import type { Answer, Cart, MealDetail, PantryItem, Plan, Profile, Question, ScanResult } from './types'

const BASE = import.meta.env.VITE_API_URL as string | undefined
export const usingMock = !BASE

const SESSION_KEY = 'kuhai.sessionId'

function readSession() {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}

async function ensureSession(): Promise<string> {
  const existing = readSession()
  if (existing) return existing
  const { sessionId } = await req<{ sessionId: string }>('POST', '/api/session', undefined, false)
  try { localStorage.setItem(SESSION_KEY, sessionId) } catch { /* privatni prozor */ }
  return sessionId
}

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

async function req<T>(method: string, path: string, body?: unknown, withSession = true, timeoutMs = 20000): Promise<T> {
  const headers: Record<string, string> = {}
  if (withSession) headers['x-session-id'] = await ensureSession()
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, { method, headers, body: payload, signal: AbortSignal.timeout(timeoutMs) })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(json?.error?.code ?? 'SERVER_ERROR', json?.error?.message ?? 'Nešto je puklo, probaj opet.')
  }
  return json as T
}

// Demo ne smije pasti: ako pravi backend pukne ili zakasni, padamo na mock — ali to se VIDI (oznaka u headeru).
let fellBack = false
export const isFallback = () => fellBack
const fallbackListeners = new Set<() => void>()
export function useFallback() {
  return useSyncExternalStore(
    (l) => { fallbackListeners.add(l); return () => fallbackListeners.delete(l) },
    () => fellBack,
  )
}

async function safe<T>(real: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (usingMock) return fallback()
  try {
    return await real()
  } catch (e) {
    console.warn('[KuhAI] backend nije odgovorio, koristim demo podatke:', e)
    fellBack = true
    fallbackListeners.forEach((l) => l())
    return fallback()
  }
}

export const api = {
  putProfile: (p: Profile) => safe(() => req<{ ok: true }>('PUT', '/api/profile', p), mock.putProfile),
  questions: () => safe(() => req<{ questions: Question[] }>('POST', '/api/questions', undefined, true, 60000), mock.questions),
  answers: (answers: Answer[]) => safe(() => req<{ ok: true }>('POST', '/api/questions/answers', { answers }), mock.answers),
  scan: (file: File) => safe(() => {
    const fd = new FormData()
    fd.append('image', file)
    return req<ScanResult>('POST', '/api/fridge/scan', fd, true, 60000)
  }, mock.scan),
  putPantry: (items: PantryItem[]) => safe(() => req<{ ok: true; count: number }>('PUT', '/api/pantry', { items }), () => mock.putPantry(items)),
  generate: (budgetEur?: number) => safe(() => req<Plan>('POST', '/api/plan/generate', budgetEur == null ? {} : { budgetEur }, true, 150000), () => mock.generate(budgetEur)),
  plan: (id: string) => safe(() => req<Plan>('GET', `/api/plan/${id}`), mock.getPlan),
  meal: (id: string) => safe(() => req<MealDetail>('GET', `/api/meal/${id}`), () => mock.meal(id)),
  swap: (id: string, reason?: string) => safe(() => req<MealDetail>('POST', `/api/meal/${id}/swap`, reason ? { reason } : {}, true, 60000), () => mock.swap(id)),
  shake: (planId: string) => safe(() => req<{ replacedMealId: string; meal: MealDetail }>('POST', `/api/plan/${planId}/shake`, undefined, true, 60000), mock.shake),
  cart: (planId: string) => safe(() => req<Cart>('GET', `/api/plan/${planId}/cart`), mock.cart),
}
