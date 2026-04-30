import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useState, useCallback, useRef } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'

const TABS = ['La colla', 'Global'] as const
type Tab = typeof TABS[number]

function tempsRelatiu(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `fa ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `fa ${h}h`
  return `fa ${Math.floor(h / 24)} dies`
}

export default function ForumScreen() {
  const router = useRouter()
  const { collaActiva, isComissioActiva } = useCollaStore()
  const { profile } = useAuthStore()
  const [tab, setTab] = useState<Tab>('La colla')
  const [fils, setFils] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<any>(null)

  useFocusEffect(useCallback(() => {
    loadFils()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [tab, collaActiva?.id]))

  async function loadFils() {
    setLoading(true)
    let q = supabase.from('forum_fils').select('*, profiles(nom, avatar_url), forum_missatges(count)')
      .order('fixat', { ascending: false }).order('updated_at', { ascending: false }).limit(30)

    if (tab === 'La colla' && collaActiva) {
      q = q.eq('colla_id', collaActiva.id)
    } else if (tab === 'Global') {
      q = q.is('colla_id', null)
    }

    const { data } = await q
    setFils(data ?? [])
    setLoading(false)

    // Realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    if (collaActiva && tab === 'La colla') {
      channelRef.current = supabase.channel(`forum-${collaActiva.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_fils', filter: `colla_id=eq.${collaActiva.id}` }, () => loadFils())
        .subscribe()
    }
  }

  async function handleDelete(fil: any) {
    Alert.alert('Eliminar fil', 'S\'eliminaran tots els missatges del fil. Estàs segur/a?', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('forum_fils').delete().eq('id', fil.id)
        setFils(prev => prev.filter(f => f.id !== fil.id))
      }},
    ])
  }

  function canDelete(fil: any) {
    return isComissioActiva() || fil.autor_id === profile?.id
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadFils()
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fòrum</Text>
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
      ) : fils.length === 0 ? (
        <EmptyState icon="💬" title="Cap fil al fòrum" subtitle="Crea el primer fil de discussió" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
          showsVerticalScrollIndicator={false}
        >
          {fils.map(fil => (
            <TouchableOpacity
              key={fil.id}
              style={styles.card}
              onPress={() => router.push(`/forum/${fil.id}` as any)}
            >
              <View style={styles.cardLeft}>
                {fil.fixat ? (
                  <View style={styles.fixatIcon}>
                    <Text style={{ fontSize: 18 }}>📢</Text>
                  </View>
                ) : (
                  <Avatar name={fil.profiles?.nom ?? ''} uri={fil.profiles?.avatar_url} size="md" />
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.filTitle} numberOfLines={2}>{fil.titol}</Text>
                <Text style={styles.filMeta}>
                  {fil.fixat ? '📌 Fixat · ' : ''}{fil.profiles?.nom ?? 'Anònim'} · {tempsRelatiu(fil.updated_at)}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.respostes}>{fil.forum_missatges?.[0]?.count ?? 0}</Text>
                <Text style={styles.respostesLabel}>💬</Text>
                {canDelete(fil) && (
                  <TouchableOpacity onPress={() => handleDelete(fil)} hitSlop={8}>
                    <Text style={styles.deleteBtn}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push({ pathname: '/forum/create', params: { global: tab === 'Global' ? '1' : '0' } } as any)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  header:      { paddingHorizontal: spacing.screenH, paddingTop: spacing[4], paddingBottom: spacing[2] },
  title:       { ...typography.display, color: colors.gray[900] },
  tabsRow:     { flexDirection: 'row', paddingHorizontal: spacing.screenH, paddingBottom: spacing[3], gap: spacing[2] },
  tabBtn:      { paddingHorizontal: spacing[4], paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  tabBtnActive:{ backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  tabText:     { ...typography.bodySm, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:{ color: colors.primary[600] },
  list:        { paddingHorizontal: spacing.screenH, gap: spacing[2] },
  card:        { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], ...shadows.sm },
  cardLeft:    { marginTop: 2 },
  fixatIcon:   { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[50], justifyContent: 'center', alignItems: 'center' },
  filTitle:    { ...typography.h3, color: colors.gray[900] },
  filMeta:     { ...typography.caption, color: colors.gray[400] },
  cardRight:   { alignItems: 'center', minWidth: 32 },
  respostes:   { ...typography.bodySm, color: colors.gray[600], fontWeight: '700' },
  respostesLabel:{ fontSize: 12 },
  deleteBtn:   { fontSize: 13, marginTop: spacing[1] },
  fab:         { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:     { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
