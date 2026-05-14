import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback, useEffect } from 'react'
import { useDataCache } from '@/stores/dataCache'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
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
  const { id: collaId, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const dc = useDataCache()
  const { isComissioActiva } = useCollaStore()
  const [membres, setMembres] = useState<any[]>([])
  const [pendents, setPendents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>((tabParam as Tab) ?? 'Tots')
  const [query, setQuery] = useState('')
  const [rolModal, setRolModal] = useState<{ id: string; nom: string } | null>(null)
  const [kickModal, setKickModal] = useState<{ id: string; nom: string } | null>(null)
  const [kickMotiu, setKickMotiu] = useState('')
  const [kickando, setKickando] = useState(false)

  useEffect(() => {
    const cached = dc.get<{ membres: any[]; pendents: any[] }>(`membres_${collaId}`)
    if (cached?.membres?.length) { setMembres(cached.membres); setPendents(cached.pendents ?? []); setLoading(false) }
  }, [collaId])

  useFocusEffect(useCallback(() => {
    if (dc.fresh(`membres_${collaId}`)) return
    loadMembres()
  }, [collaId]))

  async function loadMembres() {
    const CK = `membres_${collaId}`
    if (!dc.get(CK)) setLoading(true)
    const [membresRes, pendentsRes] = await Promise.all([
      supabase.from('colla_membres').select('*, profiles(nom, cognoms, avatar_url)').eq('colla_id', collaId).eq('estat', 'actiu').order('data_ingres', { ascending: false }),
      isComissioActiva()
        ? supabase.from('colla_membres').select('*, profiles(nom, cognoms, avatar_url)').eq('colla_id', collaId).eq('estat', 'pendent')
        : null,
    ])
    const mem = membresRes.data ?? []
    const pen = pendentsRes?.data ?? []
    setMembres(mem)
    setPendents(pen)
    dc.put(CK, { membres: mem, pendents: pen })
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
    // Block demoting the only president
    if (rol !== 'president') {
      const current = membres.find(m => m.id === membreId)
      if (current?.rol === 'president') {
        const presidents = membres.filter(m => m.rol === 'president')
        if (presidents.length <= 1) {
          Alert.alert(
            'Cal un president',
            "La colla ha de tenir sempre almenys un president. Assigna primer el rol de president a un altre membre.",
            [{ text: "D'acord" }]
          )
          return
        }
      }
    }
    await supabase.from('colla_membres').update({ rol }).eq('id', membreId)
    setRolModal(null)
    loadMembres()
  }

  async function expulsarMembre() {
    if (!kickModal || !kickMotiu.trim()) return

    // Block expelling the only president
    const target = membres.find(m => m.id === kickModal.id)
    if (target?.rol === 'president') {
      const presidents = membres.filter(m => m.rol === 'president')
      if (presidents.length <= 1) {
        Alert.alert(
          'Cal un president',
          "No es pot expulsar l'únic president de la colla. Assigna primer el rol de president a un altre membre.",
          [{ text: "D'acord" }]
        )
        return
      }
    }

    setKickando(true)
    await supabase.from('colla_membres')
      .update({ estat: 'inactiu', motiu_expulsio: kickMotiu.trim() })
      .eq('id', kickModal.id)
    dc.bust(`membres_${collaId}`)
    setKickModal(null)
    setKickMotiu('')
    setKickando(false)
    loadMembres()
  }

  function openKick(m: { id: string; nom: string }) {
    setRolModal(null)
    setKickMotiu('')
    setKickModal(m)
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
  const TAB_LABELS: Record<string, string> = {
    'Tots':     t('membres.tabs.all'),
    'Junta':    t('membres.tabs.board'),
    'Nous':     t('membres.tabs.new'),
    'Pendents': t('membres.pending'),
  }
  const amComissio = isComissioActiva()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('modul.membres')} ({membres.length})</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={`🔍 ${t('membres.search.ph')}`}
          placeholderTextColor={colors.gray[400]}
        />
      </View>

      <View style={styles.tabsRow}>
        {tabs.map(tabKey => (
          <TouchableOpacity key={tabKey} style={[styles.tabBtn, tab === tabKey && styles.tabBtnActive]} onPress={() => setTab(tabKey as Tab)}>
            <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
              {TAB_LABELS[tabKey] ?? tabKey}{tabKey === 'Pendents' && pendents.length > 0 ? ` (${pendents.length})` : ''}
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
                  <Text style={styles.membreMeta}>{t('membres.pending')}</Text>
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
                  <TouchableOpacity
                    key={m.id}
                    style={styles.juntaCard}
                    onPress={amComissio ? () => setRolModal({ id: m.id, nom: `${m.profiles?.nom ?? ''}` }) : undefined}
                    activeOpacity={amComissio ? 0.7 : 1}
                  >
                    <Avatar name={`${m.profiles?.nom ?? ''} ${m.profiles?.cognoms ?? ''}`} uri={m.profiles?.avatar_url} size="xl" />
                    <Text style={styles.juntaNom} numberOfLines={1}>{m.profiles?.nom}</Text>
                    <Badge label={t(`membres.rol.${m.rol}`, { defaultValue: m.rol })} variant={ROL_CONFIG[m.rol]?.variant ?? 'default'} size="sm" />
                    {amComissio && <Text style={styles.juntaEditHint}>···</Text>}
                  </TouchableOpacity>
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
                <Text style={styles.membreMeta}>{t('perfil.memberSince', { year: new Date(m.data_ingres).getFullYear() })}</Text>
              </View>
              {amComissio ? (
                <TouchableOpacity onPress={() => setRolModal({ id: m.id, nom: `${m.profiles?.nom ?? ''}` })} style={styles.rolBtn}>
                  <Text style={styles.rolBtnText}>{t(`membres.rol.${m.rol}`, { defaultValue: m.rol })}</Text>
                </TouchableOpacity>
              ) : (
                isComissio(m.rol) && <Badge label={t(`membres.rol.${m.rol}`, { defaultValue: m.rol })} variant={ROL_CONFIG[m.rol]?.variant ?? 'default'} size="sm" />
              )}
            </View>
          ))}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* Role modal */}
      <Modal visible={!!rolModal} transparent animationType="slide" onRequestClose={() => setRolModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRolModal(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{rolModal?.nom}</Text>
            {Object.keys(ROL_CONFIG).map(rol => (
              <TouchableOpacity key={rol} style={styles.modalOption} onPress={() => canviarRol(rolModal!.id, rol)}>
                <Text style={styles.modalOptionText}>{t(`membres.rol.${rol}`, { defaultValue: rol })}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalDivider} />
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => openKick({ id: rolModal!.id, nom: rolModal!.nom })}
            >
              <Text style={styles.modalExpulsarText}>{t('membres.kick.title')}...</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setRolModal(null)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Kick modal */}
      <Modal visible={!!kickModal} transparent animationType="slide" onRequestClose={() => setKickModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setKickModal(null)}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{t('membres.kick.title')}: {kickModal?.nom}</Text>
              <Text style={styles.kickSubtitle}>{t('membres.kick.reason')}</Text>
              <TextInput
                style={styles.kickInput}
                value={kickMotiu}
                onChangeText={setKickMotiu}
                placeholder={t('membres.kick.reason')}
                placeholderTextColor={colors.gray[400]}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.kickConfirmBtn, (!kickMotiu.trim() || kickando) && styles.kickConfirmBtnDisabled]}
                onPress={expulsarMembre}
                disabled={!kickMotiu.trim() || kickando}
              >
                {kickando
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.kickConfirmText}>Confirmar expulsió</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setKickModal(null)}>
                <Text style={styles.modalCancelText}>Cancel·lar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:    { fontSize: 22, color: colors.primary[600], width: 36, lineHeight: 26 },
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
  juntaEditHint: { ...typography.caption, color: colors.gray[300], letterSpacing: 1 },
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

  // Modals
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[6], gap: spacing[2] },
  modalTitle:        { ...typography.h3, color: colors.gray[900], marginBottom: spacing[2] },
  modalOption:       { paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  modalOptionText:   { ...typography.body, color: colors.gray[800] },
  modalDivider:      { height: 1, backgroundColor: colors.gray[200], marginVertical: spacing[1] },
  modalExpulsarText: { ...typography.body, color: colors.danger[500] },
  modalCancel:       { paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  modalCancelText:   { ...typography.body, color: colors.danger[500], fontWeight: '600' },

  // Kick modal
  kickSubtitle:          { ...typography.bodySm, color: colors.gray[500], marginBottom: spacing[2] },
  kickInput:             { backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, padding: spacing[3], ...typography.body, color: colors.gray[900], minHeight: 80, textAlignVertical: 'top' },
  kickConfirmBtn:        { backgroundColor: colors.danger[500], borderRadius: radius.sm, paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  kickConfirmBtnDisabled:{ opacity: 0.4 },
  kickConfirmText:       { ...typography.body, color: colors.white, fontWeight: '700' },
})
