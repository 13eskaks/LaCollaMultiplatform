import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export default function CollaLandingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [colla, setColla] = useState<any>(null)
  const [stats, setStats] = useState({ membres: 0, events: 0 })
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [alreadyMembre, setAlreadyMembre] = useState(false)

  useEffect(() => { loadColla() }, [id])

  async function loadColla() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [collaRes, membresRes, eventsRes, membresiaRes] = await Promise.all([
      supabase.from('colles').select('*').eq('id', id).single(),
      supabase.from('colla_membres').select('id', { count: 'exact', head: true }).eq('colla_id', id).eq('estat', 'actiu'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('colla_id', id),
      user ? supabase.from('colla_membres').select('id').eq('colla_id', id).eq('user_id', user.id).limit(1) : null,
    ])

    setColla(collaRes.data)
    setStats({ membres: membresRes.count ?? 0, events: eventsRes.count ?? 0 })
    if (membresiaRes?.data && membresiaRes.data.length > 0) setAlreadyMembre(true)
    setLoading(false)
  }

  async function handleJoin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/(auth)/register')
      return
    }
    setJoining(true)
    const { error } = await supabase.from('colla_membres').insert({
      colla_id: id, user_id: user.id, estat: 'pendent', rol: 'membre',
    })
    setJoining(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      router.replace(`/(auth)/onboarding/pending?colla_id=${id}`)
    }
  }

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[600]} /></View>
  if (!colla) return <View style={styles.loader}><Text style={{ color: colors.gray[500] }}>Colla no trobada</Text></View>

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero portada */}
        <View style={styles.hero}>
          {colla.portada_url ? (
            <Image source={{ uri: colla.portada_url }} style={styles.portada} />
          ) : (
            <View style={[styles.portada, { backgroundColor: colors.primary[600] }]} />
          )}
          <View style={styles.heroOverlay} />
          <SafeAreaView style={styles.heroTop} edges={['top']}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Contingut */}
        <View style={styles.content}>
          <Avatar name={colla.nom} uri={colla.avatar_url} size="2xl" border style={styles.avatar} />

          <Text style={styles.nom}>{colla.nom}</Text>
          {colla.localitat && <Text style={styles.localitat}>📍 {colla.localitat}</Text>}
          {colla.any_fundacio && (
            <Text style={styles.meta}>Fundada el {colla.any_fundacio} · {new Date().getFullYear() - colla.any_fundacio} anys</Text>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.membres}</Text>
              <Text style={styles.statLabel}>Membres</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.events}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>

          {colla.descripcio && (
            <Text style={styles.descripcio}>{colla.descripcio}</Text>
          )}

          {/* Xarxes socials */}
          {(colla.instagram || colla.facebook || colla.web) && (
            <View style={styles.xarxesRow}>
              {colla.instagram && <Badge label="📷 Instagram" variant="default" />}
              {colla.facebook && <Badge label="👥 Facebook" variant="default" />}
              {colla.web && <Badge label="🌐 Web" variant="default" />}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* CTA fix a baix */}
      <View style={styles.cta}>
        {alreadyMembre ? (
          <Button label="Ja formes part d'aquesta colla ✓" variant="secondary" size="lg" disabled style={{ flex: 1 }} onPress={() => {}} />
        ) : (
          <Button label="Sol·licitar unir-me" size="lg" loading={joining} style={{ flex: 1 }} onPress={handleJoin} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.white },
  loader:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero:        { height: 200, position: 'relative' },
  portada:     { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroTop:     { ...StyleSheet.absoluteFillObject, paddingHorizontal: spacing.screenH },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginTop: spacing[2] },
  closeBtnText:{ color: colors.white, fontSize: 14 },
  content:     { paddingHorizontal: spacing.screenH, alignItems: 'center', gap: spacing[3] },
  avatar:      { marginTop: -40 },
  nom:         { ...typography.h1, color: colors.gray[900], textAlign: 'center' },
  localitat:   { ...typography.body, color: colors.gray[500] },
  meta:        { ...typography.caption, color: colors.gray[400] },
  statsRow:    { flexDirection: 'row', backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing[3], alignSelf: 'stretch', justifyContent: 'center' },
  stat:        { flex: 1, alignItems: 'center', gap: 2 },
  statNum:     { ...typography.h2, color: colors.gray[900] },
  statLabel:   { ...typography.caption, color: colors.gray[500] },
  statDivider: { width: 1, backgroundColor: colors.gray[200] },
  descripcio:  { ...typography.bodyLg, color: colors.gray[600], textAlign: 'center', lineHeight: 24 },
  xarxesRow:   { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', justifyContent: 'center' },
  cta:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, paddingHorizontal: spacing.screenH, paddingTop: spacing[3], paddingBottom: spacing[8], borderTopWidth: 1, borderTopColor: colors.gray[100], flexDirection: 'row', ...shadows.md },
})
