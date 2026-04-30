import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import ca from '@/locales/ca.json'
import es from '@/locales/es.json'
import en from '@/locales/en.json'

i18n.use(initReactI18next).init({
  resources: {
    ca: { translation: ca },
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'ca',
  fallbackLng: 'ca',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
})

export async function loadStoredLanguage() {
  const stored = await AsyncStorage.getItem('language')
  if (stored && stored !== i18n.language) {
    await i18n.changeLanguage(stored)
  }
}

export default i18n
