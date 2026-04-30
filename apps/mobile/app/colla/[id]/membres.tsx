import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { isComissio } from '@lacolla/shared'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

const ROL_CONFIG: Record<string, { label: string; variant: any }> = {
  president:  { label: 'President', variant: 'premium' },
  secretari:  { label: 'Secretari', variant: 'primary' },
  tresorer:   { label: 'Tresorer', variant: 'success' },
  junta:      { label: 'Junta', variant: 'default' },
  membre:     { label: 'Membre', variant: 'default' },
}

const TABS = ['Tots', 'Junta', 'Nous'] as const
type Tab = typeof TABS[number]

export default function MembresScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [membres, setMembres] = useState<any[]>([])
  const [pendents, setPendents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Tots')
  const [query, setQuery] = useState('')
  const [rolModal, setRolModal] = useState<{ id: string; nom: string } | null>(null)

  useFocusEffect(useCallback(() => { loadMembres() }, [collaId]))

  async function loadMembres() {
    setLoading(true)
    const [membresRes, pendentsRes] = await Promise.all([
      supabase.from('colla_membres').select('*, profiles(nom, cognoms, avatar_url)').eq('colla_id', collaId).eq('estat', 'actiu').order('data_ingres', { ascending: false }),
      isComissioActiva()
        ? supabase.from('colla_membres').select('*, profiles(nom, cognoms, avatar_url)').eq('colla_id', collaId).eq('estat', 'pendent')
        : null,
    ])
    setMembres(membresRes.data ?? [])
    setPendents(pendentsRes?.data ?? [])
    setLoading(false)
  }

  async function aprovar(membreId: string) {
    await supabase.from('colla_membres').update({ estat: 'actiu', data_ingres: new Date().toISOString() }).eq('id', membreId)
    loadMembres()
  }

  async function rebutjar(membreId: string) {
    await supabase.from('colla_membres').delete().eq('id', membreId)
    loadMembres()
  }

  async function canviarRol(membreId: string, rol: string) {
    await supabase.from('colla_membres').update({ rol }).eq('id', membreId)
    setRolModal(null)
    loadMembres()
  }

  let filtered = membres
  if (tab === 'Junta') filtered = membres.filter(m => isComissio(m.rol))
  if (tab === 'Nous') {
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1)
    filtered = membres.filter(m => new Date(m.data_ingres) > monthAgo)
  }
  if (query) {
    const q = query.toLowerCase()
    filtered = filtered.filter(m =>
      m.profiles?.nom?.toLowerCase().includes(q) ||
      m.profiles?.cognoms?.toLowerCase().includes(q)
    )
  }

  const junta = membres.filter(m => isComissio(m.rol))
  const tabs = isComissioActiva() ? [...TABS, 'Pendents' as const] : TABS

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Membres ({membres.length})</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="🔍 Buscar membre..."
          placeholderTextColor={colors.gray[400]}
        />
      </View>

      <View style={styles.tabsRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t as Tab)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t}{t === 'Pendents' && pendents.length > 0 ? ` (${pendents.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* Pendents tab */}
          {tab === ('Pendents' as any) && (
            pendents.length === 0 ? (
              <Text style={styles.emptyText}>Cap sol·licitud pending</Text>
            ) : pendents.map(m => (
              <View key={m.id} style={styles.membreCard}>
                <Avatar name={`${m.profiles?.nom ?? ''} ${m.profiles?.cognoms ?? ''}`} uri={m.profiles?.avatar_url} size="md" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.membreNom}>{m.profiles?.nom} {m.profiles?.cognoms}</Text>
                  <Text style={styles.membreMeta}>Sol·licitud pendent</Text>
                </View>
                <TouchableOpacity style={styles.aprovarBtn} onPress={() => aprovar(m.id)}>
                  <Text style={styles.aprovarText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rebutjarBtn} onPress={() => rebutjar(m.id)}>
                  <Text style={styles.rebutjarText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Junta section (only on Tots tab) */}
          {tab === 'Tots' && junta.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Junta Directiva</Text>
              <View style={styles.juntaGrid}>
                {junta.map(m => (
                  <View key={m.id} style={styles.juntaCard}>
                    <Avatar name={`${m.profiles?.nom ?? ''} ${m.profiles?.cognoms ?? ''}`} uri={m.profiles?.avatar_url} size="xl" />
                    <Text style={styles.juntaNom} numberOfLines={1}>{m.profiles?.nom}</Text>
                    <Badge label={ROL_CONFIG[m.rol]?.label ?? m.rol} variant={ROL_CONFIG[m.rol]?.variant ?? 'default'} size="sm" />
                  </View>
                ))}
              </View>
              <Text style={styles.sectionLabel}>Tots els membres</Text>
            </>
          )}

          {/* Members list */}
          {tab !== ('Pendents' as any) && filtered.filter(m => tab !== 'Tots' || !isComissio(m.rol)).map(m => (
            <View key={m.id} style={styles.membreCard}>
              <Avatar name={`${m.profiles?.nom ?? ''} ${m.profiles?.cognoms ?? ''}`} uri={m.profiles?.avatar_url} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={styles.membreNom}>{m.profiles?.nom} {m.profiles?.cognoms}</Text>
                <Text style={styles.membreMeta}>Membre des de {new Date(m.data_ingres).getFullYear()}</Text>
              </View>
              {isComissioActiva() ? (
                <TouchableOpacity onPress={() => setRolModal({ id: m.id, nom: `${m.profiles?.nom ?? ''}` })} style={styles.rolBtn}>
                  <Text style={styles.rolBtnText}>{ROL_CONFIG[m.rol]?.label ?? m.rol}</Text>
                </TouchableOpacity>
              ) : (
                isComissio(m.rol) && <Badge label={ROL_CONFIG[m.rol]?.label ?? m.rol} variant={ROL_CONFIG[m.rol]?.variant ?? 'default'} size="sm" />
              )}
            </View>
          ))}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      <Modal visible={!!rolModal} transparent animationType="slide" onRequestClose={() => setRolModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRolModal(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Rol de {rolModal?.nom}</Text>
            {Object.entries(ROL_CONFIG).map(([rol, cfg]) => (
              <TouchableOpacity key={rol} style={styles.modalOption} onPress={() => canviarRol(rolModal!.id, rol)}>
                <Text style={styles.modalOptionText}>{cfg.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setRolModal(null)}>
              <Text style={styles.modalCancelText}>Cancel·lar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:    { fontSize: 22, color: colors.primary[600], width: 36 },
  title:       { ...typography.h3, color: colors.gray[900] },
  searchRow:   { paddingHorizontal: spacing.screenH, paddingVertical: spacing[2], backgroundColor: colors.white },
  searchInput: { height: 44, backgroundColor: colors.gray[100], borderRadius: radius.sm, paddingHorizontal: spacing[3], ...typography.body, color: colors.gray[900] },
  tabsRow:     { flexDirection: 'row', paddingHorizontal: spacing.screenH, paddingVertical: spacing[2], backgroundColor: colors.white, gap: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tabBtn:      { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.gray[100] },
  tabBtnActive:{ backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  tabText:     { ...typography.caption, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:{ color: colors.primary[600] },
  list:        { padding: spacing.screenH, gap: spacing[2] },
  sectionLabel:{ ...typography.label, color: colors.gray[500], marginTop: spacing[3], marginBottom: spacing[2] },
  juntaGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginBottom: spacing[3] },
  juntaCard:   { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], alignItems: 'center', gap: spacing[2], width: '30%', ...shadows.sm },
  juntaNom:    { ...typography.caption, color: colors.gray[800], fontWeight: '600', textAlign: 'center' },
  membreCard:  { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm },
  membreNom:   { ...typography.body, color: colors.gray[900], fontWeight: '600' },
  membreMeta:  { ...typography.caption, color: colors.gray[400], marginTop: 2 },
  aprovarBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },
  aprovarText: { color: colors.white, fontWeight: '700' },
  rebutjarBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[200], justifyContent: 'center', alignItems: 'center' },
  rebutjarText:{ color: colors.gray[600], fontWeight: '700' },
  emptyText:   { ...typography.body, color: colors.gray[400], textAlign: 'center', paddingVertical: spacing[6] },
  rolBtn:      { backgroundColor: colors.gray[100], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 4 },
  rolBtnText:  { ...typography.caption, color: colors.gray[600], fontWeight: '600' },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[6], gap: spacing[2] },
  modalTitle:  { ...typography.h3, color: colors.gray[900], marginBottom: spacing[2] },
  modalOption: { paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  modalOptionText: { ...typography.body, color: colors.gray[800] },
  modalCancel: { paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  modalCancelText: { ...typography.body, color: colors.danger[500], fontWeight: '600' },
})
