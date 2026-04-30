import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Calendar, LocaleConfig } from 'react-native-calendars'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { useScreenCache } from '@/stores/screenCache'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { EventDateBox } from '@/components/ui/EventDateBox'
import i18n from '@/lib/i18n'

LocaleConfig.locales['ca'] = {
  monthNames: ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'],
  monthNamesShort: ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'],
  dayNames: ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'],
  dayNamesShort: ['Du','Dl','Dt','Dc','Dj','Dv','Ds'],
  today: 'Avui',
}
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Do','Lu','Ma','Mi','Ju','Vi','Sa'],
  today: 'Hoy',
}
LocaleConfig.locales['en'] = {
  monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  today: 'Today',
}
LocaleConfig.defaultLocale = i18n.language in LocaleConfig.locales ? i18n.language : 'en'

const C_EVENT = colors.primary[600]
const C_TORN  = '#f59e0b'
const C_ACTA  = '#7c3aed'

const HEADER_THEME = {
  calendarBackground:      colors.white,
  textSectionTitleColor:   colors.gray[400],
  arrowColor:              colors.gray[600],
  monthTextColor:          colors.gray[900],
  textMonthFontWeight:     '700' as const,
  textMonthFontSize:       17,
  textDayHeaderFontSize:   11,
  textDayHeaderFontWeight: '600' as const,
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' })
}

