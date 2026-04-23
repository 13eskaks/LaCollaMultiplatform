import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

type ScreenView = 'list' | 'detail' | 'create'

export default function ActesScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [actes, setActes] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [viewMode, setViewMode] = useState<ScreenView>('list')
  const [loading, setLoading] = useState(true)

  // Create form state
  const [titol, setTitol] = useState('')
  const [contingut, setContingut] = useState('')
  const [dataActa, setDataActa] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadActes() }, [collaId])

  async function loadActes() {
    setLoading(true)
    const { data } = await supabase
      .from('actes')
      .select('*')
      .eq('colla_id', collaId)
      .order('data_acta', { ascending: false })
    setActes(data ?? [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!titol.trim() || !contingut.trim()) {
      Alert.alert('Error', 'El títol i el contingut són obligatoris')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('actes').insert({
      colla_id: collaId,
      autor_id: user?.id,
      titol: titol.trim(),
      contingut: contingut.trim(),
      data_acta: dataActa,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setTitol('')
      setContingut('')
      setViewMode('list')
      loadActes()
    }
  }

  async function handleDelete(acta: any) {
    Alert.alert('Eliminar acta', 'Estàs segur/a?', [
      { text: 'Cancel·lar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('actes').delete().eq('id', acta.id)
          setActes(prev => prev.filter(a => a.id !== acta.id))
          setViewMode('list')
        },
      },
    ])
  }

  if (viewMode === 'create') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Nova acta" leftAction={{ label: '←', onPress: () => setViewMode('list') }} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>Data de la reunió</Text>
            <TextInput
              style={styles.input}
              value={dataActa}
              onChangeText={setDataActa}
              placeholder="AAAA-MM-DD"
            />
            <Text style={[styles.label, { marginTop: spacing[3] }]}>Títol</Text>
            <TextInput
              style={styles.input}
              value={titol}
              onChangeText={setTitol}
              placeholder="Reunió ordinària de..."
            />
            <Text style={[styles.label, { marginTop: spacing[3] }]}>Contingut</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={contingut}
              onChangeText={setContingut}
              placeholder="Acords, punts tractats..."
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
          </View>
          <Button label="Crear acta" size="lg" loading={saving} onPress={handleCreate} />
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (viewMode === 'detail' && selected) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title={selected.titol}
          leftAction={{ label: '←', onPress: () => setViewMode('list') }}
          rightAction={isComissioActiva() ? { label: 'Eliminar', onPress: () => handleDelete(selected) } : undefined}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.actaDate}>
            {new Date(selected.data_acta).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.card}>
            <Text style={styles.contingut}>{selected.contingut}</Text>
          </View>
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Actes" />

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : actes.length === 0 ? (
        <EmptyState icon="🏛" title="Cap acta encara" subtitle="Crea el primer registre de reunió" />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {actes.map(acta => (
            <TouchableOpacity
              key={acta.id}
              style={styles.actaCard}
              onPress={() => { setSelected(acta); setViewMode('detail') }}
            >
              <Text style={styles.actaTitol}>{acta.titol}</Text>
              <Text style={styles.actaDateSmall}>
                {new Date(acta.data_acta).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <Text style={styles.actaPreview} numberOfLines={2}>{acta.contingut}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {isComissioActiva() && (
        <TouchableOpacity style={styles.fab} onPress={() => setViewMode('create')}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  content:      { padding: spacing.screenH, gap: spacing[3] },
  listContent:  { padding: spacing.screenH, gap: spacing[3] },
  card:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], ...shadows.sm },
  label:        { ...typography.label, color: colors.gray[500], marginBottom: spacing[1] },
  input:        { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900], backgroundColor: colors.white },
  textArea:     { height: 200, paddingTop: spacing[3] },
  actaCard:     { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], ...shadows.sm, gap: spacing[1] },
  actaTitol:    { ...typography.h3, color: colors.gray[900] },
  actaDate:     { ...typography.body, color: colors.primary[600], fontWeight: '600', textAlign: 'center' },
  actaDateSmall:{ ...typography.caption, color: colors.primary[600] },
  actaPreview:  { ...typography.bodySm, color: colors.gray[500], lineHeight: 20 },
  contingut:    { ...typography.bodyLg, color: colors.gray[700], lineHeight: 26 },
  deleteText:   { ...typography.bodySm, color: colors.danger[500] },
  fab:          { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText:      { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
