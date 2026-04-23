import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { formatHora } from '@lacolla/shared'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { EmptyState } from '@/components/ui/EmptyState'

const DIES_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']
const MESOS_CA = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre']

function getMondayBasedDay(d: Date): number {
  return (d.getDay() + 6) % 7 // 0=Dll, 6=Dg
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = getMondayBasedDay(new Date(year, month, 1))
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function AgendaScreen() {
  const { collaActiva } = useCollaStore()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<number | null>(today.getDate())
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rsvpMap, setRsvpMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (collaActiva) loadEvents()
  }, [collaActiva, year, month])

  async function loadEvents() {
    if (!collaActiva) return
    setLoading(true)

    const inici = new Date(year, month, 1).toISOString()
    const fi = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const { data: { user } } = await supabase.auth.getUser()

    const [eventsRes, rsvpRes] = await Promise.all([
      supabase.from('events').select('*').eq('colla_id', collaActiva.id)
        .gte('data_inici', inici).lte('data_inici', fi).order('data_inici', { ascending: true }),
      user ? supabase.from('event_rsvp').select('event_id, estat').eq('user_id', user.id) : null,
    ])

    setEvents(eventsRes.data ?? [])

    if (rsvpRes?.data) {
      const map: Record<string, string> = {}
      for (const r of rsvpRes.data) map[r.event_id] = r.estat
      setRsvpMap(map)
    }
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  const cells = buildCalendarGrid(year, month)
  const daysWithEvents = new Set(events.map(e => new Date(e.data_inici).getDate()))

  const filteredEvents = selected
    ? events.filter(e => new Date(e.data_inici).getDate() === selected)
    : events

  // Group events by day
  const grouped: Record<number, any[]> = {}
  for (const e of filteredEvents) {
    const d = new Date(e.data_inici).getDate()
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(e)
  }

  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header mes */}
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Text style={styles.navBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MESOS_CA[month]} {year}</Text>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Text style={styles.navBtnText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Calendari */}
        <View style={styles.calendar}>
          {/* Dies de la setmana */}
          <View style={styles.weekRow}>
            {DIES_CA.map(d => (
              <Text key={d} style={styles.weekDay}>{d}</Text>
            ))}
          </View>

          {/* Cel·les */}
          <View style={styles.grid}>
            {cells.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.cell,
                  day && selected === day && styles.cellSelected,
                  day && isToday(day) && selected !== day && styles.cellToday,
                ]}
                onPress={() => day && setSelected(selected === day ? null : day)}
                disabled={!day}
              >
                {day && (
                  <>
                    <Text style={[
                      styles.cellText,
                      selected === day && styles.cellTextSelected,
                      isToday(day) && selected !== day && styles.cellTextToday,
                    ]}>
                      {day}
                    </Text>
                    {daysWithEvents.has(day) && (
                      <View style={[styles.dot, selected === day && styles.dotSelected]} />
                    )}
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Events */}
        <View style={styles.eventList}>
          {loading ? (
            <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
          ) : Object.keys(grouped).length === 0 ? (
            <EmptyState
              icon="📅"
              title={selected ? `Sense events el dia ${selected}` : 'Cap event aquest mes'}
              subtitle="Crea el primer event de la colla!"
            />
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, dayEvents]) => (
                <View key={day} style={styles.dayGroup}>
                  <Text style={styles.dayLabel}>
                    {new Date(year, month, Number(day)).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
                  </Text>
                  {dayEvents.map(event => (
                    <Link key={event.id} href={`/event/${event.id}`} asChild>
                      <TouchableOpacity style={styles.eventCard}>
                        <View style={styles.eventTime}>
                          <Text style={styles.eventTimeText}>{formatHora(event.data_inici)}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.eventTitle} numberOfLines={1}>{event.titol}</Text>
                          {event.lloc && <Text style={styles.eventMeta}>📍 {event.lloc}</Text>}
                        </View>
                        {rsvpMap[event.id] === 'apuntat' && (
                          <Text style={styles.apuntatBadge}>✓</Text>
                        )}
                      </TouchableOpacity>
                    </Link>
                  ))}
                </View>
              ))
          )}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.white },
  monthHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingTop: spacing[4], paddingBottom: spacing[3] },
  monthTitle:     { ...typography.h2, color: colors.gray[900] },
  navBtn:         { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  navBtnText:     { fontSize: 18, color: colors.gray[700] },
  calendar:       { paddingHorizontal: spacing.screenH, marginBottom: spacing[4] },
  weekRow:        { flexDirection: 'row', marginBottom: spacing[2] },
  weekDay:        { flex: 1, textAlign: 'center', ...typography.label, color: colors.gray[500] },
  grid:           { flexDirection: 'row', flexWrap: 'wrap' },
  cell:           { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected:   { backgroundColor: colors.primary[600], borderRadius: radius.full },
  cellToday:      { borderWidth: 1.5, borderColor: colors.primary[600], borderRadius: radius.full },
  cellText:       { ...typography.body, color: colors.gray[700], fontWeight: '500' },
  cellTextSelected:{ color: colors.white, fontWeight: '700' },
  cellTextToday:  { color: colors.primary[600], fontWeight: '700' },
  dot:            { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary[600], marginTop: 2 },
  dotSelected:    { backgroundColor: colors.white },
  eventList:      { paddingHorizontal: spacing.screenH, gap: spacing[4] },
  dayGroup:       { gap: spacing[2] },
  dayLabel:       { ...typography.label, color: colors.gray[500], marginBottom: spacing[1] },
  eventCard:      { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadows.sm, borderWidth: 1, borderColor: colors.gray[100] },
  eventTime:      { backgroundColor: colors.primary[50], borderRadius: radius.xs, paddingHorizontal: spacing[2], paddingVertical: spacing[1], minWidth: 52, alignItems: 'center' },
  eventTimeText:  { ...typography.caption, color: colors.primary[600], fontWeight: '700' },
  eventTitle:     { ...typography.h3, color: colors.gray[900] },
  eventMeta:      { ...typography.caption, color: colors.gray[500] },
  apuntatBadge:   { fontSize: 16, color: colors.primary[600] },
})
