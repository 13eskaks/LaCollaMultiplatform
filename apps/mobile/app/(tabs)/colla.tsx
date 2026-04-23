import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

function tempsRelatiu(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `fa ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `fa ${h}h`
  return `fa ${Math.floor(h / 24)} dies`
}

const MODULS = [
  { icon: '📢', label: 'Anuncis', sublabel: null, route: (id: string) => `/colla/${id}/anuncis`, available: true },
  { icon: '🗳️', label: 'Votacions', sublabel: null, route: (id: string) => `/colla/${id}/votacions`, available: true },
  { icon: '🧹', label: 'Torns', sublabel: null, route: (id: string) => `/colla/${id}/torns`, available: true },
  { icon: '👥', label: 'Membres', sublabel: null, route: (id: string) => `/colla/${id}/membres`, available: true },
  { icon: '💶', label: 'Caixa', sublabel: null, route: (id: string) => `/colla/${id}/caixa`, available: true },
  { icon: '📋', label: 'Quotes', sublabel: null, route: (id: string) => `/colla/${id}/quotes`, available: true },
  { icon: '📸', label: 'Fotos', sublabel: null, route: (id: string) => `/colla/${id}/fotos`, available: true },
  { icon: '🏛', label: 'Actes', sublabel: null, route: (id: string) => `/colla/${id}/actes`, available: true },
  { icon: '🏷️', label: 'Pressupost', sublabel: null, route: (id: string) => `/colla/${id}/pressupost`, available: true },
  { icon: '🔗', label: 'Connexions', sublabel: null, route: (id: string) => `/colla/${id}/connexions`, available: true },
]

export default function CollaScreen() {
  const router = useRouter()
  const { collaActiva, isComissioActiva } = useCollaStore()
  const [stats, setStats] = useState({ membres: 0, events: 0 })
  const [anuncis, setAnuncis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (collaActiva) loadData()
  }, [collaActiva])

  async function loadData() {
    if (!collaActiva) return
    setLoading(true)

    const [membresRes, eventsRes, anuncisRes] = await Promise.all([
      supabase.from('colla_membres').select('id', { count: 'exact', head: true }).eq('colla_id', collaActiva.id).eq('estat', 'actiu'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('colla_id', collaActiva.id),
      supabase.from('anuncis').select('*, profiles(nom)').eq('colla_id', collaActiva.id)
        .order('fixat', { ascending: false }).order('created_at', { ascending: false }).limit(3),
    ])

    setStats({ membres: membresRes.count ?? 0, events: eventsRes.count ?? 0 })
    setAnuncis(anuncisRes.data ?? [])
    setLoading(false)
  }

  if (!collaActiva) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState icon="🌩" title="No pertanys a cap colla" subtitle="Crea o uneix-te a una colla per continuar" />
      </SafeAreaView>
    )
  }

  const anysFundacio = collaActiva.any_fundacio
    ? new Date().getFullYear() - collaActiva.any_fundacio
    : null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header colla */}
        <View style={styles.heroContainer}>
          {collaActiva.portada_url ? (
            <Image source={{ uri: collaActiva.portada_url }} style={styles.portada} />
          ) : (
            <View style={[styles.portada, styles.portadaPlaceholder]} />
          )}
          <View style={styles.heroOverlay} />

          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={{ width: 36 }} />
              {isComissioActiva() && (
                <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push(`/colla/${collaActiva.id}/settings` as any)}>
                  <Text style={{ fontSize: 18 }}>⚙️</Text>
                </TouchableOpacity>
              )}
            </View>

            <Avatar
              name={collaActiva.nom}
              uri={collaActiva.avatar_url}
              size="2xl"
              border
              style={styles.collaAvatar}
            />
            <Text style={styles.collaNom}>{collaActiva.nom}</Text>
            {collaActiva.localitat && (
              <Text style={styles.collaLocalitat}>📍 {collaActiva.localitat}</Text>
            )}
          </View>
        </View>

        {/* Stats */}
        {!loading && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.membres}</Text>
              <Text style={styles.statLabel}>Membres</Text>
            </View>
            <View style={styles.statDivider} />
            {anysFundacio && (
              <>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{anysFundacio}</Text>
                  <Text style={styles.statLabel}>Anys</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            )}
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.events}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
        )}

        {/* Mòduls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mòduls</Text>
          <View style={styles.grid}>
            {MODULS.map(modul => (
              <TouchableOpacity
                key={modul.label}
                style={[styles.modulCard, !modul.available && styles.modulCardDisabled]}
                onPress={() => modul.available && router.push(modul.route(collaActiva.id) as any)}
                activeOpacity={modul.available ? 0.7 : 1}
              >
                <Text style={styles.modulIcon}>{modul.icon}</Text>
                <Text style={[styles.modulLabel, !modul.available && styles.modulLabelDisabled]}>
                  {modul.label}
                </Text>
                {!modul.available && <Text style={styles.comingSoon}>Pròximament</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Anuncis recents */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Anuncis recents</Text>
            <TouchableOpacity onPress={() => router.push(`/colla/${collaActiva.id}/anuncis` as any)}>
              <Text style={styles.seeAll}>Veure tots</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : anuncis.length === 0 ? (
            <Text style={styles.emptyText}>Cap anunci de moment</Text>
          ) : (
            <View style={styles.anuncisCard}>
              {anuncis.map((a, idx) => (
                <View key={a.id}>
                  <TouchableOpacity style={styles.anunciRow} onPress={() => router.push(`/colla/${collaActiva.id}/anuncis` as any)}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.anunciHeader}>
                        <Text style={styles.anunciAutor}>{a.profiles?.nom ?? 'Anònim'}</Text>
                        {a.fixat && <Badge label="📌 Fixat" variant="primary" size="sm" />}
                        <Text style={styles.anunciTime}>{tempsRelatiu(a.created_at)}</Text>
                      </View>
                      <Text style={styles.anunciText} numberOfLines={3}>{a.cos}</Text>
                    </View>
                  </TouchableOpacity>
                  {idx < anuncis.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          )}

          {isComissioActiva() && (
            <TouchableOpacity style={styles.fab} onPress={() => router.push(`/colla/${collaActiva.id}/anuncis/create` as any)}>
              <Text style={styles.fabText}>+ Nou anunci</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.gray[50] },
  heroContainer:      { height: 240, position: 'relative', marginBottom: spacing[4] },
  portada:            { width: '100%', height: '100%' },
  portadaPlaceholder: { backgroundColor: colors.primary[600] },
  heroOverlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  heroContent:        { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spacing[4] },
  heroTop:            { position: 'absolute', top: spacing[2], left: spacing.screenH, right: spacing.screenH, flexDirection: 'row', justifyContent: 'space-between' },
  settingsBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  collaAvatar:        { marginBottom: spacing[2] },
  collaNom:           { ...typography.h1, color: colors.white, textAlign: 'center' },
  collaLocalitat:     { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  statsRow:           { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: spacing.screenH, marginBottom: spacing[4], backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, paddingVertical: spacing[3] },
  statItem:           { flex: 1, alignItems: 'center', gap: 2 },
  statNum:            { ...typography.h2, color: colors.gray[900] },
  statLabel:          { ...typography.caption, color: colors.gray[500] },
  statDivider:        { width: 1, height: 32, backgroundColor: colors.gray[200] },

  section:            { marginHorizontal: spacing.screenH, marginBottom: spacing[5] },
  sectionRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle:       { ...typography.h3, color: colors.gray[900], marginBottom: spacing[3] },
  seeAll:             { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },

  grid:               { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  modulCard:          { backgroundColor: colors.white, borderRadius: radius.md, width: '47%', paddingVertical: spacing[4], paddingHorizontal: spacing[3], alignItems: 'center', gap: spacing[2], ...shadows.sm },
  modulCardDisabled:  { opacity: 0.5 },
  modulIcon:          { fontSize: 30 },
  modulLabel:         { ...typography.bodySm, color: colors.gray[800], fontWeight: '600', textAlign: 'center' },
  modulLabelDisabled: { color: colors.gray[400] },
  comingSoon:         { ...typography.caption, color: colors.gray[400], fontSize: 10 },

  anuncisCard:        { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  anunciRow:          { padding: spacing[4] },
  anunciHeader:       { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  anunciAutor:        { ...typography.label, color: colors.gray[700] },
  anunciTime:         { ...typography.caption, color: colors.gray[400], marginLeft: 'auto' },
  anunciText:         { ...typography.body, color: colors.gray[600], lineHeight: 20 },
  divider:            { height: 1, backgroundColor: colors.gray[100] },
  emptyText:          { ...typography.body, color: colors.gray[400], textAlign: 'center', paddingVertical: spacing[4] },

  fab:                { marginTop: spacing[3], backgroundColor: colors.primary[600], borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  fabText:            { ...typography.body, color: colors.white, fontWeight: '600' },
})
