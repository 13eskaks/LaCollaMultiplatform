import { createClient } from '@/lib/supabase/server'

export default async function LogPage() {
  const supabase = createClient()

  const { data: logs } = await supabase
    .from('admin_log')
    .select('*, profiles(nom, cognoms)')
    .order('created_at', { ascending: false })
    .limit(100)

  const accioColors: Record<string, string> = {
    colla_activa:   'bg-green-100 text-green-700',
    colla_suspesa:  'bg-red-100 text-red-700',
    solicitud_entrada: 'bg-blue-100 text-blue-700',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Log d'accions</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Acció</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Entitat</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Detall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs?.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('ca-ES')}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.profiles ? `${log.profiles.nom} ${log.profiles.cognoms ?? ''}` : 'Sistema'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    accioColors[log.accio] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {log.accio}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {log.entitat_tipus}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                  {log.detall ? JSON.stringify(log.detall) : '—'}
                </td>
              </tr>
            ))}
            {!logs?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Encara no hi ha accions registrades
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
