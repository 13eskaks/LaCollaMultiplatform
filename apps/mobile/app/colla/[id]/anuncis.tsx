import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
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

export default function AnuncisScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [anuncis, setAnuncis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadAnuncis() }, [collaId])

  async function loadAnuncis() {
    setLoading(true)
    const { data } = await supabase
      .from('anuncis')
      .select('*, profiles(nom, rol_colla:colla_membres(rol))')
      .eq('colla_id', collaId)
      .order('fixat', { ascending: false })
      .order('created_at', { ascending: false })
    setAnuncis(data ?? [])
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Anuncis</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={styles.loader} />
      ) : anuncis.length === 0 ? (
        <EmptyState icon="📢" title="Cap anunci" subtitle="Encara no hi ha anuncis publicats" />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {anuncis.map(a => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.autor}>{a.profiles?.nom ?? 'Anònim'}</Text>
                {a.fixat && <Badge label="📌 Fixat" variant="primary" size="sm" />}
                <Text style={styles.time}>{tempsRelatiu(a.created_at)}</Text>
              </View>
              {a.titol && <Text style={styles.titol}>{a.titol}</Text>}
              <Text
                style={styles.cos}
                numberOfLines={expandedId === a.id ? undefined : 4}
              >
                {a.cos}
              </Text>
              {a.cos.length > 200 && (
                <TouchableOpacity onPress={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                  <Text style={styles.llegirMes}>
                    {expandedId === a.id ? 'Llegir menys' : 'Llegir més'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
  backText:   { fontSize: 22, color: colors.primary[600], width: 36 },
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
  fab:        { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:    { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
