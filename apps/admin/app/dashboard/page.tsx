import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()

  // Mètriques en paral·lel
  const [
    { count: totalColles },
    { count: collesPendent },
    { count: totalUsuaris },
    { count: usuarisNousSeptimana },
    { count: subscripcionsActives },
    { count: anuncisActius },
    { count: solicitutsPendents },
  ] = await Promise.all([
    supabase.from('colles').select('*', { count: 'exact', head: true }).eq('estat', 'activa'),
    supabase.from('colles').select('*', { count: 'exact', head: true }).eq('estat', 'pendent'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .is('deleted_at', null),
    supabase.from('subscripcions').select('*', { count: 'exact', head: true }).eq('activa', true),
    supabase.from('anuncis_comercials').select('*', { count: 'exact', head: true }).eq('actiu', true),
    supabase.from('colla_membres').select('*', { count: 'exact', head: true }).eq('estat', 'pendent'),
  ])

  // MRR estimat
  const { data: subs } = await supabase
    .from('subscripcions')
    .select('import, periode')
    .eq('activa', true)

  const mrr = subs?.reduce((acc, s) => {
    return acc + (s.periode === 'anual' ? s.import / 12 : s.import)
  }, 0) ?? 0

  const stats = [
    { label: 'Colles actives', value: totalColles ?? 0, color: 'bg-blue-50 text-blue-700' },
    { label: 'Colles pendents', value: collesPendent ?? 0, color: 'bg-yellow-50 text-yellow-700', alert: (collesPendent ?? 0) > 0 },
    { label: 'Usuaris totals', value: totalUsuaris ?? 0, color: 'bg-green-50 text-green-700' },
    { label: 'Nous (7 dies)', value: usuarisNousSeptimana ?? 0, color: 'bg-green-50 text-green-700' },
    { label: 'Subscripcions actives', value: subscripcionsActives ?? 0, color: 'bg-purple-50 text-purple-700' },
    { label: 'MRR estimat', value: `${mrr.toFixed(2)}€`, color: 'bg-purple-50 text-purple-700' },
    { label: 'Anuncis actius', value: anuncisActius ?? 0, color: 'bg-orange-50 text-orange-700' },
    { label: 'Sol·licituds pendents', value: solicitutsPendents ?? 0, color: 'bg-red-50 text-red-700', alert: (solicitutsPendents ?? 0) > 0 },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color} relative`}>
            {stat.alert && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500" />
            )}
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm mt-1 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Accions ràpides */}
      {(collesPendent ?? 0) > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="font-medium text-yellow-800">
            ⏳ Hi ha {collesPendent} colla{(collesPendent ?? 0) > 1 ? 's' : ''} pendent{(collesPendent ?? 0) > 1 ? 's' : ''} d'aprovació
          </p>
          <a href="/colles?estat=pendent" className="text-sm text-yellow-700 underline mt-1 inline-block">
            Revisar ara →
          </a>
        </div>
      )}

      {(solicitutsPendents ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="font-medium text-red-800">
            👥 Hi ha {solicitutsPendents} sol·licitud{(solicitutsPendents ?? 0) > 1 ? 's' : ''} d'entrada pendents
          </p>
          <a href="/usuaris?estat=pendent" className="text-sm text-red-700 underline mt-1 inline-block">
            Revisar ara →
          </a>
        </div>
      )}
    </div>
  )
}
