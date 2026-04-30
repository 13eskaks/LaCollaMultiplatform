import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Alert, ActivityIndicator, TextInput, Linking,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { LocationInput } from '@/components/ui/LocationInput'
import type { LocVal } from '@/components/ui/LocationInput'

const CAR_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

type Passatger = {
  id: string
  user_id: string | null
  nom_extern: string | null
  profiles: { nom: string; avatar_url: string | null } | null
}
type Cotxe = {
  id: string
  conductor_id: string | null
  nom_conductor: string | null
  afegit_per: string | null
  model: string | null
  color: string | null
  places_totals: number
  punt_trobada: string | null
  punt_trobada_lat: number | null
  punt_trobada_lng: number | null
  hora_sortida: string | null
  profiles: { nom: string; avatar_url: string | null } | null
  event_cotxe_passatgers: Passatger[]
}

function conductorDisplayName(c: Cotxe): string {
  return c.nom_conductor ?? c.profiles?.nom ?? '?'
}

function passName(p: Passatger): string {
  return p.nom_extern ?? p.profiles?.nom ?? '?'
}

function canManageCar(c: Cotxe, userId: string | null): boolean {
  return !!userId && (c.conductor_id === userId || c.afegit_per === userId)
}

function SeatDot({ nom, occupied }: { nom?: string; occupied: boolean }) {
  if (occupied && nom) {
    return (
      <View style={seat.filled}>
        <Text style={seat.initial}>{nom.charAt(0).toUpperCase()}</Text>
      </View>
    )
  }
  return <View style={seat.empty} />
}

const seat = StyleSheet.create({
  filled:  { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary[100], borderWidth: 2, borderColor: colors.primary[300], justifyContent: 'center', alignItems: 'center' },
  empty:   { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gray[100], borderWidth: 2, borderColor: colors.gray[200] },
  initial: { fontSize: 11, fontWeight: '700', color: colors.primary[700] },
})

