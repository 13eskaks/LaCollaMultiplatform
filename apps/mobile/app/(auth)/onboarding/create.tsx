import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Share, Image, ActivityIndicator, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CityInput } from '@/components/ui/CityInput'
import { YearPicker } from '@/components/ui/YearPicker'

const COMARQUES = [
  'L\'Alacantí','L\'Alcalatén','L\'Alt Maestrat','L\'Alt Millars','L\'Alt Palància','L\'Alt Vinalopó',
  'La Canal de Navarrés','La Costera','El Comtat','La Marina Alta','La Marina Baixa','La Plana Alta',
  'La Plana Baixa','La Plana d\'Utiel-Requena','La Ribera Alta','La Ribera Baixa','La Safor',
  'La Vall d\'Albaida','La Vall de Cofrents-Aiora','La Vega Baixa','Els Ports','El Racó d\'Ademús',
  'El Rincón de Ademuz','La Serranía','La Vall d\'Albaida','El Vinalopó Mitjà','El Camp de Morvedre',
  'El Camp de Túria','L\'Horta Nord','L\'Horta Oest','L\'Horta Sud','València',
]

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[si.dot, i < current && si.done, i === current && si.active]} />
      ))}
    </View>
  )
}
const si = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: spacing[8] },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gray[300] },
  done:   { backgroundColor: colors.primary[600] },
  active: { width: 24, backgroundColor: colors.primary[600] },
})

