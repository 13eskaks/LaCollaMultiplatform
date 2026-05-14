import {
  View, Text, ScrollView, Switch, StyleSheet, Alert,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { useDataCache } from '@/stores/dataCache'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { CityInput } from '@/components/ui/CityInput'
import { YearPicker } from '@/components/ui/YearPicker'
import { LocationPickerModal } from '@/components/ui/LocationPickerModal'

const ALL_MODULS = [
  { key: 'anuncis',    icon: '📢', label: 'Anuncis' },
  { key: 'votacions',  icon: '🗳️', label: 'Votacions' },
  { key: 'torns',      icon: '🧹', label: 'Torns' },
  { key: 'llocs',      icon: '📍', label: 'Llocs' },
  { key: 'membres',    icon: '👥', label: 'Membres' },
  { key: 'caixa',      icon: '💶', label: 'Caixa' },
  { key: 'tricount',   icon: '🧾', label: 'Tricount' },
  { key: 'quotes',     icon: '📋', label: 'Quotes' },
  { key: 'fotos',      icon: '📸', label: 'Fotos' },
  { key: 'actes',      icon: '🏛', label: 'Actes' },
  { key: 'pressupost',  icon: '🏷️', label: 'Pressupost' },
  { key: 'connexions',  icon: '🔗', label: 'Connexions' },
]

type Tab = 'general' | 'membres' | 'moduls'

type PendingMembre = {
  id: string
  user_id: string
  profiles: { nom: string; avatar_url: string | null } | null
  created_at: string
}

export default function CollaSettingsScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const { loadColles } = useCollaStore()
  const dc = useDataCache()

  const [tab, setTab] = useState<Tab>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // General tab state
  const [nom, setNom] = useState('')
  const [localitat, setLocalitat] = useState('')
  const [comarca, setComarca] = useState('')
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)
  const [anyFundacio, setAnyFundacio] = useState('')
  const [nomLastChanged, setNomLastChanged] = useState<string | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [originalNom, setOriginalNom] = useState('')
  const [portadaUrl, setPortadaUrl] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState<'portada' | 'avatar' | null>(null)

  // Membres tab state
  const [aprovacioManual, setAprovacioManual] = useState(true)
  const [perfilPublic, setPerfilPublic] = useState(true)
  const [quiCreaEvents, setQuiCreaEvents] = useState<'membres' | 'comissio'>('membres')
  const [quiCreaVotacions, setQuiCreaVotacions] = useState<'membres' | 'comissio'>('membres')
  const [quiCreaFils, setQuiCreaFils] = useState<'membres' | 'comissio'>('membres')
  const [pendents, setPendents] = useState<PendingMembre[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Mòduls tab state
  const [modulsActius, setModulsActius] = useState<string[]>(ALL_MODULS.map(m => m.key))
  const [modulsComissio, setModulsComissio] = useState<string[]>([])

  useEffect(() => { loadAll() }, [collaId])

  async function loadAll() {
    setLoading(true)
    const [configRes, collaRes, pendentsRes] = await Promise.all([
      supabase.from('colla_config').select('*').eq('colla_id', collaId).single(),
      supabase.from('colles')
        .select('nom, localitat, comarca, latitud, longitud, any_fundacio, descripcio, portada_url, avatar_url, nom_last_changed')
        .eq('id', collaId).single(),
      supabase.from('colla_membres')
        .select('id, user_id, created_at, profiles!user_id(nom, avatar_url)')
        .eq('colla_id', collaId)
        .eq('estat', 'pendent')
        .order('created_at', { ascending: true }),
    ])

    if (configRes.data) {
      setAprovacioManual(configRes.data.aprovacio_manual ?? true)
      setPerfilPublic(configRes.data.perfil_public ?? true)
      setQuiCreaEvents(configRes.data.qui_pot_crear_events ?? 'membres')
      setQuiCreaVotacions(configRes.data.qui_pot_crear_votacions ?? 'membres')
      setQuiCreaFils(configRes.data.qui_pot_crear_fils ?? 'membres')
      if (configRes.data.moduls_actius) setModulsActius(configRes.data.moduls_actius)
      setModulsComissio(configRes.data.moduls_comissio ?? [])
    }
    if (collaRes.data) {
      const c = collaRes.data
      setNom(c.nom ?? ''); setOriginalNom(c.nom ?? '')
      setLocalitat(c.localitat ?? ''); setComarca(c.comarca ?? '')
      setLatitud(c.latitud ?? null); setLongitud(c.longitud ?? null)
      setAnyFundacio(c.any_fundacio ? String(c.any_fundacio) : '')
      setPortadaUrl(c.portada_url); setAvatarUrl(c.avatar_url)
      setNomLastChanged(c.nom_last_changed ?? null)
    }
    setPendents((pendentsRes.data ?? []) as unknown as PendingMembre[])
    setLoading(false)
  }

  // ── Image upload ──────────────────────────────────────────────
  async function handleUploadImage(type: 'portada' | 'avatar') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9], quality: 0.85,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${collaId}/${type}-${Date.now()}.${ext}`
    setUploadingImage(type)
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      const bstr = atob(b64); const bytes = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i)

      const { error } = await supabase.storage
        .from('colla-fotos')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true })
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('colla-fotos').getPublicUrl(path)
      await supabase.from('colles').update({ [type === 'portada' ? 'portada_url' : 'avatar_url']: publicUrl }).eq('id', collaId)
      if (type === 'portada') setPortadaUrl(publicUrl)
      else setAvatarUrl(publicUrl)
      loadColles()
    } catch {
      Alert.alert(t('common.error'), t('settings.image.uploadError'))
    } finally {
      setUploadingImage(null)
    }
  }

  // ── General tab save ──────────────────────────────────────────
  const canRename = !nomLastChanged ||
    Date.now() - new Date(nomLastChanged).getTime() > 30 * 24 * 60 * 60 * 1000
  const nextRenameDate = nomLastChanged
    ? new Date(new Date(nomLastChanged).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null

  async function handleSaveGeneral() {
    if (!nom.trim()) { Alert.alert(t('common.error'), t('settings.error.nameEmpty')); return }
    const nomChanged = nom.trim() !== originalNom
    if (nomChanged && !canRename) {
      Alert.alert(t('settings.rename.limit'), t('settings.rename.until', { date: nextRenameDate!.toLocaleDateString() }))
      return
    }
    setSaving(true)
    const collaUpdate: Record<string, any> = {
      localitat: localitat.trim() || null,
      comarca: comarca.trim() || null,
      latitud: latitud ?? null,
      longitud: longitud ?? null,
      any_fundacio: anyFundacio ? parseInt(anyFundacio, 10) : null,
    }
    if (nomChanged) { collaUpdate.nom = nom.trim(); collaUpdate.nom_last_changed = new Date().toISOString() }

    const { error } = await supabase.from('colles').update(collaUpdate).eq('id', collaId)
    if (error) { Alert.alert('Error', error.message) }
    else {
      if (nomChanged) { setOriginalNom(nom.trim()); setNomLastChanged(new Date().toISOString()) }
      loadColles()
      Alert.alert(t('settings.saved'))
    }
    setSaving(false)
  }

  // ── Config auto-save helpers ──────────────────────────────────
  async function saveConfigField(field: Record<string, any>) {
    await supabase.from('colla_config').update(field).eq('colla_id', collaId)
  }

  function toggleAprovacio(val: boolean) {
    setAprovacioManual(val)
    saveConfigField({ aprovacio_manual: val })
  }
  function togglePerfilPublic(val: boolean) {
    setPerfilPublic(val)
    saveConfigField({ perfil_public: val })
  }
  function changeQuiCrea(field: string, val: 'membres' | 'comissio') {
    if (field === 'events') setQuiCreaEvents(val)
    else if (field === 'votacions') setQuiCreaVotacions(val)
    else setQuiCreaFils(val)
    saveConfigField({ [`qui_pot_crear_${field}`]: val })
  }
  function toggleModul(key: string, actiu: boolean) {
    const next = actiu ? modulsActius.filter(k => k !== key) : [...modulsActius, key]
    const nextComissio = actiu ? modulsComissio.filter(k => k !== key) : modulsComissio
    setModulsActius(next)
    if (actiu) setModulsComissio(nextComissio)
    saveConfigField({ moduls_actius: next, moduls_comissio: nextComissio })
    dc.bust(`colla_tab_${collaId}`)
  }

  function toggleModulVisibilitat(key: string) {
    const isComissioOnly = modulsComissio.includes(key)
    const next = isComissioOnly
      ? modulsComissio.filter(k => k !== key)
      : [...modulsComissio, key]
    setModulsComissio(next)
    saveConfigField({ moduls_comissio: next })
    dc.bust(`colla_tab_${collaId}`)
  }

  // ── Pending members ───────────────────────────────────────────
  async function handleAprovar(membreId: string) {
    setActionLoading(membreId)
    await supabase.from('colla_membres')
      .update({ estat: 'actiu', data_ingres: new Date().toISOString() })
      .eq('id', membreId)
    setPendents(prev => prev.filter(p => p.id !== membreId))
    setActionLoading(null)
  }

  async function handleRebutjar(membreId: string, nom: string) {
    Alert.alert(t('settings.members.reject.title'), t('settings.members.reject.confirm', { nom }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        setActionLoading(membreId)
        await supabase.from('colla_membres').delete().eq('id', membreId)
        setPendents(prev => prev.filter(p => p.id !== membreId))
        setActionLoading(null)
      }},
    ])
  }

  // ── Sub-components ────────────────────────────────────────────
  const SegmentControl = ({
    value, field,
  }: { value: 'membres' | 'comissio'; field: 'events' | 'votacions' | 'fils' }) => (
    <View style={styles.segment}>
      {(['membres', 'comissio'] as const).map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.segBtn, value === opt && styles.segBtnActive]}
          onPress={() => changeQuiCrea(field, opt)}
        >
          <Text style={[styles.segText, value === opt && styles.segTextActive]}>
            {opt === 'membres' ? t('settings.allMembers') : t('settings.commissionOnly')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('settings.title.loading')} />
        <View style={styles.loaderWrap}><ActivityIndicator color={colors.primary[600]} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('settings.title')} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'general',  label: t('settings.tab.general') },
          { key: 'membres',  label: `${t('settings.tab.members')}${pendents.length ? ` (${pendents.length})` : ''}` },
          { key: 'moduls',   label: t('settings.tab.modules') },
        ] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── GENERAL TAB ── */}
      {tab === 'general' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Images */}
          <Text style={styles.sectionTitle}>{t('settings.section.images')}</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.imageRow} onPress={() => handleUploadImage('portada')} disabled={!!uploadingImage}>
              <View style={styles.portadaPreview}>
                {portadaUrl
                  ? <Image source={{ uri: portadaUrl }} style={styles.portadaImg} />
                  : <View style={[styles.portadaImg, styles.portadaPlaceholder]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.imageLabelText}>{t('settings.image.portada')}</Text>
                <Text style={styles.imageHint}>{t('settings.image.portada.hint')}</Text>
              </View>
              {uploadingImage === 'portada'
                ? <ActivityIndicator size="small" color={colors.primary[600]} />
                : <Text style={styles.editLink}>{t('settings.image.change')}</Text>}
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.imageRow} onPress={() => handleUploadImage('avatar')} disabled={!!uploadingImage}>
              <View style={styles.avatarPreview}>
                {avatarUrl
                  ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                  : <View style={[styles.avatarImg, styles.avatarPlaceholder]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.imageLabelText}>{t('settings.image.avatar')}</Text>
                <Text style={styles.imageHint}>{t('settings.image.avatar.hint')}</Text>
              </View>
              {uploadingImage === 'avatar'
                ? <ActivityIndicator size="small" color={colors.primary[600]} />
                : <Text style={styles.editLink}>{t('settings.image.change')}</Text>}
            </TouchableOpacity>
          </View>

          {/* Basic info */}
          <Text style={styles.sectionTitle}>{t('settings.section.basicInfo')}</Text>
          <View style={styles.card}>
            <View style={styles.fieldWrap}>
              <Input label={t('settings.basicInfo.nom')} value={nom} onChangeText={setNom} editable={canRename} />
              {!canRename && nextRenameDate && (
                <Text style={styles.renameHint}>
                  {t('settings.basicInfo.renameLock', { date: nextRenameDate.toLocaleDateString() })}
                </Text>
              )}
            </View>
            <View style={styles.fieldWrap}>
              <CityInput label={t('settings.basicInfo.localitat')} value={localitat} onChangeText={setLocalitat} placeholder="Ex: Gràcia, Barcelona..." />
            </View>
            {comarca ? (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('settings.basicInfo.comarca')}</Text>
                <Text style={styles.fieldReadOnly}>{comarca}</Text>
              </View>
            ) : null}
            <View style={[styles.fieldWrap, { paddingBottom: spacing[3] }]}>
              <YearPicker label={t('settings.basicInfo.anyFundacio')} value={anyFundacio} onChange={setAnyFundacio} />
            </View>
          </View>

          <LocationPickerModal
            visible={showLocationPicker}
            initialLat={latitud}
            initialLon={longitud}
            onClose={() => setShowLocationPicker(false)}
            onConfirm={(lat, lon, loc, com) => {
              setLatitud(lat); setLongitud(lon)
              if (loc) setLocalitat(loc)
              if (com) setComarca(com)
              setShowLocationPicker(false)
            }}
          />

          {/* Location picker */}
          <Text style={styles.sectionTitle}>{t('settings.section.location')}</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => setShowLocationPicker(true)}>
            <Text style={styles.locationBtnIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationBtnTitle}>
                {latitud && longitud ? t('settings.location.change') : t('settings.location.select')}
              </Text>
              {latitud && longitud
                ? <Text style={styles.locationBtnSub}>{latitud.toFixed(4)}, {longitud.toFixed(4)}</Text>
                : <Text style={styles.locationBtnSub}>{t('settings.location.notSet')}</Text>
              }
            </View>
            <Text style={styles.landingBtnChevron}>›</Text>
          </TouchableOpacity>

          {/* Landing editor */}
          <Text style={styles.sectionTitle}>{t('settings.section.publicPage')}</Text>
          <TouchableOpacity
            style={styles.landingBtn}
            onPress={() => router.push(`/colla/${collaId}/landing-editor` as any)}
          >
            <View style={styles.landingBtnLeft}>
              <Text style={styles.landingBtnIcon}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.landingBtnTitle}>{t('settings.landing.title')}</Text>
                <Text style={styles.landingBtnHint}>{t('settings.landing.hint')}</Text>
              </View>
            </View>
            <Text style={styles.landingBtnChevron}>›</Text>
          </TouchableOpacity>

          <Button label={t('settings.save')} size="lg" loading={saving} onPress={handleSaveGeneral} />
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* ── MEMBRES TAB ── */}
      {tab === 'membres' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Pending requests */}
          <Text style={styles.sectionTitle}>{t('settings.section.pending')}</Text>
          {pendents.length === 0 ? (
            <View style={styles.emptyPendents}>
              <Text style={styles.emptyPendentsIcon}>✅</Text>
              <Text style={styles.emptyPendentsText}>{t('settings.members.noPending')}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {pendents.map((p, idx) => {
                const nomP = p.profiles?.nom ?? 'Usuari'
                const dies = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
                return (
                  <View key={p.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.pendentRow}>
                      <Avatar name={nomP} uri={p.profiles?.avatar_url} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendentNom}>{nomP}</Text>
                        <Text style={styles.pendentDies}>
                          {dies === 0
                            ? t('settings.members.ago.less')
                            : dies === 1
                              ? t('settings.members.ago.day')
                              : t('settings.members.ago.days', { count: dies })}
                        </Text>
                      </View>
                      {actionLoading === p.id ? (
                        <ActivityIndicator size="small" color={colors.primary[600]} />
                      ) : (
                        <View style={styles.pendentActions}>
                          <TouchableOpacity style={styles.rebutjarBtn} onPress={() => handleRebutjar(p.id, nomP)}>
                            <Text style={styles.rebutjarText}>✕</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.aprovarBtn} onPress={() => handleAprovar(p.id)}>
                            <Text style={styles.aprovarText}>{t('settings.members.approve')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Invite shortcut */}
          <TouchableOpacity style={styles.inviteCard} onPress={() => router.push(`/colla/${collaId}/invitar` as any)}>
            <Text style={styles.inviteIcon}>👋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteTitle}>{t('settings.members.invite.title')}</Text>
              <Text style={styles.inviteHint}>{t('settings.members.invite.hint')}</Text>
            </View>
            <Text style={styles.inviteChevron}>›</Text>
          </TouchableOpacity>

          {/* Access & visibility */}
          <Text style={styles.sectionTitle}>{t('settings.section.access')}</Text>
          <View style={styles.card}>
            <View style={styles.toggle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('settings.access.manualApproval')}</Text>
                <Text style={styles.toggleHint}>{t('settings.access.manualApproval.hint')}</Text>
              </View>
              <Switch value={aprovacioManual} onValueChange={toggleAprovacio} trackColor={{ true: colors.primary[600] }} />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('settings.access.publicProfile')}</Text>
                <Text style={styles.toggleHint}>{t('settings.access.publicProfile.hint')}</Text>
              </View>
              <Switch value={perfilPublic} onValueChange={togglePerfilPublic} trackColor={{ true: colors.primary[600] }} />
            </View>
          </View>

          {/* Content permissions */}
          <Text style={styles.sectionTitle}>{t('settings.section.permissions')}</Text>
          <View style={styles.card}>
            <View style={styles.permRow}>
              <Text style={styles.permLabel}>{t('settings.permissions.createEvents')}</Text>
              <SegmentControl value={quiCreaEvents} field="events" />
            </View>
            <View style={styles.divider} />
            <View style={styles.permRow}>
              <Text style={styles.permLabel}>{t('settings.permissions.createVotes')}</Text>
              <SegmentControl value={quiCreaVotacions} field="votacions" />
            </View>
            <View style={styles.divider} />
            <View style={styles.permRow}>
              <Text style={styles.permLabel}>{t('settings.permissions.createThreads')}</Text>
              <SegmentControl value={quiCreaFils} field="fils" />
            </View>
          </View>

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* ── MÒDULS TAB ── */}
      {tab === 'moduls' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{t('settings.section.modules')}</Text>
          <Text style={styles.modulsHint}>{t('settings.modules.hint')}</Text>
          <View style={styles.card}>
            {ALL_MODULS.map((modul, idx) => {
              const actiu = modulsActius.includes(modul.key)
              const comissioOnly = modulsComissio.includes(modul.key)
              return (
                <View key={modul.key}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.toggle}>
                    <Text style={[styles.modulIcon, !actiu && styles.modulIconOff]}>{modul.icon}</Text>
                    <Text style={[styles.toggleLabel, { flex: 1 }, !actiu && styles.toggleLabelOff]}>{t(`modul.${modul.key}`)}</Text>
                    {actiu && (
                      <TouchableOpacity
                        style={[styles.visPill, comissioOnly && styles.visPillComissio]}
                        onPress={() => toggleModulVisibilitat(modul.key)}
                      >
                        <Text style={[styles.visPillText, comissioOnly && styles.visPillTextComissio]}>
                          {comissioOnly ? t('settings.modules.commission') : t('settings.modules.all')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Switch
                      value={actiu}
                      onValueChange={() => toggleModul(modul.key, actiu)}
                      trackColor={{ true: colors.primary[600] }}
                    />
                  </View>
                </View>
              )
            })}
          </View>
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.gray[50] },
  loaderWrap:       { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tab bar
  tabBar:           { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100], paddingHorizontal: spacing.screenH },
  tabBtn:           { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:     { borderBottomColor: colors.primary[600] },
  tabText:          { ...typography.bodySm, color: colors.gray[500], fontWeight: '600' },
  tabTextActive:    { color: colors.primary[600] },

  // Common
  content:      { padding: spacing.screenH, gap: spacing[3] },
  sectionTitle: { ...typography.label, color: colors.gray[500], marginTop: spacing[2] },
  card:         { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  divider:      { height: 1, backgroundColor: colors.gray[100] },

  // Images
  imageRow:           { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  portadaPreview:     { width: 72, height: 44, borderRadius: radius.sm, overflow: 'hidden' },
  portadaImg:         { width: '100%', height: '100%' },
  portadaPlaceholder: { backgroundColor: colors.primary[200] },
  avatarPreview:      { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarImg:          { width: '100%', height: '100%' },
  avatarPlaceholder:  { backgroundColor: colors.primary[200] },
  imageLabelText:     { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  imageHint:          { ...typography.caption, color: colors.gray[400], marginTop: 2 },
  editLink:           { ...typography.caption, color: colors.primary[600], fontWeight: '600' },

  // Fields
  fieldWrap:      { paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  fieldLabel:     { ...typography.label, color: colors.gray[500], marginBottom: spacing[1] },
  fieldReadOnly:  { ...typography.body, color: colors.gray[400], paddingBottom: spacing[2] },
  renameHint:     { ...typography.caption, color: colors.gray[400], marginTop: spacing[1], paddingBottom: spacing[2] },
  // Location
  locationBtn:     { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1.5, borderColor: colors.gray[200] },
  locationBtnIcon: { fontSize: 22 },
  locationBtnTitle:{ ...typography.body, color: colors.gray[800], fontWeight: '600' },
  locationBtnSub:  { ...typography.caption, color: colors.gray[400], marginTop: 2 },

  // Landing
  landingBtn:       { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.primary[200] },
  landingBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  landingBtnIcon:   { fontSize: 22 },
  landingBtnTitle:  { ...typography.body, color: colors.primary[800], fontWeight: '700' },
  landingBtnHint:   { ...typography.caption, color: colors.primary[500], marginTop: 2 },
  landingBtnChevron:{ fontSize: 22, color: colors.primary[400] },

  // Toggles
  toggle:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  toggleLabel:  { ...typography.body, color: colors.gray[700], fontWeight: '600' },
  toggleHint:   { ...typography.caption, color: colors.gray[400], marginTop: 2 },
  modulIcon:        { fontSize: 18, width: 24, textAlign: 'center' },
  modulIconOff:     { opacity: 0.35 },
  toggleLabelOff:   { color: colors.gray[400] },
  modulsHint:       { ...typography.bodySm, color: colors.gray[400], lineHeight: 20 },
  visPill:          { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 4, backgroundColor: colors.gray[100], marginRight: spacing[2] },
  visPillComissio:  { backgroundColor: colors.primary[50] },
  visPillText:      { fontSize: 11, fontWeight: '700', color: colors.gray[500] },
  visPillTextComissio: { color: colors.primary[600] },

  // Permissions
  permRow:      { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  permLabel:    { ...typography.body, color: colors.gray[700], fontWeight: '600' },
  segment:      { flexDirection: 'row', backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3, gap: 3 },
  segBtn:       { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.xs },
  segBtnActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  segText:      { fontSize: 13, color: colors.gray[500] },
  segTextActive:{ color: colors.gray[900], fontWeight: '700' },

  // Invite
  inviteCard:    { backgroundColor: colors.primary[50], borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1.5, borderColor: colors.primary[100] },
  inviteIcon:    { fontSize: 24 },
  inviteTitle:   { ...typography.body, color: colors.primary[800], fontWeight: '700' },
  inviteHint:    { ...typography.caption, color: colors.primary[600], marginTop: 2 },
  inviteChevron: { fontSize: 22, color: colors.primary[400], fontWeight: '300' },

  // Pending members
  emptyPendents:     { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, padding: spacing[5], alignItems: 'center', gap: spacing[2] },
  emptyPendentsIcon: { fontSize: 32 },
  emptyPendentsText: { ...typography.body, color: colors.gray[400] },
  pendentRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  pendentNom:        { ...typography.body, color: colors.gray[800], fontWeight: '600' },
  pendentDies:       { ...typography.caption, color: colors.gray[400], marginTop: 2 },
  pendentActions:    { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  rebutjarBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  rebutjarText:      { fontSize: 14, color: colors.gray[500], fontWeight: '700' },
  aprovarBtn:        { backgroundColor: colors.primary[600], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  aprovarText:       { ...typography.bodySm, color: colors.white, fontWeight: '700' },
})
