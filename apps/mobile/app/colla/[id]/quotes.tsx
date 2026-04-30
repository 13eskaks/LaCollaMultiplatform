import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'

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

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [membres, setMembres] = useState<any[]>([])
  const [selUserId, setSelUserId] = useState<string | null>(null)
  const [nouConcepte, setNouConcepte] = useState('Quota anual')
  const [nouImport, setNouImport] = useState('')
  const [nouDataLimit, setNouDataLimit] = useState<Date | null>(null)
  const [creating, setCreating] = useState(false)

  useFocusEffect(useCallback(() => { loadQuotes() }, [collaId, tab]))

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

  async function handleDelete(quota: any) {
    Alert.alert('Eliminar quota', `Eliminar la quota de ${quota.profiles?.nom}?`, [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('quotes').delete().eq('id', quota.id)
        setQuotes(prev => prev.filter(x => x.id !== quota.id))
      }},
    ])
  }

  async function handleMarcarPagat(quota: any) {
    if (!isComissioActiva()) return
    Alert.alert('Marcar com a pagat', `Confirmes el pagament de ${quota.profiles?.nom}?`, [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        await supabase.from('quotes').update({ estat: 'pagat', data_pagament: new Date().toISOString() }).eq('id', quota.id)
        loadQuotes()
      }},
    ])
  }

  async function openCreate() {
    const { data } = await supabase
      .from('colla_membres')
      .select('user_id, profiles(nom, cognoms, avatar_url)')
      .eq('colla_id', collaId)
      .eq('estat', 'actiu')
    setMembres(data ?? [])
    setSelUserId(null)
    setNouConcepte('Quota anual')
    setNouImport('')
    setNouDataLimit(null)
    setShowCreate(true)
  }

  async function handleCreate() {
    const num = parseFloat(nouImport.replace(',', '.'))
    if (!selUserId) { Alert.alert('Error', 'Selecciona un membre'); return }
    if (isNaN(num) || num <= 0) { Alert.alert('Error', 'Import invàlid'); return }
    setCreating(true)
    const { error } = await supabase.from('quotes').insert({
      colla_id: collaId,
      user_id: selUserId,
      concepte: nouConcepte.trim() || 'Quota anual',
      import: num,
      data_limit: nouDataLimit ? nouDataLimit.toISOString().slice(0, 10) : null,
      estat: 'pendent',
    })
    setCreating(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowCreate(false)
    loadQuotes()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Quotes"
        rightAction={isComissioActiva() ? { label: '+ Nova', onPress: openCreate } : undefined}
      />

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
        <EmptyState icon="📋" title={`Cap quota ${tab.toLowerCase()}`} subtitle={isComissioActiva() ? 'Crea la primera quota amb el botó + Nova' : ''} />
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
                {isComissioActiva() && (
                  <TouchableOpacity onPress={() => handleDelete(quota)} hitSlop={8}>
                    <Text style={styles.deleteBtn}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nova quota</Text>

            <Text style={styles.fieldLabel}>Membre *</Text>
            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {membres.map(m => (
                <TouchableOpacity
                  key={m.user_id}
                  style={[styles.memberRow, selUserId === m.user_id && styles.memberRowSel]}
                  onPress={() => setSelUserId(m.user_id)}
                >
                  <Avatar
                    name={`${m.profiles?.nom ?? ''} ${m.profiles?.cognoms ?? ''}`}
                    uri={m.profiles?.avatar_url}
                    size="sm"
                  />
                  <Text style={[styles.memberName, selUserId === m.user_id && { color: colors.primary[700], fontWeight: '700' }]}>
                    {m.profiles?.nom} {m.profiles?.cognoms}
                  </Text>
                  {selUserId === m.user_id && <Text style={{ color: colors.primary[600], fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Concepte</Text>
            <TextInput
              style={styles.input}
              value={nouConcepte}
              onChangeText={setNouConcepte}
              placeholder="Quota anual"
            />

            <Text style={styles.fieldLabel}>Import (€) *</Text>
            <TextInput
              style={styles.input}
              value={nouImport}
              onChangeText={setNouImport}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Venciment (opcional)</Text>
            <DatePicker value={nouDataLimit ?? new Date()} onChange={setNouDataLimit} />

            <View style={styles.modalBtns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
              <Button label="Crear" size="md" loading={creating} onPress={handleCreate} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
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
  deleteBtn:    { fontSize: 14, color: colors.gray[400] },
  // Modal
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[3], maxHeight: '85%' },
  modalTitle:   { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  fieldLabel:   { ...typography.label, color: colors.gray[600] },
  membersList:  { maxHeight: 180, borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm },
  memberRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  memberRowSel: { backgroundColor: colors.primary[50] },
  memberName:   { ...typography.body, color: colors.gray[800], flex: 1 },
  input:        { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  modalBtns:    { flexDirection: 'row', gap: spacing[2] },
})
