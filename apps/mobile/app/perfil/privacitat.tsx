import { View, Text, ScrollView, Switch, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { API_URL, ANON_KEY } from '@/lib/config'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'

export default function PrivacitatScreen() {
  const router = useRouter()
  const { profile, loadProfile, signOut } = useAuthStore()

  const [showTelefon, setShowTelefon] = useState(false)
  const [repMissatges, setRepMissatges] = useState(true)
  const [visibleDirectori, setVisibleDirectori] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleDeleteAccount() {
    Alert.alert(
      'Eliminar compte',
      "S'esborraran el teu perfil i les teues dades de manera permanent. Aquesta acció no es pot desfer.",
      [
        { text: 'Cancel·lar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            setDeleting(true)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (!session) return
              const res = await fetch(`${API_URL}/auth/v1/user`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY },
              })
              if (!res.ok) throw new Error(`Error ${res.status}`)
              await signOut()
              router.replace('/(auth)/welcome')
            } catch (e: any) {
              Alert.alert('Error', "No s'ha pogut eliminar el compte. Torna-ho a provar.")
            } finally {
              setDeleting(false)
            }
          },
        },
      ],
    )
  }

  useEffect(() => {
    if (profile) {
      setShowTelefon(profile.show_telefon ?? false)
      setRepMissatges(profile.rep_missatges_altres_colles ?? true)
      setVisibleDirectori(profile.visible_directori ?? true)
    }
  }, [profile])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').update({
      show_telefon: showTelefon,
      rep_missatges_altres_colles: repMissatges,
      visible_directori: visibleDirectori,
    }).eq('id', user.id)

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      await loadProfile()
      router.back()
    }
  }

  const rows: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }[] = [
    {
      label: 'Mostrar telèfon als membres',
      sub: 'Els membres de la teua colla podran veure el teu telèfon',
      value: showTelefon,
      onChange: setShowTelefon,
    },
    {
      label: 'Rebre missatges d\'altres colles',
      sub: 'Permet que membres d\'altres colles t\'envien missatges directes',
      value: repMissatges,
      onChange: setRepMissatges,
    },
    {
      label: 'Visible al directori',
      sub: 'El teu perfil apareix al directori públic de membres',
      value: visibleDirectori,
      onChange: setVisibleDirectori,
    },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Privacitat" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>VISIBILITAT</Text>
        <View style={styles.card}>
          {rows.map((row, idx) => (
            <View key={row.label}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowSub}>{row.sub}</Text>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={row.onChange}
                  trackColor={{ true: colors.primary[600] }}
                />
              </View>
              {idx < rows.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Text style={styles.legalNote}>
          Les teves dades es gestionen d'acord amb la nostra Política de privacitat.
          Pots eliminar el teu compte en qualsevol moment des d'aquesta pantalla.
        </Text>

        <Button label="Guardar" size="lg" loading={saving} onPress={handleSave} />

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={deleting}>
          <Text style={styles.deleteText}>{deleting ? 'Eliminant...' : 'Eliminar el meu compte'}</Text>
        </TouchableOpacity>

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
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[4], gap: spacing[3] },
  rowText:      { flex: 1 },
  rowLabel:     { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  rowSub:       { ...typography.caption, color: colors.gray[400], marginTop: 2 },
  divider:      { height: 1, backgroundColor: colors.gray[100] },
  deleteBtn:    { alignItems: 'center', paddingVertical: spacing[3] },
  deleteText:   { ...typography.body, color: colors.danger[500], fontWeight: '600' },
  legalNote:    { ...typography.caption, color: colors.gray[400], textAlign: 'center', lineHeight: 18 },
})
