import { View, Text, StyleSheet } from 'react-native'
import { colors, radius } from '@/theme'

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'premium'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, { bg: string; text: string }> = {
  default:  { bg: colors.gray[100],    text: colors.gray[700] },
  primary:  { bg: colors.primary[100], text: colors.primary[600] },
  success:  { bg: colors.success[100], text: colors.success[500] },
  warning:  { bg: colors.warning[100], text: colors.warning[500] },
  danger:   { bg: colors.danger[100],  text: colors.danger[500] },
  premium:  { bg: colors.gold[100],    text: colors.gold[500] },
}

interface BadgeProps {
  label: string
  variant?: Variant
  size?: Size
}

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  const { bg, text } = VARIANTS[variant]
  return (
    <View style={[styles.base, styles[size], { backgroundColor: bg }]}>
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: text }]}>{label.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base:    { borderRadius: radius.xs, alignSelf: 'flex-start' },
  sm:      { paddingHorizontal: 6,  paddingVertical: 2 },
  md:      { paddingHorizontal: 8,  paddingVertical: 3 },
  text:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  textSm:  { fontSize: 10 },
})
