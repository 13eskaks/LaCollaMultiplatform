// supabase/functions/notify-nou-event/index.ts
// Disparada per webhook quan s'insereix un event amb notificar_membres = true

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { formatData, formatHora } from 'https://esm.sh/@lacolla/shared@*'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const { record } = await req.json()

    if (!record.notificar_membres) {
      return new Response('notificació no requerida', { status: 200 })
    }

    // Obtenir tokens push de tots els membres actius de la colla
    const { data: membres } = await supabase
      .from('colla_membres')
      .select('profiles(expo_push_token, nom)')
      .eq('colla_id', record.colla_id)
      .eq('estat', 'actiu')

    if (!membres || membres.length === 0) {
      return new Response('no hi ha membres', { status: 200 })
    }

    const tokens = membres
      .map((m: any) => m.profiles?.expo_push_token)
      .filter(Boolean)

    if (tokens.length === 0) {
      return new Response('no hi ha tokens push', { status: 200 })
    }

    // Obtenir nom de la colla
    const { data: colla } = await supabase
      .from('colles')
      .select('nom')
      .eq('id', record.colla_id)
      .single()

    const dataText = formatData(record.data_inici)
    const horaText = formatHora(record.data_inici)

    const messages = tokens.map((token: string) => ({
      to: token,
      sound: 'default',
      title: `📅 Nou event · ${colla?.nom ?? 'La colla'}`,
      body: `${record.titol} · ${dataText} a les ${horaText}`,
      data: {
        type: 'nou_event',
        event_id: record.id,
        colla_id: record.colla_id,
      },
    }))

    // Enviar en batches de 100 (límit de l'API d'Expo)
    const batchSize = 100
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
    }

    return new Response(`notificació enviada a ${tokens.length} membres`, { status: 200 })
  } catch (err) {
    console.error('notify-nou-event error:', err)
    return new Response('error', { status: 500 })
  }
})
