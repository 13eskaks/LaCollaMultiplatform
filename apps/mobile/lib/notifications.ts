import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const isExpoGo = Constants.appOwnership === 'expo'

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo || !Device.isDevice) return null

  const Notifications = await import('expo-notifications')

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data

  const { data: { user } } = await supabase.auth.getUser()
  if (user && token) {
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id)
  }

  return token
}

export function useNotificationNavigation(router: any) {
  if (isExpoGo) return

  import('expo-notifications').then((Notifications) => {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      switch (data?.type) {
        case 'solicitud_entrada': router.push(`/colla/${data.colla_id}/membres?tab=pendents`); break
        case 'nou_event': router.push(`/event/${data.event_id}`); break
        case 'nova_votacio': router.push(`/colla/${data.colla_id}/votacions/${data.votacio_id}`); break
        case 'torn_neteja': router.push(`/colla/${data.colla_id}/torns`); break
        default: router.push('/')
      }
    })
  })
}
