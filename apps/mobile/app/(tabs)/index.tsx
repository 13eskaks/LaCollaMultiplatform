import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { useState, useCallback, useRef } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCollaStore } from '@/stores/colla'
import { useScreenCache } from '@/stores/screenCache'
import { formatHora } from '@lacolla/shared'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { EventDateBox } from '@/components/ui/EventDateBox'

function tempsRelatiu(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ara mateix'
  if (mins < 60) return `fa ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `fa ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ahir'
  return `fa ${d} dies`
}


export default function InicialScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const { colles, collaActiva, setCollaActiva, isComissioActiva } = useCollaStore()

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 14) return t('home.greeting.morning')
    if (h < 21) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }
  const screenCache = useScreenCache()
  const [events, setEvents] = useState<any[]>([])
  const [activitat, setActivitat] = useState<any[]>([])
  const [votacionsPendents, setVotacionsPendents] = useState<any[]>([])
  const [isTornMeu, setIsTornMeu] = useState(false)
  const [quotesPendents, setQuotesPendents] = useState(0)
  const [membresPendents, setMembresPendents] = useState(0)
  const [rsvpMap, setRsvpMap] = useState<Record<string, string>>({})
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tricountBal, setTricountBal] = useState(0)
  const [tricountOldestDebt, setTricountOldestDebt] = useState<string | null>(null)
  const channelRef = useRef<any>(null)

  useFocusEffect(useCallback(() => {
    if (!collaActiva) return
    loadData()
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`home-${collaActiva.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncis', filter: `colla_id=eq.${collaActiva.id}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvp' }, () => loadData())
      .subscribe()
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null } }
  }, [collaActiva?.id]))

  async function loadData() {
    if (!collaActiva) return
    const cacheKey = `home_${collaActiva.id}`
    const hasData = events.length > 0 || activitat.length > 0
    if (!hasData) setLoading(true)
    if (!refreshing && !screenCache.isStale(cacheKey) && hasData) return
    screenCache.touch(cacheKey)

    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const todayStr = startOfToday.toISOString()

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)

    const [eventsRes, anuncisRes, myRsvpRes, votacionsRes, myVotsRes, tornRes, quotesRes, pendentsRes, despesesRes, liquidacionsRes] = await Promise.all([
      supabase.from('events').select('*, event_rsvp(estat)').eq('colla_id', collaActiva.id)
        .or(`data_fi.gte.${now},and(data_fi.is.null,data_inici.gte.${todayStr})`)
        .order('data_inici', { ascending: true }).limit(5),
      supabase.from('anuncis').select('*, profiles(nom)').eq('colla_id', collaActiva.id)
        .order('created_at', { ascending: false }).limit(5),
      user ? supabase.from('event_rsvp').select('event_id, estat').eq('user_id', user.id) : null,
      supabase.from('votacions').select('id, pregunta, tipus').eq('colla_id', collaActiva.id)
        .or(`data_limit.is.null,data_limit.gte.${now}`)
        .order('created_at', { ascending: false }).limit(10),
      user ? supabase.from('vots').select('votacio_id').eq('user_id', user.id) : null,
      user ? supabase.from('torns_neteja')
        .select('id, torn_membres(user_id)')
        .eq('colla_id', collaActiva.id)
        .gte('data_inici', weekStart.toISOString().slice(0, 10))
        .lte('data_inici', weekEnd.toISOString().slice(0, 10))
        .limit(1).maybeSingle() : null,
      user ? supabase.from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('colla_id', collaActiva.id).eq('user_id', user.id).eq('estat', 'pendent') : null,
      isComissioActiva() ? supabase.from('colla_membres')
        .select('id', { count: 'exact', head: true })
        .eq('colla_id', collaActiva.id).eq('estat', 'pendent') : null,
      user ? supabase.from('despeses_compartides')
        .select('id, import, pagador_id, data, parts:despesa_parts(user_id, pes)')
        .eq('colla_id', collaActiva.id) : null,
      user ? supabase.from('liquidacions_tricount')
        .select('pagador_id, receptor_id, import')
        .eq('colla_id', collaActiva.id) : null,
    ])

    setEvents(eventsRes.data ?? [])
    setActivitat(anuncisRes.data ?? [])

    if (myRsvpRes?.data) {
      const map: Record<string, string> = {}
      for (const r of myRsvpRes.data) map[r.event_id] = r.estat
      setRsvpMap(map)
    }

    const myVotIds = new Set(myVotsRes?.data?.map((v: any) => v.votacio_id) ?? [])
    setVotacionsPendents((votacionsRes.data ?? []).filter(v => !myVotIds.has(v.id)))

    if (tornRes?.data && user) {
      setIsTornMeu(tornRes.data.torn_membres?.some((m: any) => m.user_id === user.id) ?? false)
    } else {
      setIsTornMeu(false)
    }

    setQuotesPendents((quotesRes as any)?.count ?? 0)
    setMembresPendents((pendentsRes as any)?.count ?? 0)

    if (user && despesesRes?.data && liquidacionsRes?.data) {
      let bal = 0
      let oldestDebt: string | null = null
      for (const d of despesesRes.data) {
        const parts: { user_id: string; pes: number }[] = d.parts ?? []
        const totalPes = parts.reduce((s, p) => s + p.pes, 0)
        if (totalPes === 0) continue
        for (const part of parts) {
          if (part.user_id === d.pagador_id) continue
          const share = (d.import * part.pes) / totalPes
          if (part.user_id === user.id) {
            bal -= share
            if (!oldestDebt || d.data < oldestDebt) oldestDebt = d.data
          } else if (d.pagador_id === user.id) {
            bal += share
          }
        }
      }
      for (const l of liquidacionsRes.data) {
        if (l.pagador_id === user.id) bal += l.import
        if (l.receptor_id === user.id) bal -= l.import
      }
      setTricountBal(bal)
      setTricountOldestDebt(oldestDebt)
    }

    setLoading(false)
  }

  async function toggleRsvp(eventId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setRsvpLoading(eventId)
    const current = rsvpMap[eventId]
    if (current === 'apuntat') {
      await supabase.from('event_rsvp').delete().eq('event_id', eventId).eq('user_id', user.id)
      setRsvpMap(m => { const n = { ...m }; delete n[eventId]; return n })
    } else {
      await supabase.from('event_rsvp').upsert({ event_id: eventId, user_id: user.id, estat: 'apuntat' }, { onConflict: 'event_id,user_id' })
      setRsvpMap(m => ({ ...m, [eventId]: 'apuntat' }))
    }
    setRsvpLoading(null)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const isApuntat = (id: string) => rsvpMap[id] === 'apuntat'

  const tricountOldDebt = tricountBal < -0.005 && tricountOldestDebt !== null &&
    Date.now() - new Date(tricountOldestDebt + 'T00:00:00').getTime() > 30 * 24 * 60 * 60 * 1000

  const perATuItems = [
    isTornMeu && { icon: '🧹', text: 'Et toca el torn de neteja aquesta setmana', color: '#f59e0b', route: `/colla/${collaActiva?.id}/torns` },
    quotesPendents > 0 && { icon: '💶', text: `Tens ${quotesPendents} quota${quotesPendents > 1 ? 'es' : ''} pendent${quotesPendents > 1 ? 's' : ''}`, color: colors.danger[500], route: `/colla/${collaActiva?.id}/quotes` },
    votacionsPendents.length > 0 && { icon: '🗳️', text: `Tens ${votacionsPendents.length} votació${votacionsPendents.length > 1 ? 'ns' : ''} per votar`, color: colors.primary[600], route: `/colla/${collaActiva?.id}/votacions` },
    membresPendents > 0 && { icon: '👤', text: `${membresPendents} sol·licitud${membresPendents > 1 ? 's' : ''} d'entrada pendent${membresPendents > 1 ? 's' : ''}`, color: colors.warning?.[600] ?? '#d97706', route: `/colla/${collaActiva?.id}/membres` },
    tricountBal < -5 && { icon: '🧾', text: `Deus ${(-tricountBal).toFixed(2).replace('.', ',')} € al Tricount`, color: colors.danger[500], route: `/colla/${collaActiva?.id}/tricount` },
    !!(tricountBal >= -5 && tricountOldDebt) && { icon: '🧾', text: 'Tens un deute pendent al Tricount', color: '#d97706', route: `/colla/${collaActiva?.id}/tricount` },
  ].filter(Boolean) as { icon: string; text: string; color: string; route: string }[]

  const QUICK_ACTIONS = [
    { icon: '📅', label: t('home.qa.event'),  route: '/event/create' },
    { icon: '📢', label: t('home.qa.anunci'), route: `/colla/${collaActiva?.id}/anuncis/create` },
    { icon: '🗳️', label: t('home.qa.vote'),   route: `/colla/${collaActiva?.id}/votacions/create` },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.salut}>{getGreeting()}</Text>
            <Text style={styles.nom}>{profile?.nom ?? ''} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/perfil' as any)}>
            <Avatar name={profile?.nom ?? 'U'} uri={profile?.avatar_url} size="lg" />
          </TouchableOpacity>
        </View>

        {/* Colla selector (only if multiple colles) */}
        {colles.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collesRow}>
            {colles.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.collaChip, c.id === collaActiva?.id && styles.collaChipActive]}
                onPress={() => setCollaActiva(c.id)}
              >
                <Text style={[styles.collaChipText, c.id === collaActiva?.id && styles.collaChipTextActive]}>
                  🌩 {c.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary[600]} />
          </View>
        ) : (
          <View style={styles.content}>

            {/* Per a tu */}
            {perATuItems.length > 0 && (
              <View style={styles.perATuCard}>
                <Text style={styles.perATuTitle}>{t('home.forYou')}</Text>
                {perATuItems.map((item, i) => (
                  <TouchableOpacity key={i} style={styles.perATuRow} onPress={() => router.push(item.route as any)}>
                    <Text style={styles.perATuIcon}>{item.icon}</Text>
                    <Text style={[styles.perATuText, { color: item.color }]} numberOfLines={1}>{item.text}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray[300]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Pròxims esdeveniments */}
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>{t('home.upcoming')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/agenda' as any)}>
                  <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                </TouchableOpacity>
              </View>

              {events.length === 0 ? (
                <EmptyState icon="📅" title={t('home.empty.events')} subtitle={t('home.empty.events.sub')} />
              ) : (
                <>
                  {/* First event — prominent card */}
                  {(() => {
                    const ev = events[0]
                    const apuntat = isApuntat(ev.id)
                    return (
                      <View style={styles.eventCardBig}>
                        <TouchableOpacity style={styles.eventCardBigInner} onPress={() => router.push(`/event/${ev.id}` as any)} activeOpacity={0.8}>
                          <EventDateBox inici={ev.data_inici} fi={ev.data_fi} />
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={styles.eventBigTitle} numberOfLines={2}>{ev.titol}</Text>
                            {ev.lloc ? <Text style={styles.eventBigMeta}>📍 {ev.lloc}</Text> : null}
                            <Text style={styles.eventBigMeta}>
                              {`🕐 ${formatHora(ev.data_inici)}  👥 `}
                              {(() => {
                                const n = (ev.event_rsvp ?? []).filter((r: any) => r.estat === 'apuntat').length
                                return ev.limit_places ? `${n}/${ev.limit_places}` : `${n}`
                              })()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rsvpBtn, apuntat && styles.rsvpBtnActive]}
                          onPress={() => toggleRsvp(ev.id)}
                          disabled={rsvpLoading === ev.id}
                        >
                          {rsvpLoading === ev.id
                            ? <ActivityIndicator size="small" color={apuntat ? colors.white : colors.primary[600]} />
                            : <Text style={[styles.rsvpBtnText, apuntat && styles.rsvpBtnTextActive]}>
                                {apuntat ? '✓ Apuntat · Cancel·lar' : "M'apunte! 🙋"}
                              </Text>
                          }
                        </TouchableOpacity>
                      </View>
                    )
                  })()}

                  {/* More events — compact horizontal scroll */}
                  {events.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing[2], paddingBottom: spacing[2] }} contentContainerStyle={styles.moreEventsContent}>
                      {events.slice(1).map(ev => (
                        <TouchableOpacity key={ev.id} style={styles.eventCardSmall} onPress={() => router.push(`/event/${ev.id}` as any)}>
                          <EventDateBox inici={ev.data_inici} fi={ev.data_fi} />
                          <Text style={styles.eventSmallTitle} numberOfLines={2}>{ev.titol}</Text>
                          {ev.lloc ? <Text style={styles.eventSmallMeta} numberOfLines={1}>📍 {ev.lloc}</Text> : null}
                          <Text style={styles.eventSmallMeta}>
                            {`👥 `}
                            {(() => {
                              const n = (ev.event_rsvp ?? []).filter((r: any) => r.estat === 'apuntat').length
                              return ev.limit_places ? `${n}/${ev.limit_places}` : `${n}`
                            })()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
            </View>

            {/* Accions ràpides (comissió only) */}
            {isComissioActiva() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
                <View style={styles.quickRow}>
                  {QUICK_ACTIONS.map(a => (
                    <TouchableOpacity key={a.label} style={styles.quickBtn} onPress={() => router.push(a.route as any)}>
                      <View style={styles.quickIcon}>
                        <Text style={{ fontSize: 26 }}>{a.icon}</Text>
                      </View>
                      <Text style={styles.quickLabel}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Activitat recent */}
            {activitat.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>{t('home.recentActivity')}</Text>
                  <TouchableOpacity onPress={() => router.push(`/colla/${collaActiva?.id}/anuncis` as any)}>
                    <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.activityCard}>
                  {activitat.map((item, idx) => (
                    <View key={item.id}>
                      <TouchableOpacity
                        style={styles.activityRow}
                        onPress={() => router.push(`/colla/${collaActiva?.id}/anuncis/${item.id}` as any)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.activityIcon}>📢</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activityText} numberOfLines={2}>
                            {item.titol || item.cos || '—'}
                          </Text>
                          <Text style={styles.activityMeta}>
                            {item.profiles?.nom ?? 'Anònim'} · {tempsRelatiu(item.created_at)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.gray[300]} />
                      </TouchableOpacity>
                      {idx < activitat.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              </View>
            )}

          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.gray[50] },
  scroll:             { flex: 1 },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenH, paddingTop: spacing[4], paddingBottom: spacing[3] },
  salut:              { ...typography.bodySm, color: colors.gray[500] },
  nom:                { ...typography.h2, color: colors.gray[900] },

  // Colla chips
  collesRow:          { paddingHorizontal: spacing.screenH, paddingBottom: spacing[4], gap: spacing[2] },
  collaChip:          { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  collaChipActive:    { backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  collaChipText:      { ...typography.bodySm, color: colors.gray[600], fontWeight: '600' },
  collaChipTextActive:{ color: colors.primary[600] },

  loadingBox:         { height: 200, justifyContent: 'center', alignItems: 'center' },
  content:            { gap: spacing[4], paddingBottom: spacing[4] },

  // Per a tu
  perATuCard:         { marginHorizontal: spacing.screenH, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[3], ...shadows.sm },
  perATuTitle:        { ...typography.label, color: colors.gray[500] },
  perATuRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  perATuIcon:         { fontSize: 20, width: 28, textAlign: 'center' },
  perATuText:         { ...typography.body, fontWeight: '600', flex: 1 },

  // Sections
  section:            { marginHorizontal: spacing.screenH },
  sectionRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle:       { ...typography.h3, color: colors.gray[900] },
  seeAll:             { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },

  // Big event card
  eventCardBig:       { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  eventCardBigInner:  { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  eventBigTitle:      { ...typography.h3, color: colors.gray[900] },
  eventBigMeta:       { ...typography.caption, color: colors.gray[500] },
  rsvpBtn:            { margin: spacing[3], marginTop: 0, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary[600] },
  rsvpBtnActive:      { backgroundColor: colors.primary[600] },
  rsvpBtnText:        { fontSize: 13, fontWeight: '600', color: colors.primary[600] },
  rsvpBtnTextActive:  { color: colors.white },

  // Date box

  // Small event cards (horizontal scroll)
  moreEventsContent:  { gap: spacing[2], paddingRight: spacing[1], paddingBottom: 2 },
  eventCardSmall:     { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, padding: spacing[3], gap: spacing[2], width: 140 },
  eventSmallTitle:    { ...typography.bodySm, color: colors.gray[900], fontWeight: '600' },
  eventSmallMeta:     { ...typography.caption, color: colors.gray[500] },

  // Quick actions
  quickRow:           { flexDirection: 'row', gap: spacing[3] },
  quickBtn:           { flex: 1, alignItems: 'center', gap: spacing[2] },
  quickIcon:          { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...shadows.sm },
  quickLabel:         { ...typography.caption, color: colors.gray[600], fontWeight: '600', textAlign: 'center' },

  // Activity feed
  activityCard:       { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm },
  activityRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[3] },
  activityIcon:       { fontSize: 18, marginTop: 1 },
  activityText:       { ...typography.body, color: colors.gray[700], lineHeight: 20 },
  activityMeta:       { ...typography.caption, color: colors.gray[400], marginTop: 3 },
  divider:            { height: 1, backgroundColor: colors.gray[100], marginHorizontal: spacing[3] },
})
