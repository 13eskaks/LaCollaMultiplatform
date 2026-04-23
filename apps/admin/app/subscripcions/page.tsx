import { createClient } from '@/lib/supabase/server'

export default async function SubscripcionsPage() {
  const supabase = createClient()

  const { data: subs } = await supabase
    .from('subscripcions')
    .select(`
      *,
      profiles(nom, cognoms, email),
      colles(nom),
      premium_tramos(membres_min, membres_max, preu_mensual, preu_anual)
    `)
    .eq('activa', true)
    .order('created_at', { ascending: false })

  // Calcular MRR
  const mrr = subs?.reduce((acc, s) => {
    return acc + (s.periode === 'anual' ? s.import / 12 : s.import)
  }, 0) ?? 0

  const arr = mrr * 12

  const individuals = subs?.filter(s => s.tipus === 'individual') ?? []
  const colles = subs?.filter(s => s.tipus === 'colla') ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subscripcions</h1>

      {/* Resum financer */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-700">{mrr.toFixed(2)}€</p>
          <p className="text-sm text-purple-500 mt-1">MRR estimat</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-700">{arr.toFixed(2)}€</p>
          <p className="text-sm text-purple-500 mt-1">ARR estimat</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{individuals.length}</p>
          <p className="text-sm text-blue-500 mt-1">Premium individual</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-yellow-700">{colles.length}</p>
          <p className="text-sm text-yellow-500 mt-1">Premium colla</p>
        </div>
      </div>

      {/* Llista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Subscriptor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipus</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Període</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Import</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">MRR</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Des de</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subs?.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {sub.tipus === 'individual' ? (
                    <div>
                      <p className="font-medium text-gray-900">
                        {sub.profiles?.nom} {sub.profiles?.cognoms}
                      </p>
                      <p className="text-xs text-gray-400">{sub.profiles?.email}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-gray-900">🌩 {sub.colles?.nom}</p>
                      <p className="text-xs text-gray-400">
                        Tramo {sub.premium_tramos?.membres_min}–{sub.premium_tramos?.membres_max ?? '∞'} membres
                      </p>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    sub.tipus === 'individual'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {sub.tipus}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{sub.periode}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{sub.import}€</td>
                <td className="px-4 py-3 text-gray-600">
                  {sub.periode === 'anual'
                    ? (sub.import / 12).toFixed(2)
                    : sub.import.toFixed(2)}€/mes
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(sub.inici).toLocaleDateString('ca-ES')}
                </td>
              </tr>
            ))}
            {!subs?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Encara no hi ha subscripcions actives
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
