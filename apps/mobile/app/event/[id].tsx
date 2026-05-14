import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert, Image
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { formatData, formatHora } from '@lacolla/shared'
import { useTranslation } from 'react-i18next'
import { useCollaStore } from '@/stores/colla'
import { useAuthStore } from '@/stores/auth'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CarpoolingSection } from '@/components/ui/CarpoolingSection'
import { RichBodyView } from '@/components/ui/RichBody'
import type { SavedBlock } from '@/components/ui/RichBody'

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const { isComissioActiva } = useCollaStore()
  const { profile } = useAuthStore()
  const [event, setEvent] = useState<any>(null)
  const [rsvps, setRsvps] = useState<any[]>([])
  const [myRsvp, setMyRsvp] = useState<string | null>(null)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [carpoolingKey, setCarpoolingKey] = useState(0)

  useFocusEffect(useCallback(() => { loadEvent() }, [id]))

  async function loadEvent() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const [eventRes, rsvpRes] = await Promise.all([
      supabase.from('events').select('*, colles(nom)').eq('id', id).single(),
      supabase.from('event_rsvp').select('*, profiles(nom, cognoms, avatar_url)').eq('event_id', id),
    ])

    setEvent(eventRes.data)
    const allRsvps = rsvpRes.data ?? []
    setRsvps(allRsvps)

    if (user) {
      const mine = allRsvps.find((r: any) => r.user_id === user.id)
      setMyRsvp(mine?.estat ?? null)
    }
    setLoading(false)
  }

  async function handleRsvp(estat: string) {
    if (!userId) {
      router.push('/(auth)/register' as any)
      return
    }
    setRsvpLoading(true)

    if (myRsvp === estat) {
      await supabase.from('event_rsvp').delete().eq('event_id', id).eq('user_id', userId)
      setMyRsvp(null)
      setRsvps(r => r.filter(x => x.user_id !== userId))
      const { data: cotxes } = await supabase.from('event_cotxes').select('id').eq('event_id', id)
      const ids = cotxes?.map(c => c.id) ?? []
      if (ids.length > 0) {
        await supabase.from('event_cotxe_passatgers').delete().eq('user_id', userId).in('cotxe_id', ids)
      }
      setCarpoolingKey(k => k + 1)
    } else {
      await supabase.from('event_rsvp').upsert(
        { event_id: id, user_id: userId, estat },
        { onConflict: 'event_id,user_id' }
      )
      setMyRsvp(estat)
      setRsvps(r => {
        const filtered = r.filter(x => x.user_id !== userId)
        return [...filtered, {
          user_id: userId,
          estat,
          profiles: profile
            ? { nom: profile.nom, cognoms: profile.cognoms, avatar_url: profile.avatar_url }
            : null,
        }]
      })
    }
    setRsvpLoading(false)
  }

  async function handleDelete() {
    Alert.alert(t('event.delete.title'), t('event.delete.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('events').delete().eq('id', id)
          router.back()
        },
      },
    ])
  }

  function openMaps() {
    if (!event?.lloc) return
    const url = `https://maps.apple.com/?q=${encodeURIComponent(event.lloc)}`
    Linking.openURL(url)
  }

  function goToEdit() {
    router.push({ pathname: '/event/create', params: { eventId: id } } as any)
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>{t('event.notFound')}</Text>
      </View>
    )
  }

  const apuntats = rsvps.filter(r => r.estat === 'apuntat')
  const isApuntat = myRsvp === 'apuntat'
  const canManage = isComissioActiva()

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Hero */}
        {event.imatge_url ? (
          <View style={styles.hero}>
            <Image source={{ uri: event.imatge_url }} style={styles.heroImg} />
            <View style={styles.heroOverlay} />
            <SafeAreaView style={styles.heroContent} edges={['top']}>
              <View style={styles.headerRow}>
                <TouchableOpacity style={styles.heroBtn} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={22} color={colors.white} />
                </TouchableOpacity>
                {canManage && (
                  <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.heroBtn} onPress={goToEdit}>
                      <Ionicons name="pencil-outline" size={18} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.heroBtn} onPress={handleDelete}>
                      <Ionicons name="trash-outline" size={18} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </SafeAreaView>
            <View style={styles.heroText}>
              <Text style={styles.collaName}>{event.colles?.nom}</Text>
              <Text style={styles.heroTitle}>{event.titol}</Text>
            </View>
          </View>
        ) : (
          <SafeAreaView style={styles.plainHeaderWrap} edges={['top']}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.darkBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={22} color={colors.gray[700]} />
              </TouchableOpacity>
              {canManage && (
                <View style={styles.headerActions}>
                  <TouchableOpacity style={styles.darkActionBtn} onPress={goToEdit}>
                    <Ionicons name="pencil-outline" size={17} color={colors.gray[600]} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerActionBtn} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger[500]} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={styles.collaNameDark}>{event.colles?.nom}</Text>
            <Text style={styles.plainTitle}>{event.titol}</Text>
          </SafeAreaView>
        )}

        <View style={styles.body}>
          {/* Info bàsica */}
          <View style={styles.infoCard}>
            <TouchableOpacity style={styles.infoRow} disabled={!event.lloc} onPress={openMaps}>
              <Text style={styles.infoIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoText}>{formatData(event.data_inici)}</Text>
                <Text style={styles.infoSub}>
                  {formatHora(event.data_inici)}
                  {event.data_fi ? ` – ${formatHora(event.data_fi)}` : ''}
                </Text>
              </View>
            </TouchableOpacity>

            {event.lloc && (
              <TouchableOpacity style={styles.infoRow} onPress={openMaps}>
                <Text style={styles.infoIcon}>📍</Text>
                <Text style={[styles.infoText, { color: colors.primary[600] }]}>{event.lloc}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>👥</Text>
              <View>
                <Text style={styles.infoText}>{apuntats.length} {apuntats.length === 1 ? t('event.attendees.one') : t('event.attendees.many')}</Text>
                {event.limit_places && (
                  <Text style={styles.infoSub}>
                    {t('event.places.free', { count: Math.max(0, event.limit_places - apuntats.length), total: event.limit_places })}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Descripció */}
          {(event.descripcio_blocks || event.descripcio) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('event.description')}</Text>
              {event.descripcio_blocks
                ? <RichBodyView blocks={event.descripcio_blocks as SavedBlock[]} textStyle={styles.descripcio} />
                : <Text style={styles.descripcio}>{event.descripcio}</Text>
              }
            </View>
          )}

          {/* Assistents */}
          {apuntats.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('event.attendees')}</Text>
              <View style={styles.avatarRow}>
                {apuntats.slice(0, 8).map((r: any) => (
                  <Avatar
                    key={r.user_id}
                    name={`${r.profiles?.nom ?? ''} ${r.profiles?.cognoms ?? ''}`}
                    uri={r.profiles?.avatar_url}
                    size="md"
                    style={styles.avatarOverlap}
                  />
                ))}
                {apuntats.length > 8 && (
                  <View style={styles.moreAvatars}>
                    <Text style={styles.moreAvatarsText}>+{apuntats.length - 8}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Desplaçaments */}
          <CarpoolingSection
            eventId={id}
            userId={userId}
            collaId={event?.colla_id}
            refreshKey={carpoolingKey}
            onJoinedCar={() => {
              setMyRsvp('apuntat')
              setRsvps(r => [...r.filter(x => x.user_id !== userId), {
                user_id: userId,
                estat: 'apuntat',
                profiles: profile
                  ? { nom: profile.nom, cognoms: profile.cognoms, avatar_url: profile.avatar_url }
                  : null,
              }])
            }}
          />

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* RSVP botó flotant */}
      <View style={styles.rsvpBar}>
        <View style={styles.rsvpBtns}>
          <Button
            label={isApuntat ? t('event.attending') : t('event.join')}
            variant={isApuntat ? 'secondary' : 'primary'}
            size="lg"
            loading={rsvpLoading}
            style={{ flex: 1 }}
            onPress={() => handleRsvp('apuntat')}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.gray[50] },
  loader:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  notFound:         { ...typography.body, color: colors.gray[500] },

  // Shared header row
  headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3] },
  headerActions:    { flexDirection: 'row', gap: spacing[2] },

  // Hero amb imatge
  hero:             { height: 280, position: 'relative' },
  heroImg:          { width: '100%', height: '100%' },
  heroOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  heroContent:      { ...StyleSheet.absoluteFillObject },
  heroBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  heroText:         { position: 'absolute', bottom: spacing[4], paddingHorizontal: spacing.screenH },
  collaName:        { ...typography.caption, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  heroTitle:        { ...typography.display, color: colors.white },

  // Header sense imatge
  plainHeaderWrap:  { backgroundColor: colors.white, paddingBottom: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.gray[100], ...shadows.sm },
  darkBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  darkActionBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  dangerActionBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.danger[50], justifyContent: 'center', alignItems: 'center' },
  collaNameDark:    { ...typography.caption, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, paddingHorizontal: spacing.screenH },
  plainTitle:       { ...typography.display, color: colors.gray[900], paddingHorizontal: spacing.screenH },

  body:             { padding: spacing.screenH, gap: spacing[4] },
  infoCard:         { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  infoRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  infoIcon:         { fontSize: 18, marginTop: 2 },
  infoText:         { ...typography.body, color: colors.gray[800], fontWeight: '500' },
  infoSub:          { ...typography.bodySm, color: colors.gray[500], marginTop: 2 },

  section:          { gap: spacing[3] },
  sectionTitle:     { ...typography.h3, color: colors.gray[900] },
  descripcio:       { ...typography.bodyLg, color: colors.gray[600], lineHeight: 24 },

  avatarRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: -8 },
  avatarOverlap:    { marginRight: -8, borderWidth: 2, borderColor: colors.white },
  moreAvatars:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray[200], justifyContent: 'center', alignItems: 'center', marginLeft: spacing[2] },
  moreAvatarsText:  { ...typography.caption, color: colors.gray[600], fontWeight: '700' },

  rsvpBar:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, paddingHorizontal: spacing.screenH, paddingTop: spacing[3], paddingBottom: spacing[8], borderTopWidth: 1, borderTopColor: colors.gray[100], ...shadows.md },
  rsvpBtns:         { flexDirection: 'row', gap: spacing[2] },
})
