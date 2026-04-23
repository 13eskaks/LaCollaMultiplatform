// supabase/functions/exportar-dades/index.ts
// GDPR: permet a l'usuari descarregar totes les seues dades en format JSON

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
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
    const [profileRes, membresRes, votsRes, missatgesRes, rsvpRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('colla_membres').select('*, colles(nom)').eq('user_id', user.id),
      supabase.from('vots').select('*, votacions(pregunta, colla_id)').eq('user_id', user.id),
      supabase.from('forum_missatges').select('text, created_at, forum_fils(titol)').eq('autor_id', user.id).limit(100),
      supabase.from('event_rsvp').select('estat, created_at, events(titol, data_inici)').eq('user_id', user.id).limit(100),
    ])

    const exportData = {
      exportat_el: new Date().toISOString(),
      perfil: profileRes.data,
      colles: membresRes.data,
      vots: votsRes.data,
      missatges_forum: missatgesRes.data,
      assistencia_events: rsvpRes.data,
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="lacolla-dades-${user.id.slice(0, 8)}.json"`,
      },
    })
  } catch (err) {
    console.error('exportar-dades error:', err)
    return new Response(JSON.stringify({ error: 'Error intern' }), { status: 500 })
  }
})
