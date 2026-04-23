import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError("Omple tots els camps"); return }
    setLoading(true)
    setError('')
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (e) throw e
    } catch (e: any) {
      setError(e.message === 'Invalid login credentials' ? 'Email o contrasenya incorrectes' : e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Tornar</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Benvingut/da de nou 👋</Text>
          <Text style={styles.subtitle}>Inicia sessió al teu compte de LaColla</Text>

          <View style={styles.form}>
            <Input label="Correu electrònic" value={email} onChangeText={setEmail} placeholder="correu@exemple.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <View>
              <Input
                label="Contrasenya"
                value={password}
                onChangeText={setPassword}
                placeholder="La teua contrasenya"
                secureTextEntry={!showPass}
                rightIcon={showPass ? '🙈' : '👁️'}
                onRightIconPress={() => setShowPass(!showPass)}
              />
              <TouchableOpacity style={styles.forgot} onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={styles.forgotText}>Has oblidat la contrasenya?</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button label="Entrar" size="lg" loading={loading} onPress={handleLogin} style={styles.btn} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>No tens compte? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
              <Text style={styles.footerLink}>Registra't</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.white },
  scroll:     { paddingHorizontal: spacing.screenH, paddingBottom: spacing[8] },
  back:       { marginTop: spacing[4], marginBottom: spacing[6] },
  backText:   { color: colors.primary[600], fontSize: 15 },
  title:      { ...typography.display, color: colors.gray[900] },
  subtitle:   { ...typography.bodyLg, color: colors.gray[500], marginTop: spacing[2], marginBottom: spacing[8] },
  form:       { gap: spacing[4] },
  forgot:     { alignSelf: 'flex-end', marginTop: spacing[2] },
  forgotText: { color: colors.primary[600], fontSize: 13 },
  errorBox:   { backgroundColor: colors.danger[100], borderRadius: radius.sm, padding: spacing[3] },
  errorText:  { color: colors.danger[500], fontSize: 13 },
  btn:        { width: '100%', marginTop: spacing[2] },
  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing[8] },
  footerText: { ...typography.body, color: colors.gray[500] },
  footerLink: { ...typography.body, color: colors.primary[600], fontWeight: '600' },
})
