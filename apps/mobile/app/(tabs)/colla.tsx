import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { useScreenCache } from '@/stores/screenCache'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'

const MODULS = [
  { key: 'anuncis',    icon: '📢', label: 'Anuncis',    route: (id: string) => `/colla/${id}/anuncis` },
  { key: 'votacions',  icon: '🗳️', label: 'Votacions',  route: (id: string) => `/colla/${id}/votacions` },
  { key: 'torns',      icon: '🧹', label: 'Torns',      route: (id: string) => `/colla/${id}/torns` },
  { key: 'llocs',      icon: '📍', label: 'Llocs',      route: (id: string) => `/colla/${id}/llocs` },
  { key: 'membres',    icon: '👥', label: 'Membres',    route: (id: string) => `/colla/${id}/membres` },
  { key: 'caixa',      icon: '💶', label: 'Caixa',      route: (id: string) => `/colla/${id}/caixa` },
  { key: 'tricount',   icon: '🧾', label: 'Tricount',   route: (id: string) => `/colla/${id}/tricount` },
  { key: 'quotes',     icon: '📋', label: 'Quotes',     route: (id: string) => `/colla/${id}/quotes` },
  { key: 'fotos',      icon: '📸', label: 'Fotos',      route: (id: string) => `/colla/${id}/fotos` },
  { key: 'actes',      icon: '🏛', label: 'Actes',      route: (id: string) => `/colla/${id}/actes` },
  { key: 'pressupost', icon: '🏷️', label: 'Pressupost', route: (id: string) => `/colla/${id}/pressupost` },
  { key: 'connexions', icon: '🔗', label: 'Connexions', route: (id: string) => `/colla/${id}/connexions` },
]

export default function CollaScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { collaActiva, isComissioActiva, loadColles } = useCollaStore()
  const screenCache = useScreenCache()
  const [stats, setStats] = useState({ membres: 0, events: 0 })
  const [pendentsCount, setPendentsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modulsActius, setModulsActius] = useState<string[]>(MODULS.map(m => m.key))
  const [modulsComissio, setModulsComissio] = useState<string[]>([])

  useFocusEffect(useCallback(() => {
    loadColles()
    if (!collaActiva) return
    const cacheKey = `colla_${collaActiva.id}`
    if (!screenCache.isStale(cacheKey) && !loading) return
    loadData()
  }, [collaActiva?.id]))

  async function loadData() {
    if (!collaActiva) return
    const cacheKey = `colla_${collaActiva.id}`
    screenCache.touch(cacheKey)
    if (stats.membres === 0) setLoading(true)

    const queries: PromiseLike<any>[] = [
      supabase.from('colla_membres').select('id', { count: 'exact', head: true }).eq('colla_id', collaActiva.id).eq('estat', 'actiu'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('colla_id', collaActiva.id),
      supabase.from('colla_config').select('moduls_actius, moduls_comissio').eq('colla_id', collaActiva.id).single(),
    ]
    if (isComissioActiva()) {
      queries.push(supabase.from('colla_membres').select('id', { count: 'exact', head: true }).eq('colla_id', collaActiva.id).eq('estat', 'pendent'))
    }
    const [membresRes, eventsRes, configRes, pendentsRes] = await Promise.all(queries)

    setStats({ membres: membresRes.count ?? 0, events: eventsRes.count ?? 0 })
    if (configRes.data?.moduls_actius) setModulsActius(configRes.data.moduls_actius)
    setModulsComissio(configRes.data?.moduls_comissio ?? [])
    if (pendentsRes) setPendentsCount(pendentsRes.count ?? 0)
    setLoading(false)
  }

  if (!collaActiva) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState icon="🌩" title={t('colla.tab.noGroup')} subtitle={t('colla.tab.noGroup.sub')} />
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
                  {pendentsCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pendentsCount > 9 ? '9+' : pendentsCount}</Text>
                    </View>
                  )}
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
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            {loading && stats.membres === 0
              ? <ActivityIndicator size="small" color={colors.primary[600]} />
              : <Text style={styles.statNum}>{stats.membres}</Text>
            }
            <Text style={styles.statLabel}>{t('colla.tab.members')}</Text>
          </View>
          <View style={styles.statDivider} />
          {!!anysFundacio && (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{anysFundacio}</Text>
                <Text style={styles.statLabel}>{t('colla.tab.years')}</Text>
              </View>
              <View style={styles.statDivider} />
            </>
          )}
          <View style={styles.statItem}>
            {loading && stats.events === 0
              ? <ActivityIndicator size="small" color={colors.primary[600]} />
              : <Text style={styles.statNum}>{stats.events}</Text>
            }
            <Text style={styles.statLabel}>{t('colla.tab.events')}</Text>
          </View>
        </View>

        {/* Mòduls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('colla.tab.modules')}</Text>
          <View style={styles.grid}>
            {MODULS.filter(m => {
              if (!modulsActius.includes(m.key)) return false
              if (modulsComissio.includes(m.key) && !isComissioActiva()) return false
              return true
            }).map(modul => (
              <TouchableOpacity
                key={modul.key}
                style={styles.modulCard}
                onPress={() => router.push(modul.route(collaActiva.id) as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.modulIcon}>{modul.icon}</Text>
                <Text style={styles.modulLabel}>{t(`modul.${modul.key}`)}</Text>
                {modulsComissio.includes(modul.key) && (
                  <Text style={styles.modulComissioTag}>{t('colla.tab.commission')}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
  badge:              { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger[500], justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText:          { color: colors.white, fontSize: 9, fontWeight: '800' },
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
  modulComissioTag:   { fontSize: 9, fontWeight: '700', color: colors.primary[600], backgroundColor: colors.primary[50], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  modulLabelDisabled: { color: colors.gray[400] },
  comingSoon:         { ...typography.caption, color: colors.gray[400], fontSize: 10 },

})
