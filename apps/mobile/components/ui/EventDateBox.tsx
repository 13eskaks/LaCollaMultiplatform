import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '@/theme'

export function EventDateBox({ inici, fi }: { inici: string; fi?: string | null }) {
  const start = new Date(inici)
  const end = fi ? new Date(fi) : null
  const sameDay = !end || start.toDateString() === end.toDateString()

  if (sameDay) {
    return (
      <View style={styles.box}>
        <Text style={styles.day}>{start.getDate()}</Text>
        <Text style={styles.mon}>{start.toLocaleDateString('ca-ES', { month: 'short' }).toUpperCase()}</Text>
      </View>
    )
  }

  const sameMonth = start.getMonth() === end!.getMonth() && start.getFullYear() === end!.getFullYear()
  if (sameMonth) {
    return (
      <View style={styles.box}>
        <Text style={styles.range}>{start.getDate()}–{end!.getDate()}</Text>
        <Text style={styles.mon}>{start.toLocaleDateString('ca-ES', { month: 'short' }).toUpperCase()}</Text>
      </View>
    )
  }

  return (
    <View style={styles.box}>
      <Text style={styles.multi}>{start.getDate()} {start.toLocaleDateString('ca-ES', { month: 'short' }).toUpperCase()}</Text>
      <Text style={styles.sep}>–</Text>
      <Text style={styles.multi}>{end!.getDate()} {end!.toLocaleDateString('ca-ES', { month: 'short' }).toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box:   { backgroundColor: colors.primary[50], borderRadius: radius.sm, width: 54, alignItems: 'center', paddingVertical: spacing[2], gap: 1 },
  day:   { fontSize: 20, fontWeight: '800', color: colors.primary[600] },
  mon:   { fontSize: 10, fontWeight: '700', color: colors.primary[600] },
  range: { fontSize: 15, fontWeight: '800', color: colors.primary[600] },
  multi: { fontSize: 9, fontWeight: '700', color: colors.primary[600], lineHeight: 12 },
  sep:   { fontSize: 10, color: colors.primary[400], lineHeight: 10 },
})
