import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { Text, Image, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useCollaStore } from '@/stores/colla'
import { useAuthStore } from '@/stores/auth'
import { colors } from '@/theme'

export default function TabsLayout() {
  const router = useRouter()
  const { t } = useTranslation()
  const { colles, loading, collaActiva } = useCollaStore()
  const { profile } = useAuthStore()

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
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: t('tabs.agenda'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="colla"
        options={{
          title: t('tabs.colla'),
          tabBarIcon: ({ focused }) => collaActiva?.avatar_url ? (
            <View style={{
              width: 26, height: 26, borderRadius: 13, overflow: 'hidden',
              borderWidth: 2, borderColor: focused ? colors.primary[600] : colors.gray[300],
            }}>
              <Image source={{ uri: collaActiva.avatar_url }} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : (
            <Text style={{ fontSize: 22, color: focused ? colors.primary[600] : colors.gray[400] }}>🌩</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: t('tabs.forum'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: t('tabs.perfil'),
          tabBarIcon: ({ focused }) => profile?.avatar_url ? (
            <View style={{
              width: 26, height: 26, borderRadius: 13, overflow: 'hidden',
              borderWidth: 2, borderColor: focused ? colors.primary[600] : colors.gray[300],
            }}>
              <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : (
            <Text style={{ fontSize: 22, color: focused ? colors.primary[600] : colors.gray[400] }}>👤</Text>
          ),
        }}
      />
    </Tabs>
  )
}
