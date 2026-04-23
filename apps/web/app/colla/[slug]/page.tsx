import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { formatData } from '@lacolla/shared'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: colla } = await supabase
    .from('colles')
    .select('nom, descripcio, portada_url, localitat')
    .eq('slug', params.slug)
    .eq('estat', 'activa')
    .single()

  if (!colla) return { title: 'LaColla' }

  return {
    title: `${colla.nom} · LaColla`,
    description: colla.descripcio ?? `${colla.nom} — ${colla.localitat}. Gestiona la teua colla amb LaColla.`,
    openGraph: {
      title: colla.nom,
      description: colla.descripcio ?? '',
      images: colla.portada_url ? [colla.portada_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: colla.nom,
      description: colla.descripcio ?? '',
      images: colla.portada_url ? [colla.portada_url] : [],
    },
  }
}

export default async function CollaLandingPage({ params }: Props) {
  const supabase = createClient()

  // Colla + config
  const { data: colla } = await supabase
    .from('colles')
    .select(`
      *,
      colla_config (
        perfil_public,
        mostrar_events_publics,
        mostrar_fotos_publiques,
        mostrar_anuncis_publics
      )
    `)
    .eq('slug', params.slug)
    .eq('estat', 'activa')
    .single()

  if (!colla || !colla.colla_config?.perfil_public) notFound()

  // Recompte de membres (sense noms per a anònims)
  const { count: numMembres } = await supabase
    .from('colla_membres')
    .select('*', { count: 'exact', head: true })
    .eq('colla_id', colla.id)
    .eq('estat', 'actiu')

  // Events públics
  const { data: events } = colla.colla_config.mostrar_events_publics
    ? await supabase
        .from('events')
        .select('id, titol, data_inici, lloc')
        .eq('colla_id', colla.id)
        .eq('obert_global', true)
        .gte('data_inici', new Date().toISOString())
        .order('data_inici', { ascending: true })
        .limit(4)
    : { data: [] }

  // Fotos públiques
  const { data: fotos } = colla.colla_config.mostrar_fotos_publiques
    ? await supabase
        .from('fotos')
        .select('id, url')
        .eq('colla_id', colla.id)
        .eq('publica', true)
        .order('created_at', { ascending: false })
        .limit(6)
    : { data: [] }

  // Anuncis públics
  const { data: anuncis } = colla.colla_config.mostrar_anuncis_publics
    ? await supabase
        .from('anuncis')
        .select('id, cos, created_at')
        .eq('colla_id', colla.id)
        .eq('public', true)
        .order('fixat', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const anysFundada = colla.any_fundacio
    ? new Date().getFullYear() - colla.any_fundacio
    : null

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative h-64 bg-gray-200">
        {colla.portada_url && (
          <Image
            src={colla.portada_url}
            alt={`Portada de ${colla.nom}`}
            fill
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-end">
          <div className="p-6 text-white">
            <div className="flex items-center gap-4">
              {colla.avatar_url && (
                <Image
                  src={colla.avatar_url}
                  alt={colla.nom}
                  width={64}
                  height={64}
                  className="rounded-full border-2 border-white"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{colla.nom}</h1>
                <p className="text-sm opacity-90">
                  {colla.localitat}
                  {numMembres ? ` · ${numMembres} membres` : ''}
                  {anysFundada ? ` · ${anysFundada} anys` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* CTA */}
        <div className="flex gap-3">
          <a
            href={`/auth/login?redirect=/colla/${params.slug}`}
            className="flex-1 text-center py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Ja sóc membre
          </a>
          <a
            href={`/auth/register?colla=${colla.id}`}
            className="flex-1 text-center py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Sol·licitar unir-me
          </a>
        </div>

        {/* Descripció */}
        {colla.descripcio && (
          <section>
            <h2 className="text-lg font-semibold mb-2">Sobre nosaltres</h2>
            <p className="text-gray-600 leading-relaxed">{colla.descripcio}</p>
          </section>
        )}

        {/* Xarxes socials */}
        {(colla.web || colla.instagram || colla.facebook) && (
          <section className="flex gap-4 text-sm text-blue-600">
            {colla.web && <a href={colla.web} target="_blank" rel="noopener noreferrer">🌐 Web</a>}
            {colla.instagram && (
              <a href={`https://instagram.com/${colla.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                📷 Instagram
              </a>
            )}
            {colla.facebook && <a href={colla.facebook} target="_blank" rel="noopener noreferrer">📘 Facebook</a>}
          </section>
        )}

        {/* Events públics */}
        {events && events.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Pròxims events oberts</h2>
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-medium text-blue-600 w-24 shrink-0">
                    {formatData(event.data_inici, 'ca-ES')}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{event.titol}</p>
                    {event.lloc && <p className="text-sm text-gray-500">📍 {event.lloc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fotos */}
        {fotos && fotos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Fotos recents</h2>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((foto) => (
                <div key={foto.id} className="aspect-square relative rounded-xl overflow-hidden bg-gray-100">
                  <Image src={foto.url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Anuncis */}
        {anuncis && anuncis.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Darreres notícies</h2>
            <div className="space-y-2">
              {anuncis.map((anunci) => (
                <div key={anunci.id} className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-gray-700 text-sm">📢 {anunci.cos}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatData(anunci.created_at)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA bottom */}
        <section className="border rounded-xl p-5 text-center space-y-3">
          <p className="font-semibold text-gray-800">Formes part de la colla?</p>
          <div className="flex gap-3">
            <a
              href={`/auth/login?redirect=/colla/${params.slug}`}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Entrar
            </a>
            <a
              href={`/auth/register?colla=${colla.id}`}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Sol·licitar
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