export function CarpoolingSection({ eventId, userId, collaId, refreshKey, onJoinedCar }: { eventId: string; userId: string | null; collaId?: string; refreshKey?: number; onJoinedCar?: () => void }) {
  const [cotxes, setCotxes] = useState<Cotxe[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Add car modal
  const [showModal, setShowModal] = useState(false)
  const [nomConductor, setNomConductor] = useState('')
  const [places, setPlaces] = useState(3)
  const [model, setModel] = useState('')
  const [carColor, setCarColor] = useState(CAR_PALETTE[0])
  const [puntTrobada, setPuntTrobada] = useState('')
  const [puntTrobadaLat, setPuntTrobadaLat] = useState<number | null>(null)
  const [puntTrobadaLng, setPuntTrobadaLng] = useState<number | null>(null)
  const [horaSortida, setHoraSortida] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [garage, setGarage] = useState<{ id: string; model: string | null; color: string; places_totals: number }[]>([])
  const [carMembers, setCarMembers] = useState<{ user_id: string; nom: string }[]>([])
  const [selectedConductorId, setSelectedConductorId] = useState<string>('self')

  // Detail modal
  const [selectedCotxe, setSelectedCotxe] = useState<Cotxe | null>(null)

  // Add external passenger modal
  const [showAddPassModal, setShowAddPassModal] = useState(false)
  const [addPassCotxeId, setAddPassCotxeId] = useState<string | null>(null)
  const [addPassNom, setAddPassNom] = useState('')
  const [addPassSaving, setAddPassSaving] = useState(false)
  const [collaMembers, setCollaMembers] = useState<{ user_id: string; nom: string; avatar_url: string | null }[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)

  useEffect(() => { load() }, [eventId, refreshKey])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('event_cotxes')
      .select('*, profiles!conductor_id(nom, avatar_url), event_cotxe_passatgers(id, user_id, nom_extern, profiles!user_id(nom, avatar_url))')
      .eq('event_id', eventId)
      .order('hora_sortida', { ascending: true, nullsFirst: false })
    const rows = (data ?? []) as Cotxe[]
    setCotxes(rows)
    // Sync selected cotxe if detail modal is open
    if (selectedCotxe) {
      const updated = rows.find(c => c.id === selectedCotxe.id)
      setSelectedCotxe(updated ?? null)
    }
    setLoading(false)
  }

  async function openModal() {
    if (!userId) return
    setModel(''); setCarColor(CAR_PALETTE[0]); setPlaces(3); setPuntTrobada('')
    setPuntTrobadaLat(null); setPuntTrobadaLng(null)
    setNomConductor(''); setHoraSortida(null)
    // If user is already a passenger or conductor, default to external conductor
    setSelectedConductorId(myPassengerCarId || myDriverCarId ? 'extern' : 'self')
    setShowModal(true)
    const [garageRes, membresRes] = await Promise.all([
      supabase.from('user_garatge').select('id, model, color, places_totals').eq('user_id', userId).order('created_at', { ascending: false }),
      collaId
        ? supabase.from('colla_membres').select('user_id, profiles!user_id(nom)').eq('colla_id', collaId).eq('estat', 'actiu')
        : { data: [] },
    ])
    setGarage(garageRes.data ?? [])
    setCarMembers(
      ((membresRes.data ?? []) as any[])
        .filter(m => m.user_id !== userId)
        .map(m => ({ user_id: m.user_id, nom: m.profiles?.nom ?? '?' }))
    )
  }

  const myPassengerCarId = cotxes.find(c => c.event_cotxe_passatgers?.some(p => p.user_id === userId))?.id
  const myDriverCarId = cotxes.find(c => c.conductor_id === userId)?.id

  async function handleJoin(cotxeId: string) {
    if (!userId) return
    if (myDriverCarId) {
      Alert.alert('Ets conductor', 'Com a conductor d\'un cotxe no et pots afegir com a passatger d\'un altre.')
      return
    }
    setActionLoading(cotxeId)
    if (myPassengerCarId === cotxeId) {
      await supabase.from('event_cotxe_passatgers').delete().eq('cotxe_id', cotxeId).eq('user_id', userId)
    } else {
      if (myPassengerCarId) {
        await supabase.from('event_cotxe_passatgers').delete().eq('cotxe_id', myPassengerCarId).eq('user_id', userId)
      }
      const { error } = await supabase.from('event_cotxe_passatgers').insert({ cotxe_id: cotxeId, user_id: userId })
      if (error) Alert.alert('Error', error.message)
      else {
        await supabase.from('event_rsvp').upsert(
          { event_id: eventId, user_id: userId, estat: 'apuntat' },
          { onConflict: 'event_id,user_id' }
        )
        onJoinedCar?.()
      }
    }
    await load()
    setActionLoading(null)
  }

  async function handleDeleteCar(carId: string) {
    Alert.alert('Eliminar cotxe', 'Els passatgers quedaran sense cotxe assignat.', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setSelectedCotxe(null)
        await supabase.from('event_cotxes').delete().eq('id', carId)
        load()
      }},
    ])
  }

  async function handleRemovePassenger(passId: string) {
    setActionLoading(passId)
    await supabase.from('event_cotxe_passatgers').delete().eq('id', passId)
    await load()
    setActionLoading(null)
  }

  function openAddPassModal(cotxeId: string) {
    setAddPassCotxeId(cotxeId)
    setAddPassNom('')
    setMemberSearch('')
    setCollaMembers([])
    setShowAddPassModal(true)
    if (collaId) {
      setMembersLoading(true)
      supabase
        .from('colla_membres')
        .select('user_id, profiles!user_id(nom, avatar_url)')
        .eq('colla_id', collaId)
        .eq('estat', 'actiu')
        .then(({ data }) => {
          setCollaMembers((data ?? []).map((m: any) => ({
            user_id: m.user_id,
            nom: m.profiles?.nom ?? '?',
            avatar_url: m.profiles?.avatar_url ?? null,
          })))
          setMembersLoading(false)
        })
    }
  }

  async function handleSaveMemberPassenger(memberId: string) {
    if (!addPassCotxeId) return
    setAddPassSaving(true)
    try {
      const allCarIds = cotxes.map(c => c.id)
      if (allCarIds.length > 0) {
        await supabase.from('event_cotxe_passatgers').delete().in('cotxe_id', allCarIds).eq('user_id', memberId)
      }
      const { error } = await supabase.from('event_cotxe_passatgers').insert({ cotxe_id: addPassCotxeId, user_id: memberId })
      if (error) throw error
      setShowAddPassModal(false)
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No s\'ha pogut afegir el passatger')
    } finally {
      setAddPassSaving(false)
    }
  }

  async function handleSaveExternalPassenger() {
    if (!addPassCotxeId || !addPassNom.trim()) return
    setAddPassSaving(true)
    try {
      const { error } = await supabase.from('event_cotxe_passatgers').insert({
        cotxe_id: addPassCotxeId,
        user_id: null,
        nom_extern: addPassNom.trim(),
      })
      if (error) throw error
      setShowAddPassModal(false)
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No s\'ha pogut afegir el passatger')
    } finally {
      setAddPassSaving(false)
    }
  }

  async function handleAddCar() {
    if (!userId) { Alert.alert('Error', 'Has d\'estar autenticat'); return }
    if (selectedConductorId === 'self' && (myPassengerCarId || myDriverCarId)) {
      Alert.alert('No pots ser conductor', 'Ja estàs en un altre cotxe o ja conduixes un.')
      return
    }
    setSaving(true)
    try {
      const horaStr = horaSortida
        ? `${String(horaSortida.getHours()).padStart(2, '0')}:${String(horaSortida.getMinutes()).padStart(2, '0')}:00`
        : null
      const conductorId = selectedConductorId === 'self' ? userId
                        : selectedConductorId === 'extern' ? null
                        : selectedConductorId
      const conductorNom = selectedConductorId === 'extern' ? nomConductor.trim() || null : null
      const { error } = await supabase.from('event_cotxes').insert({
        event_id:      eventId,
        conductor_id:  conductorId,
        nom_conductor: conductorNom,
        afegit_per:    userId,
        places_totals: places,
        model:         model.trim() || null,
        color:         carColor,
        punt_trobada:     puntTrobada.trim() || null,
        punt_trobada_lat: puntTrobadaLat,
        punt_trobada_lng: puntTrobadaLng,
        hora_sortida:     horaStr,
      })
      if (error) throw error
      setShowModal(false)
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No s\'ha pogut afegir el cotxe')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary[600]} style={{ marginVertical: spacing[4] }} />

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Desplaçaments 🚗</Text>
        <TouchableOpacity style={styles.offerBtn} onPress={openModal}>
          <Text style={styles.offerBtnText}>+ Afegir cotxe</Text>
        </TouchableOpacity>
      </View>

      {cotxes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚗</Text>
          <Text style={styles.emptyTitle}>Cap cotxe ofert</Text>
          <Text style={styles.emptySub}>Sigues el primer en oferir transport!</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {cotxes.map((c, idx) => {
            const col     = c.color ?? CAR_PALETTE[idx % CAR_PALETTE.length]
            const pass    = c.event_cotxe_passatgers ?? []
            const lliures = c.places_totals - pass.length
            const isMine  = canManageCar(c, userId)
            const imIn    = pass.some(p => p.user_id === userId)
            const full    = lliures <= 0 && !imIn

            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.85}
                style={[styles.card, { borderTopColor: col, borderTopWidth: 5 }]}
                onPress={() => setSelectedCotxe(c)}
              >
                {/* Top row */}
                <View style={styles.cardTop}>
                  <Text style={styles.carEmoji}>🚗</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.carModel}>{c.model || 'Cotxe'}</Text>
                    {c.hora_sortida && <Text style={styles.cardMeta}>🕐 {c.hora_sortida.slice(0, 5)}</Text>}
                    {c.punt_trobada && <Text style={styles.cardMeta} numberOfLines={1}>📍 {c.punt_trobada}</Text>}
                  </View>
                  {isMine && (
                    <View style={[styles.myBadge, { backgroundColor: col }]}>
                      <Text style={styles.myBadgeText}>Tu 🧑‍✈️</Text>
                    </View>
                  )}
                </View>

                {/* Conductor */}
                <View style={styles.driverRow}>
                  {c.conductor_id
                    ? <Avatar name={c.profiles?.nom ?? ''} uri={c.profiles?.avatar_url} size="xs" />
                    : <View style={styles.extAvatar}><Text style={{ fontSize: 14 }}>👤</Text></View>
                  }
                  <Text style={styles.driverName} numberOfLines={1}>{conductorDisplayName(c)}</Text>
                  <Text style={styles.driverLabel}>conductor/a</Text>
                </View>

                {/* Seats preview */}
                <View style={styles.seatsWrap}>
                  <SeatDot nom={conductorDisplayName(c)} occupied />
                  {Array.from({ length: c.places_totals }).map((_, i) => (
                    <SeatDot key={i} nom={pass[i] ? passName(pass[i]) : ''} occupied={!!pass[i]} />
                  ))}
                </View>
                <Text style={styles.placesCount}>
                  {pass.length}/{c.places_totals} · {lliures > 0 ? `${lliures} lliure${lliures > 1 ? 's' : ''}` : 'Ple'}
                </Text>

                {/* Join/leave */}
                {!isMine && myDriverCarId && !imIn && (
                  <View style={[styles.joinBtn, styles.joinBtnFull]}>
                    <Text style={styles.joinTextFull}>🧑‍✈️ Ets conductor</Text>
                  </View>
                )}
                {!isMine && !myDriverCarId && (
                  <TouchableOpacity
                    style={[styles.joinBtn, { borderColor: col }, imIn && { backgroundColor: col }, full && styles.joinBtnFull]}
                    onPress={(e) => { e.stopPropagation?.(); handleJoin(c.id) }}
                    disabled={full || actionLoading === c.id}
                  >
                    {actionLoading === c.id
                      ? <ActivityIndicator size="small" color={imIn ? colors.white : col} />
                      : <Text style={[styles.joinText, imIn && styles.joinTextIn, full && styles.joinTextFull]}>
                          {imIn ? '✓ A bord · Sortir' : full ? '🚫 Ple' : "M'hi apunte 🙋"}
                        </Text>
                    }
                  </TouchableOpacity>
                )}
                {isMine && (
                  <View style={styles.manageRow}>
                    <Text style={styles.tapHint}>Toca per gestionar</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* ── DETAIL MODAL ── */}
      <Modal visible={!!selectedCotxe} transparent animationType="slide" onRequestClose={() => setSelectedCotxe(null)}>
        <View style={styles.overlay}>
          <View style={styles.detailSheet}>
            {selectedCotxe && (() => {
              const c   = selectedCotxe
              const col = c.color ?? CAR_PALETTE[0]
              const pass = c.event_cotxe_passatgers ?? []
              const lliures = c.places_totals - pass.length
              const isMine  = canManageCar(c, userId)
              const imIn    = pass.some(p => p.user_id === userId)
              const full    = lliures <= 0 && !imIn

              return (
                <>
                  <View style={[styles.detailHeader, { borderTopColor: col, borderTopWidth: 5 }]}>
                    <Text style={styles.detailEmoji}>🚗</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailTitle}>{c.model || 'Cotxe'}</Text>
                      <Text style={styles.detailConductor}>{conductorDisplayName(c)} · conductor/a</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedCotxe(null)} style={styles.closeBtn}>
                      <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
                    {/* Info rows */}
                    {c.hora_sortida && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>🕐</Text>
                        <Text style={styles.infoText}>Sortida a les {c.hora_sortida.slice(0, 5)}</Text>
                      </View>
                    )}
                    {c.punt_trobada && (
                      <TouchableOpacity
                        style={styles.infoRow}
                        onPress={() => {
                          const url = c.punt_trobada_lat && c.punt_trobada_lng
                            ? `https://maps.apple.com/?ll=${c.punt_trobada_lat},${c.punt_trobada_lng}&q=${encodeURIComponent(c.punt_trobada!)}`
                            : `https://maps.apple.com/?q=${encodeURIComponent(c.punt_trobada!)}`
                          Linking.openURL(url)
                        }}
                      >
                        <Text style={styles.infoIcon}>📍</Text>
                        <Text style={[styles.infoText, { color: colors.primary[600] }]}>{c.punt_trobada}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.infoRow}>
                      <Text style={styles.infoIcon}>💺</Text>
                      <Text style={styles.infoText}>{lliures > 0 ? `${lliures} plaça${lliures > 1 ? 'ces' : ''} lliure${lliures > 1 ? 's' : ''}` : 'Ple'}</Text>
                    </View>

                    {/* Passenger list */}
                    <Text style={styles.passLabel}>Passatgers ({pass.length}/{c.places_totals})</Text>
                    {pass.length === 0 ? (
                      <Text style={styles.emptyPass}>Encara ningú s'ha apuntat</Text>
                    ) : (
                      pass.map(p => (
                        <View key={p.id} style={styles.passRow}>
                          {p.user_id
                            ? <Avatar name={p.profiles?.nom ?? ''} uri={p.profiles?.avatar_url} size="sm" />
                            : <View style={styles.extAvatar}><Text style={{ fontSize: 14 }}>👤</Text></View>
                          }
                          <Text style={styles.passNom}>{passName(p)}</Text>
                          {p.nom_extern && <Text style={styles.externBadge}>extern</Text>}
                          {isMine && (
                            <TouchableOpacity
                              onPress={() => handleRemovePassenger(p.id)}
                              disabled={actionLoading === p.id}
                            >
                              {actionLoading === p.id
                                ? <ActivityIndicator size="small" color={colors.danger[500]} />
                                : <Text style={styles.removePass}>✕</Text>
                              }
                            </TouchableOpacity>
                          )}
                        </View>
                      ))
                    )}

                    {/* Actions */}
                    <View style={styles.detailActions}>
                      {(isMine || !!myDriverCarId) && (
                        <Button
                          label="+ Afegir passatger"
                          variant="secondary"
                          size="md"
                          onPress={() => { setSelectedCotxe(null); openAddPassModal(c.id) }}
                        />
                      )}
                      {isMine && (
                        <Button
                          label="Eliminar cotxe"
                          variant="danger"
                          size="md"
                          onPress={() => handleDeleteCar(c.id)}
                        />
                      )}
                      {!isMine && myDriverCarId && !imIn && (
                        <View style={styles.driverBlockedBanner}>
                          <Text style={styles.driverBlockedText}>🧑‍✈️ Ets conductor d'un altre cotxe</Text>
                        </View>
                      )}
                      {!isMine && !myDriverCarId && (
                        <Button
                          label={imIn ? '✓ A bord · Sortir del cotxe' : full ? '🚫 Ple' : "M'hi apunte 🙋"}
                          variant={imIn ? 'secondary' : 'primary'}
                          size="lg"
                          loading={actionLoading === c.id}
                          onPress={() => handleJoin(c.id)}
                          disabled={full && !imIn}
                        />
                      )}
                    </View>
                  </ScrollView>
                </>
              )
            })()}
          </View>
        </View>
      </Modal>

      {/* ── ADD CAR MODAL ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.modalScroll}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Afegir cotxe 🚗</Text>

              {garage.length > 0 && (
              <View>
                <Text style={styles.fieldLabel}>Des del garatge</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
                  {garage.map(car => (
                    <TouchableOpacity
                      key={car.id}
                      style={[styles.garageChip, { borderColor: car.color }]}
                      onPress={() => { setModel(car.model ?? ''); setCarColor(car.color); setPlaces(car.places_totals) }}
                    >
                      <View style={[styles.garageChipDot, { backgroundColor: car.color }]} />
                      <Text style={styles.garageChipText}>{car.model || 'Cotxe'} · {car.places_totals}p</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputWrap}>
                <Text style={styles.fieldLabel}>Conductor/a</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[1] }}>
                  {[{ user_id: 'self', nom: 'Jo (tu)' }, ...carMembers, { user_id: 'extern', nom: 'Extern ✏️' }].map(m => {
                    const selfBlocked = m.user_id === 'self' && !!(myPassengerCarId || myDriverCarId)
                    return (
                      <TouchableOpacity
                        key={m.user_id}
                        style={[styles.conductorChip, selectedConductorId === m.user_id && styles.conductorChipOn, selfBlocked && styles.conductorChipDisabled]}
                        onPress={() => !selfBlocked && setSelectedConductorId(m.user_id)}
                        disabled={selfBlocked}
                      >
                        <Text style={[styles.conductorChipText, selectedConductorId === m.user_id && styles.conductorChipTextOn, selfBlocked && styles.conductorChipTextDisabled]}>
                          {m.nom}{selfBlocked ? ' 🚫' : ''}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
                {selectedConductorId === 'extern' && (
                  <TextInput
                    style={[styles.textInput, { marginTop: spacing[2] }]}
                    value={nomConductor}
                    onChangeText={setNomConductor}
                    placeholder="Ex: Jose, prima d'Ivan..."
                    placeholderTextColor={colors.gray[400]}
                    autoFocus
                  />
                )}
              </View>

              <View>
                <Text style={styles.fieldLabel}>Places per a passatgers</Text>
                <View style={styles.placesRow}>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.placeBtn, places === n && styles.placeBtnOn]}
                      onPress={() => setPlaces(n)}
                    >
                      <Text style={[styles.placeBtnTxt, places === n && styles.placeBtnTxtOn]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Color del cotxe</Text>
                <View style={styles.colorRow}>
                  {CAR_PALETTE.map(col => (
                    <TouchableOpacity
                      key={col}
                      style={[styles.colorDot, { backgroundColor: col }, carColor === col && styles.colorDotOn]}
                      onPress={() => setCarColor(col)}
                    />
                  ))}
                </View>
              </View>

              <LocationInput
                label="Punt de trobada (opcional)"
                value={puntTrobada}
                onChangeText={t => { setPuntTrobada(t); setPuntTrobadaLat(null); setPuntTrobadaLng(null) }}
                onSelect={(loc: LocVal) => { setPuntTrobada(loc.nom); setPuntTrobadaLat(loc.lat); setPuntTrobadaLng(loc.lng) }}
                placeholder="📍 Busca o escriu el punt de trobada..."
                collaId={collaId}
              />

              <View style={styles.inputWrap}>
                <Text style={styles.fieldLabel}>Model del cotxe (opcional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={model}
                  onChangeText={setModel}
                  placeholder="Ex: Seat Ibiza, Volkswagen Golf..."
                  placeholderTextColor={colors.gray[400]}
                />
              </View>

              <DatePicker label="Hora de sortida (opcional)" value={horaSortida} onChange={setHoraSortida} mode="time" />

              <View style={styles.modalBtns}>
                <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
                <Button label="Afegir 🚗" size="md" loading={saving} onPress={handleAddCar} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── ADD PASSENGER MODAL ── */}
      <Modal visible={showAddPassModal} transparent animationType="fade">
        <View style={styles.passOverlay}>
          <View style={styles.passModal}>
            <Text style={styles.modalTitle}>Afegir passatger</Text>

            {collaId && (
              <>
                <TextInput
                  style={styles.textInput}
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Cerca un membre de la colla..."
                  placeholderTextColor={colors.gray[400]}
                  autoFocus
                />
                {membersLoading ? (
                  <ActivityIndicator color={colors.primary[600]} />
                ) : (
                  <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {collaMembers
                      .filter(m => {
                        const cotxe = cotxes.find(c => c.id === addPassCotxeId)
                        const alreadyIn = cotxe?.event_cotxe_passatgers?.some(p => p.user_id === m.user_id) || cotxe?.conductor_id === m.user_id
                        return !alreadyIn && m.nom.toLowerCase().includes(memberSearch.toLowerCase())
                      })
                      .map(m => (
                        <TouchableOpacity
                          key={m.user_id}
                          style={styles.memberRow}
                          onPress={() => handleSaveMemberPassenger(m.user_id)}
                          disabled={addPassSaving}
                        >
                          <Avatar name={m.nom} uri={m.avatar_url} size="sm" />
                          <Text style={styles.memberNom}>{m.nom}</Text>
                          <Text style={{ color: colors.primary[600], fontSize: 18, fontWeight: '700' }}>+</Text>
                        </TouchableOpacity>
                      ))
                    }
                  </ScrollView>
                )}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>o afegir extern</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            <TextInput
              style={styles.textInput}
              value={addPassNom}
              onChangeText={setAddPassNom}
              placeholder="Nom del convidat extern..."
              placeholderTextColor={colors.gray[400]}
              onSubmitEditing={handleSaveExternalPassenger}
            />
            <View style={styles.modalBtns}>
              <Button label="Cancel·lar" variant="secondary" size="md" onPress={() => setShowAddPassModal(false)} style={{ flex: 1 }} />
              <Button label="Afegir extern" size="md" loading={addPassSaving} onPress={handleSaveExternalPassenger} style={{ flex: 1 }} disabled={!addPassNom.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  section:        { gap: spacing[3] },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:          { ...typography.h3, color: colors.gray[900] },
  offerBtn:       { backgroundColor: colors.primary[600], borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  offerBtnText:   { ...typography.caption, color: colors.white, fontWeight: '700' },

  empty:          { backgroundColor: colors.gray[50], borderRadius: radius.lg, padding: spacing[6], alignItems: 'center', gap: spacing[2] },
  emptyEmoji:     { fontSize: 52 },
  emptyTitle:     { ...typography.h3, color: colors.gray[600] },
  emptySub:       { ...typography.bodySm, color: colors.gray[400], textAlign: 'center' },

  scroll:         { gap: spacing[3], paddingBottom: spacing[1] },
  card:           { width: 200, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], gap: spacing[2], ...shadows.sm },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  carEmoji:       { fontSize: 28, lineHeight: 34 },
  carModel:       { ...typography.h3, color: colors.gray[900] },
  cardMeta:       { ...typography.caption, color: colors.gray[500], marginTop: 1 },
  myBadge:        { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  myBadgeText:    { fontSize: 11, color: colors.white, fontWeight: '700' },

  driverRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  driverName:     { ...typography.bodySm, color: colors.gray[700], fontWeight: '600', flex: 1 },
  driverLabel:    { ...typography.caption, color: colors.gray[400] },
  extAvatar:      { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },

  seatsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  placesCount:    { ...typography.caption, color: colors.gray[400] },

  joinBtn:        { borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center', borderWidth: 1.5, marginTop: spacing[1] },
  joinBtnFull:    { borderColor: colors.gray[200], backgroundColor: colors.gray[50] },
  joinText:       { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  joinTextIn:     { color: colors.white },
  joinTextFull:   { color: colors.gray[400] },
  manageRow:      { alignItems: 'center', marginTop: spacing[1] },
  tapHint:        { ...typography.caption, color: colors.gray[400] },

  // Detail sheet
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet:    { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', overflow: 'hidden' },
  detailHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[5], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  detailEmoji:    { fontSize: 32 },
  detailTitle:    { ...typography.h2, color: colors.gray[900] },
  detailConductor:{ ...typography.bodySm, color: colors.gray[500] },
  closeBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  closeBtnText:   { fontSize: 14, color: colors.gray[600] },
  detailBody:     { padding: spacing[5], gap: spacing[3], paddingBottom: spacing[8] },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  infoIcon:       { fontSize: 18 },
  infoText:       { ...typography.body, color: colors.gray[800] },
  passLabel:      { ...typography.label, color: colors.gray[500], marginTop: spacing[2] },
  emptyPass:      { ...typography.bodySm, color: colors.gray[400] },
  passRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1] },
  passNom:        { ...typography.body, color: colors.gray[800], flex: 1 },
  externBadge:    { ...typography.caption, color: colors.gray[400], backgroundColor: colors.gray[100], paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full },
  removePass:     { fontSize: 16, color: colors.danger[500], paddingHorizontal: spacing[2] },
  detailActions:       { gap: spacing[2], marginTop: spacing[2] },
  driverBlockedBanner: { backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: spacing[3], alignItems: 'center' },
  driverBlockedText:   { ...typography.body, color: colors.gray[500] },

  // Add car modal
  modalScroll:    { justifyContent: 'flex-end', flexGrow: 1 },
  modal:          { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[4] },
  modalTitle:     { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  fieldLabel:     { ...typography.label, color: colors.gray[500], marginBottom: spacing[2] },
  placesRow:      { flexDirection: 'row', gap: spacing[2] },
  placeBtn:       { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  placeBtnOn:     { backgroundColor: colors.primary[600] },
  placeBtnTxt:    { fontSize: 18, fontWeight: '700', color: colors.gray[600] },
  placeBtnTxtOn:  { color: colors.white },
  colorRow:       { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  colorDot:       { width: 32, height: 32, borderRadius: 16 },
  colorDotOn:     { borderWidth: 3, borderColor: colors.gray[800] },
  conductorChip:          { borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6, backgroundColor: colors.white },
  conductorChipOn:        { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  conductorChipDisabled:  { borderColor: colors.gray[100], backgroundColor: colors.gray[50], opacity: 0.5 },
  conductorChipText:      { ...typography.bodySm, color: colors.gray[600], fontWeight: '600' },
  conductorChipTextOn:    { color: colors.primary[700] },
  conductorChipTextDisabled: { color: colors.gray[400] },
  garageChip:     { flexDirection: 'row', alignItems: 'center', gap: spacing[1], borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  garageChipDot:  { width: 10, height: 10, borderRadius: 5 },
  garageChipText: { ...typography.bodySm, color: colors.gray[700], fontWeight: '600' },
  inputWrap:      { gap: spacing[1] },
  textInput:      { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: 10, ...typography.body, color: colors.gray[900], backgroundColor: colors.white },
  modalBtns:      { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },

  // Add passenger modal
  passOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: spacing[5] },
  passModal:      { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  memberRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  memberNom:      { ...typography.body, color: colors.gray[800], flex: 1 },
  dividerRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dividerLine:    { flex: 1, height: 1, backgroundColor: colors.gray[200] },
  dividerText:    { ...typography.caption, color: colors.gray[400] },
})
