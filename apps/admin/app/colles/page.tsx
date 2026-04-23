import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  searchParams: { estat?: string; q?: string }
}

export default async function CollesPage({ searchParams }: Props) {
  const supabase = createClient()

  let query = supabase
    .from('colles')
    .select(`
      id, nom, slug, localitat, estat, is_premium, created_at,
      colla_membres(count)
    `)
    .order('created_at', { ascending: false })

  if (searchParams.estat) {
    query = query.eq('estat', searchParams.estat)
  }
  if (searchParams.q) {
    query = query.ilike('nom', `%${searchParams.q}%`)
  }

  const { data: colles } = await query.limit(50)

  const estatColors: Record<string, string> = {
    pendent:  'bg-yellow-100 text-yellow-700',
    activa:   'bg-green-100 text-green-700',
    suspesa:  'bg-red-100 text-red-700',
    eliminada:'bg-gray-100 text-gray-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Colles</h1>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'pendent', 'activa', 'suspesa'].map((estat) => (
          <Link
            key={estat}
            href={estat ? `/colles?estat=${estat}` : '/colles'}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              searchParams.estat === estat || (!searchParams.estat && estat === '')
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {estat === '' ? 'Totes' : estat.charAt(0).toUpperCase() + estat.slice(1)}
          </Link>
        ))}
      </div>

      {/* Taula */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Localitat</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Membres</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estat</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Premium</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Creada</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colles?.map((colla) => (
              <tr key={colla.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900">{colla.nom}</td>
                <td className="px-4 py-3 text-gray-500">{colla.localitat ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {(colla.colla_membres as any)?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${estatColors[colla.estat]}`}>
                    {colla.estat}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {colla.is_premium ? (
                    <span className="text-yellow-500">⭐ Premium</span>
                  ) : (
                    <span className="text-gray-400">Free</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(colla.created_at).toLocaleDateString('ca-ES')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/colles/${colla.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Veure →
                  </Link>
                </td>
              </tr>
            ))}
            {!colles?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Cap colla trobada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
