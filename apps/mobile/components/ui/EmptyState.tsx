import { View, Text, StyleSheet } from 'react-native'
import { Button } from './Button'
import { colors, typography } from '@/theme'

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} size="md" style={styles.btn} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  icon:      { fontSize: 56 },
  title:     { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  subtitle:  { ...typography.body, color: colors.gray[500], textAlign: 'center' },
  btn:       { marginTop: 8 },
})
