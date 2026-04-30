import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { useScreenCache } from '@/stores/screenCache'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { LocationInput } from '@/components/ui/LocationInput'
import type { LocVal } from '@/components/ui/LocationInput'
import { RichBodyEditor, uploadBlocks, blocksFromSaved, makeTextBlock } from '@/components/ui/RichBody'
import type { RichBlock, SavedBlock } from '@/components/ui/RichBody'

// Colors forbidden: #f59e0b (torn) and #7c3aed (acta)
const EVENT_COLORS = [
  '#2563eb',  // blue (default)
  '#16a34a',  // green
  '#dc2626',  // red
  '#0891b2',  // cyan
  '#be185d',  // rose
  '#0f766e',  // teal
  '#c2410c',  // burnt-orange
  '#374151',  // charcoal
]

export default function CreateEventScreen() {
  const router = useRouter()
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  const isEdit = !!eventId
  const { collaActiva } = useCollaStore()
  const screenCache = useScreenCache()

  const [titol, setTitol] = useState('')
  const [blocks, setBlocks] = useState<RichBlock[]>([makeTextBlock()])
  const [lloc, setLloc] = useState('')
  const [llocLat, setLlocLat] = useState<number | null>(null)
  const [llocLng, setLlocLng] = useState<number | null>(null)
  const [llocId, setLlocId] = useState<string | null>(null)
  const [dataInici, setDataInici] = useState<Date | null>(null)
  const [horaInici, setHoraInici] = useState<Date | null>(null)
  const [dataFi, setDataFi] = useState<Date | null>(null)
  const [horaFi, setHoraFi] = useState<Date | null>(null)
  const [permRsvp, setPermRsvp] = useState(true)
  const [permConvidats, setPermConvidats] = useState(false)
  const [visibleExtern, setVisibleExtern] = useState(false)
  const [limitPlaces, setLimitPlaces] = useState(false)
  const [numPlaces, setNumPlaces] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [color, setColor] = useState('#2563eb')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!eventId) return
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => {
      if (!data) return
      setTitol(data.titol ?? '')
      if (data.descripcio_blocks) setBlocks(blocksFromSaved(data.descripcio_blocks as SavedBlock[]))
      else if (data.descripcio) setBlocks([makeTextBlock(data.descripcio)])
      setLloc(data.lloc ?? '')
      setLlocLat(data.lloc_lat ?? null)
      setLlocLng(data.lloc_lng ?? null)
      setLlocId(data.lloc_id ?? null)
      if (data.data_inici) setDataInici(new Date(data.data_inici))
      if (data.data_inici) setHoraInici(new Date(data.data_inici))
      if (data.data_fi) setDataFi(new Date(data.data_fi))
      if (data.data_fi) setHoraFi(new Date(data.data_fi))
      setPermRsvp(data.permet_rsvp ?? true)
      setPermConvidats(data.permet_convidats_externs ?? false)
      setVisibleExtern(data.visible_extern ?? false)
      if (data.limit_places) { setLimitPlaces(true); setNumPlaces(String(data.limit_places)) }
      setColor(data.color ?? '#2563eb')
    })
  }, [eventId])

  function validate() {
    const e: Record<string, string> = {}
    if (!titol.trim()) e.titol = 'El títol és obligatori'
    if (!dataInici) e.dataInici = 'La data és obligatòria'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildDatetime(date: Date | null, time: Date | null, fallbackTime = '00:00'): string | null {
    if (!date) return null
    const d = date.toISOString().slice(0, 10)
    const t = time
      ? `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
      : fallbackTime
    return `${d}T${t}:00`
  }

  async function handleCreate() {
    if (!validate()) return
    setLoading(true)

    const payload = {
      titol: titol.trim(),
      descripcio: null as string | null,
      lloc: lloc.trim() || null,
      lloc_lat: llocLat,
      lloc_lng: llocLng,
      lloc_id: llocId,
      data_inici: buildDatetime(dataInici, horaInici, '00:00'),
      data_fi: buildDatetime(dataFi, horaFi, '23:59'),
      permet_rsvp: permRsvp,
      permet_convidats_externs: permConvidats,
      visible_extern: visibleExtern,
      limit_places: limitPlaces && numPlaces ? parseInt(numPlaces) : null,
      color,
    }

    try {
      if (isEdit) {
        const { data: { user } } = await supabase.auth.getUser()
        const saved = await uploadBlocks(blocks, 'event', eventId!)
        const { error } = await supabase.from('events').update({ ...payload, descripcio_blocks: saved }).eq('id', eventId)
        if (error) throw error
        screenCache.invalidateAll()
        router.back()
      } else {
        if (!collaActiva) return
        const { data: event, error } = await supabase.from('events').insert({
          ...payload,
          colla_id: collaActiva.id,
          notificar_membres: notificar,
        }).select().single()
        if (error || !event) throw error ?? new Error('Error creant l\'event')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('event_rsvp').insert({ event_id: event.id, user_id: user.id, estat: 'apuntat' })
          const saved = await uploadBlocks(blocks, 'event', event.id)
          if (saved.length > 0) await supabase.from('events').update({ descripcio_blocks: saved }).eq('id', event.id)
        }
        screenCache.invalidateAll()
        router.replace(`/event/${event.id}`)
      }
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
        <Text style={styles.headerTitle}>{isEdit ? 'Editar event' : 'Nou event'}</Text>
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

        <View style={{ gap: spacing[1] }}>
          <Text style={{ ...typography.label, color: colors.gray[500] }}>Descripció</Text>
          <RichBodyEditor blocks={blocks} onChange={setBlocks} placeholder="Detalls de l'event..." />
        </View>

        <LocationInput
          label="Lloc"
          value={lloc}
          onChangeText={t => { setLloc(t); setLlocLat(null); setLlocLng(null); setLlocId(null) }}
          onSelect={(loc: LocVal) => { setLloc(loc.nom); setLlocLat(loc.lat); setLlocLng(loc.lng); setLlocId(loc.lloc_id ?? null) }}
          placeholder="Ex: Casal faller, Plaça Major..."
          collaId={collaActiva?.id}
        />

        <View style={{ gap: spacing[2] }}>
          <Text style={{ ...typography.label, color: colors.gray[500] }}>Color</Text>
          <View style={{ flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' }}>
            {EVENT_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: c,
                  justifyContent: 'center', alignItems: 'center',
                  borderWidth: color === c ? 3 : 0,
                  borderColor: colors.white,
                  elevation: 3,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.25, shadowRadius: 2,
                }}
              >
                {color === c && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <DatePicker
              label="Data inici *"
              value={dataInici}
              onChange={setDataInici}
              error={errors.dataInici}
            />
          </View>
          <View style={{ width: spacing[3] }} />
          <View style={{ flex: 1 }}>
            <DatePicker
              label="Hora inici"
              value={horaInici}
              onChange={setHoraInici}
              mode="time"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <DatePicker
              label="Data fi (opcional)"
              value={dataFi}
              onChange={setDataFi}
              minimumDate={dataInici ?? undefined}
            />
          </View>
          <View style={{ width: spacing[3] }} />
          <View style={{ flex: 1 }}>
            <DatePicker
              label="Hora fi"
              value={horaFi}
              onChange={setHoraFi}
              mode="time"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Opcions</Text>

        {[
          { label: 'Permet confirmació d\'assistència (RSVP)', value: permRsvp, onChange: setPermRsvp },
          { label: 'Permet invitats externs', value: permConvidats, onChange: setPermConvidats },
          { label: '✨ Visible a la landing pública', value: visibleExtern, onChange: setVisibleExtern },
          { label: 'Limitar nombre de places', value: limitPlaces, onChange: setLimitPlaces },
          ...(!isEdit ? [{ label: 'Notificar als membres', value: notificar, onChange: setNotificar }] : []),
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
          label={isEdit ? 'Guardar canvis ✏️' : 'Crear event 🎉'}
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
