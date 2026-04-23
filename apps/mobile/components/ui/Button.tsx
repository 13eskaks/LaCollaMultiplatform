import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, radius } from '@/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'premium'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  onPress?: () => void
  label: string
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  accessibilityLabel?: string
  haptic?: boolean
}

export function Button({
  onPress, label, variant = 'primary', size = 'md',
  loading = false, disabled = false, style, textStyle,
  accessibilityLabel, haptic = true,
}: ButtonProps) {
  const isDisabled = disabled || loading

  function handlePress() {
    if (haptic && !isDisabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    onPress?.()
  }

  const spinnerColor = (variant === 'secondary' || variant === 'ghost')
    ? colors.primary[600]
    : colors.white

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[styles.base, styles[variant], styles[size], isDisabled && styles.disabled, style]}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
    >
      {loading
        ? <ActivityIndicator color={spinnerColor} size="small" />
        : <Text style={[styles.text, styles[`text_${variant}` as keyof typeof styles], styles[`text_${size}` as keyof typeof styles], textStyle] as any}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base:            { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  disabled:        { opacity: 0.4 },

  primary:         { backgroundColor: colors.primary[600] },
  secondary:       { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary[600] },
  ghost:           { backgroundColor: 'transparent' },
  danger:          { backgroundColor: colors.danger[500] },
  premium:         { backgroundColor: colors.gold[500] },

  sm:              { height: 36, paddingHorizontal: 14 },
  md:              { height: 44, paddingHorizontal: 20 },
  lg:              { height: 52, paddingHorizontal: 24 },

  text:            { fontWeight: '600' as const },
  text_primary:    { color: colors.white },
  text_secondary:  { color: colors.primary[600] },
  text_ghost:      { color: colors.primary[600] },
  text_danger:     { color: colors.white },
  text_premium:    { color: colors.white },

  text_sm:         { fontSize: 13 },
  text_md:         { fontSize: 15 },
  text_lg:         { fontSize: 16 },
})
