'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const collaId = searchParams.get('colla')

  const [nom, setNom] = useState('')
  const [cognoms, setCognoms] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contrasenya ha de tenir almenys 8 caràcters')
      return
    }
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom,
          cognoms,
          colla_id_pendent: collaId,
        },
        emailRedirectTo: collaId
          ? `${window.location.origin}/auth/callback?colla=${collaId}`
          : `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-6">📬</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Comprova el teu email</h1>
          <p className="text-gray-500 mb-8">
            T'hem enviat un link de verificació a <strong>{email}</strong>.
            Fes clic al link per activar el compte.
          </p>
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            Tornar a l'inici
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl">🌩</span>
            <span className="text-xl font-bold text-gray-900">LaColla</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {collaId ? 'Sol·licitar unir-se' : 'Crea el teu compte'}
          </h1>
          <p className="text-gray-500 mt-1">
            {collaId ? 'Omple les dades per demanar accés a la colla' : 'Comença a gestionar la teua colla'}
          </p>
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Maria"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cognoms</label>
              <input
                value={cognoms}
                onChange={(e) => setCognoms(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="García"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrasenya *</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínim 8 caràcters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? 'Creant compte...' : collaId ? 'Sol·licitar accés' : 'Crear compte gratuït'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            En registrar-te acceptes els nostres{' '}
            <Link href="/legal/termes" className="underline">Termes d'ús</Link>
            {' '}i la{' '}
            <Link href="/legal/privacitat" className="underline">Política de privacitat</Link>.
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Ja tens compte?{' '}
          <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
            Entra aquí
          </Link>
        </p>
      </div>
    </div>
  )
}
