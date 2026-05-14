import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback, useEffect } from 'react'
import { useDataCache } from '@/stores/dataCache'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { isComissioActiva, isMembreActiu } = useCollaStore()
  const dc = useDataCache()
  const [tab, setTab] = useState<Tab>('Actives')
  const [votacions, setVotacions] = useState<any[]>([])
  const [myVots, setMyVots] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = dc.get<{ votacions: any[]; myVots: string[] }>(`votacions_${tab}_${collaId}`)
    if (cached?.votacions?.length) { setVotacions(cached.votacions); setMyVots(new Set(cached.myVots ?? [])); setLoading(false) }
    else { setVotacions([]); setMyVots(new Set()); setLoading(true) }
  }, [collaId, tab])

  useFocusEffect(useCallback(() => {
    if (dc.fresh(`votacions_${tab}_${collaId}`)) return
    loadVotacions()
  }, [collaId, tab]))

  async function loadVotacions() {
    const CK = `votacions_${tab}_${collaId}`
    if (!dc.get(CK)) setLoading(true)
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    let q = supabase.from('votacions').select('*, vots(count)').eq('colla_id', collaId)
    if (tab === 'Actives') q = q.or(`data_limit.is.null,data_limit.gte.${now}`)
    else q = q.not('data_limit', 'is', null).lt('data_limit', now)

    const [votacionsRes, votsRes] = await Promise.all([
      q.order('created_at', { ascending: false }),
      user ? supabase.from('vots').select('votacio_id').eq('user_id', user.id) : null,
    ])

    const list = votacionsRes.data ?? []
    const myVotsList = votsRes?.data?.map((v: any) => v.votacio_id) ?? []
    setVotacions(list)
    setMyVots(new Set(myVotsList))
    dc.put(CK, { votacions: list, myVots: myVotsList })
    setLoading(false)
  }

  async function handleDelete(v: any) {
    Alert.alert(t('common.delete'), t('anuncis.delete.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('votacions').delete().eq('id', v.id)
        if (error) { Alert.alert('Error', error.message); return }
        setVotacions(prev => prev.filter(x => x.id !== v.id))
        dc.bust(`votacions_${tab}_${collaId}`)
      }},
    ])
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
        <Text style={styles.title}>{t('modul.votacions')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabsRow}>
        {TABS.map(tabKey => (
          <TouchableOpacity key={tabKey} style={[styles.tabBtn, tab === tabKey && styles.tabBtnActive]} onPress={() => setTab(tabKey)}>
            <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
              {tabKey === 'Actives' ? t('votacions.tabs.active') : t('votacions.tabs.closed')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : votacions.length === 0 ? (
        <EmptyState icon="🗳️" title={tab === 'Actives' ? t('votacions.tabs.active') : t('votacions.tabs.closed')} subtitle="" />
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
                  {isComissioActiva() && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(v)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={15} color={colors.gray[400]} />
                    </TouchableOpacity>
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

      {isMembreActiu() && (
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
  backText:    { fontSize: 22, color: colors.primary[600], width: 36, lineHeight: 26 },
  title:       { ...typography.h3, color: colors.gray[900] },
  tabsRow:     { flexDirection: 'row', paddingHorizontal: spacing.screenH, paddingVertical: spacing[2], backgroundColor: colors.white, gap: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tabBtn:      { paddingHorizontal: spacing[4], paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  tabBtnActive:{ backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  tabText:     { ...typography.bodySm, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:{ color: colors.primary[600] },
  list:        { padding: spacing.screenH, gap: spacing[3] },
  card:        { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[3], ...shadows.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[2] },
  deleteBtn:   { padding: 5 },
  pregunta:    { ...typography.h3, color: colors.gray[900], flex: 1 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  metaText:    { ...typography.bodySm, color: colors.gray[500] },
  fab:         { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:     { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
