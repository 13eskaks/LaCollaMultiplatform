import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing } from '@/theme'
import { Button } from '@/components/ui/Button'

export default function VerifyEmailScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  // Poll cada 3s fins que l'email es confirme
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email_confirmed_at) {
        clearInterval(interval)
        router.replace('/(auth)/onboarding')
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  async function handleResend() {
    if (cooldown > 0 || !email) return
    setResending(true)
    await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    setCooldown(60)
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => { if (c <= 1) clearInterval(t); return c - 1 }), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.icon}>📬</Text>
        <Text style={styles.title}>Comprova el teu correu</Text>
        <Text style={styles.body}>
          T'hem enviat un link de verificació a{'\n'}
          <Text style={styles.email}>{email ?? 'el teu email'}</Text>
        </Text>
        <Text style={styles.hint}>Clica el link per activar el teu compte. Pot trigar un minut.</Text>

        <Button
          label={cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar correu'}
          variant="secondary"
          loading={resending}
          disabled={cooldown > 0}
          onPress={handleResend}
          style={styles.btn}
        />

        <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
          <Text style={styles.changeEmail}>Canviar correu electrònic</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.screenH },
  content:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[4] },
  icon:        { fontSize: 72 },
  title:       { ...typography.h1, color: colors.gray[900], textAlign: 'center' },
  body:        { ...typography.bodyLg, color: colors.gray[500], textAlign: 'center' },
  email:       { color: colors.gray[900], fontWeight: '600' },
  hint:        { ...typography.bodySm, color: colors.gray[500], textAlign: 'center' },
  btn:         { width: '100%', marginTop: spacing[4] },
  changeEmail: { color: colors.primary[600], fontSize: 14, marginTop: spacing[2] },
})
