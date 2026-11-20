import { create } from 'zustand'

const DEFAULT_TTL = 30_000

interface Entry {
  data: unknown
  ts: number
}

interface DataCacheState {
  _entries: Record<string, Entry>
  /** Returns the cached value for `key` (stale or not), or undefined. */
  get<T = unknown>(key: string): T | undefined
  /** True when `key` was written less than `ttl` ms ago. */
  fresh(key: string, ttl?: number): boolean
  /** Stores a value for `key`. */
  put<T = unknown>(key: string, data: T): void
  /** Removes one or more keys so the next load refetches. */
  bust(...keys: string[]): void
  clear(): void
}

/**
 * Small in-memory stale-while-revalidate cache shared between screens.
 * Screens show cached data immediately and refetch in the background
 * when the entry is no longer fresh.
 */
export const useDataCache = create<DataCacheState>((set, get) => ({
  _entries: {},

  get<T>(key: string) {
    return get()._entries[key]?.data as T | undefined
  },

  fresh(key: string, ttl = DEFAULT_TTL) {
    const e = get()._entries[key]
    return !!e && Date.now() - e.ts < ttl
  },

  put(key, data) {
    set(s => ({ _entries: { ...s._entries, [key]: { data, ts: Date.now() } } }))
  },

  bust(...keys) {
    set(s => {
      const entries = { ...s._entries }
      for (const k of keys) delete entries[k]
      return { _entries: entries }
    })
  },

  clear() {
    set({ _entries: {} })
  },
}))
