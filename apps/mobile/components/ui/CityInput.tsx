import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, typography, spacing, radius, shadows } from '@/theme'

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
  }
}

interface Props {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  error?: string
}

export function CityInput({ label, value, onChangeText, placeholder, error }: Props) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(text: string) {
    onChangeText(text)
    setSuggestions([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 2) return
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 400)
  }

  async function fetchSuggestions(q: string) {
    setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}&accept-language=ca&countrycodes=es,ad`
      const res = await fetch(url, { headers: { 'User-Agent': 'LaCollaApp/1.0' } })
      const data: NominatimResult[] = await res.json()
      setSuggestions(data)
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }

  function cityName(item: NominatimResult): string {
    return item.address.city ?? item.address.town ?? item.address.village ?? item.address.municipality ?? item.display_name.split(',')[0].trim()
  }

  function subLabel(item: NominatimResult): string {
    return [item.address.county, item.address.state].filter(Boolean).join(', ')
  }

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, !!error && styles.inputRowError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          onBlur={() => setTimeout(() => setSuggestions([]), 200)}
          placeholder={placeholder ?? 'Ex: Gràcia, Barcelona...'}
          placeholderTextColor={colors.gray[400]}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {searching && (
          <ActivityIndicator size="small" color={colors.primary[600]} style={{ marginRight: spacing[2] }} />
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item, idx) => (
            <TouchableOpacity
              key={item.place_id}
              style={[styles.row, idx < suggestions.length - 1 && styles.rowBorder]}
              onPress={() => { onChangeText(cityName(item)); setSuggestions([]) }}
            >
              <Text style={styles.rowPin}>🏘</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowNom}>{cityName(item)}</Text>
                {subLabel(item) ? <Text style={styles.rowSub} numberOfLines={1}>{subLabel(item)}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:          { gap: spacing[1] },
  label:         { ...typography.label, color: colors.gray[500] },
  inputRow:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, backgroundColor: colors.white },
  inputRowError: { borderColor: '#ef4444' },
  input:         { flex: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  errorText:     { ...typography.caption, color: '#ef4444' },
  dropdown:      { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, ...shadows.md, marginTop: 2 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3] },
  rowBorder:     { borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  rowPin:        { fontSize: 14 },
  rowNom:        { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  rowSub:        { ...typography.caption, color: colors.gray[400], marginTop: 1 },
})
