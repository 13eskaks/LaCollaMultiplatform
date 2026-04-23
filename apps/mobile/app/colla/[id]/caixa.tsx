import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

type TipusMoviment = 'ingrés' | 'despesa'

export default function CaixaScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const { isComissioActiva } = useCollaStore()
  const [moviments, setMoviments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saldo, setSaldo] = useState(0)
  const [showModal, setShowModal] = useState(false)

  // Form
  const [tipus, setTipus] = useState<TipusMoviment>('ingrés')
  const [concepte, setConcepte] = useState('')
  const [importVal, setImportVal] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadMoviments() }, [collaId])

  async function loadMoviments() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('caixa_moviments')
      .select('*')
      .eq('colla_id', collaId)
      .order('data', { ascending: false })

    const all = rows ?? []
    setMoviments(all)
    const total = all.reduce((s, m) => s + (m.tipus === 'ingrés' ? m.import : -m.import), 0)
    setSaldo(total)
    setLoading(false)
  }

  async function handleAdd() {
    const num = parseFloat(importVal.replace(',', '.'))
    if (!concepte.trim() || isNaN(num) || num <= 0) {
      Alert.alert('Error', 'Omple tots els camps correctament')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('caixa_moviments').insert({
      colla_id: collaId,
      autor_id: user?.id,
      tipus,
      concepte: concepte.trim(),
      import: num,
      data,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setConcepte('')
      setImportVal('')
      setShowModal(false)
      loadMoviments()
    }
  }

  const saldoColor = saldo >= 0 ? colors.success[500] : colors.danger[500]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Caixa" />

      {/* Saldo */}
      <View style={styles.saldoBox}>
        <Text style={styles.saldoLabel}>Saldo actual</Text>
        <Text style={[styles.saldoNum, { color: saldoColor }]}>
          {saldo >= 0 ? '+' : ''}{saldo.toFixed(2)} €
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : moviments.length === 0 ? (
        <EmptyState icon="💶" title="Cap moviment registrat" subtitle="Afegeix el primer moviment a la caixa" />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {moviments.map(m => (
            <View key={m.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: m.tipus === 'ingrés' ? colors.success[500] : colors.danger[500] }]} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowConcepte}>{m.concepte}</Text>
                <Text style={styles.rowData}>{new Date(m.data).toLocaleDateString('ca-ES')}</Text>
              </View>
              <Text style={[styles.rowImport, { color: m.tipus === 'ingrés' ? colors.success[500] : colors.danger[500] }]}>
                {m.tipus === 'ingrés' ? '+' : '-'}{m.import.toFixed(2)} €
              </Text>
            </View>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {isComissioActiva() && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nou moviment</Text>

            <View style={styles.typeRow}>
              {(['ingrés', 'despesa'] as TipusMoviment[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, tipus === t && (t === 'ingrés' ? styles.typeBtnIngres : styles.typeBtnDespesa)]}
                  onPress={() => setTipus(t)}
                >
                  <Text style={[styles.typeText, tipus === t && styles.typeTextActive]}>
                    {t === 'ingrés' ? '+ Ingrés' : '− Despesa'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} value={concepte} onChangeText={setConcepte} placeholder="Concepte" />
            <TextInput style={styles.input} value={importVal} onChangeText={setImportVal} placeholder="Import (€)" keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={data} onChangeText={setData} placeholder="Data (AAAA-MM-DD)" />

            <View style={styles.modalBtns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
              <Button label="Afegir" size="md" loading={saving} onPress={handleAdd} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  saldoBox:     { backgroundColor: colors.white, paddingVertical: spacing[5], alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.gray[100], gap: spacing[1] },
  saldoLabel:   { ...typography.label, color: colors.gray[500] },
  saldoNum:     { ...typography.display, fontWeight: '700' },
  list:         { padding: spacing.screenH, gap: spacing[2] },
  row:          { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  rowInfo:      { flex: 1, gap: 2 },
  rowConcepte:  { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  rowData:      { ...typography.caption, color: colors.gray[400] },
  rowImport:    { ...typography.h3, fontWeight: '700' },
  fab:          { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:      { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  modalTitle:   { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  typeRow:      { flexDirection: 'row', gap: spacing[2] },
  typeBtn:      { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.gray[100] },
  typeBtnIngres:{ backgroundColor: colors.success[50], borderWidth: 1.5, borderColor: colors.success[500] },
  typeBtnDespesa:{ backgroundColor: colors.danger[50], borderWidth: 1.5, borderColor: colors.danger[500] },
  typeText:     { ...typography.body, color: colors.gray[600], fontWeight: '600' },
  typeTextActive:{ color: colors.gray[900] },
  input:        { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  modalBtns:    { flexDirection: 'row', gap: spacing[2] },
})
