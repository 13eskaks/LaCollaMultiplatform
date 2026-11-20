import { Platform } from 'react-native'

/**
 * URL del backend (Vercel). A la web, si no s'indica, fem servir el mateix
 * domini on està servida l'app. A iOS/Android cal EXPO_PUBLIC_API_URL.
 */
function resolveApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  if (env && !env.includes('YOUR_PROJECT')) return env.replace(/\/$/, '')
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin
  }
  return 'https://lacolla.vercel.app'
}

export const API_URL = resolveApiUrl()
// El backend accepta qualsevol valor com a clau anònima; supabase-js la necessita.
export const ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'lacolla-anon'
