import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, useWindowDimensions } from 'react-native'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'

type TipusMoviment = 'ingrés' | 'despesa'
type Periodicitat = 'mensual' | 'trimestral' | 'anual'

const PERIODICITAT_LABEL: Record<Periodicitat, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

function nextDate(d: Date, periodicitat: Periodicitat): Date {
  const next = new Date(d)
  if (periodicitat === 'mensual') next.setMonth(next.getMonth() + 1)
  else if (periodicitat === 'trimestral') next.setMonth(next.getMonth() + 3)
  else next.setFullYear(next.getFullYear() + 1)
  return next
}

function isDue(properPagament: string): boolean {
  return new Date(properPagament) <= new Date()
}

export default function CaixaScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const { isComissioActiva } = useCollaStore()
  const { height: screenH } = useWindowDimensions()
  const [moviments, setMoviments] = useState<any[]>([])
  const [periodics, setPeriodics] = useState<any[]>([])
  const [periodicsLoading, setPeriodicsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saldo, setSaldo] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [showPeriodics, setShowPeriodics] = useState(false)
  const [showNouPeriodic, setShowNouPeriodic] = useState(false)
  const [editingMoviment, setEditingMoviment] = useState<any | null>(null)

  // Form moviment
  const [tipus, setTipus] = useState<TipusMoviment>('ingrés')
  const [concepte, setConcepte] = useState('')
  const [importVal, setImportVal] = useState('')
  const [data, setData] = useState<Date>(new Date())
  const [saving, setSaving] = useState(false)

  // Form periòdic
  const [pTipus, setPTipus] = useState<TipusMoviment>('despesa')
  const [pConcepte, setPConcepte] = useState('')
  const [pImport, setPImport] = useState('')
  const [pPeriodicitat, setPPeriodicitat] = useState<Periodicitat>('mensual')
  const [pProperPagament, setPProperPagament] = useState<Date>(new Date())
  const [savingPeriodic, setSavingPeriodic] = useState(false)

  useFocusEffect(useCallback(() => {
    loadMoviments()
    loadPeriodics()
  }, [collaId]))

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

  async function loadPeriodics() {
    setPeriodicsLoading(true)
    const { data, error } = await supabase
      .from('caixa_periodics')
      .select('*')
      .eq('colla_id', collaId)
      .eq('actiu', true)
      .order('proper_pagament', { ascending: true })
    if (error) Alert.alert('Error carregant periòdics', error.message)
    setPeriodics(data ?? [])
    setPeriodicsLoading(false)
  }

  async function handleDelete(m: any) {
    Alert.alert('Eliminar moviment', `Eliminar "${m.concepte}"?`, [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('caixa_moviments').delete().eq('id', m.id)
        const updated = moviments.filter(x => x.id !== m.id)
        setMoviments(updated)
        const total = updated.reduce((s, x) => s + (x.tipus === 'ingrés' ? x.import : -x.import), 0)
        setSaldo(total)
      }},
    ])
  }

  function openCreate() {
    setEditingMoviment(null)
    setTipus('ingrés')
    setConcepte('')
    setImportVal('')
    setData(new Date())
    setShowModal(true)
  }

  function openEdit(m: any) {
    setEditingMoviment(m)
    setTipus(m.tipus)
    setConcepte(m.concepte)
    setImportVal(String(m.import).replace('.', ','))
    setData(new Date(m.data + 'T00:00:00'))
    setShowModal(true)
  }

  async function handleAdd() {
    const num = parseFloat(importVal.replace(',', '.'))
    if (!concepte.trim() || isNaN(num) || num <= 0) {
      Alert.alert('Error', 'Omple tots els camps correctament')
      return
    }
    setSaving(true)

    if (editingMoviment) {
      const { error } = await supabase.from('caixa_moviments').update({
        tipus,
        concepte: concepte.trim(),
        import: num,
        data: data.toISOString().slice(0, 10),
      }).eq('id', editingMoviment.id)
      setSaving(false)
      if (error) { Alert.alert('Error', error.message); return }
      setConcepte(''); setImportVal(''); setShowModal(false); setEditingMoviment(null)
      loadMoviments()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('caixa_moviments').insert({
      colla_id: collaId,
      autor_id: user?.id,
      tipus,
      concepte: concepte.trim(),
      import: num,
      data: data.toISOString().slice(0, 10),
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

  async function handleRegistrar(p: any) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('caixa_moviments').insert({
      colla_id: collaId,
      autor_id: user?.id,
      tipus: p.tipus,
      concepte: p.concepte,
      import: p.import,
      data: new Date().toISOString().slice(0, 10),
    })
    if (error) { Alert.alert('Error', error.message); return }
    const next = nextDate(new Date(p.proper_pagament + 'T00:00:00'), p.periodicitat)
    await supabase.from('caixa_periodics').update({
      proper_pagament: next.toISOString().slice(0, 10),
    }).eq('id', p.id)
    loadMoviments()
    loadPeriodics()
  }

  async function handleDeletePeriodic(p: any) {
    Alert.alert('Eliminar periòdic', `Eliminar "${p.concepte}"?`, [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('caixa_periodics').delete().eq('id', p.id)
        setPeriodics(prev => prev.filter(x => x.id !== p.id))
      }},
    ])
  }

  async function handleAddPeriodic() {
    const num = parseFloat(pImport.replace(',', '.'))
    if (!pConcepte.trim() || isNaN(num) || num <= 0) {
      Alert.alert('Error', 'Omple tots els camps')
      return
    }
    setSavingPeriodic(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('caixa_periodics').insert({
      colla_id: collaId,
      autor_id: user?.id,
      tipus: pTipus,
      concepte: pConcepte.trim(),
      import: num,
      periodicitat: pPeriodicitat,
      proper_pagament: pProperPagament.toISOString().slice(0, 10),
    })
    setSavingPeriodic(false)
    if (error) { Alert.alert('Error', error.message); return }
    setPConcepte('')
    setPImport('')
    setPProperPagament(new Date())
    setShowNouPeriodic(false)
    await loadPeriodics()
  }

  const saldoColor = saldo >= 0 ? colors.success[500] : colors.danger[500]
  const periodicsVencuts = periodics.filter(p => isDue(p.proper_pagament))

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Caixa"
        rightAction={isComissioActiva() ? { label: `🔄 Periòdics${periodicsVencuts.length > 0 ? ` (${periodicsVencuts.length})` : ''}`, onPress: () => { setShowPeriodics(true); loadPeriodics() } } : undefined}
      />

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
              {isComissioActiva() && (
                <>
                  <TouchableOpacity onPress={() => openEdit(m)} hitSlop={8}>
                    <Text style={[styles.deleteBtn, { color: colors.gray[400] }]}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(m)} hitSlop={8}>
                    <Text style={styles.deleteBtn}>🗑</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {isComissioActiva() && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Modal nou moviment */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingMoviment ? 'Editar moviment' : 'Nou moviment'}</Text>

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
            <DatePicker value={data} onChange={setData} />

            <View style={styles.modalBtns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
              <Button label={editingMoviment ? 'Guardar' : 'Afegir'} size="md" loading={saving} onPress={handleAdd} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal periòdics */}
      <Modal visible={showPeriodics} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Moviments periòdics</Text>
              <TouchableOpacity onPress={() => setShowPeriodics(false)}>
                <Text style={{ color: colors.gray[400], fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: screenH * 0.55 }}>
              {periodicsLoading ? (
                <ActivityIndicator color={colors.primary[600]} style={{ marginVertical: spacing[4] }} />
              ) : periodics.length === 0 ? (
                <Text style={{ ...typography.body, color: colors.gray[400], textAlign: 'center', paddingVertical: spacing[4] }}>
                  Cap moviment periòdic configurat
                </Text>
              ) : (
                periodics.map(p => {
                  const due = isDue(p.proper_pagament)
                  return (
                    <View key={p.id} style={styles.periodicRow}>
                      <View style={[styles.dot, { backgroundColor: p.tipus === 'ingrés' ? colors.success[500] : colors.danger[500] }]} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.rowConcepte}>{p.concepte}</Text>
                        <Text style={styles.rowData}>
                          {PERIODICITAT_LABEL[p.periodicitat as Periodicitat]} · Proper: {new Date(p.proper_pagament + 'T00:00:00').toLocaleDateString('ca-ES')}
                        </Text>
                      </View>
                      <Text style={[styles.rowImport, { color: p.tipus === 'ingrés' ? colors.success[500] : colors.danger[500], fontSize: 14 }]}>
                        {p.tipus === 'ingrés' ? '+' : '-'}{p.import.toFixed(2)} €
                      </Text>
                      {due && (
                        <TouchableOpacity style={styles.registrarBtn} onPress={() => handleRegistrar(p)}>
                          <Text style={styles.registrarText}>Registrar</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDeletePeriodic(p)} hitSlop={8}>
                        <Text style={styles.deleteBtn}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })
              )}
            </ScrollView>

            <Button
              label="+ Afegir periòdic"
              size="md"
              onPress={() => setShowNouPeriodic(true)}
              style={{ marginTop: spacing[3] }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal nou periòdic */}
      <Modal visible={showNouPeriodic} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nou periòdic</Text>

            <View style={styles.typeRow}>
              {(['ingrés', 'despesa'] as TipusMoviment[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, pTipus === t && (t === 'ingrés' ? styles.typeBtnIngres : styles.typeBtnDespesa)]}
                  onPress={() => setPTipus(t)}
                >
                  <Text style={[styles.typeText, pTipus === t && styles.typeTextActive]}>
                    {t === 'ingrés' ? '+ Ingrés' : '− Despesa'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} value={pConcepte} onChangeText={setPConcepte} placeholder="Concepte (ex: Lloguer local)" />
            <TextInput style={styles.input} value={pImport} onChangeText={setPImport} placeholder="Import (€)" keyboardType="decimal-pad" />

            {/* Periodicitat selector */}
            <View style={styles.typeRow}>
              {(['mensual', 'trimestral', 'anual'] as Periodicitat[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.typeBtn, pPeriodicitat === p && styles.typeBtnIngres]}
                  onPress={() => setPPeriodicitat(p)}
                >
                  <Text style={[styles.typeText, { fontSize: 12 }, pPeriodicitat === p && styles.typeTextActive]}>
                    {PERIODICITAT_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ ...typography.label, color: colors.gray[600] }}>Primer pagament</Text>
            <DatePicker value={pProperPagament} onChange={setPProperPagament} />

            <View style={styles.modalBtns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowNouPeriodic(false)} style={{ flex: 1 }} />
              <Button label="Afegir" size="md" loading={savingPeriodic} onPress={handleAddPeriodic} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.gray[50] },
  saldoBox:      { backgroundColor: colors.white, paddingVertical: spacing[5], alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.gray[100], gap: spacing[1] },
  saldoLabel:    { ...typography.label, color: colors.gray[500] },
  saldoNum:      { ...typography.display, fontWeight: '700' },
  list:          { padding: spacing.screenH, gap: spacing[2] },
  row:           { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm },
  periodicRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  deleteBtn:     { fontSize: 14, color: colors.gray[400] },
  dot:           { width: 10, height: 10, borderRadius: 5 },
  rowInfo:       { flex: 1, gap: 2 },
  rowConcepte:   { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  rowData:       { ...typography.caption, color: colors.gray[400] },
  rowImport:     { ...typography.h3, fontWeight: '700' },
  registrarBtn:  { backgroundColor: colors.primary[600], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 4 },
  registrarText: { ...typography.caption, color: colors.white, fontWeight: '600' },
  fab:           { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:       { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  modalTitle:    { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  typeRow:       { flexDirection: 'row', gap: spacing[2] },
  typeBtn:       { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.gray[100] },
  typeBtnIngres: { backgroundColor: colors.success[50], borderWidth: 1.5, borderColor: colors.success[500] },
  typeBtnDespesa:{ backgroundColor: colors.danger[50], borderWidth: 1.5, borderColor: colors.danger[500] },
  typeText:      { ...typography.body, color: colors.gray[600], fontWeight: '600' },
  typeTextActive:{ color: colors.gray[900] },
  input:         { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  modalBtns:     { flexDirection: 'row', gap: spacing[2] },
})
