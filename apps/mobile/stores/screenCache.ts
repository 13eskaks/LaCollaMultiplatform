import { create } from 'zustand'

const DEFAULT_TTL = 30_000

interface ScreenCacheState {
  _ts: Record<string, number>
  touch(key: string): void
  isStale(key: string, ttl?: number): boolean
  invalidate(...keys: string[]): void
  invalidateAll(): void
}

export const useScreenCache = create<ScreenCacheState>((set, get) => ({
  _ts: {},

  touch(key: string) {
    set(s => ({ _ts: { ...s._ts, [key]: Date.now() } }))
  },

  isStale(key: string, ttl = DEFAULT_TTL) {
    const ts = get()._ts[key]
    return !ts || Date.now() - ts > ttl
  },

  invalidate(...keys: string[]) {
    set(s => {
      const ts = { ...s._ts }
      for (const k of keys) delete ts[k]
      return { _ts: ts }
    })
  },

  invalidateAll() {
    set({ _ts: {} })
  },
}))
