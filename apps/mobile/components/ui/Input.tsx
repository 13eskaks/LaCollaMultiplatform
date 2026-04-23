import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native'
import { colors, radius, typography } from '@/theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  rightIcon?: string
  onRightIconPress?: () => void
}

export function Input({ label, error, rightIcon, onRightIconPress, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.container,
        focused && styles.focused,
        error ? styles.errorBorder : null,
      ]}>
        <TextInput
          style={[styles.input, rightIcon ? styles.inputWithIcon : null, style as any]}
          placeholderTextColor={colors.gray[300]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.iconBtn}>
            <Text style={styles.icon}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:    { gap: 6 },
  label:      { ...typography.label, color: colors.gray[700] },
  container:  {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  focused:     { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  errorBorder: { borderColor: colors.danger[500] },
  input:       { flex: 1, fontSize: 15, color: colors.gray[900], height: '100%' },
  inputWithIcon: { paddingRight: 8 },
  iconBtn:     { padding: 4 },
  icon:        { fontSize: 18 },
  error:       { fontSize: 12, color: colors.danger[500] },
})
