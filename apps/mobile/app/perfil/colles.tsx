import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export default function CollesScreen() {
  const router = useRouter()
  const { colles, collaActiva, setCollaActiva, loadColles } = useCollaStore()

  async function handleAbandonar(collaId: string, collaNom: string) {
    Alert.alert(
      `Abandonar ${collaNom}`,
      'Estàs segur/a que vols abandonar aquesta colla? Perdràs l\'accés a tot el contingut.',
      [
        { text: 'Cancel·lar', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            await supabase.from('colla_membres').delete()
              .eq('colla_id', collaId).eq('user_id', user.id)
            await loadColles()
          },
        },
      ]
    )
  }

  function handleActivar(collaId: string) {
    setCollaActiva(collaId)
    router.replace('/(tabs)/')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Les meues colles</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Canvia entre colles o gestiona les teues pertinences
        </Text>

        {colles.map(colla => {
          const isActive = colla.id === collaActiva?.id
          const rol = colla.membership?.rol ?? 'membre'
          return (
            <View key={colla.id} style={[styles.card, isActive && styles.cardActive]}>
              <View style={styles.cardTop}>
                <Avatar name={colla.nom} uri={colla.avatar_url} size="lg" />
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.collaNom} numberOfLines={1}>{colla.nom}</Text>
                    {isActive && <Badge label="Activa" variant="primary" size="sm" />}
                  </View>
                  {colla.localitat && <Text style={styles.collaMeta}>📍 {colla.localitat}</Text>}
                  <Badge label={rol} variant={rol === 'president' ? 'premium' : 'default'} size="sm" />
                </View>
              </View>

              <View style={styles.cardActions}>
                {!isActive && (
                  <Button label="Obrir colla" size="sm" style={{ flex: 1 }} onPress={() => handleActivar(colla.id)} />
                )}
                <Button
                  label="Abandonar"
                  size="sm"
                  variant="danger"
                  style={{ flex: isActive ? 1 : undefined }}
                  onPress={() => handleAbandonar(colla.id, colla.nom)}
                />
              </View>
            </View>
          )
        })}

        <Button
          label="+ Unir-me a una altra colla"
          variant="secondary"
          size="lg"
          onPress={() => router.push('/(auth)/onboarding/join' as any)}
          style={{ marginTop: spacing[2] }}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Pla gratuït: fins a 2 colles simultànies. Premium: fins a 5 colles.
          </Text>
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:     { fontSize: 22, color: colors.primary[600], width: 36 },
  title:        { ...typography.h3, color: colors.gray[900] },
  content:      { padding: spacing.screenH, gap: spacing[3] },
  subtitle:     { ...typography.body, color: colors.gray[500], marginBottom: spacing[2] },
  card:         { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3], ...shadows.sm, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive:   { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  cardTop:      { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4, flexWrap: 'wrap' },
  collaNom:     { ...typography.h3, color: colors.gray[900] },
  collaMeta:    { ...typography.caption, color: colors.gray[500], marginBottom: 4 },
  cardActions:  { flexDirection: 'row', gap: spacing[2] },
  infoBox:      { backgroundColor: colors.primary[50], borderRadius: radius.md, padding: spacing[3], marginTop: spacing[2] },
  infoText:     { ...typography.bodySm, color: colors.primary[600] },
})
