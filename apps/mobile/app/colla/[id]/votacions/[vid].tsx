import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

export default function VotacioDetailScreen() {
  const { id: collaId, vid: votacioId } = useLocalSearchParams<{ id: string; vid: string }>()
  const router = useRouter()
  const [votacio, setVotacio] = useState<any>(null)
  const [opcions, setOpcions] = useState<any[]>([])
  const [vots, setVots] = useState<any[]>([])
  const [comentaris, setComentaris] = useState<any[]>([])
  const [myVot, setMyVot] = useState<string | null>(null)
  const [selectedOpcio, setSelectedOpcio] = useState<string | null>(null)
  const [comentariText, setComentariText] = useState('')
  const [loading, setLoading] = useState(true)
  const [votLoading, setVotLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadVotacio() }, [votacioId])

  async function loadVotacio() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const [votacioRes, opcionsRes, votsRes, comentarisRes] = await Promise.all([
      supabase.from('votacions').select('*').eq('id', votacioId).single(),
      supabase.from('votacio_opcions').select('*').eq('votacio_id', votacioId).order('ordre', { ascending: true }),
      supabase.from('vots').select('*, profiles(nom)').eq('votacio_id', votacioId),
      supabase.from('votacio_comentaris').select('*, profiles(nom, avatar_url)').eq('votacio_id', votacioId).order('created_at', { ascending: true }),
    ])

    setVotacio(votacioRes.data)
    setOpcions(opcionsRes.data ?? [])
    setVots(votsRes.data ?? [])
    setComentaris(comentarisRes.data ?? [])

    if (user) {
      const mine = votsRes.data?.find((v: any) => v.user_id === user.id)
      setMyVot(mine?.opcio_id ?? null)
    }
    setLoading(false)
  }

  async function handleVotar() {
    if (!selectedOpcio || !userId) return
    setVotLoading(true)
    try {
      const { error } = await supabase.functions.invoke('votar', {
        body: { votacio_id: votacioId, opcio_id: selectedOpcio }
      })
      if (error) throw error
      await loadVotacio()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No s\'ha pogut registrar el vot')
    }
    setVotLoading(false)
  }

  async function handleComentari() {
    if (!comentariText.trim() || !userId) return
    await supabase.from('votacio_comentaris').insert({
      votacio_id: votacioId,
      user_id: userId,
      text: comentariText.trim(),
    })
    setComentariText('')
    loadVotacio()
  }

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[600]} /></View>
  if (!votacio) return <View style={styles.loader}><Text style={styles.notFound}>Votació no trobada</Text></View>

  const isActiva = !votacio.data_limit || new Date(votacio.data_limit) > new Date()
  const hasVotat = !!myVot
  const totalVots = vots.length

  const resultats = opcions.map(o => ({
    ...o,
    count: vots.filter(v => v.opcio_id === o.id).length,
    pct: totalVots > 0 ? Math.round((vots.filter(v => v.opcio_id === o.id).length / totalVots) * 100) : 0,
  }))

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Badge label={isActiva ? '🗳️ ACTIVA' : '🔒 TANCADA'} variant={isActiva ? 'primary' : 'default'} />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pregunta}>{votacio.pregunta}</Text>
        {votacio.descripcio && <Text style={styles.descripcio}>{votacio.descripcio}</Text>}

        <Text style={styles.statsText}>
          {totalVots} {totalVots === 1 ? 'vot' : 'vots'}
          {votacio.data_limit && ` · ${new Date(votacio.data_limit).toLocaleDateString('ca-ES')}`}
        </Text>

        {/* Votar (activa i no ha votat) */}
        {isActiva && !hasVotat && (
          <View style={styles.votarSection}>
            <Text style={styles.sectionTitle}>Tria la teua opció</Text>
            {votacio.tipus === 'si_no' ? (
              <View style={styles.siNoRow}>
                {opcions.slice(0, 2).map((opt, idx) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.siNoBtn, selectedOpcio === opt.id && styles.siNoBtnActive]}
                    onPress={() => setSelectedOpcio(opt.id)}
                  >
                    <Text style={[styles.siNoBtnText, selectedOpcio === opt.id && { color: colors.white }]}>
                      {idx === 0 ? `✅ ${opt.text}` : `❌ ${opt.text}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              opcions.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.opcioBtn, selectedOpcio === o.id && styles.opcioBtnActive]}
                  onPress={() => setSelectedOpcio(o.id)}
                >
                  <View style={[styles.radio, selectedOpcio === o.id && styles.radioActive]}>
                    {selectedOpcio === o.id && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.opcioText}>{o.text}</Text>
                </TouchableOpacity>
              ))
            )}
            <Button
              label="Enviar vot 🗳️"
              size="lg"
              loading={votLoading}
              disabled={!selectedOpcio}
              onPress={handleVotar}
              style={{ marginTop: spacing[3] }}
            />
          </View>
        )}

        {/* Resultats (ha votat o tancada) */}
        {(hasVotat || !isActiva) && (
          <View style={styles.resultatsSection}>
            <Text style={styles.sectionTitle}>Resultats</Text>
            {resultats.map(r => (
              <View key={r.id} style={styles.resultatRow}>
                <View style={styles.resultatTop}>
                  <Text style={[styles.resultatText, myVot === r.id && { color: colors.primary[600], fontWeight: '700' }]}>
                    {r.text}
                    {myVot === r.id ? ' (el teu vot)' : ''}
                  </Text>
                  <Text style={styles.resultatPct}>{r.pct}%</Text>
                </View>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${r.pct}%` as any }]} />
                </View>
                <Text style={styles.resultatCount}>{r.count} vots</Text>
              </View>
            ))}
          </View>
        )}

        {/* Comentaris */}
        {votacio.permet_comentaris && (
          <View style={styles.comentarisSection}>
            <Text style={styles.sectionTitle}>Comentaris</Text>
            {comentaris.map(c => (
              <View key={c.id} style={styles.comentariRow}>
                <Avatar name={c.profiles?.nom ?? ''} size="sm" />
                <View style={styles.comentariBubble}>
                  <Text style={styles.comentariAutor}>{c.profiles?.nom}</Text>
                  <Text style={styles.comentariText}>{c.text}</Text>
                </View>
              </View>
            ))}

            <View style={styles.comentariInput}>
              <TextInput
                style={styles.comentariField}
                value={comentariText}
                onChangeText={setComentariText}
                placeholder="Afegeix un comentari..."
                placeholderTextColor={colors.gray[400]}
              />
              <TouchableOpacity style={styles.comentariSend} onPress={handleComentari}>
                <Text style={{ color: colors.white, fontWeight: '700' }}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.white },
  loader:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound:          { ...typography.body, color: colors.gray[500] },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:          { fontSize: 22, color: colors.primary[600] },
  content:           { padding: spacing.screenH, gap: spacing[4] },
  pregunta:          { ...typography.h1, color: colors.gray[900] },
  descripcio:        { ...typography.body, color: colors.gray[500] },
  statsText:         { ...typography.bodySm, color: colors.gray[400] },
  sectionTitle:      { ...typography.h3, color: colors.gray[800], marginBottom: spacing[3] },
  votarSection:      { gap: spacing[2] },
  siNoRow:           { flexDirection: 'row', gap: spacing[3] },
  siNoBtn:           { flex: 1, paddingVertical: spacing[4], borderRadius: radius.md, backgroundColor: colors.gray[100], alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  siNoBtnActive:     { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  siNoBtnText:       { ...typography.h3, color: colors.gray[700] },
  opcioBtn:          { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.sm, backgroundColor: colors.gray[50], borderWidth: 1.5, borderColor: colors.gray[200] },
  opcioBtnActive:    { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  radio:             { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.gray[300], justifyContent: 'center', alignItems: 'center' },
  radioActive:       { borderColor: colors.primary[600] },
  radioDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary[600] },
  opcioText:         { ...typography.body, color: colors.gray[800] },
  resultatsSection:  { gap: spacing[3] },
  resultatRow:       { gap: spacing[1] },
  resultatTop:       { flexDirection: 'row', justifyContent: 'space-between' },
  resultatText:      { ...typography.body, color: colors.gray[700] },
  resultatPct:       { ...typography.body, color: colors.gray[700], fontWeight: '700' },
  barBackground:     { height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  barFill:           { height: 8, backgroundColor: colors.primary[600], borderRadius: 4 },
  resultatCount:     { ...typography.caption, color: colors.gray[400] },
  comentarisSection: { gap: spacing[3] },
  comentariRow:      { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  comentariBubble:   { flex: 1, backgroundColor: colors.gray[50], borderRadius: radius.sm, padding: spacing[3], gap: spacing[1] },
  comentariAutor:    { ...typography.label, color: colors.gray[700] },
  comentariText:     { ...typography.body, color: colors.gray[600] },
  comentariInput:    { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  comentariField:    { flex: 1, height: 44, backgroundColor: colors.gray[100], borderRadius: radius.sm, paddingHorizontal: spacing[3], ...typography.body, color: colors.gray[900] },
  comentariSend:     { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },
})
