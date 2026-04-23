import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCollaStore } from '@/stores/colla'
import { formatHora } from '@lacolla/shared'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

function salutacio() {
  const h = new Date().getHours()
  if (h < 14) return 'Bon dia'
  if (h < 21) return 'Bona vesprada'
  return 'Bona nit'
}

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
  const { profile } = useAuthStore()
  const { colles, collaActiva, setCollaActiva } = useCollaStore()
  const [events, setEvents] = useState<any[]>([])
  const [activitat, setActivitat] = useState<any[]>([])
  const [rsvpMap, setRsvpMap] = useState<Record<string, string>>({})
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (collaActiva) loadData()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [collaActiva])

  async function loadData() {
    if (!collaActiva) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const [eventsRes, anuncisRes, myRsvpRes] = await Promise.all([
      supabase.from('events').select('*, event_rsvp(count)').eq('colla_id', collaActiva.id)
        .gte('data_inici', new Date().toISOString()).order('data_inici', { ascending: true }).limit(5),
      supabase.from('anuncis').select('*, profiles(nom)').eq('colla_id', collaActiva.id)
        .order('created_at', { ascending: false }).limit(8),
      user ? supabase.from('event_rsvp').select('event_id, estat').eq('user_id', user.id) : null,
    ])

    setEvents(eventsRes.data ?? [])
    setActivitat(anuncisRes.data ?? [])

    if (myRsvpRes?.data) {
      const map: Record<string, string> = {}
      for (const r of myRsvpRes.data) map[r.event_id] = r.estat
      setRsvpMap(map)
    }

    // Realtime subscription
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`home-${collaActiva.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncis', filter: `colla_id=eq.${collaActiva.id}` },
        () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvp' },
        () => loadData())
      .subscribe()

    setLoading(false)
  }

  async function toggleRsvp(eventId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setRsvpLoading(eventId)

    const current = rsvpMap[eventId]
    const newEstat = current === 'apuntat' ? null : 'apuntat'

    if (!newEstat) {
      await supabase.from('event_rsvp').delete().eq('event_id', eventId).eq('user_id', user.id)
      setRsvpMap(m => { const n = { ...m }; delete n[eventId]; return n })
    } else {
      await supabase.from('event_rsvp').upsert({ event_id: eventId, user_id: user.id, estat: newEstat }, { onConflict: 'event_id,user_id' })
      setRsvpMap(m => ({ ...m, [eventId]: newEstat }))
    }
    setRsvpLoading(null)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const apuntat = (eventId: string) => rsvpMap[eventId] === 'apuntat'

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
            <Text style={styles.salut}>{salutacio()},</Text>
            <Text style={styles.nom}>{profile?.nom ?? ''} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/perfil')}>
            <Avatar name={profile?.nom ?? 'U'} size="lg" />
          </TouchableOpacity>
        </View>

        {/* Colla selector chip */}
        {collaActiva && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collesRow}>
            {colles.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.collaChip, c.id === collaActiva.id && styles.collaChipActive]}
                onPress={() => setCollaActiva(c.id)}
              >
                <Text style={[styles.collaChipText, c.id === collaActiva.id && styles.collaChipTextActive]}>
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
          <>
            {/* Pròxims esdeveniments */}
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Pròxims esdeveniments</Text>
                <Link href="/(tabs)/agenda" style={styles.seeAll}>Veure tots</Link>
              </View>

              {events.length === 0 ? (
                <EmptyState icon="📅" title="Sense events pròxims" subtitle="Crea el primer event de la colla!" />
              ) : (
                <View style={{ gap: spacing[3] }}>
                  {events.map(event => (
                    <View key={event.id} style={styles.eventCard}>
                      <Link href={`/event/${event.id}`} asChild>
                        <TouchableOpacity style={styles.eventCardInner}>
                          <View style={styles.eventDateBox}>
                            <Text style={styles.eventDateDay}>
                              {new Date(event.data_inici).toLocaleDateString('ca-ES', { day: 'numeric' })}
                            </Text>
                            <Text style={styles.eventDateMon}>
                              {new Date(event.data_inici).toLocaleDateString('ca-ES', { month: 'short' }).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.eventTitle} numberOfLines={2}>{event.titol}</Text>
                            {event.lloc && <Text style={styles.eventMeta}>📍 {event.lloc}</Text>}
                            <Text style={styles.eventMeta}>
                              👥 {event.event_rsvp?.[0]?.count ?? 0} · 🕐 {formatHora(event.data_inici)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </Link>
                      <TouchableOpacity
                        style={[styles.rsvpBtn, apuntat(event.id) && styles.rsvpBtnActive]}
                        onPress={() => toggleRsvp(event.id)}
                        disabled={rsvpLoading === event.id}
                      >
                        {rsvpLoading === event.id
                          ? <ActivityIndicator size="small" color={apuntat(event.id) ? colors.white : colors.primary[600]} />
                          : <Text style={[styles.rsvpBtnText, apuntat(event.id) && styles.rsvpBtnTextActive]}>
                              {apuntat(event.id) ? 'Apuntat ✓' : "M'apunte"}
                            </Text>
                        }
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Activitat recent */}
            {activitat.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Activitat recent</Text>
                <View style={styles.activityCard}>
                  {activitat.map((item, idx) => (
                    <View key={item.id}>
                      <View style={styles.activityRow}>
                        <Text style={styles.activityIcon}>📢</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activityText} numberOfLines={2}>{item.cos}</Text>
                          <Text style={styles.activityMeta}>
                            {item.profiles?.nom ?? 'Anònim'} · {tempsRelatiu(item.created_at)}
                          </Text>
                        </View>
                      </View>
                      {idx < activitat.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.gray[50] },
  scroll:             { flex: 1 },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenH, paddingTop: spacing[4], paddingBottom: spacing[3] },
  salut:              { ...typography.bodySm, color: colors.gray[500] },
  nom:                { ...typography.h2, color: colors.gray[900] },
  collesRow:          { paddingHorizontal: spacing.screenH, paddingBottom: spacing[4], gap: spacing[2] },
  collaChip:          { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  collaChipActive:    { backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  collaChipText:      { ...typography.bodySm, color: colors.gray[600], fontWeight: '600' },
  collaChipTextActive:{ color: colors.primary[600] },
  loadingBox:         { height: 200, justifyContent: 'center', alignItems: 'center' },
  section:            { marginHorizontal: spacing.screenH, marginBottom: spacing[6] },
  sectionRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle:       { ...typography.h3, color: colors.gray[900] },
  seeAll:             { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },
  eventCard:          { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  eventCardInner:     { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3] },
  eventDateBox:       { backgroundColor: colors.primary[50], borderRadius: radius.sm, width: 50, alignItems: 'center', paddingVertical: spacing[2] },
  eventDateDay:       { fontSize: 20, fontWeight: '800', color: colors.primary[600] },
  eventDateMon:       { fontSize: 10, fontWeight: '700', color: colors.primary[600] },
  eventTitle:         { ...typography.h3, color: colors.gray[900] },
  eventMeta:          { ...typography.caption, color: colors.gray[500] },
  rsvpBtn:            { margin: spacing[3], marginTop: 0, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: spacing[3], borderWidth: 1.5, borderColor: colors.primary[600], alignItems: 'center' },
  rsvpBtnActive:      { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  rsvpBtnText:        { fontSize: 13, fontWeight: '600', color: colors.primary[600] },
  rsvpBtnTextActive:  { color: colors.white },
  activityCard:       { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm },
  activityRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[3] },
  activityIcon:       { fontSize: 18, marginTop: 1 },
  activityText:       { ...typography.body, color: colors.gray[700], lineHeight: 20 },
  activityMeta:       { ...typography.caption, color: colors.gray[400], marginTop: 3 },
  divider:            { height: 1, backgroundColor: colors.gray[100], marginHorizontal: spacing[3] },
})
