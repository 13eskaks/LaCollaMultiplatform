import { createElement } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, typography } from '@/theme'

interface Props {
  label?: string
  value: Date | null
  onChange: (date: Date) => void
  mode?: 'date' | 'time'
  minimumDate?: Date
  maximumDate?: Date
  error?: string
  placeholder?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Versió web del DatePicker: input natiu del navegador. */
export function DatePicker({ label, value, onChange, mode = 'date', minimumDate, maximumDate, error }: Props) {
  function handle(e: any) {
    const v: string = e.target.value
    if (!v) return
    const base = value ? new Date(value) : new Date()
    if (mode === 'date') {
      const [y, m, d] = v.split('-').map(Number)
      base.setFullYear(y, m - 1, d)
    } else {
      const [h, mi] = v.split(':').map(Number)
      base.setHours(h, mi, 0, 0)
    }
    onChange(base)
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      {createElement('input', {
        type: mode,
        value: value ? (mode === 'date' ? toDateStr(value) : toTimeStr(value)) : '',
        min: mode === 'date' && minimumDate ? toDateStr(minimumDate) : undefined,
        max: mode === 'date' && maximumDate ? toDateStr(maximumDate) : undefined,
        onChange: handle,
        style: {
          height: 48,
          boxSizing: 'border-box',
          width: '100%',
          border: `1.5px solid ${error ? colors.danger[500] : colors.gray[300]}`,
          borderRadius: radius.sm,
          background: colors.white,
          padding: '0 14px',
          fontSize: 15,
          color: colors.gray[900],
          fontFamily: 'inherit',
        },
      })}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { ...typography.label, color: colors.gray[700] },
  error: { fontSize: 12, color: colors.danger[500] },
})
