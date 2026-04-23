// supabase/functions/notify-solicitud/index.ts
// Disparada per webhook quan s'insereix un colla_membre amb estat='pendent'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const { record } = await req.json()

    if (record.estat !== 'pendent') {
      return new Response('not pendent, skip', { status: 200 })
    }

    // Obtenir dades del sol·licitant
    const { data: solicitant } = await supabase
      .from('profiles')
      .select('nom, cognoms')
      .eq('id', record.user_id)
      .single()

    if (!solicitant) return new Response('solicitant not found', { status: 200 })

    const nomComplet = [solicitant.nom, solicitant.cognoms].filter(Boolean).join(' ')

    // Obtenir tokens push de la comissió
    const { data: comissio } = await supabase
      .from('colla_membres')
      .select('profiles(expo_push_token, nom)')
      .eq('colla_id', record.colla_id)
      .in('rol', ['president', 'secretari', 'tresorer', 'junta'])
      .eq('estat', 'actiu')

    if (!comissio || comissio.length === 0) {
      return new Response('no comissio found', { status: 200 })
    }

    // Obtenir nom de la colla
    const { data: colla } = await supabase
      .from('colles')
      .select('nom')
      .eq('id', record.colla_id)
      .single()

    // Enviar notificacions push via Expo
    const tokens = comissio
      .map((m: any) => m.profiles?.expo_push_token)
      .filter(Boolean)

    if (tokens.length > 0) {
      const messages = tokens.map((token: string) => ({
        to: token,
        sound: 'default',
        title: `Nova sol·licitud · ${colla?.nom ?? ''}`,
        body: `${nomComplet} vol unir-se a la colla`,
        data: {
          type: 'solicitud_entrada',
          colla_id: record.colla_id,
          user_id: record.user_id,
        },
      }))

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      })
    }

    // Log admin
    await supabase.from('admin_log').insert({
      accio: 'solicitud_entrada',
      entitat_tipus: 'colla',
      entitat_id: record.colla_id,
      detall: { user_id: record.user_id, nom: nomComplet },
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('notify-solicitud error:', err)
    return new Response('error', { status: 500 })
  }
})
