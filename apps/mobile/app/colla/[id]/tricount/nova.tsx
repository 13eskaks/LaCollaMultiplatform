import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'

// ── Types ─────────────────────────────────────────────────────────────────────

type Membre = {
  user_id: string
  nom: string
  cognoms: string
  avatar_url: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'general',     label: 'General',     icon: '💶' },
  { key: 'menjar',      label: 'Menjar',       icon: '🍽️' },
  { key: 'transport',   label: 'Transport',    icon: '🚗' },
  { key: 'activitat',   label: 'Activitat',    icon: '🎭' },
  { key: 'allotjament', label: 'Allotjament',  icon: '🏠' },
  { key: 'altres',      label: 'Altres',       icon: '📦' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function NovaDespesaScreen() {
  const { id: collaId, eid } = useLocalSearchParams<{ id: string; eid?: string }>()
  const router = useRouter()
  const isEdit = !!eid

  // Data
  const [membres, setMembres] = useState<Membre[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [loadingMembres, setLoadingMembres] = useState(true)

  // Form fields
  const [titol, setTitol] = useState('')
  const [importVal, setImportVal] = useState('')
  const [categoria, setCategoria] = useState('general')
  const [data, setData] = useState(new Date())
  const [nota, setNota] = useState('')
  const [pagadorId, setPagadorId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Set<string>>(new Set())
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [customPesos, setCustomPesos] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)

  useEffect(() => { loadMembres() }, [collaId])

  useEffect(() => {
    if (!eid || loadingMembres) return
    supabase.from('despeses_compartides')
      .select('*, parts:despesa_parts(user_id, pes)')
      .eq('id', eid)
      .single()
      .then(({ data: d }) => {
        if (!d) return
        setTitol(d.titol)
        setImportVal(String(d.import).replace('.', ','))
        setCategoria(d.categoria)
        setData(new Date(d.data + 'T00:00:00'))
        setNota(d.nota ?? '')
        setPagadorId(d.pagador_id)
        const parts: { user_id: string; pes: number }[] = d.parts ?? []
        setParticipants(new Set(parts.map(p => p.user_id)))
        const hasCustom = parts.some(p => p.pes !== 1)
        if (hasCustom) {
          setSplitMode('custom')
          const pesos: Record<string, string> = {}
          parts.forEach(p => { pesos[p.user_id] = String(p.pes) })
          setCustomPesos(prev => ({ ...prev, ...pesos }))
        }
      })
  }, [eid, loadingMembres])

  async function loadMembres() {
    setLoadingMembres(true)
    const { data: { user } } = await supabase.auth.getUser()
    setMyId(user?.id ?? null)

    const { data: rows } = await supabase
      .from('colla_membres')
      .select('user_id, profiles(nom, cognoms, avatar_url)')
      .eq('colla_id', collaId)
      .eq('estat', 'actiu')

    const list: Membre[] = (rows ?? []).map((m: any) => ({
      user_id: m.user_id,
      nom: m.profiles.nom,
      cognoms: m.profiles.cognoms,
      avatar_url: m.profiles.avatar_url,
    }))

    setMembres(list)

    // Defaults: current user pays, everyone participates
    if (user) setPagadorId(user.id)
    const allIds = new Set(list.map(m => m.user_id))
    setParticipants(allIds)
    const pesos: Record<string, string> = {}
    list.forEach(m => { pesos[m.user_id] = '1' })
    setCustomPesos(pesos)

    setLoadingMembres(false)
  }

  function toggleParticipant(uid: string) {
    setParticipants(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function nomCurt(m: Membre) {
    return `${m.nom} ${m.cognoms.split(' ')[0]}`
  }

  // Preview: how much each person owes
  function previewShare(): number {
    const importNum = parseFloat(importVal.replace(',', '.'))
    if (isNaN(importNum) || importNum <= 0) return 0

    if (splitMode === 'equal') {
      return participants.size > 0 ? importNum / participants.size : 0
    }

    // custom: use weights for participants
    const totalPes = [...participants].reduce((s, uid) => {
      return s + (parseFloat(customPesos[uid] ?? '1') || 0)
    }, 0)
    return totalPes > 0 ? importNum / totalPes : 0
  }

  async function handleSave() {
    const importNum = parseFloat(importVal.replace(',', '.'))

    if (!titol.trim()) {
      Alert.alert('Error', 'El títol és obligatori')
      return
    }
    if (isNaN(importNum) || importNum <= 0) {
      Alert.alert('Error', "L'import ha de ser un número positiu")
      return
    }
    if (!pagadorId) {
      Alert.alert('Error', 'Selecciona qui ha pagat')
      return
    }
    if (participants.size === 0) {
      Alert.alert('Error', 'Selecciona almenys un participant')
      return
    }

    setSaving(true)

    const partsPayload = [...participants].map(uid => ({
      user_id: uid,
      pes: splitMode === 'equal' ? 1 : parseFloat(customPesos[uid] ?? '1') || 1,
    }))

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('despeses_compartides')
        .update({
          titol:      titol.trim(),
          import:     importNum,
          pagador_id: pagadorId,
          categoria,
          data:       data.toISOString().slice(0, 10),
          nota:       nota.trim() || null,
        })
        .eq('id', eid!)

      if (updateError) {
        setSaving(false)
        Alert.alert('Error', updateError.message)
        return
      }

      await supabase.from('despesa_parts').delete().eq('despesa_id', eid!)

      const { error: partsError } = await supabase.from('despesa_parts').insert(
        partsPayload.map(p => ({ ...p, despesa_id: eid! }))
      )

      setSaving(false)
      if (partsError) { Alert.alert('Error', partsError.message); return }
      router.back()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    // Insert expense
    const { data: despesa, error: despesaError } = await supabase
      .from('despeses_compartides')
      .insert({
        colla_id:   collaId,
        titol:      titol.trim(),
        import:     importNum,
        pagador_id: pagadorId,
        categoria,
        data:       data.toISOString().slice(0, 10),
        nota:       nota.trim() || null,
        created_by: user?.id,
      })
      .select('id')
      .single()

    if (despesaError || !despesa) {
      setSaving(false)
      Alert.alert('Error', despesaError?.message ?? 'Error desconegut')
      return
    }

    const { error: partsError } = await supabase
      .from('despesa_parts')
      .insert(partsPayload.map(p => ({ ...p, despesa_id: despesa.id })))

    setSaving(false)

    if (partsError) {
      await supabase.from('despeses_compartides').delete().eq('id', despesa.id)
      Alert.alert('Error', partsError.message)
      return
    }

    router.back()
  }

  if (loadingMembres) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={isEdit ? 'Editar despesa' : 'Nova despesa'} />
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      </SafeAreaView>
    )
  }

  const importNum = parseFloat(importVal.replace(',', '.'))
  const shareAmt  = previewShare()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={isEdit ? 'Editar despesa' : 'Nova despesa'} />

      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Títol */}
        <View style={styles.field}>
          <Text style={styles.label}>Títol *</Text>
          <TextInput
            style={styles.input}
            value={titol}
            onChangeText={setTitol}
            placeholder="Sopar, taxi, hotel..."
            autoFocus
          />
        </View>

        {/* Import */}
        <View style={styles.field}>
          <Text style={styles.label}>Import *</Text>
          <View style={styles.importRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={importVal}
              onChangeText={setImportVal}
              placeholder="0,00"
              keyboardType="decimal-pad"
            />
            <View style={styles.currency}>
              <Text style={styles.currencyText}>€</Text>
            </View>
          </View>
        </View>

        {/* Categoria */}
        <View style={styles.field}>
          <Text style={styles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.screenH }}>
            <View style={styles.catRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catBtn, categoria === cat.key && styles.catBtnActive]}
                  onPress={() => setCategoria(cat.key)}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={[styles.catLabel, categoria === cat.key && styles.catLabelActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Data */}
        <View style={styles.field}>
          <Text style={styles.label}>Data</Text>
          <DatePicker value={data} onChange={setData} />
        </View>

        {/* Qui ha pagat */}
        <View style={styles.field}>
          <Text style={styles.label}>Qui ha pagat *</Text>
          <View style={styles.memberGrid}>
            {membres.map(m => (
              <TouchableOpacity
                key={m.user_id}
                style={[styles.memberBtn, pagadorId === m.user_id && styles.memberBtnActive]}
                onPress={() => setPagadorId(m.user_id)}
              >
                <Avatar name={`${m.nom} ${m.cognoms}`} uri={m.avatar_url} size="sm" />
                <Text style={[styles.memberName, pagadorId === m.user_id && styles.memberNameActive]} numberOfLines={1}>
                  {nomCurt(m)}
                  {m.user_id === myId ? ' (tu)' : ''}
                </Text>
                {pagadorId === m.user_id && <Text style={styles.memberCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Participants */}
        <View style={styles.field}>
          <View style={styles.fieldHeader}>
            <Text style={styles.label}>Per a qui *</Text>
            <TouchableOpacity onPress={() => setParticipants(new Set(membres.map(m => m.user_id)))}>
              <Text style={styles.selectAll}>Tots</Text>
            </TouchableOpacity>
          </View>

          {/* Split mode toggle */}
          <View style={styles.splitToggle}>
            <TouchableOpacity
              style={[styles.splitBtn, splitMode === 'equal' && styles.splitBtnActive]}
              onPress={() => setSplitMode('equal')}
            >
              <Text style={[styles.splitBtnText, splitMode === 'equal' && styles.splitBtnTextActive]}>Parts iguals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.splitBtn, splitMode === 'custom' && styles.splitBtnActive]}
              onPress={() => setSplitMode('custom')}
            >
              <Text style={[styles.splitBtnText, splitMode === 'custom' && styles.splitBtnTextActive]}>Pesos custom</Text>
            </TouchableOpacity>
          </View>

          {membres.map(m => {
            const selected = participants.has(m.user_id)
            const perPerson = selected && !isNaN(importNum) && importNum > 0
              ? (splitMode === 'equal'
                ? importNum / participants.size
                : importNum * (parseFloat(customPesos[m.user_id] ?? '1') || 0)
                    / ([...participants].reduce((s, uid) => s + (parseFloat(customPesos[uid] ?? '1') || 0), 0))
                )
              : null

            return (
              <View key={m.user_id} style={styles.participantRow}>
                <TouchableOpacity
                  style={[styles.participantCheck, selected && styles.participantCheckSelected]}
                  onPress={() => toggleParticipant(m.user_id)}
                >
                  {selected && <Text style={styles.participantCheckMark}>✓</Text>}
                </TouchableOpacity>

                <Avatar name={`${m.nom} ${m.cognoms}`} uri={m.avatar_url} size="sm" />

                <Text style={[styles.participantName, !selected && styles.participantNameDisabled]} numberOfLines={1}>
                  {nomCurt(m)}{m.user_id === myId ? ' (tu)' : ''}
                </Text>

                {splitMode === 'custom' && selected && (
                  <TextInput
                    style={styles.pesoInput}
                    value={customPesos[m.user_id] ?? '1'}
                    onChangeText={v => setCustomPesos(prev => ({ ...prev, [m.user_id]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="1"
                  />
                )}

                {perPerson !== null && (
                  <Text style={styles.participantShare}>
                    {perPerson.toFixed(2).replace('.', ',')} €
                  </Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Nota */}
        <View style={styles.field}>
          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput
            style={[styles.input, styles.notaInput]}
            value={nota}
            onChangeText={setNota}
            placeholder="Algun detall addicional..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Preview */}
        {!isNaN(importNum) && importNum > 0 && participants.size > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Resum</Text>
            <Text style={styles.previewText}>
              {membres.find(m => m.user_id === pagadorId)
                ? `${nomCurt(membres.find(m => m.user_id === pagadorId)!)} paga ${importNum.toFixed(2).replace('.', ',')} €`
                : '—'
              }
            </Text>
            <Text style={styles.previewText}>
              Repartit entre {participants.size} persones
            </Text>
            {splitMode === 'equal' && (
              <Text style={styles.previewShare}>
                ≈ {shareAmt.toFixed(2).replace('.', ',')} € per persona
              </Text>
            )}
          </View>
        )}

        <Button
          label={isEdit ? 'Guardar canvis' : 'Afegir despesa'}
          size="lg"
          loading={saving}
          onPress={handleSave}
          style={{ marginTop: spacing[2] }}
        />

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.gray[50] },
  form:  { padding: spacing.screenH, gap: spacing[4] },

  field:       { gap: spacing[2] },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:       { ...typography.label, color: colors.gray[700] },
  selectAll:   { ...typography.caption, color: colors.primary[600], fontWeight: '600' },

  input:       { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  notaInput:   { minHeight: 80, textAlignVertical: 'top' },

  importRow:   { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  currency:    { backgroundColor: colors.gray[100], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  currencyText:{ ...typography.body, color: colors.gray[600], fontWeight: '700' },

  catRow:      { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing.screenH },
  catBtn:      { alignItems: 'center', gap: spacing[1], backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: spacing[3], paddingHorizontal: spacing[3], minWidth: 80, borderWidth: 1.5, borderColor: 'transparent', ...shadows.sm },
  catBtnActive:{ borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  catIcon:     { fontSize: 24 },
  catLabel:    { ...typography.caption, color: colors.gray[600] },
  catLabelActive: { color: colors.primary[600], fontWeight: '700' },

  memberGrid:     { gap: spacing[2] },
  memberBtn:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], borderWidth: 1.5, borderColor: 'transparent', ...shadows.sm },
  memberBtnActive:{ borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  memberName:     { ...typography.body, color: colors.gray[700], flex: 1 },
  memberNameActive:{ color: colors.primary[700], fontWeight: '600' },
  memberCheck:    { color: colors.primary[600], fontSize: 16 },

  splitToggle:       { flexDirection: 'row', backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3, alignSelf: 'flex-start', marginBottom: spacing[2] },
  splitBtn:          { paddingHorizontal: spacing[4], paddingVertical: 6, borderRadius: radius.sm - 2 },
  splitBtnActive:    { backgroundColor: colors.white, ...shadows.sm },
  splitBtnText:      { fontSize: 13, fontWeight: '600', color: colors.gray[500] },
  splitBtnTextActive:{ color: colors.gray[900] },

  participantRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[50] },
  participantCheck:        { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.gray[300], justifyContent: 'center', alignItems: 'center' },
  participantCheckSelected:{ backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  participantCheckMark:    { color: colors.white, fontSize: 13, fontWeight: '700' },
  participantName:         { ...typography.body, color: colors.gray[800], flex: 1 },
  participantNameDisabled: { color: colors.gray[400] },
  participantShare:        { ...typography.caption, color: colors.gray[500], fontWeight: '600' },
  pesoInput:               { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 6, width: 56, textAlign: 'center', ...typography.caption, color: colors.gray[900] },

  preview:      { backgroundColor: colors.primary[50], borderRadius: radius.md, padding: spacing[4], gap: spacing[1], borderLeftWidth: 3, borderLeftColor: colors.primary[400] },
  previewTitle: { ...typography.label, color: colors.primary[700] },
  previewText:  { ...typography.body, color: colors.primary[800] },
  previewShare: { ...typography.h3, color: colors.primary[700], fontWeight: '700', marginTop: spacing[1] },
})
