import { create } from 'zustand'
import type { Colla, CollaMembre } from '@lacolla/shared'
import { isComissio } from '@lacolla/shared'
import { supabase } from '@/lib/supabase'

interface CollaState {
  colles: (Colla & { membership?: CollaMembre })[]
  collaActiva: Colla | null
  membershipActiva: CollaMembre | null
  loading: boolean
  loadColles: () => Promise<void>
  setCollaActiva: (collaId: string) => void
  isMembreActiu: () => boolean
  isComissioActiva: () => boolean
}

export const useCollaStore = create<CollaState>((set, get) => ({
  colles: [],
  collaActiva: null,
  membershipActiva: null,
  loading: false,

  loadColles: async () => {
    set({ loading: true })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('colla_membres')
      .select('*, colles(*)')
      .eq('user_id', user.id)
      .eq('estat', 'actiu')
      .order('data_ingres', { ascending: false })

    const colles = data?.map(m => ({
      ...m.colles,
      membership: m,
    })) ?? []

    set({ colles, loading: false })

    // Activar la primera colla per defecte
    if (colles.length > 0 && !get().collaActiva) {
      get().setCollaActiva(colles[0].id)
    }
  },

  setCollaActiva: (collaId: string) => {
    const colla = get().colles.find(c => c.id === collaId)
    if (colla) {
      set({
        collaActiva: colla,
        membershipActiva: colla.membership ?? null,
      })
    }
  },

  isMembreActiu: () => {
    return get().membershipActiva?.estat === 'actiu'
  },

  isComissioActiva: () => {
    const rol = get().membershipActiva?.rol
    return rol ? isComissio(rol) : false
  },
}))
