// supabase/functions/get-anunci/index.ts
// Retorna un anunci comercial per a la comarca de la colla activa de l'usuari

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const { colla_id } = await req.json()

    if (!colla_id) {
      return new Response(JSON.stringify({ error: 'colla_id required' }), { status: 400 })
    }

    // Obtenir comarca de la colla
    const { data: colla } = await supabase
      .from('colles')
      .select('comarca')
      .eq('id', colla_id)
      .single()

    const today = new Date().toISOString().split('T')[0]

    // Buscar anunci actiu per comarca (o genèric si no n'hi ha)
    let query = supabase
      .from('anuncis_comercials')
      .select('*')
      .eq('actiu', true)
      .lte('data_inici', today)
      .gte('data_fi', today)
      .order('created_at', { ascending: false })

    if (colla?.comarca) {
      query = query.contains('comarques', [colla.comarca])
    }

    const { data: anuncis } = await query.limit(10)

    if (!anuncis || anuncis.length === 0) {
      return new Response(JSON.stringify({ anunci: null }), { status: 200 })
    }

    // Escollir aleatòriament entre els disponibles (distribució uniforme)
    const anunci = anuncis[Math.floor(Math.random() * anuncis.length)]

    // Registrar impressió
    await supabase
      .from('anuncis_comercials')
      .update({ impressions: anunci.impressions + 1 })
      .eq('id', anunci.id)

    return new Response(JSON.stringify({ anunci }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('get-anunci error:', err)
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500 })
  }
})
