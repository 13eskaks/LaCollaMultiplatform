import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { RichBodyView } from '@/components/ui/RichBody'
import type { SavedBlock } from '@/components/ui/RichBody'
import { Badge } from '@/components/ui/Badge'
import { colors, typography, spacing } from '@/theme'

function tempsRelatiu(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `fa ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `fa ${h}h`
  return `fa ${Math.floor(h / 24)} dies`
}

export default function AnunciDetailScreen() {
  const { id: collaId, aid } = useLocalSearchParams<{ id: string; aid: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [anunci, setAnunci] = useState<any>(null)
  const [allIds, setAllIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { load() }, [aid])

  async function load() {
    setLoading(true)
    const [anunciRes, idsRes, authRes] = await Promise.all([
      supabase.from('anuncis').select('*, profiles(nom)').eq('id', aid).single(),
      supabase.from('anuncis').select('id')
        .eq('colla_id', collaId)
        .order('fixat', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.auth.getUser(),
    ])
    setAnunci(anunciRes.data)
    setAllIds((idsRes.data ?? []).map((x: any) => x.id))
    setUserId(authRes.data.user?.id ?? null)
    setLoading(false)
  }

  async function handleDelete() {
    Alert.alert('Eliminar anunci', 'Estàs segur/a?', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('anuncis').delete().eq('id', aid)
        router.back()
      }},
    ])
  }

  const idx = allIds.indexOf(aid)
  const prevId = idx > 0 ? allIds[idx - 1] : null
  const nextId = idx < allIds.length - 1 ? allIds[idx + 1] : null
  const canManage = isComissioActiva() || anunci?.autor_id === userId

  function goTo(targetId: string) {
    router.replace(`/colla/${collaId}/anuncis/${targetId}` as any)
  }

  if (loading) return (
    <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[600]} /></View>
  )

  if (!anunci) return (
    <View style={styles.loader}><Text style={styles.notFound}>Anunci no trobat</Text></View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anunci</Text>
        <View style={styles.headerActions}>
          {canManage && (
            <>
              <TouchableOpacity onPress={() => router.push(`/colla/${collaId}/anuncis/create?anunciId=${aid}` as any)}>
                <Text style={styles.actionBtn}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Text style={styles.actionBtn}>🗑</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Body */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.meta}>
          <Text style={styles.autor}>{anunci.profiles?.nom ?? 'Anònim'}</Text>
          {anunci.fixat && <Badge label="📌 Fixat" variant="primary" size="sm" />}
          <Text style={styles.time}>{tempsRelatiu(anunci.created_at)}</Text>
        </View>

        {anunci.titol ? <Text style={styles.titol}>{anunci.titol}</Text> : null}

        {anunci.cos_blocks
          ? <RichBodyView blocks={anunci.cos_blocks as SavedBlock[]} />
          : <Text style={styles.cos}>{anunci.cos}</Text>
        }

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* Prev / Next bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navBtn, !prevId && styles.navBtnDisabled]}
          onPress={() => prevId && goTo(prevId)}
          disabled={!prevId}
        >
          <Text style={[styles.navText, !prevId && styles.navTextDisabled]}>← Anterior</Text>
        </TouchableOpacity>

        <Text style={styles.navCount}>{idx + 1} / {allIds.length}</Text>

        <TouchableOpacity
          style={[styles.navBtn, !nextId && styles.navBtnDisabled]}
          onPress={() => nextId && goTo(nextId)}
          disabled={!nextId}
        >
          <Text style={[styles.navText, !nextId && styles.navTextDisabled]}>Següent →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.white },
  loader:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound:          { ...typography.body, color: colors.gray[500] },

  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backBtn:           { width: 36 },
  backText:          { fontSize: 22, color: colors.primary[600] },
  headerTitle:       { ...typography.h3, color: colors.gray[900] },
  headerActions:     { flexDirection: 'row', gap: spacing[2], width: 60, justifyContent: 'flex-end' },
  actionBtn:         { fontSize: 18 },

  body:              { padding: spacing.screenH, gap: spacing[3] },
  meta:              { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  autor:             { ...typography.label, color: colors.gray[700], fontWeight: '700', flex: 1 },
  time:              { ...typography.caption, color: colors.gray[400] },
  titol:             { ...typography.h2, color: colors.gray[900] },
  cos:               { ...typography.bodyLg, color: colors.gray[600], lineHeight: 24 },

  navBar:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: colors.gray[100], backgroundColor: colors.white },
  navBtn:            { paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  navBtnDisabled:    { opacity: 0.3 },
  navText:           { ...typography.body, color: colors.primary[600], fontWeight: '600' },
  navTextDisabled:   { color: colors.gray[400] },
  navCount:          { ...typography.caption, color: colors.gray[400] },
})
