import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, Linking, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import WebView from 'react-native-webview'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { LocationInput } from '@/components/ui/LocationInput'
import type { LocVal } from '@/components/ui/LocationInput'

function buildMapHtml(llocs: any[]): string {
  const pts = llocs.filter(l => l.lat && l.lng)
  const center = pts.length > 0 ? [pts[0].lat, pts[0].lng] : [41.3851, 2.1734]
  const markers = pts.map(l =>
    `L.marker([${l.lat},${l.lng}]).addTo(map)
      .bindPopup(${JSON.stringify('<b>' + l.nom + '</b>' + (l.adreca ? '<br>' + l.adreca : ''))})
      .bindTooltip(${JSON.stringify(l.nom)}, {permanent:true, direction:'top', offset:[-16,-10], className:'lloc-label'});`
  ).join('\n')
  const fitBounds = pts.length > 1
    ? `const grp=L.featureGroup([${pts.map(l => `L.marker([${l.lat},${l.lng}])`).join(',')}]);map.fitBounds(grp.getBounds().pad(0.3));`
    : ''
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
body{margin:0;}
#map{height:100vh;}
.lloc-label {
  background: rgba(255,255,255,0.95);
  border: none;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  color: #1a1a2e;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  white-space: nowrap;
}
.lloc-label::before { display: none; }
</style>
</head><body><div id="map"></div><script>
const map=L.map('map').setView([${center[0]},${center[1]}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
${markers}
${fitBounds}
</script></body></html>`
}

export default function LlocsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [llocs, setLlocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)

  // Form
  const [nom, setNom] = useState('')
  const [adreca, setAdreca] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [nomError, setNomError] = useState('')

  useFocusEffect(useCallback(() => { loadLlocs() }, [collaId]))

  async function loadLlocs() {
    setLoading(true)
    const { data } = await supabase
      .from('colla_llocs').select('*').eq('colla_id', collaId).order('nom', { ascending: true })
    setLlocs(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setEditItem(null); setNom(''); setAdreca(''); setLat(null); setLng(null); setNomError('')
    setShowFormModal(true)
  }

  function openEdit(item: any) {
    setEditItem(item); setNom(item.nom); setAdreca(item.adreca ?? '')
    setLat(item.lat ?? null); setLng(item.lng ?? null); setNomError('')
    setShowFormModal(true)
  }

  async function handleSave() {
    if (!nom.trim()) { setNomError('El nom és obligatori'); return }
    setSaving(true)
    const payload = { colla_id: collaId, nom: nom.trim(), adreca: adreca.trim() || null, lat, lng }
    if (editItem) {
      await supabase.from('colla_llocs').update(payload).eq('id', editItem.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('colla_llocs').insert({ ...payload, created_by: user?.id })
    }
    setSaving(false); setShowFormModal(false); loadLlocs()
  }

  async function handleDelete(item: any) {
    Alert.alert('Eliminar lloc', `Eliminar "${item.nom}"?`, [
      { text: 'Cancel·lar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('colla_llocs').delete().eq('id', item.id)
          setLlocs(prev => prev.filter(l => l.id !== item.id))
        },
      },
    ])
  }

  function openNativeMaps(item: any) {
    if (!item.lat || !item.lng) return
    const label = encodeURIComponent(item.nom)
    const url = Platform.OS === 'ios'
      ? `maps://?q=${label}&ll=${item.lat},${item.lng}`
      : `geo:${item.lat},${item.lng}?q=${label}`
    Linking.openURL(url)
  }

  const llocsAmbCoords = llocs.filter(l => l.lat && l.lng)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Llocs de la colla"
        rightAction={isComissioActiva() ? { label: '+ Afegir', onPress: openAdd } : undefined}
      />

      {/* Map button */}
      {llocsAmbCoords.length > 0 && (
        <TouchableOpacity style={styles.mapBtn} onPress={() => setShowMapModal(true)}>
          <Text style={styles.mapBtnText}>🗺 Veure tots al mapa ({llocsAmbCoords.length})</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : llocs.length === 0 ? (
        <EmptyState
          icon="📍"
          title="Cap lloc guardat"
          subtitle={isComissioActiva() ? 'Afegeix llocs habituals de la colla' : 'La comissió encara no ha afegit llocs'}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {llocs.map(lloc => (
            <View key={lloc.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => openNativeMaps(lloc)}
                disabled={!lloc.lat}
              >
                <View style={styles.iconBox}>
                  <Text style={{ fontSize: 22 }}>📍</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.nom}>{lloc.nom}</Text>
                  {lloc.adreca ? <Text style={styles.adreca} numberOfLines={1}>{lloc.adreca}</Text> : null}
                  {lloc.lat ? <Text style={styles.mapLink}>🗺 Veure al mapa</Text> : null}
                </View>
              </TouchableOpacity>
              {isComissioActiva() && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(lloc)}>
                    <Text>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(lloc)}>
                    <Text>🗑</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* Form modal */}
      <Modal visible={showFormModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editItem ? 'Editar lloc' : 'Nou lloc'}</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput
                style={[styles.input, !!nomError && styles.inputError]}
                value={nom}
                onChangeText={t => { setNom(t); setNomError('') }}
                placeholder="Ex: Casal Faller, Casa Mario..."
                placeholderTextColor={colors.gray[400]}
              />
              {!!nomError && <Text style={styles.errorText}>{nomError}</Text>}
            </View>

            <LocationInput
              label="Adreça"
              value={adreca}
              onChangeText={setAdreca}
              onSelect={(loc: LocVal) => { setAdreca(loc.nom); setLat(loc.lat); setLng(loc.lng) }}
              placeholder="🔍 Busca l'adreça..."
            />

            {lat && lng && (
              <Text style={styles.coordsOk}>✓ Coordenades obtingudes ({lat.toFixed(4)}, {lng.toFixed(4)})</Text>
            )}

            <View style={styles.modalBtns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowFormModal(false)} style={{ flex: 1 }} />
              <Button label={editItem ? 'Guardar' : 'Afegir'} size="md" loading={saving} onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Map modal */}
      <Modal visible={showMapModal} animationType="slide">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={styles.mapClose}>✕ Tancar</Text>
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Llocs de la colla</Text>
            <View style={{ width: 80 }} />
          </View>
          <WebView
            style={{ flex: 1 }}
            source={{ html: buildMapHtml(llocs) }}
            originWhitelist={['*']}
            javaScriptEnabled
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  mapBtn:      { marginHorizontal: spacing.screenH, marginVertical: spacing[3], backgroundColor: colors.primary[600], borderRadius: radius.md, paddingVertical: spacing[3], flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  mapBtnText:  { color: colors.white, fontWeight: '600', fontSize: 15 },
  list:        { padding: spacing.screenH, gap: spacing[3] },
  card:        { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  cardMain:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  iconBox:     { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primary[50], justifyContent: 'center', alignItems: 'center' },
  nom:         { ...typography.h3, color: colors.gray[900] },
  adreca:      { ...typography.bodySm, color: colors.gray[500] },
  mapLink:     { ...typography.caption, color: colors.primary[600], fontWeight: '600' },
  actions:     { flexDirection: 'row', paddingRight: spacing[2] },
  actionBtn:   { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:       { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[4] },
  modalTitle:  { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  field:       { gap: spacing[1] },
  fieldLabel:  { ...typography.label, color: colors.gray[500] },
  input:       { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  inputError:  { borderColor: '#ef4444' },
  errorText:   { ...typography.caption, color: '#ef4444' },
  coordsOk:    { ...typography.caption, color: '#16a34a', fontWeight: '600' },
  modalBtns:   { flexDirection: 'row', gap: spacing[2] },
  mapHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100], backgroundColor: colors.white },
  mapClose:    { ...typography.body, color: colors.primary[600], fontWeight: '600' },
  mapTitle:    { ...typography.h3, color: colors.gray[900] },
})
