import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native'
import { colors, typography, spacing, radius } from '@/theme'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1800
const YEARS: number[] = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => CURRENT_YEAR - i)
const ITEM_HEIGHT = 50

interface Props {
  label?: string
  value: string
  onChange: (year: string) => void
}

export function YearPicker({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selectedIndex = value ? Math.max(0, CURRENT_YEAR - parseInt(value, 10)) : 0

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value || 'Selecciona un any...'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label ?? 'Any de fundació'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={YEARS}
              keyExtractor={y => String(y)}
              getItemLayout={(_, idx) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * idx, index: idx })}
              initialScrollIndex={selectedIndex}
              renderItem={({ item: year }) => {
                const sel = String(year) === value
                return (
                  <TouchableOpacity
                    style={[styles.yearRow, sel && styles.yearRowSel]}
                    onPress={() => { onChange(String(year)); setOpen(false) }}
                  >
                    <Text style={[styles.yearText, sel && styles.yearTextSel]}>{year}</Text>
                    {sel && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                )
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:         { gap: spacing[1] },
  label:        { ...typography.label, color: colors.gray[500] },
  trigger:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, backgroundColor: colors.white, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  triggerText:  { ...typography.body, color: colors.gray[900] },
  placeholder:  { color: colors.gray[400] },
  chevron:      { fontSize: 14, color: colors.gray[400] },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%' },
  sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  sheetTitle:   { ...typography.h3, color: colors.gray[900] },
  closeBtn:     { color: colors.gray[400], fontSize: 20, lineHeight: 24 },
  yearRow:      { height: ITEM_HEIGHT, paddingHorizontal: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearRowSel:   { backgroundColor: colors.primary[50] },
  yearText:     { ...typography.bodyLg, color: colors.gray[700] },
  yearTextSel:  { color: colors.primary[600], fontWeight: '700' },
  check:        { color: colors.primary[600], fontWeight: '700', fontSize: 16 },
})
