import { View, Text, ScrollView, Switch, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function CollaSettingsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Config state
  const [aprovacioManual, setAprovacioManual] = useState(true)
  const [perfilPublic, setPerfilPublic] = useState(true)
  const [quiCreaEvents, setQuiCreaEvents] = useState<'membres' | 'comissio'>('membres')
  const [quiCreaVotacions, setQuiCreaVotacions] = useState<'membres' | 'comissio'>('membres')
  const [quiCreaFils, setQuiCreaFils] = useState<'membres' | 'comissio'>('membres')

  useEffect(() => { loadConfig() }, [collaId])

  async function loadConfig() {
    const { data } = await supabase.from('colla_config').select('*').eq('colla_id', collaId).single()
    if (data) {
      setConfig(data)
      setAprovacioManual(data.aprovacio_manual ?? true)
      setPerfilPublic(data.perfil_public ?? true)
      setQuiCreaEvents(data.qui_pot_crear_events ?? 'membres')
      setQuiCreaVotacions(data.qui_pot_crear_votacions ?? 'membres')
      setQuiCreaFils(data.qui_pot_crear_fils ?? 'membres')
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('colla_config').update({
      aprovacio_manual: aprovacioManual,
      perfil_public: perfilPublic,
      qui_pot_crear_events: quiCreaEvents,
      qui_pot_crear_votacions: quiCreaVotacions,
      qui_pot_crear_fils: quiCreaFils,
    }).eq('colla_id', collaId)

    if (error) Alert.alert('Error', error.message)
    else router.back()
    setSaving(false)
  }

  const SegmentControl = ({ value, onChange }: { value: string; onChange: (v: any) => void }) => (
    <View style={styles.segment}>
      {(['membres', 'comissio'] as const).map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.segBtn, value === opt && styles.segBtnActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.segText, value === opt && styles.segTextActive]}>
            {opt === 'membres' ? 'Tots els membres' : 'Només comissió'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Configuració de la colla" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Membres</Text>
        <View style={styles.card}>
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>Aprovació manual de nous membres</Text>
            <Switch value={aprovacioManual} onValueChange={setAprovacioManual} trackColor={{ true: colors.primary[600] }} />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>Perfil de colla públic</Text>
            <Switch value={perfilPublic} onValueChange={setPerfilPublic} trackColor={{ true: colors.primary[600] }} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Permisos de contingut</Text>

        <Text style={styles.permLabel}>Qui pot crear events</Text>
        <SegmentControl value={quiCreaEvents} onChange={setQuiCreaEvents} />

        <Text style={styles.permLabel}>Qui pot crear votacions</Text>
        <SegmentControl value={quiCreaVotacions} onChange={setQuiCreaVotacions} />

        <Text style={styles.permLabel}>Qui pot crear fils al fòrum</Text>
        <SegmentControl value={quiCreaFils} onChange={setQuiCreaFils} />

        <Button label="Guardar canvis" size="lg" loading={saving} onPress={handleSave} style={{ marginTop: spacing[4] }} />

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  content:      { padding: spacing.screenH, gap: spacing[3] },
  sectionTitle: { ...typography.label, color: colors.gray[500] },
  card:         { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  toggle:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  toggleLabel:  { ...typography.body, color: colors.gray[700], flex: 1, paddingRight: spacing[4] },
  divider:      { height: 1, backgroundColor: colors.gray[100] },
  permLabel:    { ...typography.body, color: colors.gray[700], fontWeight: '600' },
  segment:      { flexDirection: 'row', backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3, gap: 3 },
  segBtn:       { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.xs },
  segBtnActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  segText:      { fontSize: 13, color: colors.gray[500] },
  segTextActive:{ color: colors.gray[900], fontWeight: '700' },
})
