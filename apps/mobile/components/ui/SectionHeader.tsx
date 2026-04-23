import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, typography, spacing } from '@/theme'

interface SectionHeaderProps {
  title: string
  linkLabel?: string
  onLinkPress?: () => void
}

export function SectionHeader({ title, linkLabel, onLinkPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {linkLabel && (
        <TouchableOpacity onPress={onLinkPress}>
          <Text style={styles.link}>{linkLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  title: { ...typography.h3, color: colors.gray[900] },
  link:  { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },
})
