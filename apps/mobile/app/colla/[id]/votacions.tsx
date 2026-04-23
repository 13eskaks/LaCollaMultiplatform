import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

const TABS = ['Actives', 'Tancades'] as const
type Tab = typeof TABS[number]

export default function VotacionsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [tab, setTab] = useState<Tab>('Actives')
  const [votacions, setVotacions] = useState<any[]>([])
  const [myVots, setMyVots] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadVotacions() }, [collaId, tab])

  async function loadVotacions() {
    setLoading(true)
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    let q = supabase.from('votacions').select('*, vots(count)').eq('colla_id', collaId)
    if (tab === 'Actives') q = q.or(`data_limit.is.null,data_limit.gte.${now}`)
    else q = q.not('data_limit', 'is', null).lt('data_limit', now)

    const [votacionsRes, votsRes] = await Promise.all([
      q.order('created_at', { ascending: false }),
      user ? supabase.from('vots').select('votacio_id').eq('user_id', user.id) : null,
    ])

    setVotacions(votacionsRes.data ?? [])
    if (votsRes?.data) setMyVots(new Set(votsRes.data.map((v: any) => v.votacio_id)))
    setLoading(false)
  }

  const diesRestants = (dataLimit: string | null) => {
    if (!dataLimit) return null
    const diff = new Date(dataLimit).getTime() - Date.now()
    const d = Math.ceil(diff / 86400000)
    return d > 0 ? `${d} dies restants` : 'Tancada'
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Votacions</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabsRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : votacions.length === 0 ? (
        <EmptyState icon="🗳️" title={`Cap votació ${tab.toLowerCase()}`} subtitle="Crea la primera votació de la colla" />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {votacions.map(v => {
            const haVotat = myVots.has(v.id)
            const numVots = v.vots?.[0]?.count ?? 0
            const restants = diesRestants(v.data_limit)
            return (
              <TouchableOpacity key={v.id} style={styles.card} onPress={() => router.push(`/colla/${collaId}/votacions/${v.id}` as any)}>
                <View style={styles.cardTop}>
                  <Text style={styles.pregunta} numberOfLines={2}>{v.pregunta}</Text>
                  {!haVotat && tab === 'Actives' && (
                    <Badge label="Pendent" variant="warning" size="sm" />
                  )}
                </View>

                <View style={styles.cardMeta}>
                  <Badge
                    label={v.tipus === 'si_no' ? 'Sí/No' : v.tipus === 'opcions' ? 'Opcions' : 'Puntuació'}
                    variant="default"
                    size="sm"
                  />
                  <Text style={styles.metaText}>
                    {numVots} {numVots === 1 ? 'vot' : 'vots'}
                    {restants ? ` · ${restants}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {isComissioActiva() && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push(`/colla/${collaId}/votacions/create` as any)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:    { fontSize: 22, color: colors.primary[600], width: 36 },
  title:       { ...typography.h3, color: colors.gray[900] },
  tabsRow:     { flexDirection: 'row', paddingHorizontal: spacing.screenH, paddingVertical: spacing[2], backgroundColor: colors.white, gap: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tabBtn:      { paddingHorizontal: spacing[4], paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  tabBtnActive:{ backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  tabText:     { ...typography.bodySm, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:{ color: colors.primary[600] },
  list:        { padding: spacing.screenH, gap: spacing[3] },
  card:        { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[3], ...shadows.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[2] },
  pregunta:    { ...typography.h3, color: colors.gray[900], flex: 1 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  metaText:    { ...typography.bodySm, color: colors.gray[500] },
  fab:         { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:     { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
