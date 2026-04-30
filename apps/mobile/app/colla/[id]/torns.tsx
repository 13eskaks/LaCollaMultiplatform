import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { setmanaDeData } from '@lacolla/shared'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { EmptyState } from '@/components/ui/EmptyState'

type ViewMode = 'list' | 'config'
type Periodicitat = 'setmanal' | 'quinzenal' | 'mensual'
type Grup = { id: string; membres: string[] }

const PERIOD_LABELS: Record<Periodicitat, string> = {
  setmanal:  'Setmanal',
  quinzenal: 'Quinzenal',
  mensual:   'Mensual',
}

const PERIOD_DAYS: Record<Periodicitat, number> = {
  setmanal: 7, quinzenal: 14, mensual: 30,
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export default function TornsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [torns, setTorns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Config state
  const [configLoading, setConfigLoading] = useState(false)
  const [membresDisponibles, setMembresDisponibles] = useState<any[]>([])
  const [grups, setGrups] = useState<Grup[]>([])
  const [periodicitat, setPeriodicitat] = useState<Periodicitat>('setmanal')
  const [dataInici, setDataInici] = useState<Date>(new Date())
  const [saving, setSaving] = useState(false)
  const [configGrups, setConfigGrups] = useState<{ membres: string[] }[]>([])

  useFocusEffect(useCallback(() => { loadTorns() }, [collaId]))

  async function loadTorns() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const sixMonthsAhead = new Date(); sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6)

    const [tornsRes, configRes] = await Promise.all([
      supabase
        .from('torns_neteja')
        .select('*, torn_membres(*, profiles(nom, avatar_url))')
        .eq('colla_id', collaId)
        .gte('data_inici', oneMonthAgo.toISOString().slice(0, 10))
        .lte('data_inici', sixMonthsAhead.toISOString().slice(0, 10))
        .order('data_inici', { ascending: true }),
      supabase.from('torns_config').select('grups').eq('colla_id', collaId).maybeSingle(),
    ])

    setTorns(tornsRes.data ?? [])
    if (configRes.data?.grups) setConfigGrups(configRes.data.grups)
    setLoading(false)
  }

  function getGrupNum(torn: any): number | null {
    if (configGrups.length === 0) return null
    const ids = new Set(torn.torn_membres?.map((m: any) => m.user_id) ?? [])
    for (let i = 0; i < configGrups.length; i++) {
      const g = configGrups[i]
      if (g.membres.length === ids.size && g.membres.every(uid => ids.has(uid))) return i + 1
    }
    return null
  }

  async function openConfig() {
    setConfigLoading(true)
    setViewMode('config')

    const [membresRes, configRes] = await Promise.all([
      supabase.from('colla_membres')
        .select('user_id, profiles(nom, avatar_url)')
        .eq('colla_id', collaId).eq('estat', 'actiu'),
      supabase.from('torns_config').select('*').eq('colla_id', collaId).maybeSingle(),
    ])

    setMembresDisponibles(membresRes.data ?? [])

    if (configRes.data) {
      const cfg = configRes.data
      setPeriodicitat(cfg.periodicitat as Periodicitat)
      setDataInici(new Date(cfg.data_inici + 'T00:00:00'))

      if (cfg.grups && Array.isArray(cfg.grups) && cfg.grups.length > 0) {
        setGrups(cfg.grups.map((g: any) => ({ id: uuidv4(), membres: g.membres ?? [] })))
      } else if (cfg.membres_ordre?.length > 0) {
        // Migrate from legacy format: split flat list into groups of num_per_torn
        const n = cfg.num_per_torn ?? 1
        const ordre: string[] = cfg.membres_ordre
        const legacyGrups: Grup[] = []
        for (let i = 0; i < ordre.length; i += n) {
          legacyGrups.push({ id: uuidv4(), membres: ordre.slice(i, i + n) })
        }
        setGrups(legacyGrups)
      } else {
        setGrups([{ id: uuidv4(), membres: [] }])
      }
    } else {
      setPeriodicitat('setmanal')
      setDataInici(new Date())
      setGrups([{ id: uuidv4(), membres: [] }])
    }

    setConfigLoading(false)
  }

  // ── Group management ──────────────────────────────────────────

  function addGrup() {
    setGrups(prev => [...prev, { id: uuidv4(), membres: [] }])
  }

  function removeGrup(id: string) {
    setGrups(prev => prev.filter(g => g.id !== id))
  }

  function toggleGrupMembre(grupId: string, uid: string) {
    setGrups(prev => prev.map(g => {
      if (g.id !== grupId) return g
      const membres = g.membres.includes(uid)
        ? g.membres.filter(id => id !== uid)
        : [...g.membres, uid]
      return { ...g, membres }
    }))
  }

  // ── Save config ───────────────────────────────────────────────

  async function handleSaveConfig() {
    if (grups.length === 0) {
      Alert.alert('Error', 'Cal com a mínim un grup de neteja')
      return
    }
    const buit = grups.findIndex(g => g.membres.length === 0)
    if (buit !== -1) {
      Alert.alert('Error', `El grup ${buit + 1} no té cap membre`)
      return
    }

    setSaving(true)
    try {
      const grupsData = grups.map(g => ({ membres: g.membres }))

      // Upsert config — one row per colla (UNIQUE on colla_id)
      await supabase.from('torns_config').upsert({
        colla_id:      collaId,
        periodicitat,
        data_inici:    dataInici.toISOString().slice(0, 10),
        grups:         grupsData,
        // keep legacy cols updated for any external readers
        num_per_torn:  Math.max(...grups.map(g => g.membres.length)),
        membres_ordre: grups.flatMap(g => g.membres),
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'colla_id' })

      // Delete ALL pendent turns (past + future) — keeps 'fet' records intact
      await supabase.from('torns_neteja').delete()
        .eq('colla_id', collaId).eq('estat', 'pendent')

      // Generate turns starting from today (or dataInici if in the future)
      const periodDays = PERIOD_DAYS[periodicitat]
      const periodMs   = periodDays * 24 * 60 * 60 * 1000
      const dataIniciMs = new Date(dataInici.toISOString().slice(0, 10) + 'T00:00:00').getTime()
      const todayMs     = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()
      const endMs       = todayMs + 6 * 30 * 24 * 60 * 60 * 1000

      // Find the first turn >= today, preserving rotation parity from dataInici
      let turnNumber: number
      let firstTurnMs: number
      if (todayMs <= dataIniciMs) {
        turnNumber  = 0
        firstTurnMs = dataIniciMs
      } else {
        turnNumber  = Math.ceil((todayMs - dataIniciMs) / periodMs)
        firstTurnMs = dataIniciMs + turnNumber * periodMs
      }

      const tornsNeteja: any[] = []
      const tornMembresRows: any[] = []

      let curMs  = firstTurnMs
      let tNum   = turnNumber

      while (curMs < endMs) {
        const grup  = grupsData[tNum % grupsData.length]
        const fiMs  = curMs + periodMs - 24 * 60 * 60 * 1000
        const id    = uuidv4()

        tornsNeteja.push({
          id,
          colla_id:   collaId,
          data_inici: new Date(curMs).toISOString().slice(0, 10),
          data_fi:    new Date(fiMs).toISOString().slice(0, 10),
          estat:      'pendent',
        })

        for (const uid of grup.membres) {
          tornMembresRows.push({ torn_id: id, user_id: uid })
        }

        curMs += periodMs
        tNum++
      }

      for (let i = 0; i < tornsNeteja.length; i += 50)
        await supabase.from('torns_neteja').insert(tornsNeteja.slice(i, i + 50))
      for (let i = 0; i < tornMembresRows.length; i += 50)
        await supabase.from('torn_membres').insert(tornMembresRows.slice(i, i + 50))

      setViewMode('list')
      loadTorns()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function marcarFet(tornId: string) {
    await supabase.from('torns_neteja').update({ estat: 'fet' }).eq('id', tornId)
    loadTorns()
  }

  // ── Config view ───────────────────────────────────────────────

  if (viewMode === 'config') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setViewMode('list')}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Configurar torns</Text>
          <View style={{ width: 36 }} />
        </View>

        {configLoading ? (
          <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
        ) : (
          <ScrollView contentContainerStyle={styles.configContent} showsVerticalScrollIndicator={false}>

            {/* Periodicitat */}
            <Text style={styles.sectionLabel}>Freqüència de rotació</Text>
            <View style={styles.optionRow}>
              {(Object.entries(PERIOD_LABELS) as [Periodicitat, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.optionBtn, periodicitat === key && styles.optionBtnActive]}
                  onPress={() => setPeriodicitat(key)}
                >
                  <Text style={[styles.optionText, periodicitat === key && styles.optionTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Data inici */}
            <DatePicker
              label="Inici de la rotació"
              value={dataInici}
              onChange={setDataInici}
            />

            {/* Grups */}
            <View style={styles.grupsSectionHeader}>
              <Text style={styles.sectionLabel}>
                Grups de neteja ({grups.length})
              </Text>
              <Text style={styles.sectionSub}>
                Cada {PERIOD_LABELS[periodicitat].toLowerCase()} li toca a un grup diferent, en ordre
              </Text>
            </View>

            {grups.map((grup, gIdx) => {
              const totalMembres = membresDisponibles.length
              return (
                <View key={grup.id} style={styles.grupCard}>
                  <View style={styles.grupCardHeader}>
                    <Text style={styles.grupTitol}>Grup {gIdx + 1}</Text>
                    <View style={styles.grupHeaderRight}>
                      <Text style={styles.grupComptador}>
                        {grup.membres.length}/{totalMembres} membres
                      </Text>
                      {grups.length > 1 && (
                        <TouchableOpacity onPress={() => removeGrup(grup.id)} hitSlop={8}>
                          <Text style={styles.grupDeleteIcon}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.grupMembres}>
                    {membresDisponibles.map(m => {
                      const uid = m.user_id
                      const isIn = grup.membres.includes(uid)
                      return (
                        <TouchableOpacity
                          key={uid}
                          style={[styles.membreChip, isIn && styles.membreChipActive]}
                          onPress={() => toggleGrupMembre(grup.id, uid)}
                          activeOpacity={0.7}
                        >
                          <Avatar
                            name={m.profiles?.nom ?? ''}
                            uri={m.profiles?.avatar_url}
                            size="xs"
                          />
                          <Text style={[styles.membreChipText, isIn && styles.membreChipTextActive]}
                            numberOfLines={1}
                          >
                            {m.profiles?.nom}
                          </Text>
                          {isIn && <Text style={styles.membreChipCheck}>✓</Text>}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              )
            })}

            <TouchableOpacity style={styles.addGrupBtn} onPress={addGrup}>
              <Text style={styles.addGrupText}>+ Afegir grup</Text>
            </TouchableOpacity>

            <Button
              label="Guardar i generar torns 🔄"
              size="lg"
              loading={saving}
              onPress={handleSaveConfig}
            />
            <View style={{ height: spacing[8] }} />
          </ScrollView>
        )}
      </SafeAreaView>
    )
  }

  // ── List view ─────────────────────────────────────────────────

  const { inici: setmanaInici, fi: setmanaFi } = setmanaDeData(new Date())
  const tornActual = torns.find(t => {
    const d = new Date(t.data_inici + 'T00:00:00')
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
        {isComissioActiva() ? (
          <TouchableOpacity onPress={openConfig} hitSlop={8} style={styles.configIconBtn}>
            <Text style={styles.configIconText}>⚙️</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tornActual ? (
            <View style={[styles.tornActualCard, isMyTorn && styles.tornActualCardMe]}>
              <View style={styles.tornActualHeader}>
                <Text style={styles.tornActualLabel}>
                  {isMyTorn ? '⭐ Et toca a tu!' : 'Torn d\'aquesta setmana'}
                </Text>
                {tornActual.estat === 'fet' && <Badge label="Fet ✓" variant="success" size="sm" />}
              </View>
              <Text style={styles.tornActualDates}>
                {new Date(tornActual.data_inici + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(tornActual.data_fi + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
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
                <TouchableOpacity style={styles.tornActionBtn} onPress={() => marcarFet(tornActual.id)}>
                  <Text style={styles.tornActionText}>✓ Marcar com a fet</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noTorn}>
              <Text style={styles.noTornText}>Cap torn assignat per a aquesta setmana</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Calendari de torns</Text>

          {torns.length === 0 ? (
            <EmptyState icon="🧹" title="Cap torn configurat" subtitle="Prem ⚙️ per configurar la rotació" />
          ) : (
            <View style={styles.tornsList}>
              {torns.map(t => {
                const esMyTorn = t.torn_membres?.some((m: any) => m.user_id === userId)
                const isCurrentWeek = new Date(t.data_inici + 'T00:00:00') >= setmanaInici &&
                  new Date(t.data_inici + 'T00:00:00') <= setmanaFi
                const grupNum = getGrupNum(t)
                return (
                  <View key={t.id} style={[styles.tornRow, isCurrentWeek && styles.tornRowCurrent]}>
                    <View style={styles.tornDates}>
                      <Text style={styles.tornDateText}>
                        {new Date(t.data_inici + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                      <Text style={styles.tornDateSub}>
                        –{new Date(t.data_fi + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                      {grupNum !== null && (
                        <Text style={styles.tornGrupLabel}>G{grupNum}</Text>
                      )}
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

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.gray[50] },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:{ fontSize: 22, color: colors.primary[600], width: 36 },
  title:   { ...typography.h3, color: colors.gray[900] },

  // List view
  content:           { padding: spacing.screenH, gap: spacing[4] },
  tornActualCard:    { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3], ...shadows.md, borderWidth: 2, borderColor: colors.gray[200] },
  tornActualCardMe:  { backgroundColor: colors.primary[50], borderColor: colors.primary[600] },
  tornActualHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tornActualLabel:   { ...typography.h3, color: colors.gray[900] },
  tornActualDates:   { ...typography.body, color: colors.gray[500] },
  tornMembres:       { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  tornMembre:        { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tornMembreNom:     { ...typography.body, color: colors.gray[700] },
  tornActionBtn:     { backgroundColor: colors.primary[600], borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  tornActionText:    { color: colors.white, fontWeight: '600', fontSize: 14 },
  noTorn:            { backgroundColor: colors.gray[100], borderRadius: radius.md, padding: spacing[4], alignItems: 'center' },
  noTornText:        { ...typography.body, color: colors.gray[500] },
  configIconBtn:  { width: 36, alignItems: 'flex-end' },
  configIconText: { fontSize: 20 },
  sectionTitle:   { ...typography.h3, color: colors.gray[700] },
  tornsList:            { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.gray[100] },
  tornRow:              { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tornRowCurrent:       { backgroundColor: 'rgba(99,102,241,0.06)' },
  tornDates:            { width: 60 },
  tornDateText:         { ...typography.caption, color: colors.gray[600], fontWeight: '600' },
  tornDateSub:          { ...typography.caption, color: colors.gray[400] },
  tornGrupLabel:        { ...typography.caption, color: colors.primary[400], fontWeight: '700', fontSize: 10 },
  tornRowMembres:       { flex: 1, flexDirection: 'row', gap: spacing[1], flexWrap: 'wrap' },

  // Config view
  configContent:      { padding: spacing.screenH, gap: spacing[4] },
  sectionLabel:       { ...typography.label, color: colors.gray[500] },
  sectionSub:         { ...typography.caption, color: colors.gray[400] },
  grupsSectionHeader: { gap: spacing[1] },
  optionRow:          { flexDirection: 'row', gap: spacing[2] },
  optionBtn:          { flex: 1, paddingVertical: spacing[3], borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.gray[100] },
  optionBtnActive:    { backgroundColor: colors.primary[50], borderWidth: 1.5, borderColor: colors.primary[600] },
  optionText:         { ...typography.bodySm, color: colors.gray[500], fontWeight: '600' },
  optionTextActive:   { color: colors.primary[600] },

  grupCard:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[3], ...shadows.sm },
  grupCardHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grupTitol:        { ...typography.h3, color: colors.gray[900] },
  grupHeaderRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  grupComptador:    { ...typography.caption, color: colors.gray[400] },
  grupDeleteIcon:   { fontSize: 16, color: colors.gray[400] },

  grupMembres:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  membreChip:          { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[2], paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.gray[100], borderWidth: 1.5, borderColor: 'transparent' },
  membreChipActive:    { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  membreChipText:      { ...typography.caption, color: colors.gray[600], fontWeight: '600', maxWidth: 80 },
  membreChipTextActive:{ color: colors.primary[700] },
  membreChipCheck:     { fontSize: 11, color: colors.primary[600], fontWeight: '700' },

  addGrupBtn:  { borderWidth: 1.5, borderColor: colors.primary[400], borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  addGrupText: { ...typography.body, color: colors.primary[600], fontWeight: '600' },
})
