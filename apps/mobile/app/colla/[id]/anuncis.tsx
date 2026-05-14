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
import type { SavedBlock } from '@/components/ui/RichBody'

function tempsRelatiu(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `fa ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `fa ${h}h`
  return `fa ${Math.floor(h / 24)} dies`
}

export default function AnuncisScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const { isComissioActiva } = useCollaStore()
  const dc = useDataCache()
  const [anuncis, setAnuncis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Hydrate from persistent cache immediately on mount
  useEffect(() => {
    const cached = dc.get<{ anuncis: any[]; userId: string | null }>(`anuncis_${collaId}`)
    if (cached?.anuncis?.length) { setAnuncis(cached.anuncis); setUserId(cached.userId ?? null); setLoading(false) }
  }, [collaId])

  useFocusEffect(useCallback(() => {
    if (dc.fresh(`anuncis_${collaId}`)) return
    loadAnuncis()
  }, [collaId]))

  async function loadAnuncis() {
    const CK = `anuncis_${collaId}`
    if (!dc.get(CK)) setLoading(true)
    const [{ data }, { data: { user } }] = await Promise.all([
      supabase.from('anuncis')
        .select('*, profiles(nom)')
        .eq('colla_id', collaId)
        .order('fixat', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.auth.getUser(),
    ])
    const list = data ?? []
    setAnuncis(list)
    setUserId(user?.id ?? null)
    dc.put(CK, { anuncis: list, userId: user?.id ?? null })
    setLoading(false)
  }

  async function handleDelete(a: any) {
    Alert.alert(t('anuncis.delete.title'), t('anuncis.delete.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await supabase.from('anuncis').delete().eq('id', a.id)
        setAnuncis(prev => prev.filter(x => x.id !== a.id))
        dc.bust(`anuncis_${collaId}`)
      }},
    ])
  }

  function canManage(a: any) {
    return isComissioActiva() || a.autor_id === userId
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('anuncis.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={styles.loader} />
      ) : anuncis.length === 0 ? (
        <EmptyState icon="📢" title={t('anuncis.empty.title')} subtitle={t('anuncis.empty.sub')} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {anuncis.map(a => (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              onPress={() => router.push(`/colla/${collaId}/anuncis/${a.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.autor}>{a.profiles?.nom ?? t('anuncis.anon')}</Text>
                {a.fixat && <Badge label={t('anuncis.pinned')} variant="primary" size="sm" />}
                <Text style={styles.time}>{tempsRelatiu(a.created_at)}</Text>
                {canManage(a) && (
                  <TouchableOpacity style={styles.iconBtn} onPress={e => { e.stopPropagation?.(); router.push(`/colla/${collaId}/anuncis/create?anunciId=${a.id}` as any) }}>
                    <Ionicons name="pencil-outline" size={15} color={colors.gray[400]} />
                  </TouchableOpacity>
                )}
                {canManage(a) && (
                  <TouchableOpacity style={styles.iconBtn} onPress={e => { e.stopPropagation?.(); handleDelete(a) }}>
                    <Ionicons name="trash-outline" size={15} color={colors.gray[400]} />
                  </TouchableOpacity>
                )}
              </View>
              {a.titol ? <Text style={styles.titol}>{a.titol}</Text> : null}
              {a.cos_blocks
                ? <Text style={styles.cos} numberOfLines={3}>
                    {(a.cos_blocks as SavedBlock[]).filter(b => b.type === 'text').map(b => (b as any).content).join(' ')}
                  </Text>
                : <Text style={styles.cos} numberOfLines={3}>{a.cos}</Text>
              }
              <Text style={styles.llegirMes}>{t('anuncis.readMore')}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {isComissioActiva() && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/colla/${collaId}/anuncis/create` as any)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.gray[50] },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:   { fontSize: 22, color: colors.primary[600], width: 36, lineHeight: 26 },
  title:      { ...typography.h3, color: colors.gray[900] },
  loader:     { flex: 1 },
  list:       { padding: spacing.screenH, gap: spacing[3] },
  card:       { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[2], ...shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  autor:      { ...typography.label, color: colors.gray[700], fontWeight: '700' },
  time:       { ...typography.caption, color: colors.gray[400], marginLeft: 'auto' },
  titol:      { ...typography.h3, color: colors.gray[900] },
  cos:        { ...typography.body, color: colors.gray[600], lineHeight: 21 },
  llegirMes:  { ...typography.bodySm, color: colors.primary[600], fontWeight: '600', marginTop: spacing[1] },
  iconBtn:    { padding: 5 },
  fab:        { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:    { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
