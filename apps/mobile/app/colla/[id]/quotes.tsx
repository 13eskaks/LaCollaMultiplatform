import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

type Tab = 'Pendent' | 'Pagat' | 'Tots'
const TABS: Tab[] = ['Pendent', 'Pagat', 'Tots']

export default function QuotesScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const { isComissioActiva } = useCollaStore()
  const [tab, setTab] = useState<Tab>('Pendent')
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPendent, setTotalPendent] = useState(0)
  const [totalRecaptat, setTotalRecaptat] = useState(0)

  useEffect(() => { loadQuotes() }, [collaId, tab])

  async function loadQuotes() {
    setLoading(true)
    let q = supabase
      .from('quotes')
      .select('*, profiles(nom, cognoms, avatar_url)')
      .eq('colla_id', collaId)
      .order('created_at', { ascending: false })

    if (tab === 'Pendent') q = q.eq('estat', 'pendent')
    else if (tab === 'Pagat') q = q.eq('estat', 'pagat')

    const [quotesRes, statsRes] = await Promise.all([
      q,
      supabase.from('quotes').select('import, estat').eq('colla_id', collaId),
    ])

    setQuotes(quotesRes.data ?? [])

    const stats = statsRes.data ?? []
    setTotalPendent(stats.filter(q => q.estat === 'pendent').reduce((s, q) => s + (q.import ?? 0), 0))
    setTotalRecaptat(stats.filter(q => q.estat === 'pagat').reduce((s, q) => s + (q.import ?? 0), 0))
    setLoading(false)
  }

  async function handleMarcarPagat(quota: any) {
    if (!isComissioActiva()) return
    Alert.alert('Marcar com a pagat', `Confirmes el pagament de ${quota.profiles?.nom}?`, [
      { text: 'Cancel·lar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          await supabase.from('quotes').update({ estat: 'pagat', data_pagament: new Date().toISOString() }).eq('id', quota.id)
          loadQuotes()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Quotes" />

      {/* Resum */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalRecaptat.toFixed(2)} €</Text>
          <Text style={styles.statLabel}>Recaptat</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.danger[500] }]}>{totalPendent.toFixed(2)} €</Text>
          <Text style={styles.statLabel}>Pendent</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : quotes.length === 0 ? (
        <EmptyState icon="📋" title={`Cap quota ${tab.toLowerCase()}`} subtitle="" />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {quotes.map(quota => (
            <View key={quota.id} style={styles.card}>
              <Avatar
                name={`${quota.profiles?.nom ?? ''} ${quota.profiles?.cognoms ?? ''}`}
                uri={quota.profiles?.avatar_url}
                size="md"
              />
              <View style={styles.info}>
                <Text style={styles.nom}>{quota.profiles?.nom} {quota.profiles?.cognoms}</Text>
                <Text style={styles.concepte}>{quota.concepte ?? 'Quota anual'}</Text>
                {quota.data_limit && (
                  <Text style={styles.dataLimit}>Venciment: {new Date(quota.data_limit).toLocaleDateString('ca-ES')}</Text>
                )}
              </View>
              <View style={styles.right}>
                <Text style={styles.import}>{quota.import?.toFixed(2) ?? '—'} €</Text>
                {quota.estat === 'pagat' ? (
                  <Badge label="Pagat" variant="success" size="sm" />
                ) : (
                  isComissioActiva()
                    ? (
                      <TouchableOpacity style={styles.pagarBtn} onPress={() => handleMarcarPagat(quota)}>
                        <Text style={styles.pagarText}>Confirmar</Text>
                      </TouchableOpacity>
                    )
                    : <Badge label="Pendent" variant="warning" size="sm" />
                )}
              </View>
            </View>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  statsRow:     { flexDirection: 'row', backgroundColor: colors.white, paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  statItem:     { flex: 1, alignItems: 'center', gap: 2 },
  statNum:      { ...typography.h2, color: colors.gray[900] },
  statLabel:    { ...typography.caption, color: colors.gray[500] },
  statDivider:  { width: 1, backgroundColor: colors.gray[200] },
  tabsRow:      { flexDirection: 'row', paddingHorizontal: spacing.screenH, paddingVertical: spacing[2], backgroundColor: colors.white, gap: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tabBtn:       { paddingHorizontal: spacing[4], paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  tabBtnActive: { backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  tabText:      { ...typography.bodySm, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:{ color: colors.primary[600] },
  list:         { padding: spacing.screenH, gap: spacing[3] },
  card:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm },
  info:         { flex: 1, gap: 2 },
  nom:          { ...typography.body, color: colors.gray[900], fontWeight: '600' },
  concepte:     { ...typography.bodySm, color: colors.gray[500] },
  dataLimit:    { ...typography.caption, color: colors.gray[400] },
  right:        { alignItems: 'flex-end', gap: spacing[1] },
  import:       { ...typography.h3, color: colors.gray[900] },
  pagarBtn:     { backgroundColor: colors.primary[600], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 4 },
  pagarText:    { ...typography.caption, color: colors.white, fontWeight: '600' },
})
