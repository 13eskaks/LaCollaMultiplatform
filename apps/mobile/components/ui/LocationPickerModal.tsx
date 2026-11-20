import { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography, spacing, radius } from '@/theme'
import { HtmlView } from './HtmlView'

interface Props {
  visible: boolean
  initialLat: number | null
  initialLon: number | null
  onClose: () => void
  onConfirm: (lat: number, lon: number, localitat?: string, comarca?: string) => void
}

function mapHtml(lat: number, lon: number, hasPoint: boolean) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body{margin:0;height:100%}#map{height:100%}</style>
</head><body><div id="map"></div><script>
var map=L.map('map').setView([${lat},${lon}],${hasPoint ? 15 : 8});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
var marker=${hasPoint ? `L.marker([${lat},${lon}]).addTo(map)` : 'null'};
map.on('click',function(e){
  if(marker){marker.setLatLng(e.latlng)}else{marker=L.marker(e.latlng).addTo(map)}
  send(JSON.stringify({lat:e.latlng.lat,lon:e.latlng.lng}));
});
</script></body></html>`
}

async function reverseGeocode(lat: number, lon: number): Promise<{ localitat?: string; comarca?: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=ca`,
      { headers: { 'User-Agent': 'LaCollaApp/1.0' } },
    )
    const d = await res.json()
    const a = d?.address ?? {}
    return {
      localitat: a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet,
      comarca: a.county ?? a.state_district,
    }
  } catch {
    return {}
  }
}

/** Selector d'ubicació: toca el mapa per marcar el punt de la colla. */
export function LocationPickerModal({ visible, initialLat, initialLon, onClose, onConfirm }: Props) {
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) setPoint(initialLat != null && initialLon != null ? { lat: initialLat, lon: initialLon } : null)
  }, [visible, initialLat, initialLon])

  const hasInitial = initialLat != null && initialLon != null
  // Centre per defecte: País Valencià
  const html = mapHtml(hasInitial ? initialLat! : 39.47, hasInitial ? initialLon! : -0.38, hasInitial)

  async function confirm() {
    if (!point) return
    setSaving(true)
    const { localitat, comarca } = await reverseGeocode(point.lat, point.lon)
    setSaving(false)
    onConfirm(point.lat, point.lon, localitat, comarca)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>✕ Tancar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Ubicació</Text>
          <View style={{ width: 70 }} />
        </View>
        {visible && (
          <HtmlView
            style={{ flex: 1 }}
            html={html}
            onMessage={d => {
              try {
                const p = JSON.parse(d)
                if (typeof p.lat === 'number' && typeof p.lon === 'number') setPoint(p)
              } catch { /* ignore */ }
            }}
          />
        )}
        <View style={styles.footer}>
          <Text style={styles.hint}>
            {point ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` : 'Toca el mapa per marcar la ubicació'}
          </Text>
          <TouchableOpacity
            style={[styles.btn, (!point || saving) && { opacity: 0.5 }]}
            disabled={!point || saving}
            onPress={confirm}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Confirmar</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH, paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  close: { ...typography.body, color: colors.primary[600], fontWeight: '600' },
  title: { ...typography.h3, color: colors.gray[900] },
  footer: { padding: spacing[4], gap: spacing[3], borderTopWidth: 1, borderTopColor: colors.gray[100] },
  hint: { ...typography.bodySm, color: colors.gray[500], textAlign: 'center' },
  btn: { backgroundColor: colors.primary[600], borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  btnText: { color: colors.white, fontWeight: '600', fontSize: 15 },
})
