import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'

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
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) setAvatarUri(res.assets[0].uri)
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
      if (avatarUri) {
        const ext = avatarUri.split('.').pop()
        const path = `${user.id}/avatar.${ext}`
        const blob = await (await fetch(avatarUri)).blob()
        await supabase.storage.from('avatars').upload(path, blob, { upsert: true })
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = publicUrl
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
          <Avatar
            name={`${nom} ${cognoms}`}
            uri={avatarUri ?? profile?.avatar_url}
            size="2xl"
          />
          <Button label="Canviar foto" variant="secondary" size="sm" onPress={pickAvatar} style={{ marginTop: spacing[2] }} />
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.white },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  headerTitle:  { ...typography.h3, color: colors.gray[900] },
  form:         { padding: spacing.screenH, gap: spacing[4] },
  avatarSection:{ alignItems: 'center', paddingVertical: spacing[4] },
  sectionLabel: { ...typography.label, color: colors.gray[500], marginTop: spacing[2] },
  toggle:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel:  { ...typography.body, color: colors.gray[700], flex: 1, paddingRight: spacing[4] },
})