function fmtRange(start: string, end: string) {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`
}

function fullDayLabel(dateStr: string, todayStr: string) {
  const label = new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return dateStr === todayStr ? `Avui · ${label}` : label
}

type ItemType = 'event' | 'torn' | 'acta'
type AgendaItem = { type: ItemType; data: any }

// ─────────────────────────────────────────────────────────────────────────────

export default function AgendaScreen() {
  const { collaActiva } = useCollaStore()
  const screenCache     = useScreenCache()
  const router          = useRouter()
  const { t, i18n: i18nInst } = useTranslation()
  const { height: screenH } = useWindowDimensions()

  useEffect(() => {
    const lang = i18nInst.language
    LocaleConfig.defaultLocale = lang in LocaleConfig.locales ? lang : 'en'
  }, [i18nInst.language])
  const today    = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => localDateStr(today), [today])

  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month')
  const [selected, setSelected] = useState<string>(todayStr)
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [events, setEvents]           = useState<any[]>([])
  const [torns, setTorns]             = useState<any[]>([])
  const [actes, setActes]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [rsvpMap, setRsvpMap]         = useState<Record<string, string>>({})
  const [configGrups, setConfigGrups] = useState<{ membres: string[] }[]>([])
  const [showTorns, setShowTorns]     = useState(false)

  useFocusEffect(useCallback(() => {
    if (!collaActiva) return
    const cacheKey = `agenda_${collaActiva.id}_${year}_${month}`
    if (!screenCache.isStale(cacheKey) && events.length > 0) return
    loadData()
  }, [collaActiva?.id, year, month]))

  async function loadData() {
    if (!collaActiva) return
    screenCache.touch(`agenda_${collaActiva.id}_${year}_${month}`)
    if (events.length === 0) setLoading(true)

    const rangeStart = new Date(year, month, 1)
    rangeStart.setDate(rangeStart.getDate() - 7)
    const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59)
    rangeEnd.setDate(rangeEnd.getDate() + 7)

    const inici  = rangeStart.toISOString()
    const fi     = rangeEnd.toISOString()
    const dInici = inici.slice(0, 10)
    const dFi    = fi.slice(0, 10)

    const { data: { user } } = await supabase.auth.getUser()

    const [eventsRes, rsvpRes, tornsRes, actesRes, configRes] = await Promise.all([
      supabase.from('events')
        .select('*, event_rsvp(estat)')
        .eq('colla_id', collaActiva.id)
        .lte('data_inici', fi)
        .or(`data_fi.gte.${inici},and(data_fi.is.null,data_inici.gte.${inici})`)
        .order('data_inici'),
      user ? supabase.from('event_rsvp').select('event_id, estat').eq('user_id', user.id) : null,
      supabase.from('torns_neteja')
        .select('id, data_inici, data_fi, estat, torn_membres(user_id)')
        .eq('colla_id', collaActiva.id)
        .lte('data_inici', dFi)
        .gte('data_fi', dInici),
      supabase.from('actes')
        .select('id, titol, data_acta')
        .eq('colla_id', collaActiva.id)
        .gte('data_acta', dInici)
        .lte('data_acta', dFi),
      supabase.from('torns_config').select('grups').eq('colla_id', collaActiva.id).maybeSingle(),
    ])

    setEvents(eventsRes.data ?? [])
    setTorns(tornsRes.data ?? [])
    setActes(actesRes.data ?? [])
    if (configRes.data?.grups) setConfigGrups(configRes.data.grups)
    if (rsvpRes?.data) {
      const map: Record<string, string> = {}
      for (const r of rsvpRes.data) map[r.event_id] = r.estat
      setRsvpMap(map)
    }
    setLoading(false)
  }

  const visibleTorns = useMemo(() => showTorns ? torns : [], [showTorns, torns])

  // Items per day (for list views)
  const eventsByDay = useMemo<Record<string, AgendaItem[]>>(() => {
    const map: Record<string, AgendaItem[]> = {}

    function push(dateStr: string, item: AgendaItem) {
      if (!map[dateStr]) map[dateStr] = []
      if (!map[dateStr].some(i => i.type === item.type && i.data.id === item.data.id))
        map[dateStr].push(item)
    }

    for (const e of events) {
      const cur = new Date(e.data_inici.slice(0, 10) + 'T00:00:00')
      const end = e.data_fi ? new Date(e.data_fi.slice(0, 10) + 'T00:00:00') : new Date(cur)
      while (cur <= end) { push(localDateStr(cur), { type: 'event', data: e }); cur.setDate(cur.getDate() + 1) }
    }
    for (const t of visibleTorns) {
      if (!t.data_inici) continue
      const cur = new Date(t.data_inici + 'T00:00:00')
      const end = new Date((t.data_fi || t.data_inici) + 'T00:00:00')
      while (cur <= end) { push(localDateStr(cur), { type: 'torn', data: t }); cur.setDate(cur.getDate() + 1) }
    }
    for (const a of actes) {
      if (a.data_acta) push(a.data_acta, { type: 'acta', data: a })
    }

    return map
  }, [events, visibleTorns, actes])

  // Stable lane assignment — greedy interval scheduling so items keep the same row across days
  const lanesByDay = useMemo<Record<string, (AgendaItem | null)[]>>(() => {
    type Span = { item: AgendaItem; start: string; end: string; priority: number }
    const spans: Span[] = []

    for (const e of events)
      spans.push({ item: { type: 'event', data: e }, start: e.data_inici.slice(0, 10), end: (e.data_fi ?? e.data_inici).slice(0, 10), priority: 0 })
    for (const t of visibleTorns) {
      if (!t.data_inici) continue
      spans.push({ item: { type: 'torn', data: t }, start: t.data_inici, end: t.data_fi || t.data_inici, priority: 1 })
    }
    for (const a of actes) {
      if (!a.data_acta) continue
      spans.push({ item: { type: 'acta', data: a }, start: a.data_acta, end: a.data_acta, priority: 2 })
    }

    spans.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority
      : a.start !== b.start ? a.start.localeCompare(b.start)
      : b.end.localeCompare(a.end)
    )

    const laneEnd: string[] = []
    const laneMap = new Map<string, number>()

    for (const s of spans) {
      const key = `${s.item.type}-${s.item.data.id}`
      let lane = 0
      while (lane < laneEnd.length && laneEnd[lane] >= s.start) lane++
      laneMap.set(key, lane)
      laneEnd[lane] = s.end
    }

    const result: Record<string, (AgendaItem | null)[]> = {}

    for (const s of spans) {
      const lane = laneMap.get(`${s.item.type}-${s.item.data.id}`)!
      const cur = new Date(s.start + 'T00:00:00')
      const end = new Date(s.end + 'T00:00:00')
      while (cur <= end) {
        const ds = localDateStr(cur)
        if (!result[ds]) result[ds] = []
        while (result[ds].length <= lane) result[ds].push(null)
        result[ds][lane] = s.item
        cur.setDate(cur.getDate() + 1)
      }
    }

    return result
  }, [events, visibleTorns, actes])

  // Month view: events for selected day
  const dayItems = useMemo(() => eventsByDay[selected] ?? [], [eventsByDay, selected])

  // Agenda view: all days with events, sorted
  const agendaDays = useMemo(() =>
    Object.entries(eventsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, items]) => ({
        dateStr,
        items: [...items].sort((a, b) => a.type.localeCompare(b.type)),
      }))
  , [eventsByDay])

  function getGrupNum(torn: any): number | null {
    if (configGrups.length === 0) return null
    const ids = new Set((torn.torn_membres ?? []).map((m: any) => m.user_id))
    for (let i = 0; i < configGrups.length; i++) {
      const g = configGrups[i]
      if (g.membres.length === ids.size && g.membres.every(uid => ids.has(uid))) return i + 1
    }
    return null
  }

  // ── Day cell: spanning bars (Google Calendar month style) ────────────────
  function renderDayCell({ date, state }: any) {
    const dateStr     = date.dateString
    const lanes       = lanesByDay[dateStr] ?? []
    const isSelected  = dateStr === selected
    const isToday     = dateStr === todayStr
    const isDisabled  = state === 'disabled'
    const isWeekStart = new Date(dateStr + 'T00:00:00').getDay() === 1

    const visibleLanes   = lanes.slice(0, 3)
    const overflowCount  = lanes.slice(3).filter(Boolean).length

    return (
      <TouchableOpacity
        style={styles.dayCell}
        onPress={() => { if (!isDisabled) setSelected(dateStr) }}
        activeOpacity={0.7}
      >
        <View style={[
          styles.dayNum,
          isToday && !isSelected && styles.dayNumToday,
          isSelected && styles.dayNumSelected,
        ]}>
          <Text style={[
            styles.dayNumText,
            isDisabled && styles.dayNumTextDisabled,
            isToday && !isSelected && styles.dayNumTextToday,
            isSelected && styles.dayNumTextSelected,
          ]}>
            {date.day}
          </Text>
        </View>

        {!isDisabled && visibleLanes.map((item, i) => {
          if (!item) return <View key={i} style={styles.bar} />

          const color = item.type === 'event' ? (item.data.color ?? C_EVENT)
                      : item.type === 'torn'  ? C_TORN : C_ACTA
          const grupNum = item.type === 'torn' ? getGrupNum(item.data) : null
          const label = item.type === 'torn'
            ? (grupNum !== null ? `G${grupNum}` : 'Torn')
            : item.data.titol

          const iStart = item.type === 'event' ? item.data.data_inici?.slice(0, 10)
                       : item.type === 'torn'  ? item.data.data_inici
                       : item.data.data_acta
          const iEnd   = item.type === 'event' ? (item.data.data_fi?.slice(0, 10) ?? iStart)
                       : item.type === 'torn'  ? (item.data.data_fi ?? iStart)
                       : iStart

          const isStart  = dateStr === iStart
          const isEnd    = dateStr === iEnd
          const showText = isStart || isWeekStart

          return (
            <View
              key={`${item.type}-${item.data.id}`}
              style={[
                styles.bar,
                { backgroundColor: color },
                isStart && styles.barRoundLeft,
                isEnd   && styles.barRoundRight,
              ]}
            >
              {showText && <Text style={styles.barText} numberOfLines={1}>{label}</Text>}
            </View>
          )
        })}

        {!isDisabled && overflowCount > 0 && (
          <Text style={styles.barMore}>+{overflowCount}</Text>
        )}
      </TouchableOpacity>
    )
  }

  // ── Shared item card ──────────────────────────────────────────────────────
  function renderItem(item: AgendaItem, idx: number, keyPrefix = '') {
    if (item.type === 'event') {
      const evColor = item.data.color ?? C_EVENT
      return (
        <TouchableOpacity
          key={`${keyPrefix}ev-${item.data.id}`}
          style={[styles.itemCard, { borderLeftColor: evColor }]}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.data.id } } as any)}
          activeOpacity={0.75}
        >
          <EventDateBox inici={item.data.data_inici} fi={item.data.data_fi} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.data.titol}</Text>
            {item.data.lloc && <Text style={styles.itemMeta}>📍 {item.data.lloc}</Text>}
            <Text style={styles.itemMeta}>
              {'👥 '}
              {(() => {
                const n = (item.data.event_rsvp ?? []).filter((r: any) => r.estat === 'apuntat').length
                return item.data.limit_places ? `${n}/${item.data.limit_places}` : `${n}`
              })()}
            </Text>
          </View>
          {rsvpMap[item.data.id] === 'apuntat' && <Text style={{ color: evColor, fontSize: 16 }}>✓</Text>}
        </TouchableOpacity>
      )
    }

    if (item.type === 'torn') {
      const grupNum = getGrupNum(item.data)
      return (
        <View key={`${keyPrefix}torn-${item.data.id}-${idx}`} style={styles.tornCard}>
          <Text style={styles.tornIcon}>🧹</Text>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.tornTitle}>Torn de neteja</Text>
              {grupNum !== null && (
                <Text style={styles.tornGrupBadge}>G{grupNum}</Text>
              )}
            </View>
            <Text style={styles.tornMeta}>{fmtRange(item.data.data_inici, item.data.data_fi)}</Text>
          </View>
          {item.data.estat === 'fet' && (
            <Text style={styles.tornFetText}>✓</Text>
          )}
        </View>
      )
    }

    return (
      <TouchableOpacity
        key={`${keyPrefix}acta-${item.data.id}`}
        style={[styles.itemCard, { borderLeftColor: C_ACTA }]}
        onPress={() => collaActiva && router.push({ pathname: '/colla/[id]/actes', params: { id: collaActiva.id, actaId: item.data.id } } as any)}
        activeOpacity={0.75}
      >
        <View style={[styles.timeChip, { backgroundColor: '#f3e8ff' }]}>
          <Text style={{ fontSize: 20 }}>🏛</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.data.titol}</Text>
          <Text style={styles.itemMeta}>{fmtDate(item.data.data_acta)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]}
            onPress={() => setViewMode('month')}
          >
            <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>Mes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'agenda' && styles.toggleBtnActive]}
            onPress={() => setViewMode('agenda')}
          >
            <Text style={[styles.toggleText, viewMode === 'agenda' && styles.toggleTextActive]}>Agenda</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={[styles.tornsToggleBtn, showTorns && styles.tornsToggleBtnActive]}
            onPress={() => setShowTorns(v => !v)}
          >
            <Text style={styles.tornsToggleText}>🧹</Text>
          </TouchableOpacity>
          {selected !== todayStr && (
            <TouchableOpacity style={styles.todayBtn} onPress={() => {
              setSelected(todayStr)
              setYear(today.getFullYear())
              setMonth(today.getMonth())
            }}>
              <Text style={styles.todayBtnText}>Avui</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.newEventBtn} onPress={() => router.push('/event/create')}>
            <Text style={styles.newEventText}>+ Event</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'month' ? (
        // ── Month: Google Calendar–style grid + selected day list ─────────
        <View style={{ flex: 1 }}>
          <View style={{ maxHeight: Math.round(screenH * 0.46), overflow: 'hidden' }}>
            <Calendar
              key={`${year}-${month}`}
              current={toDateStr(year, month, 1)}
              firstDay={1}
              enableSwipeMonths
              onMonthChange={({ year: y, month: m }) => { setYear(y); setMonth(m - 1) }}
              theme={HEADER_THEME}
              dayComponent={renderDayCell}
            />
          </View>

          <View style={styles.divider} />

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.dayHeader}>{fullDayLabel(selected, todayStr).toUpperCase()}</Text>
            {loading ? (
              <ActivityIndicator color={C_EVENT} style={{ marginTop: spacing[6] }} />
            ) : dayItems.length === 0 ? (
              <Text style={styles.emptyText}>Cap activitat aquest dia</Text>
            ) : (
              dayItems.map((item, idx) => renderItem(item, idx))
            )}
            <View style={{ height: spacing[8] }} />
          </ScrollView>
        </View>

      ) : (
        // ── Agenda: infinite chronological list ───────────────────────────
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={C_EVENT} style={{ marginTop: spacing[8] }} />
          ) : agendaDays.length === 0 ? (
            <Text style={styles.emptyText}>Cap activitat propera</Text>
          ) : (
            agendaDays.map(({ dateStr, items }) => (
              <View key={dateStr}>
                <TouchableOpacity
                  style={[styles.agendaDayRow, dateStr === selected && styles.agendaDayRowActive]}
                  onPress={() => { setSelected(dateStr); setViewMode('month') }}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.agendaDayText,
                    dateStr === todayStr && styles.agendaDayTextToday,
                    dateStr === selected && styles.agendaDayTextActive,
                  ]}>
                    {fullDayLabel(dateStr, todayStr).toUpperCase()}
                  </Text>
                </TouchableOpacity>
                {items.map((item, idx) => renderItem(item, idx, `${dateStr}-`))}
              </View>
            ))
          )}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },

  topBar:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenH, paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  viewToggle:       { flexDirection: 'row', backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3 },
  toggleBtn:        { paddingHorizontal: spacing[4], paddingVertical: 6, borderRadius: radius.sm - 2 },
  toggleBtnActive:  { backgroundColor: colors.white, ...shadows.sm },
  toggleText:       { fontSize: 13, fontWeight: '600', color: colors.gray[500] },
  toggleTextActive: { color: colors.gray[900] },

  topRight:            { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tornsToggleBtn:      { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray[100] },
  tornsToggleBtnActive:{ backgroundColor: '#fef3c7', borderWidth: 1.5, borderColor: '#f59e0b' },
  tornsToggleText:     { fontSize: 16 },
  todayBtn:     { borderWidth: 1.5, borderColor: colors.primary[300], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: 6 },
  todayBtnText: { color: colors.primary[600], fontWeight: '700', fontSize: 13 },
  newEventBtn:  { backgroundColor: colors.primary[600], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: 7 },
  newEventText: { color: colors.white, fontWeight: '600', fontSize: 13 },

  divider: { height: 1, backgroundColor: colors.gray[100] },

  // Day cell
  dayCell:             { alignItems: 'center', paddingTop: 2, width: '100%', minHeight: 52 },
  dayNum:              { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 1 },
  dayNumToday:         { backgroundColor: colors.primary[50] },
  dayNumSelected:      { backgroundColor: colors.primary[600] },
  dayNumText:          { fontSize: 13, color: colors.gray[700] },
  dayNumTextDisabled:  { color: colors.gray[300] },
  dayNumTextToday:     { color: colors.primary[600], fontWeight: '700' },
  dayNumTextSelected:  { color: '#fff', fontWeight: '700' },

  // Spanning bars
  bar:           { width: '100%', height: 12, marginBottom: 1, justifyContent: 'center', paddingHorizontal: 3 },
  barRoundLeft:  { borderTopLeftRadius: 3, borderBottomLeftRadius: 3, marginLeft: 2 },
  barRoundRight: { borderTopRightRadius: 3, borderBottomRightRadius: 3, marginRight: 2 },
  barText:       { fontSize: 9, color: '#fff', fontWeight: '600' },
  barMore:       { fontSize: 9, color: colors.gray[400], marginTop: 1 },

  // List section
  listContent: { paddingHorizontal: spacing.screenH, paddingTop: spacing[3], gap: spacing[3] },
  dayHeader:   { ...typography.label, color: colors.gray[500], fontSize: 11, marginBottom: spacing[1] },
  emptyText:   { ...typography.caption, color: colors.gray[400], fontStyle: 'italic', paddingVertical: spacing[2] },

  // Agenda view day headers
  agendaDayRow:       { paddingVertical: spacing[2], borderLeftWidth: 2, borderLeftColor: 'transparent', paddingLeft: spacing[2] },
  agendaDayRowActive: { borderLeftColor: colors.primary[600] },
  agendaDayText:      { ...typography.label, color: colors.gray[500], fontSize: 11 },
  agendaDayTextToday: { color: colors.primary[600] },
  agendaDayTextActive:{ color: colors.primary[600], fontWeight: '700' },

  // Item cards
  itemCard:   { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.md, borderWidth: 1, borderColor: colors.gray[200], borderLeftWidth: 4 },
  timeChip:   { borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1], minWidth: 50, alignItems: 'center', justifyContent: 'center', height: 40 },
  itemTitle:  { ...typography.h3, color: colors.gray[900], fontSize: 14 },
  itemMeta:   { ...typography.caption, color: colors.gray[500] },
  estatBadge: { borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3 },
  estatText:  { fontSize: 11, fontWeight: '700' },

  // Torn card — subtle, low-profile
  tornCard:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 7, paddingHorizontal: spacing[3], backgroundColor: 'rgba(245,158,11,0.07)', borderRadius: radius.sm, borderLeftWidth: 2, borderLeftColor: '#f59e0b' },
  tornIcon:      { fontSize: 14, opacity: 0.7 },
  tornTitle:     { ...typography.caption, color: colors.gray[500], fontWeight: '600', fontSize: 12 },
  tornGrupBadge: { fontSize: 10, fontWeight: '700', color: '#b45309', backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  tornMeta:      { ...typography.caption, color: colors.gray[400], fontSize: 11 },
  tornFetText:   { fontSize: 13, color: '#16a34a', opacity: 0.7 },
})
