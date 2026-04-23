import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function CreateEventScreen() {
  const router = useRouter()
  const { collaActiva } = useCollaStore()

  const [titol, setTitol] = useState('')
  const [descripcio, setDescripcio] = useState('')
  const [lloc, setLloc] = useState('')
  const [dataInici, setDataInici] = useState('')
  const [horaInici, setHoraInici] = useState('')
  const [dataFi, setDataFi] = useState('')
  const [horaFi, setHoraFi] = useState('')
  const [permRsvp, setPermRsvp] = useState(true)
  const [permConvidats, setPermConvidats] = useState(false)
  const [limitPlaces, setLimitPlaces] = useState(false)
  const [numPlaces, setNumPlaces] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!titol.trim()) e.titol = 'El títol és obligatori'
    if (!dataInici.trim()) e.dataInici = 'La data és obligatòria'
    if (dataInici && !/^\d{4}-\d{2}-\d{2}$/.test(dataInici)) e.dataInici = 'Format: AAAA-MM-DD'
    if (horaInici && !/^\d{2}:\d{2}$/.test(horaInici)) e.horaInici = 'Format: HH:MM'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate() {
    if (!validate() || !collaActiva) return
    setLoading(true)

    try {
      const datetimeInici = horaInici
        ? `${dataInici}T${horaInici}:00`
        : `${dataInici}T00:00:00`
      const datetimeFi = dataFi
        ? `${dataFi}T${horaFi || '23:59'}:00`
        : null

      const { data: event, error } = await supabase.from('events').insert({
        colla_id: collaActiva.id,
        titol: titol.trim(),
        descripcio: descripcio.trim() || null,
        lloc: lloc.trim() || null,
        data_inici: datetimeInici,
        data_fi: datetimeFi,
        permet_rsvp: permRsvp,
        permet_convidats_externs: permConvidats,
        limit_places: limitPlaces && numPlaces ? parseInt(numPlaces) : null,
        notificar_membres: notificar,
      }).select().single()

      if (error || !event) throw error ?? new Error('Error creant l\'event')

      router.replace(`/event/${event.id}`)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Button label="✕" variant="ghost" size="sm" onPress={() => router.back()} style={styles.closeBtn} />
        <Text style={styles.headerTitle}>Nou event</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Input
          label="Títol *"
          value={titol}
          onChangeText={setTitol}
          placeholder="Nom de l'event"
          error={errors.titol}
        />

        <Input
          label="Descripció"
          value={descripcio}
          onChangeText={setDescripcio}
          placeholder="Detalls de l'event..."
          multiline
          style={{ height: 100 }}
        />

        <Input
          label="Lloc"
          value={lloc}
          onChangeText={setLloc}
          placeholder="Ex: Casal faller, Plaça Major..."
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Data inici *"
              value={dataInici}
              onChangeText={setDataInici}
              placeholder="2026-06-15"
              error={errors.dataInici}
              keyboardType="numeric"
            />
          </View>
          <View style={{ width: spacing[3] }} />
          <View style={{ flex: 1 }}>
            <Input
              label="Hora inici"
              value={horaInici}
              onChangeText={setHoraInici}
              placeholder="20:00"
              error={errors.horaInici}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Data fi (opcional)"
              value={dataFi}
              onChangeText={setDataFi}
              placeholder="2026-06-15"
              keyboardType="numeric"
            />
          </View>
          <View style={{ width: spacing[3] }} />
          <View style={{ flex: 1 }}>
            <Input
              label="Hora fi"
              value={horaFi}
              onChangeText={setHoraFi}
              placeholder="23:00"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Opcions</Text>

        {[
          { label: 'Permet confirmació d\'assistència (RSVP)', value: permRsvp, onChange: setPermRsvp },
          { label: 'Permet invitats externs', value: permConvidats, onChange: setPermConvidats },
          { label: 'Limitar nombre de places', value: limitPlaces, onChange: setLimitPlaces },
          { label: 'Notificar als membres', value: notificar, onChange: setNotificar },
        ].map(({ label, value, onChange }) => (
          <View key={label} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary[600] }} />
          </View>
        ))}

        {limitPlaces && (
          <Input
            label="Nombre màxim de places"
            value={numPlaces}
            onChangeText={setNumPlaces}
            placeholder="Ex: 30"
            keyboardType="number-pad"
          />
        )}

        <Button
          label="Crear event 🎉"
          size="lg"
          loading={loading}
          onPress={handleCreate}
          style={{ marginTop: spacing[4] }}
        />

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.white },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  closeBtn:     { width: 44 },
  headerTitle:  { ...typography.h3, color: colors.gray[900] },
  scroll:       { flex: 1 },
  form:         { padding: spacing.screenH, gap: spacing[4] },
  row:          { flexDirection: 'row' },
  sectionLabel: { ...typography.label, color: colors.gray[500], marginTop: spacing[2] },
  toggle:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel:  { ...typography.body, color: colors.gray[700], flex: 1, paddingRight: spacing[4] },
})
