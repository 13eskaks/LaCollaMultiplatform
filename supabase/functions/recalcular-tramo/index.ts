// supabase/functions/recalcular-tramo/index.ts
// Cridat per webhook de Stripe en renovació de subscripció de colla
// Recalcula el tramo i actualitza el preu si ha canviat

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
})

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type !== 'invoice.upcoming' && event.type !== 'customer.subscription.updated') {
    return new Response('skip', { status: 200 })
  }

  try {
    const stripeSubId = event.data.object.id

    // Obtenir la subscripció de la BD
    const { data: sub } = await supabase
      .from('subscripcions')
      .select('*, colles(nom)')
      .eq('stripe_subscription_id', stripeSubId)
      .single()

    if (!sub || sub.tipus !== 'colla') {
      return new Response('not a colla subscription', { status: 200 })
    }

    // Comptar membres actius actuals
    const { count: numMembres } = await supabase
      .from('colla_membres')
      .select('*', { count: 'exact', head: true })
      .eq('colla_id', sub.colla_id)
      .eq('estat', 'actiu')

    // Obtenir nou tramo
    const { data: nouTramo } = await supabase
      .rpc('get_tramo_colla', { p_colla_id: sub.colla_id })

    const { data: tramoDades } = await supabase
      .from('premium_tramos')
      .select('*')
      .eq('id', nouTramo)
      .single()

    if (!tramoDades) return new Response('tramo not found', { status: 200 })

    const nouPreu = sub.periode === 'anual'
      ? tramoDades.preu_anual
      : tramoDades.preu_mensual

    // Si el tramo ha canviat, notificar a la comissió
    if (nouTramo !== sub.tramo_id) {
      // Obtenir tokens push de la comissió
      const { data: comissio } = await supabase
        .from('colla_membres')
        .select('profiles(expo_push_token)')
        .eq('colla_id', sub.colla_id)
        .in('rol', ['president', 'secretari', 'tresorer', 'junta'])
        .eq('estat', 'actiu')

      const tokens = comissio
        ?.map((m: any) => m.profiles?.expo_push_token)
        .filter(Boolean) ?? []

      if (tokens.length > 0) {
        const messages = tokens.map((token: string) => ({
          to: token,
          sound: 'default',
          title: '💳 Canvi de pla Premium',
          body: `La colla té ${numMembres} membres. El proper mes pagareu ${nouPreu}€.`,
          data: { type: 'canvi_tramo', colla_id: sub.colla_id },
        }))

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
      }

      // Actualitzar la subscripció a la BD
      await supabase
        .from('subscripcions')
        .update({
          tramo_id: nouTramo,
          membres_al_contractar: numMembres,
          import: nouPreu,
        })
        .eq('id', sub.id)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('recalcular-tramo error:', err)
    return new Response('error', { status: 500 })
  }
})
