import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, FlatList, Dimensions,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { EmptyState } from '@/components/ui/EmptyState'

const { width } = Dimensions.get('window')
const ALBUM_COL_GAP = spacing[3]
const ALBUM_COLS = 2
const ALBUM_W = (width - spacing.screenH * 2 - ALBUM_COL_GAP) / ALBUM_COLS
const ALBUM_H = ALBUM_W * 0.85

const PHOTO_COLS = 3
const PHOTO_GAP = 2
const PHOTO_SIZE = (width - PHOTO_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS

const EMOJIS = ['📸', '🎉', '🏖️', '🎭', '🎶', '🍻', '⚽', '🏔️', '🎨', '❤️', '🏆', '🌸']

type Album = {
  id: string
  nom: string
  emoji: string | null
  created_at: string
  cover?: string | null
  foto_count?: number
}

type Foto = {
  id: string
  url: string
  storage_path: string | null
  uploaded_by: string | null
  created_at: string
}

export default function FotosScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const { isComissioActiva } = useCollaStore()

  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [showNewAlbum, setShowNewAlbum] = useState(false)
  const [newAlbumNom, setNewAlbumNom] = useState('')
  const [newAlbumEmoji, setNewAlbumEmoji] = useState('📸')
  const [savingAlbum, setSavingAlbum] = useState(false)

  const [viewingIndex, setViewingIndex] = useState<number | null>(null)

  useFocusEffect(useCallback(() => {
    if (selectedAlbum) {
      loadFotos(selectedAlbum.id)
    } else {
      loadAlbums()
    }
  }, [collaId, selectedAlbum?.id]))

  async function loadAlbums() {
    setLoading(true)
    const { data: albumsData } = await supabase
      .from('albums')
      .select('id, nom, emoji, created_at')
      .eq('colla_id', collaId)
      .order('created_at', { ascending: false })

    if (!albumsData) { setLoading(false); return }

    const enriched = await Promise.all(
      albumsData.map(async (a) => {
        const { data: coverData } = await supabase
          .from('fotos')
          .select('url')
          .eq('album_id', a.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const { count } = await supabase
          .from('fotos')
          .select('id', { count: 'exact', head: true })
          .eq('album_id', a.id)

        return { ...a, cover: coverData?.url ?? null, foto_count: count ?? 0 }
      })
    )
    setAlbums(enriched)
    setLoading(false)
  }

  async function loadFotos(albumId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('fotos')
      .select('id, url, storage_path, uploaded_by, created_at')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
    setFotos(data ?? [])
    setLoading(false)
  }

  async function handleCreateAlbum() {
    if (!newAlbumNom.trim()) return
    setSavingAlbum(true)
    const { data, error } = await supabase
      .from('albums')
      .insert({ colla_id: collaId, nom: newAlbumNom.trim(), emoji: newAlbumEmoji })
      .select()
      .single()
    setSavingAlbum(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowNewAlbum(false)
    setNewAlbumNom('')
    setNewAlbumEmoji('📸')
    setAlbums(prev => [{ ...data, cover: null, foto_count: 0 }, ...prev])
  }

  async function handleUpload() {
    if (!selectedAlbum) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.85,
    })
    if (result.canceled) return

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    for (const asset of result.assets) {
      const rawExt = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase()
      const ext = rawExt === 'jpg' ? 'jpeg' : rawExt
      const storagePath = `${collaId}/${selectedAlbum.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${rawExt}`
      const mimeType = `image/${ext}`

      const response = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('colla-fotos')
        .upload(storagePath, arrayBuffer, { contentType: mimeType })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('colla-fotos').getPublicUrl(storagePath)
        await supabase.from('fotos').insert({
          colla_id: collaId,
          album_id: selectedAlbum.id,
          uploaded_by: user.id,
          url: publicUrl,
          storage_path: storagePath,
        })
      }
    }

    setUploading(false)
    loadFotos(selectedAlbum.id)
  }

  async function handleDeleteFoto(foto: Foto) {
    Alert.alert('Eliminar foto', 'Estàs segur/a?', [
      { text: 'Cancel·lar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          if (foto.storage_path) {
            await supabase.storage.from('colla-fotos').remove([foto.storage_path])
          }
          await supabase.from('fotos').delete().eq('id', foto.id)
          setFotos(prev => prev.filter(f => f.id !== foto.id))
        },
      },
    ])
  }

  async function handleDeleteAlbum(album: Album) {
    Alert.alert(
      'Eliminar àlbum',
      `Eliminar "${album.nom}" i totes les seves fotos?`,
      [
        { text: 'Cancel·lar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            const { data: fotosAlbum } = await supabase
              .from('fotos').select('storage_path').eq('album_id', album.id)
            const paths = (fotosAlbum ?? []).map(f => f.storage_path).filter(Boolean)
            if (paths.length) await supabase.storage.from('colla-fotos').remove(paths)
            await supabase.from('albums').delete().eq('id', album.id)
            setAlbums(prev => prev.filter(a => a.id !== album.id))
          },
        },
      ]
    )
  }

  function openAlbum(album: Album) {
    setSelectedAlbum(album)
    loadFotos(album.id)
  }

  function closeAlbum() {
    setSelectedAlbum(null)
    loadAlbums()
  }

  // ── Album detail view ──────────────────────────────────────────────
  if (selectedAlbum) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title={`${selectedAlbum.emoji ?? '📸'} ${selectedAlbum.nom}`}
          onBack={closeAlbum}
          right={
            <TouchableOpacity onPress={handleUpload} disabled={uploading} style={styles.headerBtn}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.primary[600]} />
                : <Text style={styles.headerBtnText}>+ Afegir</Text>
              }
            </TouchableOpacity>
          }
        />

        {loading ? (
          <ActivityIndicator color={colors.primary[600]} style={styles.centered} />
        ) : fotos.length === 0 ? (
          <EmptyState icon="🖼️" title="Àlbum buit" subtitle="Puja les primeres fotos d'aquest àlbum" />
        ) : (
          <FlatList
            data={fotos}
            keyExtractor={item => item.id}
            numColumns={PHOTO_COLS}
            contentContainerStyle={styles.photoGrid}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => setViewingIndex(index)}
                onLongPress={() => handleDeleteFoto(item)}
                activeOpacity={0.85}
                style={styles.photoCell}
              >
                <Image source={{ uri: item.url }} style={styles.photoImg} />
              </TouchableOpacity>
            )}
          />
        )}

        {/* Fullscreen photo viewer */}
        <Modal
          visible={viewingIndex !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setViewingIndex(null)}
          statusBarTranslucent
        >
          <View style={styles.viewerBackdrop}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewingIndex(null)}>
              <Text style={styles.viewerCloseText}>✕</Text>
            </TouchableOpacity>
            {viewingIndex !== null && (
              <>
                <FlatList
                  data={fotos}
                  keyExtractor={item => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={viewingIndex}
                  getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                  onMomentumScrollEnd={e => {
                    const i = Math.round(e.nativeEvent.contentOffset.x / width)
                    setViewingIndex(i)
                  }}
                  renderItem={({ item }) => (
                    <View style={styles.viewerPage}>
                      <Image source={{ uri: item.url }} style={styles.viewerImage} resizeMode="contain" />
                    </View>
                  )}
                />
                <Text style={styles.viewerCounter}>
                  {viewingIndex + 1} / {fotos.length}
                </Text>
              </>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    )
  }

  // ── Albums grid view ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Fotos"
        right={
          isComissioActiva() ? (
            <TouchableOpacity onPress={() => setShowNewAlbum(true)} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>+ Àlbum</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={styles.centered} />
      ) : albums.length === 0 ? (
        <EmptyState icon="📸" title="Cap àlbum encara" subtitle={isComissioActiva() ? "Crea el primer àlbum de la colla" : "La comissió encara no ha creat cap àlbum"} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.albumsGrid}
          showsVerticalScrollIndicator={false}
        >
          {albums.map(album => (
            <TouchableOpacity
              key={album.id}
              style={styles.albumCard}
              onPress={() => openAlbum(album)}
              onLongPress={() => isComissioActiva() && handleDeleteAlbum(album)}
              activeOpacity={0.88}
            >
              {album.cover ? (
                <Image source={{ uri: album.cover }} style={styles.albumCover} />
              ) : (
                <View style={[styles.albumCover, { backgroundColor: gradientForAlbum(album.nom) }]} />
              )}
              <View style={styles.albumOverlay}>
                <Text style={styles.albumEmoji}>{album.emoji ?? '📸'}</Text>
                <View>
                  <Text style={styles.albumNom} numberOfLines={1}>{album.nom}</Text>
                  <Text style={styles.albumCount}>{album.foto_count} {album.foto_count === 1 ? 'foto' : 'fotos'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* New album modal */}
      <Modal visible={showNewAlbum} transparent animationType="slide" onRequestClose={() => setShowNewAlbum(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowNewAlbum(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nou àlbum</Text>

            <Text style={styles.modalLabel}>Nom</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Festa major 2026"
              placeholderTextColor={colors.gray[400]}
              value={newAlbumNom}
              onChangeText={setNewAlbumNom}
              autoFocus
              maxLength={60}
            />

            <Text style={styles.modalLabel}>Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, newAlbumEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setNewAlbumEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCreateBtn, (!newAlbumNom.trim() || savingAlbum) && styles.modalCreateBtnDisabled]}
              onPress={handleCreateAlbum}
              disabled={!newAlbumNom.trim() || savingAlbum}
            >
              {savingAlbum
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.modalCreateBtnText}>Crear àlbum</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function gradientForAlbum(nom: string): string {
  const palette = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#a18cd1', '#fcb69f', '#a1c4fd']
  return palette[nom.charCodeAt(0) % palette.length]
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.gray[50] },
  centered:    { flex: 1, marginTop: spacing[10] },
  headerBtn:   { paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  headerBtnText: { ...typography.bodySm, color: colors.primary[600], fontWeight: '700' },

  // Albums grid
  albumsGrid:  { padding: spacing.screenH, flexDirection: 'row', flexWrap: 'wrap', gap: ALBUM_COL_GAP },
  albumCard:   { width: ALBUM_W, height: ALBUM_H, borderRadius: radius.lg, overflow: 'hidden', ...shadows.md },
  albumCover:  { ...StyleSheet.absoluteFillObject },
  albumOverlay:{ ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: spacing[3], gap: spacing[1], backgroundColor: 'rgba(0,0,0,0.32)' },
  albumEmoji:  { fontSize: 22 },
  albumNom:    { color: colors.white, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  albumCount:  { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500' },

  // Photo grid
  photoGrid:   {},
  photoCell:   { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: PHOTO_GAP / 2 },
  photoImg:    { width: '100%', height: '100%', backgroundColor: colors.gray[100] },

  // New album modal
  modalBackdrop:   { flex: 1, justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], paddingBottom: spacing[10], ...shadows.lg },
  modalHandle:     { width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.gray[300], alignSelf: 'center', marginBottom: spacing[4] },
  modalTitle:      { ...typography.h2, color: colors.gray[900], marginBottom: spacing[4] },
  modalLabel:      { ...typography.label, color: colors.gray[600], marginBottom: spacing[2] },
  modalInput:      { borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900], marginBottom: spacing[4], backgroundColor: colors.gray[50] },
  emojiRow:        { marginBottom: spacing[5] },
  emojiBtn:        { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing[2], backgroundColor: colors.gray[100] },
  emojiBtnActive:  { backgroundColor: colors.primary[100], borderWidth: 2, borderColor: colors.primary[500] },
  emojiText:       { fontSize: 22 },
  modalCreateBtn:      { backgroundColor: colors.primary[600], borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[2] },
  modalCreateBtnDisabled: { opacity: 0.4 },
  modalCreateBtnText:  { ...typography.body, color: colors.white, fontWeight: '700' },

  // Fullscreen viewer
  viewerBackdrop:  { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerPage:      { width, flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerImage:     { width, height: '100%' },
  viewerClose:     { position: 'absolute', top: 52, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewerCloseText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  viewerCounter:   { position: 'absolute', bottom: 48, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
})
