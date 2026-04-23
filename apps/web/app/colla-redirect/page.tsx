'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CollaRedirectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const collaId = searchParams.get('id')

  useEffect(() => {
    async function handleRedirect() {
      if (!collaId) {
        router.replace('/')
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace(`/auth/login?redirect=/colla-redirect?id=${collaId}`)
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('colla_membres')
        .select('id, estat')
        .eq('colla_id', collaId)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        if (existing.estat === 'pendent') {
          router.replace(`/solicitud-pending?colla=${collaId}`)
        } else {
          // Already a member — show colla page
          const { data: colla } = await supabase
            .from('colles')
            .select('slug')
            .eq('id', collaId)
            .single()
          router.replace(colla?.slug ? `/colla/${colla.slug}` : '/')
        }
        return
      }

      // Insert pending membership
      await supabase.from('colla_membres').insert({
        colla_id: collaId,
        user_id: user.id,
        estat: 'pendent',
        rol: 'membre',
      })

      router.replace(`/solicitud-pending?colla=${collaId}`)
    }

    handleRedirect()
  }, [collaId])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">🌩</div>
        <p className="text-gray-500">Processant la teua sol·licitud...</p>
      </div>
    </div>
  )
}
