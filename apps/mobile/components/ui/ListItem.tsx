import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { colors, typography, spacing, radius } from '@/theme'

interface ListItemProps {
  icon?: string
  title: string
  subtitle?: string
  right?: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
  chevron?: boolean
}

export function ListItem({ icon, title, subtitle, right, onPress, style, chevron = true }: ListItemProps) {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper style={[styles.item, style]} onPress={onPress} activeOpacity={0.7}>
      {icon && (
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right && <View style={styles.right}>{right}</View>}
      {chevron && onPress && <Text style={styles.chevron}>›</Text>}
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  item:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: colors.white, gap: spacing[3] },
  iconBox: { width: 32, height: 32, borderRadius: radius.xs, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  icon:    { fontSize: 16 },
  content: { flex: 1, gap: 2 },
  title:   { ...typography.body, color: colors.gray[800] },
  subtitle:{ ...typography.caption, color: colors.gray[400] },
  right:   { marginLeft: spacing[2] },
  chevron: { fontSize: 20, color: colors.gray[300], marginLeft: spacing[1] },
})
