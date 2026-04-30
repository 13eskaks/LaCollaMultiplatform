import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, ActivityIndicator, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect, useMemo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { formatData } from '@lacolla/shared'

export default function WelcomeScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState<any[]>([])
  const [colles, setColles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPublic() }, [])

  async function loadPublic() {
    const now = new Date().toISOString()
    const [eventsRes, collesRes] = await Promise.all([
      supabase.from('events')
        .select('id, titol, data_inici, data_fi, lloc, color, colla:colles(id, nom, localitat, avatar_url)')
        .eq('visible_extern', true)
        .gte('data_inici', now)
        .order('data_inici')
        .limit(12),
      supabase.from('colla_config')
        .select('colla:colles(id, nom, localitat, comarca, avatar_url, portada_url, any_fundacio)')
        .eq('perfil_public', true)
        .limit(24),
    ])
    setEvents(eventsRes.data ?? [])
    setColles((collesRes.data ?? []).map((r: any) => r.colla).filter(Boolean))
    setLoading(false)
  }

  const q = search.trim().toLowerCase()

  const filteredEvents = useMemo(() => q ? events.filter(e =>
    e.titol?.toLowerCase().includes(q) ||
    e.lloc?.toLowerCase().includes(q) ||
    (e.colla as any)?.nom?.toLowerCase().includes(q) ||
    (e.colla as any)?.localitat?.toLowerCase().includes(q)
  ) : events, [events, q])

  const filteredColles = useMemo(() => q ? colles.filter(c =>
    c.nom?.toLowerCase().includes(q) ||
    c.localitat?.toLowerCase().includes(q) ||
    c.comarca?.toLowerCase().includes(q)
  ) : colles, [colles, q])

  function goEvent(id: string) { router.push(`/event/${id}` as any) }
  function goColla(id: string)  { router.push(`/colla/${id}/landing` as any) }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Top bar */}
        <View style={s.topBar}>
          <Text style={s.logo}>
            <Text style={s.logoLa}>La</Text>
            <Text style={s.logoColla}>Colla</Text>
            <Text style={s.logoIcon}> 🌩</Text>
          </Text>
          <TouchableOpacity style={s.langBtn} onPress={() => router.push('/(auth)/language' as any)}>
            <Text style={s.langText}>🌐</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={colors.gray[400]} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Busca per zona, localitat o nom..."
            placeholderTextColor={colors.gray[400]}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {loading ? (
            <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
          ) : (
            <>
              {/* ── Activitats obertes ── */}
              {filteredEvents.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionRow}>
                    <Text style={s.sectionTitle}>📅 Activitats obertes</Text>
                    <Text style={s.sectionSub}>{filteredEvents.length} disponibles</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
                    {filteredEvents.map(ev => {
                      const colla = ev.colla as any
                      const color = ev.color ?? colors.primary[600]
                      return (
                        <TouchableOpacity key={ev.id} style={s.eventCard} onPress={() => goEvent(ev.id)} activeOpacity={0.8}>
                          <View style={[s.eventColorBar, { backgroundColor: color }]} />
                          <View style={s.eventBody}>
                            <Text style={s.eventDate}>{formatData(ev.data_inici)}</Text>
                            <Text style={s.eventTitle} numberOfLines={2}>{ev.titol}</Text>
                            {ev.lloc && <Text style={s.eventMeta} numberOfLines={1}>📍 {ev.lloc}</Text>}
                            {colla && (
                              <View style={s.eventColla}>
                                <Avatar name={colla.nom} uri={colla.avatar_url} size="xs" />
                                <Text style={s.eventCollaNom} numberOfLines={1}>{colla.nom}</Text>
                              </View>
                            )}
                            <View style={[s.joinBadge, { borderColor: color }]}>
                              <Text style={[s.joinBadgeText, { color }]}>M'apunte →</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ── Colles ── */}
              {filteredColles.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionRow}>
                    <Text style={s.sectionTitle}>🌩 Colles</Text>
                    <Text style={s.sectionSub}>{filteredColles.length} colles</Text>
                  </View>
                  <View style={s.collaGrid}>
                    {filteredColles.map(c => {
                      const anys = c.any_fundacio ? new Date().getFullYear() - c.any_fundacio : null
                      return (
                        <TouchableOpacity key={c.id} style={s.collaCard} onPress={() => goColla(c.id)} activeOpacity={0.8}>
                          <View style={s.collaHero}>
                            {c.portada_url
                              ? <Image source={{ uri: c.portada_url }} style={s.collaPortada} resizeMode="cover" />
                              : <View style={[s.collaPortada, { backgroundColor: colors.primary[600] }]} />
                            }
                            <View style={s.collaAvatarWrap}>
                              <Avatar name={c.nom} uri={c.avatar_url} size="md" border />
                            </View>
                          </View>
                          <View style={s.collaInfo}>
                            <Text style={s.collaNom} numberOfLines={1}>{c.nom}</Text>
                            {(c.localitat || c.comarca) && (
                              <Text style={s.collaLoc} numberOfLines={1}>
                                📍 {c.localitat ?? c.comarca}
                              </Text>
                            )}
                            {anys && <Text style={s.collaAnys}>{anys} anys</Text>}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* Empty state */}
              {!loading && filteredEvents.length === 0 && filteredColles.length === 0 && (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyIcon}>🔍</Text>
                  <Text style={s.emptyText}>
                    {q ? `Sense resultats per "${search}"` : 'Ara mateix no hi ha activitats públiques'}
                  </Text>
                </View>
              )}

              {/* ── Crear colla ── */}
              <TouchableOpacity style={s.createCard} onPress={() => router.push('/(auth)/register' as any)} activeOpacity={0.85}>
                <Text style={s.createIcon}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.createTitle}>Crea la teua colla</Text>
                  <Text style={s.createSub}>Registra't i funda la teua pròpia colla en minuts</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.primary[600]} />
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom sticky CTA */}
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.registerBtn} onPress={() => router.push('/(auth)/register' as any)}>
            <Text style={s.registerBtnText}>Registra't gratis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/(auth)/login' as any)}>
            <Text style={s.loginBtnText}>Iniciar sessió</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.gray[50] },
  scroll:  { gap: spacing[5], paddingBottom: spacing[4] },

  // Top bar
  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3] },
  logo:      { fontSize: 26, letterSpacing: -0.5 },
  logoLa:    { fontWeight: '400', color: colors.gray[900] },
  logoColla: { fontWeight: '900', color: colors.primary[600] },
  logoIcon:  { fontSize: 20 },
  langBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  langText:  { fontSize: 16 },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.screenH, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderWidth: 1.5, borderColor: colors.gray[200], marginBottom: spacing[2], gap: spacing[2], ...shadows.sm },
  searchIcon:  { marginRight: -4 },
  searchInput: { flex: 1, ...typography.body, color: colors.gray[900], paddingVertical: 2 },

  // Sections
  section:    { gap: spacing[3] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH },
  sectionTitle:{ ...typography.h3, color: colors.gray[900] },
  sectionSub: { ...typography.caption, color: colors.gray[400] },
  hScroll:    { paddingHorizontal: spacing.screenH, gap: spacing[3], paddingBottom: 4 },

  // Event cards (horizontal)
  eventCard:    { width: 200, backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden', ...shadows.sm, borderWidth: 1, borderColor: colors.gray[100] },
  eventColorBar:{ height: 4, width: '100%' },
  eventBody:    { padding: spacing[3], gap: spacing[1] },
  eventDate:    { ...typography.caption, color: colors.gray[400], fontWeight: '600' },
  eventTitle:   { ...typography.body, color: colors.gray[900], fontWeight: '700', lineHeight: 20 },
  eventMeta:    { ...typography.caption, color: colors.gray[500] },
  eventColla:   { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 2 },
  eventCollaNom:{ ...typography.caption, color: colors.gray[500], flex: 1 },
  joinBadge:    { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, marginTop: spacing[1] },
  joinBadgeText:{ fontSize: 11, fontWeight: '700' },

  // Colla grid
  collaGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.screenH, gap: spacing[3] },
  collaCard:    { width: '47%', backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden', ...shadows.sm, borderWidth: 1, borderColor: colors.gray[100] },
  collaHero:    { height: 70, position: 'relative' },
  collaPortada: { width: '100%', height: '100%' },
  collaAvatarWrap: { position: 'absolute', bottom: -18, left: spacing[2] },
  collaInfo:    { paddingHorizontal: spacing[2], paddingTop: 22, paddingBottom: spacing[2], gap: 2 },
  collaNom:     { ...typography.bodySm, color: colors.gray[900], fontWeight: '700' },
  collaLoc:     { ...typography.caption, color: colors.gray[500] },
  collaAnys:    { fontSize: 10, color: colors.gray[400] },

  // Create CTA
  createCard:   { marginHorizontal: spacing.screenH, flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], borderWidth: 1.5, borderColor: colors.primary[200], ...shadows.sm },
  createIcon:   { fontSize: 28 },
  createTitle:  { ...typography.h3, color: colors.gray[900] },
  createSub:    { ...typography.caption, color: colors.gray[500], marginTop: 2 },

  // Empty
  emptyWrap:    { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[3] },
  emptyIcon:    { fontSize: 40 },
  emptyText:    { ...typography.body, color: colors.gray[400], textAlign: 'center', paddingHorizontal: spacing[6] },

  // Bottom bar
  bottomBar:    { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], paddingBottom: spacing[5], borderTopWidth: 1, borderTopColor: colors.gray[100], backgroundColor: colors.white, ...shadows.md },
  registerBtn:  { flex: 1, backgroundColor: colors.primary[600], borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  registerBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  loginBtn:     { flex: 1, borderWidth: 1.5, borderColor: colors.gray[300], borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  loginBtnText: { color: colors.gray[700], fontWeight: '600', fontSize: 15 },
})
