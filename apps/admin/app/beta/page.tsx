'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BetaPage() {
  const supabase = createClient()
  const [stats, setStats] = useState({ total: 0, beta: 0 })
  const [comunicat, setComunicat] = useState({ assumpte: '', cos: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const [{ count: total }, { count: beta }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('beta_user', true),
    ])
    setStats({ total: total ?? 0, beta: beta ?? 0 })
  }

  async function activarTots() {
    if (!confirm('Activar mode beta per a TOTS els usuaris actuals?')) return
    await supabase
      .from('profiles')
      .update({ beta_user: true })
      .is('deleted_at', null)
    loadStats()
  }

  async function desactivarTots() {
    if (!confirm('Desactivar mode beta per a tots els usuaris? Perdran accés Premium.')) return
    await supabase
      .from('profiles')
      .update({ beta_user: false })
      .is('deleted_at', null)
    loadStats()
  }

  async function enviarComunicat(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)

    // Guardar el comunicat a la BD
    const { data: user } = await supabase.auth.getUser()
    await supabase.from('beta_comunicats').insert({
      ...comunicat,
      enviat_at: new Date().toISOString(),
      enviat_per: user.user?.id,
    })

    // Aquí cridaries la teua Edge Function d'enviament d'emails
    // await fetch('/api/beta/send-email', { method: 'POST', body: JSON.stringify(comunicat) })

    setSending(false)
    setSent(true)
    setComunicat({ assumpte: '', cos: '' })
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gestió Beta</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500 mt-1">Usuaris totals</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
          <p className="text-3xl font-bold text-blue-700">{stats.beta}</p>
          <p className="text-sm text-blue-500 mt-1">Mode Explorador actiu</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-500">{stats.total - stats.beta}</p>
          <p className="text-sm text-gray-400 mt-1">Sense beta</p>
        </div>
      </div>

      {/* Info mode Explorador */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-semibold mb-1">ℹ️ Mode Explorador</p>
        <p>Els usuaris amb <code className="bg-blue-100 px-1 rounded">beta_user = true</code> tenen accés complet a totes les funcions Premium sense cost durant la beta. El nom que veu l'usuari és <strong>"Mode Explorador"</strong>.</p>
      </div>

      {/* Accions globals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Accions globals</h2>
        <div className="flex gap-3">
          <button
            onClick={activarTots}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            🚀 Activar beta per a tothom
          </button>
          <button
            onClick={desactivarTots}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
          >
            Finalitzar beta
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Quan finalitzes la beta, els usuaris passen a Free. Recorda donar 30 dies de gràcia Premium.
        </p>
      </div>

      {/* Enviar comunicat */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Enviar comunicat als usuaris beta</h2>
        <form onSubmit={enviarComunicat} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assumpte</label>
            <input
              required
              value={comunicat.assumpte}
              onChange={e => setComunicat({ ...comunicat, assumpte: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Ex: LaColla ix de la beta el 30 de setembre"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Missatge</label>
            <textarea
              required
              value={comunicat.cos}
              onChange={e => setComunicat({ ...comunicat, cos: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              rows={5}
              placeholder="Escriu el missatge que rebran tots els beta users..."
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Enviant...' : sent ? '✓ Enviat!' : `Enviar a ${stats.beta} usuaris`}
          </button>
        </form>
      </div>
    </div>
  )
}
