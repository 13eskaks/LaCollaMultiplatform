import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

const CATEGORIES = ['Events', 'Vestuari', 'Material', 'Local', 'Comunicació', 'Formació', 'Altres'] as const

export default function PressupostScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const { isComissioActiva } = useCollaStore()
  const [partides, setPartides] = useState<any[]>([])
  const [any, setAny] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form
  const [categoria, setCategoria] = useState<string>(CATEGORIES[0])
  const [concepte, setConcepte] = useState('')
  const [importPressupostat, setImportPressupostat] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPartides() }, [collaId, any])

  async function loadPartides() {
    setLoading(true)
    const { data } = await supabase
      .from('pressupost_partides')
      .select('*')
      .eq('colla_id', collaId)
      .eq('any', any)
      .order('categoria', { ascending: true })
    setPartides(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    const num = parseFloat(importPressupostat.replace(',', '.'))
    if (!concepte.trim() || isNaN(num) || num <= 0) {
      Alert.alert('Error', 'Omple tots els camps correctament')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('pressupost_partides').insert({
      colla_id: collaId,
      any,
      categoria,
      concepte: concepte.trim(),
      import_pressupostat: num,
      import_executat: 0,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setConcepte('')
      setImportPressupostat('')
      setShowModal(false)
      loadPartides()
    }
  }

  const totalPressupostat = partides.reduce((s, p) => s + (p.import_pressupostat ?? 0), 0)
  const totalExecutat = partides.reduce((s, p) => s + (p.import_executat ?? 0), 0)
  const pctExecutat = totalPressupostat > 0 ? (totalExecutat / totalPressupostat) * 100 : 0

  const byCategoria = CATEGORIES.reduce((acc, cat) => {
    const items = partides.filter(p => p.categoria === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, any[]>)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Pressupost" />

      {/* Any selector */}
      <View style={styles.anyRow}>
        <TouchableOpacity onPress={() => setAny(a => a - 1)} style={styles.anyBtn}>
          <Text style={styles.anyBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.anyText}>{any}</Text>
        <TouchableOpacity onPress={() => setAny(a => a + 1)} style={styles.anyBtn}>
          <Text style={styles.anyBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Resum */}
      {partides.length > 0 && (
        <View style={styles.resumCard}>
          <View style={styles.resumRow}>
            <View style={styles.resumItem}>
              <Text style={styles.resumNum}>{totalPressupostat.toFixed(0)} €</Text>
              <Text style={styles.resumLabel}>Pressupostat</Text>
            </View>
            <View style={styles.resumDivider} />
            <View style={styles.resumItem}>
              <Text style={[styles.resumNum, { color: pctExecutat > 100 ? colors.danger[500] : colors.success[500] }]}>
                {totalExecutat.toFixed(0)} €
              </Text>
              <Text style={styles.resumLabel}>Executat</Text>
            </View>
            <View style={styles.resumDivider} />
            <View style={styles.resumItem}>
              <Text style={styles.resumNum}>{Math.round(pctExecutat)}%</Text>
              <Text style={styles.resumLabel}>Execució</Text>
            </View>
          </View>
          <View style={styles.barBackground}>
            <View style={[styles.barFill, { width: `${Math.min(pctExecutat, 100)}%` as any, backgroundColor: pctExecutat > 100 ? colors.danger[500] : colors.primary[600] }]} />
          </View>
        </View>
      )}

      {loading ? null : partides.length === 0 ? (
        <EmptyState icon="🏷️" title="Cap partida pressupostada" subtitle="Crea el primer pressupost de la colla" />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {Object.entries(byCategoria).map(([cat, items]) => {
            const catTotal = items.reduce((s, p) => s + (p.import_pressupostat ?? 0), 0)
            const catExecutat = items.reduce((s, p) => s + (p.import_executat ?? 0), 0)
            return (
              <View key={cat} style={styles.catSection}>
                <View style={styles.catHeader}>
                  <Text style={styles.catLabel}>{cat}</Text>
                  <Text style={styles.catTotal}>{catExecutat.toFixed(0)} / {catTotal.toFixed(0)} €</Text>
                </View>
                <View style={styles.catCard}>
                  {items.map((p, idx) => (
                    <View key={p.id}>
                      <View style={styles.partidaRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partidaConcepte}>{p.concepte}</Text>
                          <Text style={styles.partidaImport}>
                            {(p.import_executat ?? 0).toFixed(2)} / {p.import_pressupostat.toFixed(2)} €
                          </Text>
                        </View>
                        <Text style={[styles.partidaPct, (p.import_executat ?? 0) > p.import_pressupostat && { color: colors.danger[500] }]}>
                          {p.import_pressupostat > 0 ? Math.round(((p.import_executat ?? 0) / p.import_pressupostat) * 100) : 0}%
                        </Text>
                      </View>
                      {idx < items.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
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
            <Text style={styles.modalTitle}>Nova partida</Text>

            <Text style={styles.modalLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catBtn, categoria === c && styles.catBtnActive]}
                    onPress={() => setCategoria(c)}
                  >
                    <Text style={[styles.catBtnText, categoria === c && styles.catBtnTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput style={styles.input} value={concepte} onChangeText={setConcepte} placeholder="Concepte" />
            <TextInput style={styles.input} value={importPressupostat} onChangeText={setImportPressupostat} placeholder="Import pressupostat (€)" keyboardType="decimal-pad" />

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
  safe:           { flex: 1, backgroundColor: colors.gray[50] },
  anyRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100], gap: spacing[6] },
  anyBtn:         { padding: spacing[2] },
  anyBtnText:     { fontSize: 24, color: colors.primary[600] },
  anyText:        { ...typography.h2, color: colors.gray[900], minWidth: 60, textAlign: 'center' },
  resumCard:      { margin: spacing.screenH, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], ...shadows.sm, gap: spacing[3] },
  resumRow:       { flexDirection: 'row', justifyContent: 'space-around' },
  resumItem:      { alignItems: 'center', gap: 2 },
  resumNum:       { ...typography.h2, color: colors.gray[900] },
  resumLabel:     { ...typography.caption, color: colors.gray[500] },
  resumDivider:   { width: 1, backgroundColor: colors.gray[200] },
  barBackground:  { height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  barFill:        { height: 8, borderRadius: 4 },
  list:           { padding: spacing.screenH, gap: spacing[4] },
  catSection:     { gap: spacing[2] },
  catHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel:       { ...typography.label, color: colors.gray[500] },
  catTotal:       { ...typography.caption, color: colors.gray[500] },
  catCard:        { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  partidaRow:     { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  partidaConcepte:{ ...typography.body, color: colors.gray[800], fontWeight: '600' },
  partidaImport:  { ...typography.caption, color: colors.gray[400], marginTop: 2 },
  partidaPct:     { ...typography.h3, color: colors.primary[600], fontWeight: '700' },
  divider:        { height: 1, backgroundColor: colors.gray[100] },
  fab:            { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:        { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:          { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  modalTitle:     { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  modalLabel:     { ...typography.label, color: colors.gray[500] },
  catBtn:         { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, backgroundColor: colors.gray[100] },
  catBtnActive:   { backgroundColor: colors.primary[600] },
  catBtnText:     { ...typography.caption, color: colors.gray[600], fontWeight: '600' },
  catBtnTextActive:{ color: colors.white },
  input:          { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  modalBtns:      { flexDirection: 'row', gap: spacing[2] },
})
