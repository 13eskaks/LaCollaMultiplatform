import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, Platform, StyleSheet } from 'react-native'
import RNDateTimePicker from '@react-native-community/datetimepicker'
import { colors, radius, typography, spacing } from '@/theme'

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

function format(date: Date, mode: 'date' | 'time') {
  if (mode === 'time') return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DatePicker({ label, value, onChange, mode = 'date', minimumDate, maximumDate, error, placeholder }: Props) {
  const [show, setShow] = useState(false)
  const defaultPlaceholder = mode === 'time' ? 'Selecciona hora' : 'Selecciona data'

  function handleChange(_: any, selected?: Date) {
    if (Platform.OS === 'android') setShow(false)
    if (selected) onChange(selected)
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.container, error ? styles.errorBorder : null]}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? format(value, mode) : (placeholder ?? defaultPlaceholder)}
        </Text>
        <Text style={styles.icon}>{mode === 'time' ? '🕐' : '📅'}</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      {show && Platform.OS === 'android' && (
        <RNDateTimePicker
          value={value ?? new Date()}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setShow(false)}>
                <Text style={styles.doneText}>Fet</Text>
              </TouchableOpacity>
              <RNDateTimePicker
                value={value ?? new Date()}
                mode={mode}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleChange}
                display="spinner"
                locale="ca-ES"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:      { gap: 6 },
  label:        { ...typography.label, color: colors.gray[700] },
  container:    {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  errorBorder:  { borderColor: colors.danger[500] },
  value:        { fontSize: 15, color: colors.gray[900] },
  placeholder:  { color: colors.gray[300] },
  icon:         { fontSize: 16 },
  error:        { fontSize: 12, color: colors.danger[500] },
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: spacing[6] },
  doneBtn:      { alignItems: 'flex-end', padding: spacing[4] },
  doneText:     { ...typography.body, color: colors.primary[600], fontWeight: '600' },
})
