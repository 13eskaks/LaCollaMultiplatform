import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'
import i18n from '@/lib/i18n'

const LANGUAGES = [
  { code: 'ca', flag: '🌊', nameKey: 'lang.ca', subKey: 'lang.ca.sub' },
  { code: 'es', flag: '🌞', nameKey: 'lang.es', subKey: 'lang.es.sub' },
  { code: 'en', flag: '🌍', nameKey: 'lang.en', subKey: 'lang.en.sub' },
] as const

type LangCode = 'ca' | 'es' | 'en'

export default function LanguageScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [selected, setSelected] = useState<LangCode | null>((i18n.language as LangCode) ?? null)

  async function handleContinue() {
    if (!selected) return
    await AsyncStorage.setItem('language', selected)
    await i18n.changeLanguage(selected)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('lang.title')}</Text>
      <Text style={styles.subtitle}>{t('lang.subtitle')}</Text>

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
                <Text style={[styles.langName, isSelected && styles.langNameSelected]}>{t(lang.nameKey)}</Text>
                <Text style={styles.langSub}>{t(lang.subKey)}</Text>
              </View>
              {isSelected && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label={t('lang.continue')}
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
