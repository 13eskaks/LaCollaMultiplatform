import { createClient } from '@/lib/supabase/server'

interface Props {
  searchParams: { q?: string; beta?: string }
}

export default async function UsuarisPage({ searchParams }: Props) {
  const supabase = createClient()

  let query = supabase
    .from('profiles')
    .select('*, colla_membres(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (searchParams.q) {
    query = query.or(`nom.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`)
  }
  if (searchParams.beta === 'true') {
    query = query.eq('beta_user', true)
  }

  const { data: usuaris } = await query

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuaris</h1>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        <a
          href="/usuaris"
          className={`px-3 py-1 rounded-full text-sm border transition ${
            !searchParams.beta ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Tots
        </a>
        <a
          href="/usuaris?beta=true"
          className={`px-3 py-1 rounded-full text-sm border transition ${
            searchParams.beta === 'true' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          🧪 Mode Explorador
        </a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Usuari</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Localitat</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Colles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Beta</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Registrat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuaris?.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{u.nom} {u.cognoms ?? ''}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.localitat ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {(u.colla_membres as any)?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-3">
                  {u.beta_user ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">🧪 Explorador</span>
                  ) : (
                    <span className="text-xs text-gray-400">Free</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(u.created_at).toLocaleDateString('ca-ES')}
                </td>
              </tr>
            ))}
            {!usuaris?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Cap usuari trobat
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
