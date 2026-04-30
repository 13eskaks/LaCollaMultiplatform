import { useState, useEffect } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { colors, spacing, radius } from '@/theme'

export type EntityType = 'votacio' | 'anunci' | 'acta' | 'event'

type SavedImage = { id: string; url: string }

type Props = {
  entityType: EntityType
  entityId: string | null   // null = create mode, uses pendingUris
  canEdit?: boolean
  // create mode only
  pendingUris?: string[]
  onPendingChange?: (uris: string[]) => void
}

export async function saveImages(
  entityType: EntityType,
  entityId: string,
  uris: string[],
  uploaderId: string,
) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { console.error('[saveImages] no session'); return }

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]
    const rawExt = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg'
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    const path = `${entityType}/${entityId}/${Date.now()}_${i}.${ext}`

    try {
      const form = new FormData()
      form.append('file', { uri, type: mimeType, name: `upload.${ext}` } as any)
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/imatges/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
            'x-upsert': 'true',
          },
          body: form,
        },
      )
      if (!res.ok) { console.error('[saveImages] upload error:', res.status, await res.text()); continue }
      const publicUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/imatges/${path}`
      const { error: dbErr } = await supabase.from('imatges').insert({
        entity_type: entityType,
        entity_id: entityId,
        url: publicUrl,
        ordre: i,
        uploader_id: uploaderId,
      })
      if (dbErr) console.error('[saveImages] db insert error:', dbErr.message)
    } catch (e: any) {
      console.error('[saveImages] exception:', e?.message ?? e)
    }
  }
}

export function ImagesSection({ entityType, entityId, canEdit, pendingUris = [], onPendingChange }: Props) {
  const [saved, setSaved] = useState<SavedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [fullscreen, setFullscreen] = useState<string | null>(null)
  const isPending = entityId === null

  useEffect(() => {
    if (!isPending && entityId) load()
  }, [entityId])

  async function load() {
    if (!entityId) return
    const { data } = await supabase
      .from('imatges')
      .select('id, url')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('ordre', { ascending: true })
    setSaved(data ?? [])
  }

  async function pickAndAdd() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (res.canceled) return
    const uris = res.assets.map(a => a.uri)

    if (isPending) {
      onPendingChange?.([...pendingUris, ...uris])
    } else {
      setUploading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setUploading(false); return }
      await saveImages(entityType, entityId!, uris, user.id)
      await load()
      setUploading(false)
    }
  }

  async function deleteImage(img: SavedImage) {
    Alert.alert('Eliminar imatge', '¿Vols eliminar aquesta imatge?', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('imatges').delete().eq('id', img.id)
        setSaved(prev => prev.filter(i => i.id !== img.id))
      }},
    ])
  }

  function removePending(uri: string) {
    onPendingChange?.(pendingUris.filter(u => u !== uri))
  }

  const allImages: { key: string; uri: string; saved?: SavedImage }[] = [
    ...saved.map(s => ({ key: s.id, uri: s.url, saved: s })),
    ...pendingUris.map(u => ({ key: u, uri: u })),
  ]

  if (!canEdit && allImages.length === 0) return null

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {allImages.map(img => (
          <TouchableOpacity key={img.key} style={styles.thumb} onPress={() => setFullscreen(img.uri)} activeOpacity={0.85}>
            <Image source={{ uri: img.uri }} style={styles.thumbImg} />
            {canEdit && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => img.saved ? deleteImage(img.saved!) : removePending(img.uri)}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        {canEdit && (
          <TouchableOpacity style={styles.addBtn} onPress={pickAndAdd} disabled={uploading}>
            {uploading
              ? <ActivityIndicator color={colors.primary[600]} />
              : <Text style={styles.addBtnIcon}>+</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={!!fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(null)}>
        <TouchableOpacity style={styles.fsOverlay} onPress={() => setFullscreen(null)} activeOpacity={1}>
          {fullscreen && <Image source={{ uri: fullscreen }} style={styles.fsImg} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const THUMB = 100

const styles = StyleSheet.create({
  wrap:         { marginVertical: spacing[1] },
  scroll:       { gap: spacing[2], paddingVertical: spacing[1] },
  thumb:        { position: 'relative' },
  thumbImg:     { width: THUMB, height: THUMB, borderRadius: radius.sm },
  deleteBtn:    { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  deleteBtnText:{ color: colors.white, fontSize: 11, fontWeight: '700' },
  addBtn:       { width: THUMB, height: THUMB, borderRadius: radius.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gray[300], justifyContent: 'center', alignItems: 'center', backgroundColor: colors.gray[50] },
  addBtnIcon:   { fontSize: 28, color: colors.gray[400], lineHeight: 32 },
  fsOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fsImg:        { width: '100%', height: '80%' },
})
