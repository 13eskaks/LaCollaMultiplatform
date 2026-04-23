import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safe}>
        {/* Botó idioma */}
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => router.push('/(auth)/language')}
          accessibilityLabel="Canviar idioma"
        >
          <Text style={styles.langText}>🌐 Idioma</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.emoji}>🌩</Text>
          <Text style={styles.logo}>
            <Text style={styles.logoLa}>La</Text>
            <Text style={styles.logoColla}>Colla</Text>
          </Text>
          <Text style={styles.tagline}>La teua colla, sempre a prop</Text>
        </View>

        {/* Features preview */}
        <View style={styles.features}>
          {[
            ['📅', 'Agenda i events'],
            ['🗳️', 'Votacions col·lectives'],
            ['💰', 'Caixa compartida'],
            ['💬', 'Fòrum intern'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{icon}</Text>
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Accions */}
        <View style={styles.actions}>
          <Button
            label="Comença ara →"
            size="lg"
            onPress={() => router.push('/(auth)/register')}
            style={styles.btnFull}
          />
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>Ja tinc compte. <Text style={styles.loginLinkBold}>Inicia sessió</Text></Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.white },
  safe:          { flex: 1, paddingHorizontal: spacing.screenH },
  langBtn:       { alignSelf: 'flex-end', marginTop: spacing[3], paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.gray[100], borderRadius: radius.full },
  langText:      { fontSize: 13, color: colors.gray[700], fontWeight: '500' },
  hero:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emoji:         { fontSize: 72 },
  logo:          { fontSize: 44, letterSpacing: -1 },
  logoLa:        { fontWeight: '400', color: colors.gray[900] },
  logoColla:     { fontWeight: '900', color: colors.primary[600] },
  tagline:       { ...typography.bodyLg, color: colors.gray[500], textAlign: 'center' },
  features:      { gap: 14, marginBottom: spacing[8] },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon:   { fontSize: 22, width: 32, textAlign: 'center' },
  featureText:   { ...typography.bodyLg, color: colors.gray[700], fontWeight: '500' },
  actions:       { paddingBottom: spacing[6], gap: spacing[3] },
  btnFull:       { width: '100%' },
  loginLink:     { alignItems: 'center', paddingVertical: spacing[2] },
  loginLinkText: { ...typography.body, color: colors.gray[500] },
  loginLinkBold: { color: colors.primary[600], fontWeight: '600' },
})
