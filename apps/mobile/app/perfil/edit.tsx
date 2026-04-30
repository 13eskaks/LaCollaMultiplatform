import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Switch, Alert,
  Modal, FlatList, TouchableOpacity, Image, Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'

const SCREEN_W = Dimensions.get('window').width
const AVATAR_COLS = 4
const AVATAR_GAP = 8
const AVATAR_SIZE = (SCREEN_W - spacing.screenH * 2 - AVATAR_GAP * (AVATAR_COLS - 1)) / AVATAR_COLS

const SEEDS = [
  'Felix','Daisy','Lily','Luna','Zoe','Max','Leo','Mia',
  'Nova','Rex','Aria','Bolt','Echo','Finn','Gus','Ivy',
  'Jade','Kai','Lux','Mox','Nox','Ori','Pip','Quinn',
  'Raf','Sky','Taz','Uma','Vex','Wren','Xen','Yuki',
]
const STYLES = ['avataaars', 'bottts', 'fun-emoji', 'pixel-art']
const STYLE_LABELS: Record<string, string> = {
  avataaars: '🧑 Persones',
  bottts: '🤖 Robots',
  'fun-emoji': '😀 Emojis',
  'pixel-art': '🕹 Píxel',
}

const PRESET_AVATARS = STYLES.flatMap(style =>
  SEEDS.map(seed => ({
    url: `https://api.dicebear.com/9.x/${style}/png?seed=${seed}&size=128`,
    style,
  }))
)

