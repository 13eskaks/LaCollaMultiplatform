import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback, useMemo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

type Membre = {
  user_id: string
  nom: string
  cognoms: string
  avatar_url: string | null
}

type Despesa = {
  id: string
  titol: string
  import: number
  categoria: string
  data: string
  nota: string | null
  pagador_id: string
  created_by: string | null
  pagador: { nom: string; cognoms: string; avatar_url: string | null }
  parts: { user_id: string; pes: number }[]
}

type Liquidacio = {
  id: string
  pagador_id: string
  receptor_id: string
  import: number
  data: string
  nota: string | null
}

type Settlement = { from: string; to: string; amount: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, string> = {
  general:      '💶',
  menjar:       '🍽️',
  transport:    '🚗',
  activitat:    '🎭',
  allotjament:  '🏠',
  altres:       '📦',
}

function nomCurt(m: { nom: string; cognoms: string }) {
  return `${m.nom} ${m.cognoms.split(' ')[0]}`
}

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',') + ' €'
}

// Minimum-transaction debt settlement algorithm
function calcSettlements(
  despeses: Despesa[],
  liquidacions: Liquidacio[],
): Record<string, number> {
  const bal: Record<string, number> = {}

  for (const d of despeses) {
    const totalPes = d.parts.reduce((s, p) => s + p.pes, 0)
    if (totalPes === 0) continue
    for (const part of d.parts) {
      if (part.user_id === d.pagador_id) continue
      const share = (d.import * part.pes) / totalPes
      bal[d.pagador_id] = (bal[d.pagador_id] ?? 0) + share
      bal[part.user_id] = (bal[part.user_id] ?? 0) - share
    }
  }

  // Subtract settled amounts
  for (const l of liquidacions) {
    bal[l.pagador_id]  = (bal[l.pagador_id]  ?? 0) + l.import
    bal[l.receptor_id] = (bal[l.receptor_id] ?? 0) - l.import
  }

  return bal
}

function minSettlements(balances: Record<string, number>): Settlement[] {
  const creditors: { id: string; amt: number }[] = []
  const debtors:   { id: string; amt: number }[] = []

  for (const [id, amt] of Object.entries(balances)) {
    if (amt > 0.005)  creditors.push({ id, amt })
    else if (amt < -0.005) debtors.push({ id, amt: -amt })
  }

  creditors.sort((a, b) => b.amt - a.amt)
  debtors.sort((a, b) => b.amt - a.amt)

  const settlements: Settlement[] = []
  let i = 0, j = 0

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i]
    const debt   = debtors[j]
    const amount = Math.min(credit.amt, debt.amt)

    if (amount > 0.005) {
      settlements.push({ from: debt.id, to: credit.id, amount })
    }

    credit.amt -= amount
    debt.amt   -= amount

    if (credit.amt < 0.005) i++
    if (debt.amt   < 0.005) j++
  }

  return settlements
}

// ── Component ─────────────────────────────────────────────────────────────────

const TABS = ['Despeses', 'Balanç'] as const
type Tab = typeof TABS[number]

