import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export default function ConnexionsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const { isComissioActiva } = useCollaStore()
  const [connexions, setConnexions] = useState<any[]>([])
  const [pendents, setPendents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => { loadConnexions() }, [collaId])

  async function loadConnexions() {
    setLoading(true)
    const [acceptadesRes, pendentsRes] = await Promise.all([
      supabase
        .from('colla_connexions')
        .select(`
          id, colla_origen_id, colla_desti_id, estat,
          colla_origen:colles!colla_origen_id(nom, localitat, avatar_url),
          colla_desti:colles!colla_desti_id(nom, localitat, avatar_url)
        `)
        .or(`colla_origen_id.eq.${collaId},colla_desti_id.eq.${collaId}`)
        .eq('estat', 'acceptada'),
      supabase
        .from('colla_connexions')
        .select(`
          id, colla_origen_id, colla_desti_id, estat,
          colla_origen:colles!colla_origen_id(nom, localitat, avatar_url),
          colla_desti:colles!colla_desti_id(nom, localitat, avatar_url)
        `)
        .eq('colla_desti_id', collaId)
        .eq('estat', 'pendent'),
    ])
    setConnexions(acceptadesRes.data ?? [])
    setPendents(pendentsRes.data ?? [])
    setLoading(false)
  }

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const { data } = await supabase
      .from('colles')
      .select('id, nom, localitat, avatar_url')
      .ilike('nom', `%${q}%`)
      .neq('id', collaId)
      .eq('estat', 'activa')
      .limit(8)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function handleSolicitarConnexio(collaDestiId: string) {
    const existing = connexions.find(c =>
      (c.colla_origen_id === collaId && c.colla_desti_id === collaDestiId) ||
      (c.colla_desti_id === collaId && c.colla_origen_id === collaDestiId)
    )
    if (existing) {
      Alert.alert('Info', 'Ja existeix una connexió amb aquesta colla')
      return
    }

    const { error } = await supabase.from('colla_connexions').insert({
      colla_origen_id: collaId,
      colla_desti_id: collaDestiId,
      estat: 'pendent',
    })
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Sol·licitud enviada', 'La colla rebrà la teua sol·licitud de connexió')
      setSearchQuery('')
      setSearchResults([])
      loadConnexions()
    }
  }

  async function handleAcceptar(connexioId: string) {
    await supabase.from('colla_connexions').update({ estat: 'acceptada' }).eq('id', connexioId)
    loadConnexions()
  }

  async function handleRebutjar(connexioId: string) {
    await supabase.from('colla_connexions').update({ estat: 'rebutjada' }).eq('id', connexioId)
    loadConnexions()
  }

  function getAltraColla(connexio: any) {
    return connexio.colla_origen_id === collaId
      ? connexio.colla_desti
      : connexio.colla_origen
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Connexions" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cercar colles per connectar */}
        {isComissioActiva() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connectar amb una colla</Text>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="🔍 Busca una colla pel nom..."
                placeholderTextColor={colors.gray[400]}
              />
              {searching && <ActivityIndicator size="small" color={colors.primary[600]} style={{ marginRight: spacing[3] }} />}
            </View>

            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((c, idx) => (
                  <View key={c.id}>
                    <TouchableOpacity style={styles.resultRow} onPress={() => handleSolicitarConnexio(c.id)}>
                      <Avatar name={c.nom} uri={c.avatar_url} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultNom}>{c.nom}</Text>
                        {c.localitat && <Text style={styles.resultLocalitat}>📍 {c.localitat}</Text>}
                      </View>
                      <Text style={styles.connectarText}>Connectar →</Text>
                    </TouchableOpacity>
                    {idx < searchResults.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Sol·licituds pendents */}
        {pendents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sol·licituds rebudes ({pendents.length})</Text>
            <View style={styles.card}>
              {pendents.map((c, idx) => {
                const altra = c.colla_origen
                return (
                  <View key={c.id}>
                    <View style={styles.connexioRow}>
                      <Avatar name={altra?.nom ?? ''} uri={altra?.avatar_url} size="md" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.connexioNom}>{altra?.nom}</Text>
                        {altra?.localitat && <Text style={styles.connexioLocalitat}>📍 {altra.localitat}</Text>}
                      </View>
                      {isComissioActiva() && (
                        <View style={styles.btnRow}>
                          <TouchableOpacity style={styles.acceptarBtn} onPress={() => handleAcceptar(c.id)}>
                            <Text style={styles.acceptarText}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rebutjarBtn} onPress={() => handleRebutjar(c.id)}>
                            <Text style={styles.rebutjarText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {idx < pendents.length - 1 && <View style={styles.divider} />}
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Connexions acceptades */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colles connectades ({connexions.length})</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : connexions.length === 0 ? (
            <EmptyState icon="🔗" title="Sense connexions" subtitle="Connecta amb altres colles per col·laborar" />
          ) : (
            <View style={styles.card}>
              {connexions.map((c, idx) => {
                const altra = getAltraColla(c)
                return (
                  <View key={c.id}>
                    <View style={styles.connexioRow}>
                      <Avatar name={altra?.nom ?? ''} uri={altra?.avatar_url} size="md" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.connexioNom}>{altra?.nom}</Text>
                        {altra?.localitat && <Text style={styles.connexioLocalitat}>📍 {altra.localitat}</Text>}
                      </View>
                      <Badge label="Connectades" variant="success" size="sm" />
                    </View>
                    {idx < connexions.length - 1 && <View style={styles.divider} />}
                  </View>
                )
              })}
            </View>
          )}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.gray[50] },
  content:        { padding: spacing.screenH, gap: spacing[4] },
  section:        { gap: spacing[2] },
  sectionTitle:   { ...typography.label, color: colors.gray[500] },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray[200], ...shadows.sm },
  searchInput:    { flex: 1, height: 48, paddingHorizontal: spacing[3], ...typography.body, color: colors.gray[900] },
  searchResults:  { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  resultRow:      { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3] },
  resultNom:      { ...typography.body, color: colors.gray[900], fontWeight: '600' },
  resultLocalitat:{ ...typography.caption, color: colors.gray[400] },
  connectarText:  { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },
  card:           { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  connexioRow:    { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  connexioNom:    { ...typography.body, color: colors.gray[900], fontWeight: '600' },
  connexioLocalitat:{ ...typography.caption, color: colors.gray[400] },
  btnRow:         { flexDirection: 'row', gap: spacing[1] },
  acceptarBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success[500], justifyContent: 'center', alignItems: 'center' },
  acceptarText:   { color: colors.white, fontWeight: '700' },
  rebutjarBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[200], justifyContent: 'center', alignItems: 'center' },
  rebutjarText:   { color: colors.gray[600], fontWeight: '700' },
  divider:        { height: 1, backgroundColor: colors.gray[100] },
})
