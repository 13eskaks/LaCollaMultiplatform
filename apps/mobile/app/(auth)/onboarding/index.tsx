import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'

export default function OnboardingIndexScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.wave}>👋</Text>
          <Text style={styles.title}>
            Benvingut/da,{'\n'}
            <Text style={styles.name}>{profile?.nom ?? ''}!</Text>
          </Text>
          <Text style={styles.subtitle}>Forma part d'una colla o crea la teua pròpia</Text>
        </View>

        <View style={styles.options}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(auth)/onboarding/join')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>🔍</Text>
            <Text style={styles.cardTitle}>Unir-me a una colla</Text>
            <Text style={styles.cardDesc}>Busca la teua colla i sol·licita l'entrada</Text>
            <Text style={styles.cardArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardAccent]}
            onPress={() => router.push('/(auth)/onboarding/create')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>✨</Text>
            <Text style={[styles.cardTitle, styles.cardTitleAccent]}>Crear una colla nova</Text>
            <Text style={[styles.cardDesc, styles.cardDescAccent]}>Funda la teua pròpia colla</Text>
            <Text style={[styles.cardArrow, styles.cardArrowAccent]}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.white },
  content:          { flex: 1, paddingHorizontal: spacing.screenH, justifyContent: 'center', gap: spacing[10] },
  header:           { gap: spacing[3] },
  wave:             { fontSize: 40 },
  title:            { ...typography.display, color: colors.gray[900] },
  name:             { color: colors.primary[600] },
  subtitle:         { ...typography.bodyLg, color: colors.gray[500] },
  options:          { gap: spacing[4] },
  card:             { padding: spacing[6], borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.gray[300], backgroundColor: colors.white, gap: spacing[2], ...shadows.sm },
  cardAccent:       { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  cardIcon:         { fontSize: 36 },
  cardTitle:        { ...typography.h2, color: colors.gray[900] },
  cardTitleAccent:  { color: colors.white },
  cardDesc:         { ...typography.body, color: colors.gray[500] },
  cardDescAccent:   { color: 'rgba(255,255,255,0.8)' },
  cardArrow:        { ...typography.h2, color: colors.primary[600], marginTop: spacing[2] },
  cardArrowAccent:  { color: colors.white },
})
