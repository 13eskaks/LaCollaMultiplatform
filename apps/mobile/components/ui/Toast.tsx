import { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, View } from 'react-native'
import { colors, typography, spacing, radius, shadows } from '@/theme'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

const VARIANT_STYLES: Record<ToastVariant, { bg: string; text: string; icon: string }> = {
  success: { bg: colors.success[100], text: colors.success[500], icon: '✅' },
  error:   { bg: colors.danger[100],  text: colors.danger[500],  icon: '❌' },
  info:    { bg: colors.primary[50],  text: colors.primary[600], icon: 'ℹ️' },
  warning: { bg: colors.warning[100], text: colors.warning[500], icon: '⚠️' },
}

interface ToastProps {
  message: string
  variant?: ToastVariant
  visible: boolean
  onHide: () => void
  duration?: number
}

export function Toast({ message, variant = 'info', visible, onHide, duration = 3000 }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide())
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [visible])

  const { bg, text, icon } = VARIANT_STYLES[variant]

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity, backgroundColor: bg }]}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[styles.text, { color: text }]}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: spacing.screenH, right: spacing.screenH, flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3], borderRadius: radius.md, ...shadows.md, zIndex: 9999 },
  text:      { ...typography.body, fontWeight: '600', flex: 1 },
})
