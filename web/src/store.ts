import { useSyncExternalStore } from 'react'
import type { PantryItem, Plan, Profile } from './api/types'

// Minimalni globalni state. Plan i profil žive i u localStorage da refresh ne briše tjedan.
interface State {
  profile: Profile | null
  plan: Plan | null
  pantry: PantryItem[]
  // "Što ti se jede?": naslovi jela (ne id-evi kandidata), šalju se backendu prije generiranja plana.
  taste: { liked: string[]; disliked: string[] }
}

const EMPTY_TASTE = { liked: [] as string[], disliked: [] as string[] }

const KEY = 'kuhai.state'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { pantry: [], taste: EMPTY_TASTE, ...JSON.parse(raw) } as State
  } catch { /* nema storagea */ }
  return { profile: null, plan: null, pantry: [], taste: EMPTY_TASTE }
}

let state = load()
const listeners = new Set<() => void>()

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function getState() {
  return state
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => select(state),
  )
}
