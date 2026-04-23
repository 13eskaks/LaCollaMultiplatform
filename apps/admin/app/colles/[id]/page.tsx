'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  params: { id: string }
}

export default function CollaDetailPage({ params }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [colla, setColla] = useState<any>(null)
  const [membres, setMembres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadColla()
  }, [])

  async function loadColla() {
    const { data } = await supabase
      .from('colles')
      .select(`*, colla_config(*), subscripcions(*)`)
      .eq('id', params.id)
      .single()
    setColla(data)

    const { data: membresData } = await supabase
      .from('colla_membres')
      .select('*, profiles(nom, cognoms, email, avatar_url)')
      .eq('colla_id', params.id)
      .order('data_ingres', { ascending: false })
    setMembres(membresData ?? [])
    setLoading(false)
  }

  async function updateEstat(nouEstat: string) {
    setActionLoading(true)
    await supabase
      .from('colles')
      .update({ estat: nouEstat })
      .eq('id', params.id)

    // Log
    await supabase.from('admin_log').insert({
      accio: `colla_${nouEstat}`,
      entitat_tipus: 'colla',
      entitat_id: params.id,
      detall: { nom: colla.nom, estat_anterior: colla.estat },
    })

    await loadColla()
    setActionLoading(false)
  }

  async function togglePremium() {
    setActionLoading(true)
    const nouPremium = !colla.is_premium
    await supabase
      .from('colles')
      .update({
        is_premium: nouPremium,
        premium_until: nouPremium
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .eq('id', params.id)
    await loadColla()
    setActionLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Carregant...</div>
  if (!colla) return <div className="p-8 text-gray-400">Colla no trobada</div>

  const estatColors: Record<string, string> = {
    pendent:  'bg-yellow-100 text-yellow-700',
    activa:   'bg-green-100 text-green-700',
    suspesa:  'bg-red-100 text-red-700',
    eliminada:'bg-gray-100 text-gray-500',
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-2xl font-bold text-gray-900">{colla.nom}</h1>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${estatColors[colla.estat]}`}>
          {colla.estat}
        </span>
        {colla.is_premium && <span className="text-yellow-500 text-sm">⭐ Premium</span>}
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Localitat:</span> <span className="font-medium">{colla.localitat ?? '—'}</span></div>
        <div><span className="text-gray-500">Comarca:</span> <span className="font-medium">{colla.comarca ?? '—'}</span></div>
        <div><span className="text-gray-500">Fundada:</span> <span className="font-medium">{colla.any_fundacio ?? '—'}</span></div>
        <div><span className="text-gray-500">Slug:</span> <code className="text-xs bg-gray-100 px-1 rounded">{colla.slug}</code></div>
        <div><span className="text-gray-500">Membres:</span> <span className="font-medium">{membres.length}</span></div>
        <div><span className="text-gray-500">Creada:</span> <span className="font-medium">{new Date(colla.created_at).toLocaleDateString('ca-ES')}</span></div>
      </div>

      {/* Accions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-700 mb-3">Accions</h2>
        <div className="flex flex-wrap gap-2">
          {colla.estat === 'pendent' && (
            <button
              onClick={() => updateEstat('activa')}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              ✓ Aprovar colla
            </button>
          )}
          {colla.estat === 'activa' && (
            <button
              onClick={() => updateEstat('suspesa')}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Suspendre
            </button>
          )}
          {colla.estat === 'suspesa' && (
            <button
              onClick={() => updateEstat('activa')}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Reactivar
            </button>
          )}
          <button
            onClick={togglePremium}
            disabled={actionLoading}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
          >
            {colla.is_premium ? 'Treure Premium' : '⭐ Activar Premium'}
          </button>
          <a
            href={`https://lacolla.app/colla/${colla.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Veure landing →
          </a>
        </div>
      </div>

      {/* Membres */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Membres ({membres.length})</h2>
        <div className="space-y-2">
          {membres.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {m.profiles?.nom} {m.profiles?.cognoms}
                </p>
                <p className="text-xs text-gray-400">{m.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{m.rol}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  m.estat === 'actiu' ? 'bg-green-100 text-green-700' :
                  m.estat === 'pendent' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{m.estat}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
