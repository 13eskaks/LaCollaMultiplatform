import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sol·licitud enviada · LaColla',
}

interface Props {
  searchParams: { colla?: string }
}

export default async function SolicitudPendingPage({ searchParams }: Props) {
  const collaId = searchParams.colla
  let collaNom: string | null = null

  if (collaId) {
    const supabase = createClient()
    const { data } = await supabase
      .from('colles')
      .select('nom')
      .eq('id', collaId)
      .single()
    collaNom = data?.nom ?? null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-6">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Sol·licitud enviada!</h1>
        <p className="text-gray-500 mb-2">
          La teua sol·licitud per unir-te a{' '}
          {collaNom ? <strong>{collaNom}</strong> : 'la colla'} ha sigut enviada.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          La comissió de la colla l'haurà d'aprovar. Rebràs una notificació quan ho facen.
        </p>

        <div className="space-y-3">
          <a
            href="https://apps.apple.com/app/lacolla"
            className="block bg-black text-white py-3 px-6 rounded-xl font-medium hover:bg-gray-800 transition"
          >
             Descarrega l'app per iOS
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=app.lacolla"
            className="block bg-black text-white py-3 px-6 rounded-xl font-medium hover:bg-gray-800 transition"
          >
            ▶ Descarrega l'app per Android
          </a>
          <Link href="/" className="block text-blue-600 text-sm hover:underline pt-2">
            Tornar a l'inici
          </Link>
        </div>
      </div>
    </div>
  )
}
