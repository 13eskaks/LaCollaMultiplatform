import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, FlatList, Dimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { EmptyState } from '@/components/ui/EmptyState'

const { width } = Dimensions.get('window')
const COLS = 3
const IMG_SIZE = (width - spacing.screenH * 2 - spacing[1] * (COLS - 1)) / COLS

export default function FotosScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [fotos, setFotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadFotos() }, [collaId])

  async function loadFotos() {
    setLoading(true)
    const { data } = await supabase
      .from('colla_fotos')
      .select('*, profiles(nom)')
      .eq('colla_id', collaId)
      .order('created_at', { ascending: false })
    setFotos(data ?? [])
    setLoading(false)
  }

  async function handleUpload() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled) return

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const asset of result.assets) {
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const path = `${collaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('colla-fotos')
        .upload(path, arrayBuffer, { contentType: `image/${ext}` })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('colla-fotos').getPublicUrl(path)
        await supabase.from('colla_fotos').insert({
          colla_id: collaId,
          autor_id: user.id,
          url: publicUrl,
          storage_path: path,
        })
      }
    }

    setUploading(false)
    loadFotos()
  }

  async function handleDelete(foto: any) {
    Alert.alert('Eliminar foto', 'Estàs segur/a?', [
      { text: 'Cancel·lar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.storage.from('colla-fotos').remove([foto.storage_path])
          await supabase.from('colla_fotos').delete().eq('id', foto.id)
          setFotos(prev => prev.filter(f => f.id !== foto.id))
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Fotos"
        right={
          <TouchableOpacity onPress={handleUpload} disabled={uploading} style={styles.uploadBtn}>
            {uploading
              ? <ActivityIndicator size="small" color={colors.primary[600]} />
              : <Text style={styles.uploadText}>+ Afegir</Text>
            }
          </TouchableOpacity>
        }
      />

      {loading ? (
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      ) : fotos.length === 0 ? (
        <EmptyState icon="📸" title="Cap foto encara" subtitle="Afegeix les primeres fotos de la colla" />
      ) : (
        <FlatList
          data={fotos}
          keyExtractor={item => item.id}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: spacing[1] }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => handleDelete(item)}
              style={styles.imgWrapper}
            >
              <Image source={{ uri: item.url }} style={styles.img} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.white },
  uploadBtn:  { paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  uploadText: { ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },
  grid:       { padding: spacing.screenH, gap: spacing[1] },
  imgWrapper: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.gray[100] },
  img:        { width: '100%', height: '100%' },
})
