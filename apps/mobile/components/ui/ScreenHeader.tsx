import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { ReactNode } from 'react'
import { useRouter } from 'expo-router'
import { colors, typography, spacing, shadows } from '@/theme'

interface ScreenHeaderProps {
  title: string
  onBack?: () => void
  leftAction?: { label: string; onPress?: () => void }
  rightAction?: { label: string; onPress: () => void }
  right?: ReactNode
  style?: ViewStyle
  shadow?: boolean
}

export function ScreenHeader({ title, onBack, leftAction, rightAction, right, style, shadow = false }: ScreenHeaderProps) {
  const router = useRouter()

  const handleLeft = onBack ?? leftAction?.onPress ?? (() => router.back())
  const leftLabel = leftAction?.label ?? '←'

  return (
    <View style={[styles.header, shadow && styles.shadow, style]}>
      <TouchableOpacity style={styles.side} onPress={handleLeft}>
        <Text style={styles.actionText}>{leftLabel}</Text>
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.side}>
        {right ?? (rightAction && (
          <TouchableOpacity onPress={rightAction.onPress}>
            <Text style={styles.actionText}>{rightAction.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  shadow:  { ...shadows.sm },
  title:   { ...typography.h3, color: colors.gray[900], flex: 1, textAlign: 'center', marginHorizontal: spacing[2] },
  side:    { minWidth: 60 },
  actionText:{ ...typography.body, color: colors.primary[600], fontWeight: '600' },
})
