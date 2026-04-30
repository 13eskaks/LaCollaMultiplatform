import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { RichBodyView } from '@/components/ui/RichBody'
import type { SavedBlock, CollaData } from '@/components/ui/RichBody'
import { formatData } from '@lacolla/shared'

type MembershipEstat = 'none' | 'pendent' | 'actiu'

export default function CollaLandingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [colla, setColla] = useState<any>(null)
  const [membresCount, setMembresCount] = useState(0)
  const [openEvents, setOpenEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [membership, setMembership] = useState<MembershipEstat>('none')

  useEffect(() => { loadColla() }, [id])

  async function loadColla() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const today = new Date().toISOString()

    const [collaRes, countRes, eventsRes] = await Promise.all([
      supabase.from('colles')
        .select('id, nom, localitat, comarca, any_fundacio, avatar_url, portada_url, descripcio, landing_blocks')
        .eq('id', id).single(),
      supabase.rpc('get_colla_membres_count', { p_colla_id: id }),
      supabase.from('events')
        .select('id, titol, data_inici, data_fi, lloc, color, limit_places, event_rsvp(estat)')
        .eq('colla_id', id)
        .eq('visible_extern', true)
        .gte('data_inici', today)
        .order('data_inici')
        .limit(5),
    ])

    setColla(collaRes.data)
    setMembresCount(countRes.data ?? 0)
    setOpenEvents(eventsRes.data ?? [])

    if (user) {
      const { data: memb } = await supabase
        .from('colla_membres').select('estat')
        .eq('colla_id', id).eq('user_id', user.id).maybeSingle()
      setMembership((memb?.estat as MembershipEstat) ?? 'none')
    }

    setLoading(false)
  }

  async function handleJoin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/(auth)/register' as any)
      return
    }
    setJoining(true)
    const { error } = await supabase.from('colla_membres').insert({
      colla_id: id, user_id: user.id, estat: 'pendent', rol: 'membre',
    })
    setJoining(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setMembership('pendent')
      Alert.alert('Sol·licitud enviada!', 'La comissió de la colla revisarà la teva sol·licitud en breu.')
    }
  }

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[600]} /></View>
  if (!colla) return <View style={styles.loader}><Text style={{ color: colors.gray[500] }}>Colla no trobada</Text></View>

  const landingBlocks: SavedBlock[] | null = Array.isArray(colla.landing_blocks) && colla.landing_blocks.length > 0
    ? colla.landing_blocks
    : null

  const collaData: CollaData = {
    nom: colla.nom,
    localitat: colla.localitat,
    any_fundacio: colla.any_fundacio,
    membresCount,
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero portada */}
        <View style={styles.hero}>
          {colla.portada_url ? (
            <Image source={{ uri: colla.portada_url }} style={styles.portada} />
          ) : (
            <View style={[styles.portada, { backgroundColor: colors.primary[600] }]} />
          )}
          <View style={styles.heroOverlay} />
          <SafeAreaView style={styles.heroTop} edges={['top']}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Capçalera */}
        <View style={styles.content}>
          <Avatar name={colla.nom} uri={colla.avatar_url} size="2xl" border style={styles.avatar} />

          <Text style={styles.nom}>{colla.nom}</Text>
          {colla.localitat && <Text style={styles.localitat}>📍 {colla.localitat}</Text>}
          {colla.any_fundacio && (
            <Text style={styles.meta}>Fundada el {colla.any_fundacio} · {new Date().getFullYear() - colla.any_fundacio} anys</Text>
          )}

          {/* Stats bàsiques si no hi ha blocks */}
          {!landingBlocks && (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{membresCount}</Text>
                <Text style={styles.statLabel}>Membres</Text>
              </View>
              {colla.any_fundacio && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{new Date().getFullYear() - colla.any_fundacio}</Text>
                    <Text style={styles.statLabel}>Anys</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Contingut rich */}
          {landingBlocks ? (
            <View style={styles.richWrap}>
              <RichBodyView blocks={landingBlocks} colla={collaData} />
            </View>
          ) : colla.descripcio ? (
            <Text style={styles.descripcio}>{colla.descripcio}</Text>
          ) : null}

          {/* Activitats obertes */}
          {openEvents.length > 0 && (
            <View style={styles.eventsSection}>
              <Text style={styles.eventsSectionTitle}>Properes activitats obertes</Text>
              <View style={styles.eventsList}>
                {openEvents.map(ev => {
                  const apuntats = (ev.event_rsvp ?? []).filter((r: any) => r.estat === 'apuntat').length
                  const color = ev.color ?? colors.primary[600]
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={styles.eventCard}
                      onPress={() => router.push(`/event/${ev.id}` as any)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.eventColorBar, { backgroundColor: color }]} />
                      <View style={styles.eventCardBody}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{ev.titol}</Text>
                        <Text style={styles.eventMeta}>
                          📅 {formatData(ev.data_inici)}
                          {ev.lloc ? `  📍 ${ev.lloc}` : ''}
                        </Text>
                        <View style={styles.eventFooter}>
                          <Text style={styles.eventApuntats}>👥 {apuntats} apuntats</Text>
                          {ev.limit_places && (
                            <Text style={styles.eventPlaces}>
                              {Math.max(0, ev.limit_places - apuntats)} lliures
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.eventChevron, { color }]}>›</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* CTA fix a baix */}
      <View style={styles.cta}>
        {membership === 'actiu' ? (
          <Button label="✓ Ja ets membre d'aquesta colla" variant="secondary" size="lg" disabled style={{ flex: 1 }} onPress={() => {}} />
        ) : membership === 'pendent' ? (
          <View style={styles.pendentWrap}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.pendentText}>Sol·licitud pendent d'aprovació</Text>
          </View>
        ) : (
          <Button label="Sol·licitar unir-me 🙋" size="lg" loading={joining} style={{ flex: 1 }} onPress={handleJoin} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.white },
  loader:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero:        { height: 200, position: 'relative' },
  portada:     { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroTop:     { ...StyleSheet.absoluteFillObject, paddingHorizontal: spacing.screenH },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginTop: spacing[2] },
  closeBtnText:{ color: colors.white, fontSize: 14 },
  content:     { paddingHorizontal: spacing.screenH, alignItems: 'center', gap: spacing[4] },
  avatar:      { marginTop: -40 },
  nom:         { ...typography.h1, color: colors.gray[900], textAlign: 'center' },
  localitat:   { ...typography.body, color: colors.gray[500] },
  meta:        { ...typography.caption, color: colors.gray[400] },
  statsRow:    { flexDirection: 'row', backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing[3], alignSelf: 'stretch', justifyContent: 'center' },
  stat:        { flex: 1, alignItems: 'center', gap: 2 },
  statNum:     { ...typography.h2, color: colors.gray[900] },
  statLabel:   { ...typography.caption, color: colors.gray[500] },
  statDivider: { width: 1, backgroundColor: colors.gray[200] },
  descripcio:  { ...typography.bodyLg, color: colors.gray[600], textAlign: 'center', lineHeight: 24 },
  richWrap:    { alignSelf: 'stretch' },
  cta:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, paddingHorizontal: spacing.screenH, paddingTop: spacing[3], paddingBottom: spacing[8], borderTopWidth: 1, borderTopColor: colors.gray[100], flexDirection: 'row', ...shadows.md },
  pendentWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.primary[50], borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  pendentText: { ...typography.body, color: colors.primary[700], flex: 1 },

  // Open events
  eventsSection:     { alignSelf: 'stretch', gap: spacing[3] },
  eventsSectionTitle:{ ...typography.h3, color: colors.gray[900] },
  eventsList:        { gap: spacing[2] },
  eventCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray[50], borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.gray[100] },
  eventColorBar:     { width: 4, alignSelf: 'stretch' },
  eventCardBody:     { flex: 1, padding: spacing[3], gap: 3 },
  eventTitle:        { ...typography.body, color: colors.gray[900], fontWeight: '700' },
  eventMeta:         { ...typography.caption, color: colors.gray[500] },
  eventFooter:       { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: 2 },
  eventApuntats:     { ...typography.caption, color: colors.gray[500] },
  eventPlaces:       { ...typography.caption, color: colors.primary[600], fontWeight: '600' },
  eventChevron:      { fontSize: 22, paddingRight: spacing[3], fontWeight: '300' },
})
