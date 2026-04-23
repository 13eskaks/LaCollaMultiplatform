import { View, Text, StyleSheet, Alert } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function PasswordScreen() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (newPass.length < 8) {
      Alert.alert('Error', 'La nova contrasenya ha de tenir almenys 8 caràcters')
      return
    }
    if (newPass !== confirm) {
      Alert.alert('Error', 'Les contrasenyes no coincideixen')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Canvi realitzat', 'La contrasenya s\'ha actualitzat correctament', [
        { text: 'D\'acord', onPress: () => router.back() },
      ])
    }
  }

  const canSave = newPass.length >= 8 && newPass === confirm

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Canviar contrasenya" />

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.hint}>
            Introdueix la teua nova contrasenya. Ha de tenir almenys 8 caràcters.
          </Text>

          <View style={styles.fields}>
            <Input
              label="Nova contrasenya"
              value={newPass}
              onChangeText={setNewPass}
              placeholder="Mínim 8 caràcters"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              label="Confirma la nova contrasenya"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeteix la contrasenya"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {confirm.length > 0 && newPass !== confirm && (
            <Text style={styles.errorText}>Les contrasenyes no coincideixen</Text>
          )}
        </View>

        <Button
          label="Guardar contrasenya"
          size="lg"
          loading={saving}
          disabled={!canSave}
          onPress={handleSave}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.gray[50] },
  content:   { padding: spacing.screenH, gap: spacing[4] },
  card:      { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], ...shadows.sm, gap: spacing[4] },
  hint:      { ...typography.bodySm, color: colors.gray[500] },
  fields:    { gap: spacing[3] },
  errorText: { ...typography.bodySm, color: colors.danger[500] },
})
