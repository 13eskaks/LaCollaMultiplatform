import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RegisterScreen() {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [cognoms, setCognoms] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!nom.trim()) e.nom = 'El nom és obligatori'
    if (!email.trim()) e.email = "L'email és obligatori"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Format d'email incorrecte"
    if (!password) e.password = 'La contrasenya és obligatòria'
    else if (password.length < 8) e.password = 'Mínim 8 caràcters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleRegister() {
    if (!validate()) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { nom: nom.trim(), cognoms: cognoms.trim() },
        },
      })
      if (error) throw error
      router.push(`/(auth)/verify-email?email=${encodeURIComponent(email)}`)
    } catch (e: any) {
      setErrors({ general: e.message })
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

          <Text style={styles.title}>Crea el teu compte</Text>
          <Text style={styles.subtitle}>Uneix-te a milers de colles valencianes</Text>

          <View style={styles.form}>
            <Input label="Nom *" value={nom} onChangeText={setNom} placeholder="El teu nom" autoCapitalize="words" error={errors.nom} />
            <Input label="Cognoms" value={cognoms} onChangeText={setCognoms} placeholder="Cognoms (opcional)" autoCapitalize="words" />
            <Input label="Correu electrònic *" value={email} onChangeText={setEmail} placeholder="correu@exemple.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} />
            <Input
              label="Contrasenya *"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínim 8 caràcters"
              secureTextEntry={!showPass}
              rightIcon={showPass ? '🙈' : '👁️'}
              onRightIconPress={() => setShowPass(!showPass)}
              error={errors.password}
            />

            {errors.general && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            <Button label="Crear compte" size="lg" loading={loading} onPress={handleRegister} style={styles.btn} />

            <Text style={styles.legal}>
              En registrar-te acceptes els{' '}
              <Text style={styles.legalLink}>termes d'ús</Text>
              {' '}i la{' '}
              <Text style={styles.legalLink}>política de privacitat</Text>
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ja tens compte? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}>Inicia sessió</Text>
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
  errorBox:   { backgroundColor: colors.danger[100], borderRadius: radius.sm, padding: spacing[3] },
  errorText:  { color: colors.danger[500], fontSize: 13 },
  btn:        { width: '100%', marginTop: spacing[2] },
  legal:      { ...typography.caption, color: colors.gray[500], textAlign: 'center' },
  legalLink:  { color: colors.primary[600] },
  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing[8] },
  footerText: { ...typography.body, color: colors.gray[500] },
  footerLink: { ...typography.body, color: colors.primary[600], fontWeight: '600' },
})
