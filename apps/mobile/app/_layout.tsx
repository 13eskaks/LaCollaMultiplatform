import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { registerForPushNotifications, useNotificationNavigation } from '@/lib/notifications'
import { useAuthStore } from '@/stores/auth'
import { useCollaStore } from '@/stores/colla'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { session, setSession, loading } = useAuthStore()
  const { loadColles } = useCollaStore()

  useNotificationNavigation(router)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        if (event === 'SIGNED_IN') {
          await loadColles()
          await registerForPushNotifications()
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = inAuthGroup && segments[1] === 'onboarding'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome')
    } else if (session && inAuthGroup && !inOnboarding) {
      router.replace('/(tabs)/')
    }
  }, [session, loading, segments])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="colla/[id]/landing" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/anuncis" />
      <Stack.Screen name="colla/[id]/anuncis/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/membres" />
      <Stack.Screen name="colla/[id]/votacions" />
      <Stack.Screen name="colla/[id]/votacions/[vid]" />
      <Stack.Screen name="colla/[id]/votacions/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="colla/[id]/torns" />
      <Stack.Screen name="colla/[id]/settings" />
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
      <Stack.Screen name="perfil/notifications" />
      <Stack.Screen name="perfil/premium-individual" options={{ presentation: 'modal' }} />
      <Stack.Screen name="perfil/password" options={{ presentation: 'modal' }} />
      <Stack.Screen name="perfil/privacitat" />
    </Stack>
  )
}
