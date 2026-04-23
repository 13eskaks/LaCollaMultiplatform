import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { Text } from 'react-native'
import { useCollaStore } from '@/stores/colla'
import { colors } from '@/theme'

export default function TabsLayout() {
  const router = useRouter()
  const { colles, loading } = useCollaStore()

  useEffect(() => {
    if (!loading && colles.length === 0) {
      router.replace('/(auth)/onboarding')
    }
  }, [colles, loading])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray[100],
          height: 84,
          paddingBottom: 24,
        },
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inici',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="colla"
        options={{
          title: 'Colla',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🌩</Text>,
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: 'Fòrum',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
    </Tabs>
  )
}