export default function EditPerfilScreen() {
  const router = useRouter()
  const { profile, loadProfile } = useAuthStore()
  const [nom, setNom] = useState(profile?.nom ?? '')
  const [cognoms, setCognoms] = useState(profile?.cognoms ?? '')
  const [sobrenom, setSobrenom] = useState(profile?.sobrenom ?? '')
  const [telefon, setTelefon] = useState(profile?.telefon ?? '')
  const [localitat, setLocalitat] = useState(profile?.localitat ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [mostrarTelefon, setMostrarTelefon] = useState(profile?.show_telefon ?? false)
  const [visibleDirectori, setVisibleDirectori] = useState(profile?.visible_directori ?? true)
  const [acceptaMissatgesAltres, setAcceptaMissatgesAltres] = useState(profile?.rep_missatges_altres_colles ?? false)

  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null)
  const [presetAvatarUrl, setPresetAvatarUrl] = useState<string | null>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [activeStyle, setActiveStyle] = useState(STYLES[0])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentAvatarUri = localAvatarUri ?? presetAvatarUrl ?? profile?.avatar_url

  async function pickFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) {
      setLocalAvatarUri(res.assets[0].uri)
      setPresetAvatarUrl(null)
      setShowAvatarPicker(false)
    }
  }

  function selectPreset(url: string) {
    setPresetAvatarUrl(url)
    setLocalAvatarUri(null)
    setShowAvatarPicker(false)
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!nom.trim()) e.nom = 'El nom és obligatori'
    if (bio.length > 160) e.bio = 'La bio no pot superar 160 caràcters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleGuardar() {
    if (!validate()) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let avatar_url = profile?.avatar_url

      if (localAvatarUri) {
        const ext = localAvatarUri.split('.').pop()
        const path = `${user.id}/avatar.${ext}`
        const blob = await (await fetch(localAvatarUri)).blob()
        await supabase.storage.from('avatars').upload(path, blob, { upsert: true })
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = publicUrl
      } else if (presetAvatarUrl) {
        avatar_url = presetAvatarUrl
      }

      const { error } = await supabase.from('profiles').update({
        nom: nom.trim(),
        cognoms: cognoms.trim() || null,
        sobrenom: sobrenom.trim() || null,
        telefon: telefon.trim() || null,
        localitat: localitat.trim() || null,
        bio: bio.trim() || null,
        show_telefon: mostrarTelefon,
        visible_directori: visibleDirectori,
        rep_missatges_altres_colles: acceptaMissatgesAltres,
        avatar_url,
      }).eq('id', user.id)

      if (error) throw error
      await loadProfile()
      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const visibleAvatars = PRESET_AVATARS.filter(a => a.style === activeStyle)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Button label="✕" variant="ghost" size="sm" onPress={() => router.back()} style={{ width: 44 }} />
        <Text style={styles.headerTitle}>Editar perfil</Text>
        <Button label="Guardar" size="sm" loading={loading} onPress={handleGuardar} style={{ minWidth: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Avatar name={`${nom} ${cognoms}`} uri={currentAvatarUri} size="2xl" />
          <Button
            label="Canviar avatar"
            variant="secondary"
            size="sm"
            onPress={() => setShowAvatarPicker(true)}
            style={{ marginTop: spacing[2] }}
          />
        </View>

        <Input label="Nom *" value={nom} onChangeText={setNom} placeholder="El teu nom" error={errors.nom} />
        <Input label="Cognoms" value={cognoms} onChangeText={setCognoms} placeholder="Els teus cognoms" />
        <Input label="Sobrenom" value={sobrenom} onChangeText={setSobrenom} placeholder="Ex: El Pitu" />
        <Input label="Telèfon" value={telefon} onChangeText={setTelefon} placeholder="+34 612 345 678" keyboardType="phone-pad" />
        <Input label="Localitat" value={localitat} onChangeText={setLocalitat} placeholder="Ex: València" />
        <View>
          <Input
            label={`Bio (${bio.length}/160)`}
            value={bio}
            onChangeText={setBio}
            placeholder="Una breu descripció sobre tu..."
            multiline
            style={{ height: 90 }}
            error={errors.bio}
          />
        </View>

        <Text style={styles.sectionLabel}>Privacitat</Text>
        {[
          { label: 'Mostrar telèfon a la colla', value: mostrarTelefon, onChange: setMostrarTelefon },
          { label: 'Visible en el directori global', value: visibleDirectori, onChange: setVisibleDirectori },
          { label: 'Rebre missatges d\'altres colles', value: acceptaMissatgesAltres, onChange: setAcceptaMissatgesAltres },
        ].map(({ label, value, onChange }) => (
          <View key={label} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary[600] }} />
          </View>
        ))}

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* Avatar picker modal */}
      <Modal visible={showAvatarPicker} animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
        <SafeAreaView style={styles.pickerSafe} edges={['top']}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowAvatarPicker(false)}>
              <Text style={styles.pickerClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Tria el teu avatar</Text>
            <TouchableOpacity onPress={pickFromGallery}>
              <Text style={styles.pickerGallery}>📷 Galeria</Text>
            </TouchableOpacity>
          </View>

          {/* Style tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleTabs} contentContainerStyle={styles.styleTabsContent}>
            {STYLES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.styleTab, activeStyle === s && styles.styleTabActive]}
                onPress={() => setActiveStyle(s)}
              >
                <Text style={[styles.styleTabText, activeStyle === s && styles.styleTabTextActive]}>
                  {STYLE_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={visibleAvatars}
            keyExtractor={item => item.url}
            numColumns={AVATAR_COLS}
            contentContainerStyle={styles.avatarGrid}
            renderItem={({ item }) => {
              const selected = item.url === presetAvatarUrl
              return (
                <TouchableOpacity
                  onPress={() => selectPreset(item.url)}
                  style={[styles.avatarCell, selected && styles.avatarCellSelected]}
                  activeOpacity={0.75}
                >
                  <Image source={{ uri: item.url }} style={styles.avatarThumb} />
                </TouchableOpacity>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.white },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  headerTitle:      { ...typography.h3, color: colors.gray[900] },
  form:             { padding: spacing.screenH, gap: spacing[4] },
  avatarSection:    { alignItems: 'center', paddingVertical: spacing[4] },
  sectionLabel:     { ...typography.label, color: colors.gray[500], marginTop: spacing[2] },
  toggle:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel:      { ...typography.body, color: colors.gray[700], flex: 1, paddingRight: spacing[4] },

  // Picker modal
  pickerSafe:         { flex: 1, backgroundColor: colors.white },
  pickerHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  pickerClose:        { fontSize: 18, color: colors.gray[500], width: 44 },
  pickerTitle:        { ...typography.h3, color: colors.gray[900] },
  pickerGallery:      { ...typography.bodySm, color: colors.primary[600], fontWeight: '700' },

  styleTabs:          { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  styleTabsContent:   { paddingHorizontal: spacing.screenH, gap: spacing[2], paddingVertical: spacing[2] },
  styleTab:           { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, backgroundColor: colors.gray[100] },
  styleTabActive:     { backgroundColor: colors.primary[600] },
  styleTabText:       { ...typography.bodySm, color: colors.gray[600], fontWeight: '600' },
  styleTabTextActive: { color: colors.white },

  avatarGrid:   { padding: spacing.screenH, gap: AVATAR_GAP },
  avatarCell:   { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  avatarCellSelected: { borderColor: colors.primary[600], ...shadows.sm },
  avatarThumb:  { width: '100%', height: '100%', backgroundColor: colors.gray[100] },
})
