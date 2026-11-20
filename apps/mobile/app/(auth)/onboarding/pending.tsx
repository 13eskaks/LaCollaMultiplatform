import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { usePolling } from '@/lib/realtime'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing } from '@/theme'
import { Button } from '@/components/ui/Button'

export default function PendingScreen() {
  const router = useRouter()
  const { colla_id } = useLocalSearchParams<{ colla_id: string }>()
  const [colla, setColla] = useState<any>(null)
  const { loadColles } = useCollaStore()

  useEffect(() => {
    if (colla_id) {
      supabase.from('colles').select('nom').eq('id', colla_id).single()
        .then(({ data }) => setColla(data))
    }
  }, [colla_id])

  // Comprovem periòdicament si la sol·licitud s'ha aprovat
  usePolling(async () => {
    if (!colla_id) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('colla_membres').select('estat')
      .eq('colla_id', colla_id).eq('user_id', user.id).maybeSingle()
    if (data?.estat === 'actiu') {
      await loadColles()
      router.replace('/(tabs)/' as any)
    }
  }, 5000, !!colla_id)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Sol·licitud enviada!</Text>
        <Text style={styles.body}>
          La comissió de{' '}
          <Text style={styles.collaName}>{colla?.nom ?? 'la colla'}</Text>
          {' '}ha rebut la teua sol·licitud.{'\n'}Normalment responen en 24-48h.
        </Text>

        <View style={styles.hint}>
          <ActivityIndicator color={colors.primary[600]} size="small" />
          <Text style={styles.hintText}>Esperant aprovació automàticament...</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Buscar una altra colla"
            variant="secondary"
            onPress={() => router.push('/(auth)/onboarding/join')}
            style={styles.btn}
          />
          <Button
            label="Tornar a l'inici"
            variant="ghost"
            onPress={() => router.replace('/(auth)/welcome')}
            style={styles.btn}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.screenH },
  content:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[4] },
  icon:      { fontSize: 72 },
  title:     { ...typography.h1, color: colors.gray[900], textAlign: 'center' },
  body:      { ...typography.bodyLg, color: colors.gray[500], textAlign: 'center', lineHeight: 26 },
  collaName: { color: colors.gray[900], fontWeight: '700' },
  hint:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.primary[50], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: 999 },
  hintText:  { ...typography.bodySm, color: colors.primary[600] },
  actions:   { width: '100%', gap: spacing[3], marginTop: spacing[4] },
  btn:       { width: '100%' },
})
