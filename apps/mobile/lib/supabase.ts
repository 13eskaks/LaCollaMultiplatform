import { Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL, ANON_KEY } from './config'

// Emmagatzematge de la sessió:
//  - Web: localStorage (amb protecció per a SSR / mode privat)
//  - iOS/Android: AsyncStorage (SecureStore té un límit de 2 KB i la sessió hi pot no cabre)
const webStorage = {
  getItem: (key: string) => {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null } catch { return null }
  },
  setItem: (key: string, value: string) => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value) } catch { /* ignore */ }
  },
  removeItem: (key: string) => {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key) } catch { /* ignore */ }
  },
}

export const supabase = createClient(API_URL, ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
