import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius, shadows } from '@/theme'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
  elevated?: boolean
}

export function Card({ children, onPress, style, elevated = false }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, elevated && styles.elevated, style]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {children}
      </TouchableOpacity>
    )
  }
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card:     { backgroundColor: colors.white, borderRadius: radius.md, padding: 16, ...shadows.sm },
  elevated: { ...shadows.md },
})
