import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@lacolla/shared'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  setSession: (session: Session | null) => void
  loadProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  setSession: (session) => {
    set({ session, loading: false })
    if (session) get().loadProfile()
  },

  loadProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