export default function TricountScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()

  const [tab, setTab] = useState<Tab>('Despeses')
  const [membres, setMembres] = useState<Membre[]>([])
  const [despeses, setDespeses] = useState<Despesa[]>([])
  const [liquidacions, setLiquidacions] = useState<Liquidacio[]>([])
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState<string | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)  // settlement being confirmed
  const [confirmModal, setConfirmModal] = useState<Settlement | null>(null)

  useFocusEffect(useCallback(() => { loadAll() }, [collaId]))

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setMyId(user?.id ?? null)

    const [membresRes, despesesRes, liquidacionsRes] = await Promise.all([
      supabase.from('colla_membres')
        .select('user_id, profiles(nom, cognoms, avatar_url)')
        .eq('colla_id', collaId)
        .eq('estat', 'actiu'),
      supabase.from('despeses_compartides')
        .select('id, titol, import, categoria, data, nota, pagador_id, created_by, pagador:profiles!pagador_id(nom, cognoms, avatar_url), parts:despesa_parts(user_id, pes)')
        .eq('colla_id', collaId)
        .order('data', { ascending: false }),
      supabase.from('liquidacions_tricount')
        .select('*')
        .eq('colla_id', collaId)
        .order('data', { ascending: false }),
    ])

    const mList: Membre[] = (membresRes.data ?? []).map((m: any) => ({
      user_id: m.user_id,
      nom: m.profiles.nom,
      cognoms: m.profiles.cognoms,
      avatar_url: m.profiles.avatar_url,
    }))

    setMembres(mList)
    setDespeses(despesesRes.data ?? [])
    setLiquidacions(liquidacionsRes.data ?? [])
    setLoading(false)
  }

  const memberMap = useMemo(() => {
    const map: Record<string, Membre> = {}
    for (const m of membres) map[m.user_id] = m
    return map
  }, [membres])

  const balances = useMemo(
    () => calcSettlements(despeses, liquidacions),
    [despeses, liquidacions],
  )

  const settlements = useMemo(() => minSettlements(balances), [balances])

  const totalDespeses = useMemo(
    () => despeses.reduce((s, d) => s + d.import, 0),
    [despeses],
  )

  const myBalance = myId ? (balances[myId] ?? 0) : 0

  async function handleDeleteDespesa(despesa: Despesa) {
    Alert.alert(
      'Eliminar despesa',
      `Eliminar "${despesa.titol}" (${fmt(despesa.import)})?`,
      [
        { text: 'Cancel·lar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            await supabase.from('despeses_compartides').delete().eq('id', despesa.id)
            setDespeses(prev => prev.filter(d => d.id !== despesa.id))
          },
        },
      ],
    )
  }

  async function handleSettle(s: Settlement) {
    setConfirmModal(s)
  }

  async function confirmSettle() {
    if (!confirmModal || !myId) return
    setSettlingId(`${confirmModal.from}-${confirmModal.to}`)
    const { error } = await supabase.from('liquidacions_tricount').insert({
      colla_id: collaId,
      pagador_id: confirmModal.from,
      receptor_id: confirmModal.to,
      import: Math.round(confirmModal.amount * 100) / 100,
    })
    setSettlingId(null)
    setConfirmModal(null)
    if (error) Alert.alert('Error', error.message)
    else loadAll()
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderDespesa(d: Despesa) {
    const icon = CATEGORIES[d.categoria] ?? '💶'
    const nParts = d.parts.length
    const canModify = d.created_by === myId

    return (
      <View key={d.id} style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{d.titol}</Text>
          <Text style={styles.cardMeta}>
            {nomCurt(d.pagador)} · {new Date(d.data + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
            {nParts > 1 ? ` · ${nParts} persones` : ''}
          </Text>
          {d.nota ? <Text style={styles.cardNota} numberOfLines={1}>{d.nota}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardImport}>{fmt(d.import)}</Text>
          {nParts > 0 && (
            <Text style={styles.cardShare}>
              {fmt(d.import / d.parts.reduce((s, p) => s + p.pes, 0))} /p
            </Text>
          )}
        </View>
        {canModify && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/colla/[id]/tricount/nova', params: { id: collaId, eid: d.id } } as any)}
            hitSlop={8}
            style={{ paddingLeft: spacing[2] }}
          >
            <Text style={{ color: colors.gray[400], fontSize: 15 }}>✏️</Text>
          </TouchableOpacity>
        )}
        {canModify && (
          <TouchableOpacity onPress={() => handleDeleteDespesa(d)} hitSlop={8} style={{ paddingLeft: spacing[1] }}>
            <Text style={{ color: colors.gray[300], fontSize: 15 }}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  function renderBalance() {
    const sorted = [...membres].sort((a, b) => {
      const ba = balances[a.user_id] ?? 0
      const bb = balances[b.user_id] ?? 0
      return bb - ba
    })

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {/* My balance summary */}
        {myId && (
          <View style={[
            styles.myBalanceBox,
            { borderColor: myBalance > 0.005 ? colors.success[400] : myBalance < -0.005 ? colors.danger[400] : colors.gray[200] },
          ]}>
            <Text style={styles.myBalanceLabel}>El teu balanç</Text>
            <Text style={[
              styles.myBalanceNum,
              { color: myBalance > 0.005 ? colors.success[600] : myBalance < -0.005 ? colors.danger[600] : colors.gray[500] },
            ]}>
              {myBalance > 0.005 ? `+${fmt(myBalance)}` : myBalance < -0.005 ? `-${fmt(-myBalance)}` : 'Liquidat ✓'}
            </Text>
            {myBalance > 0.005 && <Text style={styles.myBalanceSub}>te deuen diners</Text>}
            {myBalance < -0.005 && <Text style={styles.myBalanceSub}>deus diners</Text>}
          </View>
        )}

        {/* Member balances */}
        <Text style={styles.sectionLabel}>BALANÇOS INDIVIDUALS</Text>
        {sorted.map(m => {
          const bal = balances[m.user_id] ?? 0
          const isMe = m.user_id === myId
          return (
            <View key={m.user_id} style={styles.balRow}>
              <Avatar name={`${m.nom} ${m.cognoms}`} uri={m.avatar_url} size="sm" />
              <Text style={[styles.balName, isMe && { fontWeight: '700' }]}>
                {nomCurt(m)}{isMe ? ' (tu)' : ''}
              </Text>
              <Text style={[
                styles.balAmount,
                bal > 0.005 ? { color: colors.success[600] } : bal < -0.005 ? { color: colors.danger[600] } : { color: colors.gray[400] },
              ]}>
                {bal > 0.005 ? `+${fmt(bal)}` : bal < -0.005 ? `-${fmt(-bal)}` : '—'}
              </Text>
            </View>
          )
        })}

        {/* Settlements */}
        {settlements.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing[4] }]}>PAGAMENTS SUGGERITS</Text>
            <Text style={styles.sectionSub}>
              {settlements.length} transacció{settlements.length !== 1 ? 'ns' : ''} per liquidar tot
            </Text>
            {settlements.map((s, i) => {
              const from = memberMap[s.from]
              const to   = memberMap[s.to]
              if (!from || !to) return null
              const key = `${s.from}-${s.to}`
              const isMyPayment = s.from === myId

              return (
                <View key={i} style={styles.settlementCard}>
                  <View style={styles.settlementRow}>
                    <Avatar name={`${from.nom} ${from.cognoms}`} uri={from.avatar_url} size="sm" />
                    <View style={styles.settlementArrow}>
                      <Text style={styles.settlementArrowText}>→</Text>
                      <Text style={styles.settlementAmount}>{fmt(s.amount)}</Text>
                    </View>
                    <Avatar name={`${to.nom} ${to.cognoms}`} uri={to.avatar_url} size="sm" />
                  </View>
                  <Text style={styles.settlementDesc}>
                    <Text style={{ fontWeight: '700' }}>{nomCurt(from)}</Text>
                    {' ha de pagar '}
                    <Text style={{ fontWeight: '700' }}>{nomCurt(to)}</Text>
                  </Text>
                  {isMyPayment && (
                    <Button
                      label={settlingId === key ? '' : 'Marcar com a pagat'}
                      loading={settlingId === key}
                      size="sm"
                      onPress={() => handleSettle(s)}
                      style={{ marginTop: spacing[2] }}
                    />
                  )}
                </View>
              )
            })}
          </>
        )}

        {settlements.length === 0 && membres.length > 0 && (
          <View style={styles.settledBox}>
            <Text style={{ fontSize: 32 }}>✅</Text>
            <Text style={styles.settledText}>Tot liquidat!</Text>
            <Text style={styles.settledSub}>Ningú deu res a ningú</Text>
          </View>
        )}

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Tricount" />

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{fmt(totalDespeses)}</Text>
          <Text style={styles.summaryLabel}>Total despeses</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{despeses.length}</Text>
          <Text style={styles.summaryLabel}>Transaccions</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[
            styles.summaryNum,
            myBalance > 0.005 ? { color: colors.success[600] }
              : myBalance < -0.005 ? { color: colors.danger[600] }
              : { color: colors.gray[400] },
          ]}>
            {myBalance > 0.005 ? `+${fmt(myBalance)}` : myBalance < -0.005 ? `-${fmt(-myBalance)}` : '—'}
          </Text>
          <Text style={styles.summaryLabel}>El teu saldo</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {t === 'Balanç' && settlements.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{settlements.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : tab === 'Despeses' ? (
        despeses.length === 0 ? (
          <EmptyState icon="💶" title="Cap despesa registrada" subtitle="Afegeix la primera despesa compartida" />
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {despeses.map(renderDespesa)}
            <View style={{ height: spacing[10] }} />
          </ScrollView>
        )
      ) : (
        renderBalance()
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/colla/${collaId}/tricount/nova` as any)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Confirm settlement modal */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirmar pagament</Text>
            {confirmModal && (
              <>
                <Text style={styles.modalBody}>
                  Confirmes que has pagat{' '}
                  <Text style={{ fontWeight: '700', color: colors.primary[600] }}>
                    {fmt(confirmModal.amount)}
                  </Text>
                  {' '}a{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {memberMap[confirmModal.to] ? nomCurt(memberMap[confirmModal.to]) : '—'}
                  </Text>
                  ?
                </Text>
                <Text style={styles.modalSub}>
                  Això quedarà registrat i actualitzarà els balanços de tothom.
                </Text>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
              <Button label="Cancel·lar" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => setConfirmModal(null)} />
              <Button label="Confirmar" size="md" style={{ flex: 1 }} onPress={confirmSettle} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },

  summaryBar:     { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100], paddingVertical: spacing[3] },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 2 },
  summaryNum:     { ...typography.h3, color: colors.gray[900], fontWeight: '700' },
  summaryLabel:   { ...typography.caption, color: colors.gray[500] },
  summaryDivider: { width: 1, backgroundColor: colors.gray[100] },

  tabs:           { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  tab:            { flex: 1, paddingVertical: spacing[3], alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing[1] },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: colors.primary[600] },
  tabText:        { ...typography.body, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:  { color: colors.primary[600] },
  tabBadge:       { backgroundColor: colors.danger[500], borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  tabBadgeText:   { color: colors.white, fontSize: 10, fontWeight: '800' },

  listContent:    { padding: spacing.screenH, gap: spacing[3] },

  // Despesa card
  card:       { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm },
  cardLeft:   { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.gray[50], justifyContent: 'center', alignItems: 'center' },
  cardIcon:   { fontSize: 22 },
  cardBody:   { flex: 1, gap: 2 },
  cardTitle:  { ...typography.body, color: colors.gray[900], fontWeight: '600' },
  cardMeta:   { ...typography.caption, color: colors.gray[500] },
  cardNota:   { ...typography.caption, color: colors.gray[400], fontStyle: 'italic' },
  cardRight:  { alignItems: 'flex-end', gap: 2 },
  cardImport: { ...typography.h3, color: colors.gray[900], fontWeight: '700' },
  cardShare:  { ...typography.caption, color: colors.gray[400] },

  // Balance tab
  myBalanceBox:   { borderWidth: 2, borderRadius: radius.lg, padding: spacing[4], alignItems: 'center', gap: spacing[1], backgroundColor: colors.white, marginBottom: spacing[3] },
  myBalanceLabel: { ...typography.label, color: colors.gray[500] },
  myBalanceNum:   { fontSize: 32, fontWeight: '800' },
  myBalanceSub:   { ...typography.caption, color: colors.gray[400] },

  sectionLabel:   { ...typography.label, color: colors.gray[400], fontSize: 11, letterSpacing: 0.5, marginBottom: spacing[2] },
  sectionSub:     { ...typography.caption, color: colors.gray[400], marginBottom: spacing[2], marginTop: -spacing[1] },

  balRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], ...shadows.sm },
  balName:    { ...typography.body, color: colors.gray[800], flex: 1 },
  balAmount:  { ...typography.h3, fontWeight: '700' },

  settlementCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[2], ...shadows.sm, borderLeftWidth: 3, borderLeftColor: colors.primary[400] },
  settlementRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  settlementArrow:{ flex: 1, alignItems: 'center', gap: 2 },
  settlementArrowText: { fontSize: 20, color: colors.gray[400] },
  settlementAmount:    { ...typography.h3, color: colors.gray[900], fontWeight: '700' },
  settlementDesc: { ...typography.body, color: colors.gray[600], textAlign: 'center' },

  settledBox:  { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[8] },
  settledText: { ...typography.h2, color: colors.success[600] },
  settledSub:  { ...typography.body, color: colors.gray[400] },

  fab:     { position: 'absolute', bottom: spacing[6], right: spacing.screenH, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText: { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: spacing.screenH },
  modal:        { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  modalTitle:   { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  modalBody:    { ...typography.bodyLg, color: colors.gray[700], textAlign: 'center', lineHeight: 24 },
  modalSub:     { ...typography.caption, color: colors.gray[400], textAlign: 'center' },
})
