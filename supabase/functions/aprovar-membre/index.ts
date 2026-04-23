// supabase/functions/aprovar-membre/index.ts
// Aprova o rebutja una sol·licitud d'entrada a una colla i envia notificació push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // Autenticació — qui crida ha de ser de la comissió
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
    const { membre_id, accio } = await req.json() // accio: 'aprovar' | 'rebutjar'

    if (!membre_id || !['aprovar', 'rebutjar'].includes(accio)) {
      return new Response(JSON.stringify({ error: 'Paràmetres invàlids' }), { status: 400 })
    }

    // Obtenir la sol·licitud
    const { data: sol, error: solError } = await supabase
      .from('colla_membres')
      .select('*, colles(nom), profiles(nom, cognoms, expo_push_token)')
      .eq('id', membre_id)
      .eq('estat', 'pendent')
      .single()

    if (solError || !sol) {
      return new Response(JSON.stringify({ error: 'Sol·licitud no trobada o ja processada' }), { status: 404 })
    }

    // Verificar que qui crida és de la comissió d'aquella colla
    const { data: caller } = await supabase
      .from('colla_membres')
      .select('rol')
      .eq('colla_id', sol.colla_id)
      .eq('user_id', user.id)
      .eq('estat', 'actiu')
      .in('rol', ['president', 'secretari', 'tresorer', 'junta'])
      .single()

    if (!caller) {
      return new Response(JSON.stringify({ error: 'No tens permís per gestionar sol·licituds' }), { status: 403 })
    }

    if (accio === 'aprovar') {
      await supabase
        .from('colla_membres')
        .update({ estat: 'actiu', data_ingres: new Date().toISOString().slice(0, 10) })
        .eq('id', membre_id)
    } else {
      // Rebutjar: eliminar la sol·licitud per permetre reintentar
      await supabase.from('colla_membres').delete().eq('id', membre_id)
    }

    // Enviar notificació push al sol·licitant
    const pushToken = sol.profiles?.expo_push_token
    if (pushToken) {
      const nomColla = sol.colles?.nom ?? 'la colla'
      const msg = accio === 'aprovar'
        ? { title: '🎉 Sol·licitud acceptada!', body: `Ja formes part de ${nomColla}. Benvingut/da!` }
        : { title: '❌ Sol·licitud no acceptada', body: `La teua sol·licitud per unir-te a ${nomColla} no ha sigut aprovada.` }

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          to: pushToken,
          sound: 'default',
          ...msg,
          data: { type: 'resposta_solicitud', accio, colla_id: sol.colla_id },
        }]),
      })
    }

    // Log
    await supabase.from('admin_log').insert({
      accio: `${accio}_membre`,
      entitat_tipus: 'colla_membre',
      entitat_id: membre_id,
      detall: { colla_id: sol.colla_id, user_id: sol.user_id, per: user.id },
    })

    const nouEstat = accio === 'aprovar' ? 'actiu' : 'eliminat'
    return new Response(JSON.stringify({ ok: true, estat: nouEstat }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('aprovar-membre error:', err)
    return new Response(JSON.stringify({ error: 'Error intern' }), { status: 500 })
  }
})
