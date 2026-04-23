import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'

const NOTIFICATIONS = [
  {
    section: 'LA MEUA COLLA',
    items: [
      { key: 'notif_anuncis', label: 'Nous anuncis', defaultValue: true },
      { key: 'notif_votacions', label: 'Votacions', defaultValue: true },
      { key: 'notif_events_24h', label: 'Recordatori d\'events (24h)', defaultValue: true },
      { key: 'notif_events_1h', label: 'Recordatori d\'events (1h)', defaultValue: true },
      { key: 'notif_torns', label: 'Torns de neteja', defaultValue: true },
      { key: 'notif_nous_membres', label: 'Nous membres', defaultValue: false },
    ],
  },
  {
    section: 'FÒRUM',
    items: [
      { key: 'notif_forum_respostes', label: 'Respostes als meus fils', defaultValue: true },
      { key: 'notif_forum_populars', label: 'Fils populars', defaultValue: false },
    ],
  },
  {
    section: 'GENERAL',
    items: [
      { key: 'notif_push', label: 'Notificacions push', defaultValue: true },
      { key: 'notif_email', label: 'Correu electrònic (resum setmanal)', defaultValue: false },
      { key: 'notif_dnd', label: 'Mode no molestar (22:00 - 09:00)', defaultValue: false },
    ],
  },
]

export default function NotificationsScreen() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {}
    NOTIFICATIONS.forEach(s => s.items.forEach(i => { defaults[i.key] = i.defaultValue }))
    return defaults
  })

  function toggle(key: string, value: boolean) {
    setPrefs(p => {
      const next = { ...p, [key]: value }
      AsyncStorage.setItem('notif_prefs', JSON.stringify(next)).catch(() => {})
      return next
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Notificacions" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {NOTIFICATIONS.map(section => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.card}>
              {section.items.map((item, idx) => (
                <View key={item.key}>
                  <View style={styles.row}>
                    <Text style={styles.label}>{item.label}</Text>
                    <Switch
                      value={prefs[item.key]}
                      onValueChange={v => toggle(item.key, v)}
                      trackColor={{ true: colors.primary[600] }}
                    />
                  </View>
                  {idx < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  content:      { padding: spacing.screenH, gap: spacing[4] },
  section:      {},
  sectionTitle: { ...typography.label, color: colors.gray[400], marginBottom: spacing[2] },
  card:         { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  label:        { ...typography.body, color: colors.gray[800], flex: 1, paddingRight: spacing[4] },
  divider:      { height: 1, backgroundColor: colors.gray[100] },
})
