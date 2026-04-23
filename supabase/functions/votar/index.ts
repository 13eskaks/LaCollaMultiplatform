// supabase/functions/votar/index.ts
// Registra un vot d'un usuari en una votació, amb totes les validacions necessàries

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // Autenticació
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autenticat' }), { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Token invàlid' }), { status: 401 })
  }

  try {
    const { votacio_id, opcio_id } = await req.json()

    if (!votacio_id || !opcio_id) {
      return new Response(JSON.stringify({ error: 'votacio_id i opcio_id són obligatoris' }), { status: 400 })
    }

    // Obtenir la votació
    const { data: votacio, error: votacioError } = await supabase
      .from('votacions')
      .select('*, colla_id')
      .eq('id', votacio_id)
      .single()

    if (votacioError || !votacio) {
      return new Response(JSON.stringify({ error: 'Votació no trobada' }), { status: 404 })
    }

    // Comprovar que la votació és activa
    if (votacio.data_limit && new Date(votacio.data_limit) < new Date()) {
      return new Response(JSON.stringify({ error: 'La votació ha tancat' }), { status: 400 })
    }

    // Comprovar que l'usuari és membre actiu de la colla
    const { data: membre } = await supabase
      .from('colla_membres')
      .select('id')
      .eq('colla_id', votacio.colla_id)
      .eq('user_id', user.id)
      .eq('estat', 'actiu')
      .single()

    if (!membre) {
      return new Response(JSON.stringify({ error: 'No ets membre actiu d\'aquesta colla' }), { status: 403 })
    }

    // Comprovar que l'opció existeix i pertany a la votació
    const { data: opcio } = await supabase
      .from('votacio_opcions')
      .select('id')
      .eq('id', opcio_id)
      .eq('votacio_id', votacio_id)
      .single()

    if (!opcio) {
      return new Response(JSON.stringify({ error: 'Opció no vàlida' }), { status: 400 })
    }

    // Comprovar que no ha votat ja
    const { data: votExistent } = await supabase
      .from('vots')
      .select('id')
      .eq('votacio_id', votacio_id)
      .eq('user_id', user.id)
      .single()

    if (votExistent) {
      return new Response(JSON.stringify({ error: 'Ja has votat en aquesta votació' }), { status: 409 })
    }

    // Registrar el vot
    const { error: insertError } = await supabase.from('vots').insert({
      votacio_id,
      opcio_id,
      user_id: votacio.vots_anonims ? null : user.id,
      // Guardem sempre user_id en una columna separada per a la deduplicació
      _user_id_for_dedup: user.id,
    })

    if (insertError) {
      // Si és un error d'unicitat, ja ha votat
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Ja has votat en aquesta votació' }), { status: 409 })
      }
      throw insertError
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('votar error:', err)
    return new Response(JSON.stringify({ error: 'Error intern' }), { status: 500 })
  }
})
