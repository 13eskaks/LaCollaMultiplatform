import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!email.trim()) { setError("Introdueix el teu email"); return }
    setLoading(true)
    setError('')
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (e) throw e
      setSent(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Tornar</Text>
      </TouchableOpacity>

      {sent ? (
        <View style={styles.success}>
          <Text style={styles.successIcon}>📬</Text>
          <Text style={styles.successTitle}>Correu enviat!</Text>
          <Text style={styles.successText}>T'hem enviat un link de recuperació a <Text style={{ fontWeight: '600' }}>{email}</Text>. Comprova la safata d'entrada.</Text>
          <Button label="Tornar a l'inici" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: spacing[6] }} />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.icon}>🔑</Text>
          <Text style={styles.title}>Recupera la contrasenya</Text>
          <Text style={styles.subtitle}>Introdueix el teu email i t'enviarem un link per restablir-la</Text>

          <View style={styles.form}>
            <Input label="Correu electrònic" value={email} onChangeText={setEmail} placeholder="correu@exemple.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={error} />
            <Button label="Enviar link de recuperació" size="lg" loading={loading} onPress={handleSend} style={styles.btn} />
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.screenH },
  back:         { marginTop: spacing[4], marginBottom: spacing[6] },
  backText:     { color: colors.primary[600], fontSize: 15 },
  content:      { flex: 1 },
  icon:         { fontSize: 48, marginBottom: spacing[4] },
  title:        { ...typography.display, color: colors.gray[900] },
  subtitle:     { ...typography.bodyLg, color: colors.gray[500], marginTop: spacing[2], marginBottom: spacing[8] },
  form:         { gap: spacing[4] },
  btn:          { width: '100%', marginTop: spacing[2] },
  success:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  successIcon:  { fontSize: 64 },
  successTitle: { ...typography.h1, color: colors.gray[900] },
  successText:  { ...typography.bodyLg, color: colors.gray[500], textAlign: 'center' },
})
