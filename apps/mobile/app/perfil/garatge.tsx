import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'

const CAR_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

type GarageEntry = {
  id: string
  model: string | null
  color: string
  places_totals: number
}

export default function GaratgeScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const [cars, setCars] = useState<GarageEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [model, setModel] = useState('')
  const [color, setColor] = useState(CAR_PALETTE[0])
  const [places, setPlaces] = useState(3)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('user_garatge')
      .select('id, model, color, places_totals')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setCars(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setModel('')
    setColor(CAR_PALETTE[0])
    setPlaces(3)
    setShowModal(true)
  }

  async function handleSave() {
    if (!profile?.id) return
    setSaving(true)
    try {
      const { error } = await supabase.from('user_garatge').insert({
        user_id: profile.id,
        model: model.trim() || null,
        color,
        places_totals: places,
      })
      if (error) throw error
      setShowModal(false)
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Eliminar cotxe', 'Vols eliminar aquest cotxe del garatge?', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('user_garatge').delete().eq('id', id)
        load()
      }},
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>El meu garatge 🚗</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Afegir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
        ) : cars.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🚗</Text>
            <Text style={styles.emptyTitle}>Cap cotxe desat</Text>
            <Text style={styles.emptySub}>Desa els teus cotxes per afegir-los ràpidament als events</Text>
            <Button label="Afegir primer cotxe" size="md" onPress={openAdd} style={{ marginTop: spacing[4] }} />
          </View>
        ) : (
          cars.map(car => (
            <View key={car.id} style={[styles.card, { borderLeftColor: car.color, borderLeftWidth: 5 }]}>
              <View style={styles.cardInfo}>
                <Text style={styles.carModel}>{car.model || 'Cotxe sense nom'}</Text>
                <Text style={styles.carMeta}>{car.places_totals} places · <Text style={{ color: car.color }}>●</Text></Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(car.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger[400]} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nou cotxe</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Model (opcional)</Text>
              <TextInput
                style={styles.input}
                value={model}
                onChangeText={setModel}
                placeholder="Ex: Seat Ibiza, Volkswagen Golf..."
                placeholderTextColor={colors.gray[400]}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Places per a passatgers</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <TouchableOpacity key={n} style={[styles.placeBtn, places === n && styles.placeBtnOn]} onPress={() => setPlaces(n)}>
                    <Text style={[styles.placeBtnTxt, places === n && styles.placeBtnTxtOn]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.row}>
                {CAR_PALETTE.map(col => (
                  <TouchableOpacity key={col} style={[styles.colorDot, { backgroundColor: col }, color === col && styles.colorDotOn]} onPress={() => setColor(col)} />
                ))}
              </View>
            </View>

            <View style={styles.btns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
              <Button label="Desar" size="md" loading={saving} onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backBtn:      { marginRight: spacing[2] },
  topTitle:     { ...typography.h3, color: colors.gray[900], flex: 1 },
  addBtn:       { backgroundColor: colors.primary[600], borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  addBtnText:   { ...typography.caption, color: colors.white, fontWeight: '700' },

  list:         { padding: spacing.screenH, gap: spacing[3] },
  empty:        { alignItems: 'center', paddingTop: spacing[12], gap: spacing[2] },
  emptyEmoji:   { fontSize: 52 },
  emptyTitle:   { ...typography.h3, color: colors.gray[600] },
  emptySub:     { ...typography.bodySm, color: colors.gray[400], textAlign: 'center' },

  card:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', ...shadows.sm },
  cardInfo:     { flex: 1, gap: 4 },
  carModel:     { ...typography.body, color: colors.gray[900], fontWeight: '600' },
  carMeta:      { ...typography.bodySm, color: colors.gray[500] },
  deleteBtn:    { padding: spacing[2] },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[4] },
  modalTitle:   { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  field:        { gap: spacing[1] },
  fieldLabel:   { ...typography.label, color: colors.gray[500], marginBottom: spacing[1] },
  input:        { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: 10, ...typography.body, color: colors.gray[900] },
  row:          { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  placeBtn:     { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  placeBtnOn:   { backgroundColor: colors.primary[600] },
  placeBtnTxt:  { fontSize: 18, fontWeight: '700', color: colors.gray[600] },
  placeBtnTxtOn:{ color: colors.white },
  colorDot:     { width: 32, height: 32, borderRadius: 16 },
  colorDotOn:   { borderWidth: 3, borderColor: colors.gray[800] },
  btns:         { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
})
