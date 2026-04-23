import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { setmanaDeData } from '@lacolla/shared'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export default function TornsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [torns, setTorns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadTorns() }, [collaId])

  async function loadTorns() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 1)
    const threeMonthsAhead = new Date(); threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)

    const { data } = await supabase
      .from('torns_neteja')
      .select('*, torn_membres(*, profiles(nom, avatar_url))')
      .eq('colla_id', collaId)
      .gte('data_inici', threeMonthsAgo.toISOString())
      .lte('data_inici', threeMonthsAhead.toISOString())
      .order('data_inici', { ascending: true })

    setTorns(data ?? [])
    setLoading(false)
  }

  async function marcarFet(tornId: string) {
    await supabase.from('torns_neteja').update({ estat: 'fet' }).eq('id', tornId)
    loadTorns()
  }

  const { inici: setmanaInici, fi: setmanaFi } = setmanaDeData(new Date())
  const tornActual = torns.find(t => {
    const d = new Date(t.data_inici)
    return d >= setmanaInici && d <= setmanaFi
  })
  const isMyTorn = tornActual?.torn_membres?.some((m: any) => m.user_id === userId)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Torns de neteja</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Torn actual */}
          {tornActual ? (
            <View style={[styles.tornActualCard, isMyTorn && styles.tornActualCardMe]}>
              <View style={styles.tornActualHeader}>
                <Text style={styles.tornActualLabel}>
                  {isMyTorn ? '⭐ Et toca a tu!' : 'Torn d\'aquesta setmana'}
                </Text>
                {tornActual.estat === 'fet' && <Badge label="Fet ✓" variant="success" size="sm" />}
              </View>
              <Text style={styles.tornActualDates}>
                {new Date(tornActual.data_inici).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(tornActual.data_fi).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
              </Text>
              <View style={styles.tornMembres}>
                {tornActual.torn_membres?.map((m: any) => (
                  <View key={m.id} style={styles.tornMembre}>
                    <Avatar name={m.profiles?.nom ?? ''} uri={m.profiles?.avatar_url} size="sm" />
                    <Text style={styles.tornMembreNom}>{m.profiles?.nom}</Text>
                  </View>
                ))}
              </View>
              {tornActual.estat !== 'fet' && (
                <View style={styles.tornActions}>
                  <TouchableOpacity style={styles.tornActionBtn} onPress={() => marcarFet(tornActual.id)}>
                    <Text style={styles.tornActionText}>✓ Marcar com a fet</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noTorn}>
              <Text style={styles.noTornText}>Cap torn assignat per a aquesta setmana</Text>
            </View>
          )}

          {/* Calendari de torns */}
          <Text style={styles.sectionTitle}>Calendari de torns</Text>
          {torns.length === 0 ? (
            <EmptyState icon="🧹" title="Cap torn configurat" subtitle="La comissió ha de configurar els torns" />
          ) : (
            <View style={styles.tornsList}>
              {torns.map(t => {
                const esMyTorn = t.torn_membres?.some((m: any) => m.user_id === userId)
                const isCurrentWeek = new Date(t.data_inici) >= setmanaInici && new Date(t.data_inici) <= setmanaFi
                return (
                  <View key={t.id} style={[styles.tornRow, isCurrentWeek && styles.tornRowCurrent]}>
                    <View style={styles.tornDates}>
                      <Text style={styles.tornDateText}>
                        {new Date(t.data_inici).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                      <Text style={styles.tornDateSub}>
                        –{new Date(t.data_fi).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.tornRowMembres}>
                      {t.torn_membres?.map((m: any) => (
                        <Avatar key={m.id} name={m.profiles?.nom ?? ''} uri={m.profiles?.avatar_url} size="xs" />
                      ))}
                    </View>
                    <Badge
                      label={t.estat === 'fet' ? 'Fet ✓' : esMyTorn ? '⭐ Tu' : 'Pendent'}
                      variant={t.estat === 'fet' ? 'success' : esMyTorn ? 'primary' : 'warning'}
                      size="sm"
                    />
                  </View>
                )
              })}
            </View>
          )}

          {isComissioActiva() && (
            <TouchableOpacity style={styles.configBtn} onPress={() => {}}>
              <Text style={styles.configBtnText}>⚙️ Configurar torns</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.gray[50] },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:          { fontSize: 22, color: colors.primary[600], width: 36 },
  title:             { ...typography.h3, color: colors.gray[900] },
  content:           { padding: spacing.screenH, gap: spacing[4] },
  tornActualCard:    { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3], ...shadows.md, borderWidth: 2, borderColor: colors.gray[200] },
  tornActualCardMe:  { backgroundColor: colors.primary[50], borderColor: colors.primary[600] },
  tornActualHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tornActualLabel:   { ...typography.h3, color: colors.gray[900] },
  tornActualDates:   { ...typography.body, color: colors.gray[500] },
  tornMembres:       { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  tornMembre:        { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tornMembreNom:     { ...typography.body, color: colors.gray[700] },
  tornActions:       { flexDirection: 'row', gap: spacing[2] },
  tornActionBtn:     { flex: 1, backgroundColor: colors.primary[600], borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  tornActionText:    { color: colors.white, fontWeight: '600', fontSize: 14 },
  noTorn:            { backgroundColor: colors.gray[100], borderRadius: radius.md, padding: spacing[4], alignItems: 'center' },
  noTornText:        { ...typography.body, color: colors.gray[500] },
  sectionTitle:      { ...typography.h3, color: colors.gray[900] },
  tornsList:         { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  tornRow:           { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tornRowCurrent:    { backgroundColor: colors.primary[50] },
  tornDates:         { width: 60 },
  tornDateText:      { ...typography.caption, color: colors.gray[700], fontWeight: '600' },
  tornDateSub:       { ...typography.caption, color: colors.gray[400] },
  tornRowMembres:    { flex: 1, flexDirection: 'row', gap: spacing[1] },
  configBtn:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], alignItems: 'center', borderWidth: 1.5, borderColor: colors.gray[300] },
  configBtnText:     { ...typography.body, color: colors.gray[600], fontWeight: '600' },
})
