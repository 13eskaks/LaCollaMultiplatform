import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'

const LANGUAGES = [
  { code: 'ca', flag: '🌊', name: 'Valencià', sub: 'Comunitat Valenciana' },
  { code: 'es', flag: '🌞', name: 'Castellano', sub: 'Español' },
  { code: 'en', flag: '🌍', name: 'English', sub: 'International' },
] as const

type LangCode = 'ca' | 'es' | 'en'

export default function LanguageScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<LangCode | null>(null)

  async function handleContinue() {
    if (!selected) return
    await AsyncStorage.setItem('language', selected)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Tria l'idioma</Text>
      <Text style={styles.subtitle}>Pots canviar-ho en qualsevol moment des del perfil</Text>

      <View style={styles.options}>
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelected(lang.code)}
              activeOpacity={0.8}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <View style={styles.cardText}>
                <Text style={[styles.langName, isSelected && styles.langNameSelected]}>{lang.name}</Text>
                <Text style={styles.langSub}>{lang.sub}</Text>
              </View>
              {isSelected && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label="Continuar →"
        size="lg"
        disabled={!selected}
        onPress={handleContinue}
        style={styles.btn}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.screenH, paddingTop: spacing[4] },
  back:            { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  backText:        { fontSize: 14, color: colors.gray[500] },
  title:           { ...typography.display, color: colors.gray[900], marginTop: spacing[8] },
  subtitle:        { ...typography.body, color: colors.gray[500], marginTop: spacing[2], marginBottom: spacing[8] },
  options:         { gap: spacing[3], flex: 1 },
  card:            { flexDirection: 'row', alignItems: 'center', padding: spacing[4], borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gray[300], backgroundColor: colors.white, gap: spacing[3] },
  cardSelected:    { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  flag:            { fontSize: 32 },
  cardText:        { flex: 1 },
  langName:        { ...typography.h3, color: colors.gray[900] },
  langNameSelected:{ color: colors.primary[600] },
  langSub:         { ...typography.bodySm, color: colors.gray[500], marginTop: 2 },
  check:           { fontSize: 18, color: colors.primary[600], fontWeight: '700' },
  btn:             { width: '100%', marginBottom: spacing[6] },
})
