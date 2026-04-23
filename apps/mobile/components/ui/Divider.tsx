import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors, spacing } from '@/theme'

interface DividerProps {
  style?: ViewStyle
  inset?: number
}

export function Divider({ style, inset = 0 }: DividerProps) {
  return <View style={[styles.divider, { marginLeft: inset }, style]} />
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.gray[100] },
})
