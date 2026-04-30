import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { RichBodyView } from '@/components/ui/RichBody'
import type { SavedBlock } from '@/components/ui/RichBody'
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
  const [myVots, setMyVots] = useState<string[]>([])
  const [selectedOpcions, setSelectedOpcions] = useState<string[]>([])
  const [comentariText, setComentariText] = useState('')
  const [loading, setLoading] = useState(true)
  const [votLoading, setVotLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<{ nom: string; avatar_url: string | null } | null>(null)

  useFocusEffect(useCallback(() => { loadVotacio() }, [votacioId]))

  async function loadVotacio() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    if (user) {
      const { data: p } = await supabase.from('profiles').select('nom, avatar_url').eq('id', user.id).single()
      setMyProfile(p ?? null)
    }

    const [votacioRes, opcionsRes, votsRes, comentarisRes] = await Promise.all([
      supabase.from('votacions').select('*').eq('id', votacioId).single(),
      supabase.from('votacio_opcions').select('*').eq('votacio_id', votacioId).order('ordre', { ascending: true }),
      supabase.from('vots').select('id, votacio_id, opcio_id, user_id, profiles!user_id(nom, avatar_url)').eq('votacio_id', votacioId),
      supabase.from('votacio_comentaris').select('*, profiles(nom, avatar_url)').eq('votacio_id', votacioId).order('created_at', { ascending: true }),
    ])

    if (votsRes.error) console.error('[vots] select error:', votsRes.error.message)

    setVotacio(votacioRes.data)
    setOpcions(opcionsRes.data ?? [])
    setVots(votsRes.data ?? [])
    setComentaris(comentarisRes.data ?? [])

    if (user) {
      const mine = votsRes.data?.filter((v: any) => v.user_id === user.id) ?? []
      setMyVots(mine.map((v: any) => v.opcio_id))
    }
    setLoading(false)
  }

  async function handleVotar() {
    if (!selectedOpcions.length || !userId) return
    setVotLoading(true)
    try {
      await supabase.from('vots').delete().eq('votacio_id', votacioId).eq('user_id', userId)
      const { error } = await supabase.from('vots').insert(
        selectedOpcions.map(opcioId => ({ votacio_id: votacioId, opcio_id: opcioId, user_id: userId }))
      )
      if (error) throw error
      setMyVots(selectedOpcions)
      setVots(prev => [
        ...prev.filter(v => v.user_id !== userId),
        ...selectedOpcions.map((opcioId, i) => ({ id: `tmp-${i}`, votacio_id: votacioId, opcio_id: opcioId, user_id: userId, profiles: myProfile })),
      ])
    } catch (e: any) {
      Alert.alert('Error votant', e.message ?? 'No s\'ha pogut registrar el vot')
    }
    setVotLoading(false)
  }

  async function handleRetiraVot() {
    if (!userId) return
    setVotLoading(true)
    try {
      const { error } = await supabase.from('vots').delete().eq('votacio_id', votacioId).eq('user_id', userId)
      if (error) throw error
      setMyVots([])
      setSelectedOpcions([])
      await loadVotacio()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setVotLoading(false)
  }

  async function handleDeleteComentari(comentariId: string) {
    await supabase.from('votacio_comentaris').delete().eq('id', comentariId)
    setComentaris(prev => prev.filter(c => c.id !== comentariId))
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
  const hasVotat = myVots.length > 0
  const totalVots = votacio.multi_resposta
    ? new Set(vots.map(v => v.user_id)).size
    : vots.length

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
          <Text style={[styles.pregunta, { flex: 1 }]}>{votacio.pregunta}</Text>
          {userId === votacio.creador_id && (
            <TouchableOpacity onPress={() => router.push(`/colla/${collaId}/votacions/create?votacioId=${votacioId}` as any)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>
        {(votacio.descripcio_blocks || votacio.descripcio) && (
          votacio.descripcio_blocks
            ? <RichBodyView blocks={votacio.descripcio_blocks as SavedBlock[]} textStyle={styles.descripcio} />
            : <Text style={styles.descripcio}>{votacio.descripcio}</Text>
        )}

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
                    style={[styles.siNoBtn, selectedOpcions.includes(opt.id) && styles.siNoBtnActive]}
                    onPress={() => setSelectedOpcions([opt.id])}
                  >
                    <Text style={[styles.siNoBtnText, selectedOpcions.includes(opt.id) && { color: colors.white }]}>
                      {idx === 0 ? `✅ ${opt.text}` : `❌ ${opt.text}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : votacio.tipus === 'puntuacio' ? (
              <View style={styles.starsRow}>
                {(() => {
                  const selectedVal = selectedOpcions[0] ? Number(opcions.find(x => x.id === selectedOpcions[0])?.text ?? 0) : 0
                  return opcions.map(o => {
                    const filled = Number(o.text) <= selectedVal
                    return (
                      <TouchableOpacity key={o.id} onPress={() => setSelectedOpcions([o.id])} style={styles.starBtn} activeOpacity={0.7}>
                        <Text style={[styles.starText, filled && styles.starTextFilled]}>★</Text>
                      </TouchableOpacity>
                    )
                  })
                })()}
              </View>
            ) : (
              opcions.map(o => {
                const isSelected = selectedOpcions.includes(o.id)
                const multi = votacio.multi_resposta
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.opcioBtn, isSelected && styles.opcioBtnActive]}
                    onPress={() => {
                      if (multi) {
                        setSelectedOpcions(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])
                      } else {
                        setSelectedOpcions([o.id])
                      }
                    }}
                  >
                    {multi ? (
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    ) : (
                      <View style={[styles.radio, isSelected && styles.radioActive]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    )}
                    <Text style={styles.opcioText}>{o.text}</Text>
                  </TouchableOpacity>
                )
              })
            )}
            <Button
              label="Enviar vot 🗳️"
              size="lg"
              loading={votLoading}
              disabled={!selectedOpcions.length}
              onPress={handleVotar}
              style={{ marginTop: spacing[3] }}
            />
          </View>
        )}

        {/* Resultats (ha votat o tancada) */}
        {(hasVotat || !isActiva) && (
          <View style={styles.resultatsSection}>
            <Text style={styles.sectionTitle}>Resultats</Text>
            {votacio.tipus === 'puntuacio' ? (() => {
              const avg = totalVots > 0
                ? (vots.reduce((sum, v) => sum + Number(opcions.find(o => o.id === v.opcio_id)?.text ?? 0), 0) / totalVots).toFixed(1)
                : '—'
              const myVal = myVots[0] ? opcions.find(o => o.id === myVots[0])?.text : null
              return (
                <View style={{ gap: spacing[3] }}>
                  <View style={styles.avgRow}>
                    <Text style={styles.avgNum}>{avg}</Text>
                    <Text style={styles.avgStars}>{'★'.repeat(Math.round(Number(avg)))}</Text>
                    <Text style={styles.avgLabel}>mitjana de {totalVots} {totalVots === 1 ? 'vot' : 'vots'}</Text>
                  </View>
                  {myVal && <Text style={styles.myVotText}>El teu vot: {'★'.repeat(Number(myVal))} ({myVal})</Text>}
                  {resultats.map(r => (
                    <View key={r.id} style={styles.resultatRow}>
                      <View style={styles.resultatTop}>
                        <Text style={styles.resultatText}>{'★'.repeat(Number(r.text))}</Text>
                        <Text style={styles.resultatPct}>{r.pct}%</Text>
                      </View>
                      <View style={styles.barBackground}>
                        <View style={[styles.barFill, { width: `${r.pct}%` as any }]} />
                      </View>
                    </View>
                  ))}
                </View>
              )
            })() : (
              resultats.map(r => {
                const voters = votacio.vots_anonims ? [] : vots.filter(v => v.opcio_id === r.id)
                return (
                  <View key={r.id} style={styles.resultatRow}>
                    <View style={styles.resultatTop}>
                      <Text style={[styles.resultatText, myVots.includes(r.id) && { color: colors.primary[600], fontWeight: '700' }]}>
                        {r.text}
                        {myVots.includes(r.id) ? ' ✓' : ''}
                      </Text>
                      <Text style={styles.resultatPct}>{r.pct}%</Text>
                    </View>
                    <View style={styles.barBackground}>
                      <View style={[styles.barFill, { width: `${r.pct}%` as any }]} />
                    </View>
                    <Text style={styles.resultatCount}>{r.count} {r.count === 1 ? 'vot' : 'vots'}</Text>
                    {voters.length > 0 && (
                      <View style={styles.votersRow}>
                        {voters.map(v => (
                          <Avatar key={v.id} name={v.profiles?.nom ?? '?'} uri={v.profiles?.avatar_url} size="xs" style={styles.voterAvatar} />
                        ))}
                        <Text style={styles.votersText}>
                          {voters.map((v: any) => v.profiles?.nom ?? '?').join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* Retirar vot */}
        {isActiva && hasVotat && (
          <Button
            label="Retirar vot"
            variant="secondary"
            size="md"
            loading={votLoading}
            onPress={handleRetiraVot}
          />
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
                {c.user_id === userId && (
                  <TouchableOpacity onPress={() => handleDeleteComentari(c.id)}>
                    <Text style={{ color: colors.danger[500], fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
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
                <Ionicons name="send" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
      </KeyboardAvoidingView>
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
  editBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  editBtnText:       { fontSize: 16 },
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
  checkbox:          { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.gray[300], justifyContent: 'center', alignItems: 'center' },
  checkboxActive:    { borderColor: colors.primary[600], backgroundColor: colors.primary[600] },
  checkmark:         { fontSize: 13, color: colors.white, fontWeight: '700', lineHeight: 16 },
  opcioText:         { ...typography.body, color: colors.gray[800] },
  starsRow:          { flexDirection: 'row', gap: spacing[2], justifyContent: 'center', paddingVertical: spacing[3] },
  starBtn:           { padding: spacing[2] },
  starText:          { fontSize: 40, color: colors.gray[200] },
  starTextFilled:    { color: colors.gold[500] },
  avgRow:            { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avgNum:            { fontSize: 36, fontWeight: '800', color: colors.gray[900] },
  avgStars:          { fontSize: 20, color: colors.gold[500] },
  avgLabel:          { ...typography.bodySm, color: colors.gray[400] },
  myVotText:         { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },
  resultatsSection:  { gap: spacing[3] },
  resultatRow:       { gap: spacing[1] },
  resultatTop:       { flexDirection: 'row', justifyContent: 'space-between' },
  resultatText:      { ...typography.body, color: colors.gray[700] },
  resultatPct:       { ...typography.body, color: colors.gray[700], fontWeight: '700' },
  barBackground:     { height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  barFill:           { height: 8, backgroundColor: colors.primary[600], borderRadius: 4 },
  resultatCount:     { ...typography.caption, color: colors.gray[400] },
  votersRow:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  voterAvatar:       { marginRight: -4 },
  votersText:        { ...typography.caption, color: colors.gray[500], marginLeft: spacing[2], flex: 1 },
  comentarisSection: { gap: spacing[3] },
  comentariRow:      { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  comentariBubble:   { flex: 1, backgroundColor: colors.gray[50], borderRadius: radius.sm, padding: spacing[3], gap: spacing[1] },
  comentariAutor:    { ...typography.label, color: colors.gray[700] },
  comentariText:     { ...typography.body, color: colors.gray[600] },
  comentariInput:    { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  comentariField:    { flex: 1, height: 44, backgroundColor: colors.gray[100], borderRadius: radius.sm, paddingHorizontal: spacing[3], ...typography.body, color: colors.gray[900] },
  comentariSend:     { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },
})
