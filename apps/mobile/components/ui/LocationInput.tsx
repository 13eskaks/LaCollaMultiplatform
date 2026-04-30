import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export interface LocVal {
  nom: string
  lat: number
  lng: number
  lloc_id?: string
}

interface Props {
  label?: string
  value: string
  onChangeText: (text: string) => void
  onSelect: (loc: LocVal) => void
  placeholder?: string
  error?: string
  collaId?: string
}

export function LocationInput({ label, value, onChangeText, onSelect, placeholder, error, collaId }: Props) {
  const [collaLlocs, setCollaLlocs] = useState<any[]>([])
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSelectingRef = useRef(false)

  useEffect(() => {
    if (!collaId) return
    supabase.from('colla_llocs').select('*').eq('colla_id', collaId)
      .order('nom', { ascending: true })
      .then(({ data }) => setCollaLlocs(data ?? []))
  }, [collaId])

  function handleChange(text: string) {
    onChangeText(text)
    setSuggestions([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 3) return
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 400)
  }

  async function fetchSuggestions(q: string) {
    setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}&accept-language=ca`
      const res = await fetch(url, { headers: { 'User-Agent': 'LaCollaApp/1.0' } })
      const data: NominatimResult[] = await res.json()
      setSuggestions(data)
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }

  function selectSaved(lloc: any) {
    onChangeText(lloc.nom)
    onSelect({ nom: lloc.nom, lat: lloc.lat, lng: lloc.lng, lloc_id: lloc.id })
    setSuggestions([])
    setFocused(false)
  }

  function selectNominatim(item: NominatimResult) {
    const nom = item.display_name.split(',').slice(0, 2).join(',').trim()
    onChangeText(nom)
    onSelect({ nom, lat: parseFloat(item.lat), lng: parseFloat(item.lon) })
    setSuggestions([])
    setFocused(false)
  }

  const filteredCollaLlocs = collaLlocs.filter(l =>
    !value || l.nom.toLowerCase().includes(value.toLowerCase())
  )

  const showCollaSection = filteredCollaLlocs.length > 0
  const showNominatimSection = focused && suggestions.length > 0

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, !!error && styles.inputRowError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => {
            if (!isSelectingRef.current) setFocused(false)
            isSelectingRef.current = false
          }, 150)}
          placeholder={placeholder ?? '🔍 Busca una adreça...'}
          placeholderTextColor={colors.gray[400]}
        />
        {searching && (
          <ActivityIndicator size="small" color={colors.primary[600]} style={{ marginRight: spacing[2] }} />
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {(showCollaSection || showNominatimSection) && (
        <View style={styles.dropdown}>
          {showCollaSection && (
            <>
              <Text style={styles.sectionHeader}>📌 Llocs de la colla</Text>
              {filteredCollaLlocs.map((lloc, idx) => (
                <TouchableOpacity
                  key={lloc.id}
                  style={[styles.row, (idx < filteredCollaLlocs.length - 1 || showNominatimSection) && styles.rowBorder]}
                  onPressIn={() => selectSaved(lloc)}
                >
                  <Text style={styles.rowPin}>📌</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowNom}>{lloc.nom}</Text>
                    {lloc.adreca ? <Text style={styles.rowAdreca} numberOfLines={1}>{lloc.adreca}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {showNominatimSection && (
            <>
              <Text style={styles.sectionHeader}>🔍 Resultats de cerca</Text>
              {suggestions.map((item, idx) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={[styles.row, idx < suggestions.length - 1 && styles.rowBorder]}
                  onPressIn={() => selectNominatim(item)}
                >
                  <Text style={styles.rowPin}>📍</Text>
                  <Text style={styles.rowText} numberOfLines={2}>{item.display_name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:           { gap: spacing[1] },
  label:          { ...typography.label, color: colors.gray[500] },
  inputRow:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, backgroundColor: colors.white },
  inputRowError:  { borderColor: '#ef4444' },
  input:          { flex: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900] },
  errorText:      { ...typography.caption, color: '#ef4444' },
  dropdown:       { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, ...shadows.sm, marginTop: 2 },
  sectionHeader:  { ...typography.caption, color: colors.gray[400], fontWeight: '700', paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[1], backgroundColor: colors.gray[50] },
  row:            { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], padding: spacing[3] },
  rowBorder:      { borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  rowPin:         { fontSize: 14, marginTop: 1 },
  rowNom:         { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  rowAdreca:      { ...typography.caption, color: colors.gray[500], marginTop: 2 },
  rowText:        { ...typography.bodySm, color: colors.gray[700], flex: 1, lineHeight: 18 },
})
