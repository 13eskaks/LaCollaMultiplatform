import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export default function JoinCollaScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [colles, setColles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [joining, setJoining] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('colles')
      .select('id, nom, localitat, avatar_url')
      .eq('estat', 'activa')
      .ilike('nom', `%${q}%`)
      .limit(20)
    setColles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => { search('') }, [])

  async function handleJoin(collaId: string) {
    setJoining(collaId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('colla_membres').insert({
        colla_id: collaId, user_id: user.id, estat: 'pendent', rol: 'membre',
      })
      setJoined(prev => new Set([...prev, collaId]))
      router.push(`/(auth)/onboarding/pending?colla_id=${collaId}`)
    } finally {
      setJoining(null)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Tornar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Busca la teua colla</Text>
        <Text style={styles.subtitle}>Cerca per nom o localitat</Text>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="🔍  Nom de la colla..."
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.primary[600]} /></View>
      ) : colles.length === 0 ? (
        <EmptyState icon="🔍" title="No s'han trobat colles" subtitle="Prova amb un altre terme de cerca" />
      ) : (
        <FlatList
          data={colles}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Avatar name={item.nom} uri={item.avatar_url} size="lg" />
              <View style={styles.info}>
                <Text style={styles.collaName}>{item.nom}</Text>
                {item.localitat && <Text style={styles.collaMeta}>📍 {item.localitat}</Text>}
              </View>
              <Button
                label={joined.has(item.id) ? 'Sol·licitat ✓' : 'Sol·licitar'}
                size="sm"
                variant={joined.has(item.id) ? 'secondary' : 'primary'}
                loading={joining === item.id}
                disabled={joined.has(item.id)}
                onPress={() => handleJoin(item.id)}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  header:      { backgroundColor: colors.white, paddingHorizontal: spacing.screenH, paddingBottom: spacing[4], gap: spacing[2], ...shadows.sm },
  back:        { marginTop: spacing[4] },
  backText:    { color: colors.primary[600], fontSize: 15 },
  title:       { ...typography.display, color: colors.gray[900], marginTop: spacing[3] },
  subtitle:    { ...typography.body, color: colors.gray[500] },
  searchInput: { marginTop: spacing[2] },
  loader:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { padding: spacing.screenH, gap: spacing[3] },
  card:        { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm },
  info:        { flex: 1 },
  collaName:   { ...typography.h3, color: colors.gray[900] },
  collaMeta:   { ...typography.bodySm, color: colors.gray[500], marginTop: 2 },
})
