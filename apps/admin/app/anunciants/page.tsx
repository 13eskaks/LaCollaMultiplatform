'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMARQUES_VALENCIANES } from '@lacolla/shared'

export default function AnunciantsPage() {
  const supabase = createClient()
  const [anuncis, setAnuncis] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    anunciant: '',
    url_desti: '',
    comarques: [] as string[],
    data_inici: '',
    data_fi: '',
    actiu: true,
    imatge_url: '',
  })

  useEffect(() => { loadAnuncis() }, [])

  async function loadAnuncis() {
    const { data } = await supabase
      .from('anuncis_comercials')
      .select('*')
      .order('created_at', { ascending: false })
    setAnuncis(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('anuncis_comercials').insert(form)
    setShowForm(false)
    setForm({ anunciant: '', url_desti: '', comarques: [], data_inici: '', data_fi: '', actiu: true, imatge_url: '' })
    loadAnuncis()
  }

  async function toggleActiu(id: string, actiu: boolean) {
    await supabase.from('anuncis_comercials').update({ actiu: !actiu }).eq('id', id)
    loadAnuncis()
  }

  async function registrarClick(id: string, url: string) {
    const anunci = anuncis.find(a => a.id === id)
    if (anunci) {
      await supabase.from('anuncis_comercials').update({ clicks: anunci.clicks + 1 }).eq('id', id)
    }
    window.open(url, '_blank')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Anunciants</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nou anunci
        </button>
      </div>

      {/* Formulari nou anunci */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Nou anunci comercial</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Anunciant *</label>
              <input
                required
                value={form.anunciant}
                onChange={e => setForm({ ...form, anunciant: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nom de l'empresa"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL destí</label>
              <input
                value={form.url_desti}
                onChange={e => setForm({ ...form, url_desti: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL imatge banner *</label>
              <input
                required
                value={form.imatge_url}
                onChange={e => setForm({ ...form, imatge_url: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="https://... (320x80px recomanat)"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Comarques</label>
              <select
                multiple
                value={form.comarques}
                onChange={e => setForm({
                  ...form,
                  comarques: Array.from(e.target.selectedOptions, o => o.value)
                })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24"
              >
                {COMARQUES_VALENCIANES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Ctrl+click per seleccionar múltiples. Buit = totes.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data inici</label>
              <input
                type="date"
                value={form.data_inici}
                onChange={e => setForm({ ...form, data_inici: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data fi</label>
              <input
                type="date"
                value={form.data_fi}
                onChange={e => setForm({ ...form, data_fi: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Crear anunci
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              Cancel·lar
            </button>
          </div>
        </form>
      )}

      {/* Llista anuncis */}
      <div className="space-y-3">
        {anuncis.map((anunci) => (
          <div key={anunci.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            {anunci.imatge_url && (
              <img src={anunci.imatge_url} alt={anunci.anunciant} className="h-12 w-32 object-cover rounded-lg bg-gray-100" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{anunci.anunciant}</p>
              <p className="text-xs text-gray-400">
                {anunci.data_inici} → {anunci.data_fi}
                {anunci.comarques?.length > 0 && ` · ${anunci.comarques.join(', ')}`}
              </p>
            </div>
            <div className="text-center text-xs text-gray-500">
              <p className="font-semibold text-gray-900 text-lg">{anunci.impressions}</p>
              <p>impressions</p>
            </div>
            <div className="text-center text-xs text-gray-500">
              <p className="font-semibold text-gray-900 text-lg">{anunci.clicks}</p>
              <p>clicks</p>
            </div>
            <div className="text-center text-xs text-gray-500">
              <p className="font-semibold text-gray-900 text-lg">
                {anunci.impressions > 0
                  ? ((anunci.clicks / anunci.impressions) * 100).toFixed(1) + '%'
                  : '—'}
              </p>
              <p>CTR</p>
            </div>
            <button
              onClick={() => toggleActiu(anunci.id, anunci.actiu)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                anunci.actiu
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {anunci.actiu ? 'Actiu' : 'Inactiu'}
            </button>
          </div>
        ))}
        {!loading && anuncis.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Encara no hi ha anunciants. Crea el primer!
          </div>
        )}
      </div>
    </div>
  )
}