export default function CreateCollaScreen() {
  const router = useRouter()
  const { loadColles } = useCollaStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Pas 1
  const [nom, setNom] = useState('')
  const [localitat, setLocalitat] = useState('')
  const [comarca, setComarca] = useState('')
  const [anyFundacio, setAnyFundacio] = useState('')
  const [descripcio, setDescripcio] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Pas 2
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [portadaUri, setPortadaUri] = useState<string | null>(null)

  // Pas 3 — URL d'invitació (es genera després de crear la colla)
  const [collaId, setCollaId] = useState<string | null>(null)

  // Pas 4
  const [aprovacioManual, setAprovacioManual] = useState(true)
  const [perfilPublic, setPerfilPublic] = useState(true)
  const [quiCreaEvents, setQuiCreaEvents] = useState<'membres' | 'comissio'>('membres')
  const [quiCreaVotacions, setQuiCreaVotacions] = useState<'membres' | 'comissio'>('membres')

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!nom.trim()) e.nom = 'El nom és obligatori'
    if (!localitat.trim()) e.localitat = 'La localitat és obligatòria'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function pickImage(type: 'avatar' | 'portada') {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) {
      if (type === 'avatar') setAvatarUri(res.assets[0].uri)
      else setPortadaUri(res.assets[0].uri)
    }
  }

  async function handleCreate() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generem l'ID al client per evitar problemes de RLS en el RETURNING
      const collaId = randomUUID()
      const slug = nom.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        + '-' + collaId.slice(0, 6)

      const { error } = await supabase.from('colles').insert({
        id: collaId,
        nom: nom.trim(),
        slug,
        localitat: localitat.trim(),
        comarca: comarca || null,
        any_fundacio: anyFundacio ? parseInt(anyFundacio) : null,
        descripcio: descripcio.trim() || null,
        estat: 'activa',
      })

      if (error) throw error

      // Primer insertar el membre (president) perquè la RLS de colla_config ho requereix
      const membreRes = await supabase.from('colla_membres').insert({
        colla_id: collaId,
        user_id: user.id,
        estat: 'actiu',
        rol: 'president',
      })
      if (membreRes.error) throw membreRes.error

      const configRes = await supabase.from('colla_config').upsert({
        colla_id: collaId,
        aprovacio_manual: aprovacioManual,
        perfil_public: perfilPublic,
        qui_pot_crear_events: quiCreaEvents,
        qui_pot_crear_votacions: quiCreaVotacions,
      })
      if (configRes.error) throw configRes.error

      // Pujar imatges si n'hi ha
      if (avatarUri) {
        const ext = avatarUri.split('.').pop()
        const path = `${collaId}/avatar.${ext}`
        const blob = await (await fetch(avatarUri)).blob()
        await supabase.storage.from('colles').upload(path, blob, { upsert: true })
        const { data: { publicUrl } } = supabase.storage.from('colles').getPublicUrl(path)
        await supabase.from('colles').update({ avatar_url: publicUrl }).eq('id', collaId)
      }

      await loadColles()
      router.replace('/(tabs)/' as any)
    } catch (e: any) {
      setErrors({ general: e.message })
    } finally {
      setLoading(false)
    }
  }

  const inviteLink = collaId ? `https://lacolla.app/colla/${collaId}` : ''

  const steps = [
    // PAS 1
    <ScrollView key="1" contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Informació bàsica</Text>
      <View style={styles.stepForm}>
        <Input label="Nom de la colla *" value={nom} onChangeText={setNom} placeholder="Ex: Colla Fallera de l'Eixample" error={errors.nom} />
        <CityInput label="Localitat *" value={localitat} onChangeText={setLocalitat} placeholder="Ex: València, Gràcia..." error={errors.localitat} />
        <YearPicker label="Any de fundació" value={anyFundacio} onChange={setAnyFundacio} />
        <Input label="Descripció (opcional)" value={descripcio} onChangeText={setDescripcio} placeholder="Breu descripció de la colla..." multiline style={{ height: 80 }} />
        {errors.general && <Text style={styles.errorText}>{errors.general}</Text>}
      </View>
    </ScrollView>,

    // PAS 2
    <ScrollView key="2" contentContainerStyle={styles.stepScroll}>
      <Text style={styles.stepTitle}>Imatge i identitat</Text>
      <Text style={styles.stepSubtitle}>Podeu afegir-les més tard si voleu</Text>
      <View style={styles.stepForm}>
        <Text style={styles.imgLabel}>Foto de perfil (circular)</Text>
        <TouchableOpacity style={styles.imgPicker} onPress={() => pickImage('avatar')}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
            : <Text style={styles.imgPickerText}>📷 Tocar per seleccionar</Text>
          }
        </TouchableOpacity>
        <Text style={styles.imgLabel}>Foto de portada (16:9, opcional)</Text>
        <TouchableOpacity style={[styles.imgPicker, styles.portadaPicker]} onPress={() => pickImage('portada')}>
          {portadaUri
            ? <Image source={{ uri: portadaUri }} style={styles.portadaPreview} />
            : <Text style={styles.imgPickerText}>📷 Tocar per seleccionar</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>,

    // PAS 3
    <View key="3" style={styles.stepScroll}>
      <Text style={styles.stepTitle}>Convida membres 🎉</Text>
      <Text style={styles.stepSubtitle}>Comparteix el link per convidar els primers membres</Text>
      <View style={[styles.linkBox, { marginTop: spacing[6] }]}>
        <Text style={styles.linkUrl}>{inviteLink}</Text>
      </View>
      <View style={styles.shareActions}>
        <Button label="📋 Copiar link" variant="secondary" size="md" style={{ flex: 1 }}
          onPress={async () => { await Clipboard.setStringAsync(inviteLink); Alert.alert('✓ Copiat!', 'L\'enllaç ha sigut copiat al porta-retalls') }} />
        <Button label="🔗 Compartir" size="md" style={{ flex: 1 }}
          onPress={() => Share.share({ message: `Uneix-te a la nostra colla a LaColla: ${inviteLink}` })} />
      </View>
    </View>,

    // PAS 4
    <ScrollView key="4" contentContainerStyle={styles.stepScroll}>
      <Text style={styles.stepTitle}>Configuració</Text>
      <View style={styles.stepForm}>
        {[
          { label: 'Aprovació manual de nous membres', value: aprovacioManual, onChange: setAprovacioManual },
          { label: 'Perfil de colla públic', value: perfilPublic, onChange: setPerfilPublic },
        ].map(({ label, value, onChange }) => (
          <View key={label} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary[600] }} />
          </View>
        ))}

        <Text style={styles.configLabel}>Qui pot crear events</Text>
        <View style={styles.segmented}>
          {(['membres', 'comissio'] as const).map(opt => (
            <TouchableOpacity key={opt} style={[styles.segBtn, quiCreaEvents === opt && styles.segBtnActive]} onPress={() => setQuiCreaEvents(opt)}>
              <Text style={[styles.segBtnText, quiCreaEvents === opt && styles.segBtnTextActive]}>
                {opt === 'membres' ? 'Tots els membres' : 'Només comissió'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.configLabel}>Qui pot crear votacions</Text>
        <View style={styles.segmented}>
          {(['membres', 'comissio'] as const).map(opt => (
            <TouchableOpacity key={opt} style={[styles.segBtn, quiCreaVotacions === opt && styles.segBtnActive]} onPress={() => setQuiCreaVotacions(opt)}>
              <Text style={[styles.segBtnText, quiCreaVotacions === opt && styles.segBtnTextActive]}>
                {opt === 'membres' ? 'Tots els membres' : 'Només comissió'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>,
  ]

  function handleNext() {
    if (step === 0 && !validateStep1()) return
    if (step === 1) { handleCreate(); return }
    if (step === steps.length - 1) { router.replace('/(tabs)/' as any); return }
    setStep(s => s + 1)
  }

  const btnLabel = step === 1 ? (loading ? 'Creant...' : 'Crear la colla! 🎉') : step === steps.length - 1 ? 'Anar a la colla' : 'Continuar'

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {step > 0 && step < 2 && (
          <TouchableOpacity onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backText}>← Enrere</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.progress}>Pas {step + 1} de {steps.length}</Text>
      </View>

      <StepIndicator current={step} total={steps.length} />

      <View style={{ flex: 1 }}>{steps[step]}</View>

      <View style={styles.footer}>
        {step === 2 && (
          <Button label="Ometre per ara" variant="ghost" onPress={() => setStep(3)} style={styles.skipBtn} />
        )}
        <Button
          label={btnLabel}
          size="lg"
          loading={loading}
          onPress={handleNext}
          style={styles.nextBtn}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.white },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenH, paddingTop: spacing[4], marginBottom: spacing[4] },
  backText:       { color: colors.primary[600], fontSize: 15 },
  progress:       { ...typography.caption, color: colors.gray[500] },
  stepScroll:     { paddingHorizontal: spacing.screenH, paddingBottom: spacing[4] },
  stepTitle:      { ...typography.display, color: colors.gray[900], marginBottom: spacing[2] },
  stepSubtitle:   { ...typography.body, color: colors.gray[500], marginBottom: spacing[6] },
  stepForm:       { gap: spacing[4] },
  errorText:      { color: colors.danger[500], fontSize: 13 },
  imgLabel:       { ...typography.label, color: colors.gray[700], marginBottom: spacing[2] },
  imgPicker:      { height: 120, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gray[300], borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  portadaPicker:  { height: 160 },
  imgPickerText:  { color: colors.gray[500], fontSize: 14 },
  avatarPreview:  { width: '100%', height: '100%' },
  portadaPreview: { width: '100%', height: '100%' },
  linkBox:        { marginHorizontal: spacing.screenH, backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing[4], borderWidth: 1, borderColor: colors.gray[300] },
  linkUrl:        { ...typography.bodySm, color: colors.primary[600], fontFamily: 'monospace' },
  shareActions:   { flexDirection: 'row', gap: spacing[3], marginHorizontal: spacing.screenH, marginTop: spacing[4] },
  toggle:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel:    { ...typography.body, color: colors.gray[900], flex: 1, marginRight: spacing[4] },
  configLabel:    { ...typography.label, color: colors.gray[700], marginTop: spacing[4], marginBottom: spacing[2] },
  segmented:      { flexDirection: 'row', backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3 },
  segBtn:         { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.xs },
  segBtnActive:   { backgroundColor: colors.white, ...shadows.sm },
  segBtnText:     { fontSize: 13, color: colors.gray[500] },
  segBtnTextActive:{ color: colors.gray[900], fontWeight: '600' },
  footer:         { paddingHorizontal: spacing.screenH, paddingBottom: spacing[6], gap: spacing[3] },
  skipBtn:        { width: '100%' },
  nextBtn:        { width: '100%' },
})
