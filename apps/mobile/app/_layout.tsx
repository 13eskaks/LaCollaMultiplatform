import '@/lib/web-polyfills'
import { useEffect } from 'react'
import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router'
import { I18nextProvider } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { registerForPushNotifications, useNotificationNavigation } from '@/lib/notifications'
import { useAuthStore } from '@/stores/auth'
import { useCollaStore } from '@/stores/colla'
import i18n, { loadStoredLanguage } from '@/lib/i18n'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments() as string[]
  const { session, setSession, loading } = useAuthStore()
  const { loadColles, loading: collesLoading, colles, collaActiva, setCollaActiva } = useCollaStore()
  const params = useGlobalSearchParams<{ id?: string }>()

  // Si s'obri directament una pantalla d'una colla (p. ex. recarregant a la web),
  // aquesta colla passa a ser l'activa perquè els permisos (comissió, etc.) siguen els correctes.
  useEffect(() => {
    if (segments[0] !== 'colla' || !params.id || collesLoading) return
    if (collaActiva?.id !== params.id && colles.some(c => c.id === params.id)) setCollaActiva(params.id)
  }, [segments[0], params.id, collesLoading, colles])

  useNotificationNavigation(router)

  useEffect(() => { loadStoredLanguage() }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // No cridem supabase dins del callback directament: supabase-js manté un
        // bloqueig d'auth i les crides niades poden quedar-se penjades.
        setTimeout(async () => {
          if (event === 'TOKEN_REFRESHED' && useAuthStore.getState().session) {
            useAuthStore.setState({ session: newSession })
            return
          }
          setSession(newSession)
          if (newSession) {
            await loadColles()
            await registerForPushNotifications()
          } else {
            useCollaStore.getState().reset()
          }
        }, 0)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = inAuthGroup && segments[1] === 'onboarding'
    const inLanguage = inAuthGroup && segments[1] === 'language'
    const isPublicRoute =
      (segments[0] === 'colla' && segments[2] === 'landing') ||
      segments[0] === 'event'

    if (!session && (!inAuthGroup || inOnboarding) && !isPublicRoute) {
      router.replace('/(auth)/welcome')
    } else if (session && inAuthGroup && !inOnboarding && !inLanguage) {
      router.replace('/(tabs)/' as any)
    }
  }, [session, loading, segments])

  // Esperem la sessió i, si n'hi ha, les colles de l'usuari (permisos) abans de pintar
  if (loading || (session && collesLoading && colles.length === 0)) return null

  return (
    <I18nextProvider i18n={i18n}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="colla/[id]/landing" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/anuncis" />
      <Stack.Screen name="colla/[id]/anuncis/[aid]" />
      <Stack.Screen name="colla/[id]/anuncis/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/llocs" />
      <Stack.Screen name="colla/[id]/tricount" />
      <Stack.Screen name="colla/[id]/tricount/nova" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/membres" />
      <Stack.Screen name="colla/[id]/votacions" />
      <Stack.Screen name="colla/[id]/votacions/[vid]" />
      <Stack.Screen name="colla/[id]/votacions/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/torns" />
      <Stack.Screen name="colla/[id]/settings" />
      <Stack.Screen name="colla/[id]/landing-editor" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/fotos" />
      <Stack.Screen name="colla/[id]/actes" />
      <Stack.Screen name="colla/[id]/quotes" />
      <Stack.Screen name="colla/[id]/caixa" />
      <Stack.Screen name="colla/[id]/pressupost" />
      <Stack.Screen name="colla/[id]/connexions" />
      <Stack.Screen name="colla/[id]/invitar" options={{ presentation: 'modal' }} />
      <Stack.Screen name="event/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="forum/[id]" />
      <Stack.Screen name="forum/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="perfil/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="perfil/colles" />
      <Stack.Screen name="perfil/garatge" />
      <Stack.Screen name="perfil/notifications" />
      <Stack.Screen name="perfil/premium-individual" options={{ presentation: 'modal' }} />
      <Stack.Screen name="perfil/password" options={{ presentation: 'modal' }} />
      <Stack.Screen name="perfil/privacitat" />
    </Stack>
    </I18nextProvider>
  )
}
