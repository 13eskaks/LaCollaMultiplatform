import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { Ionicons } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'

function tempsRelatiu(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `fa ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `fa ${h}h`
  return `fa ${Math.floor(h / 24)} dies`
}

export default function ForumFilScreen() {
  const { id: filId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isComissioActiva } = useCollaStore()
  const [fil, setFil] = useState<any>(null)
  const [missatges, setMissatges] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [filId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const [filRes, missatgesRes, profileRes] = await Promise.all([
      supabase.from('forum_fils').select('*, profiles(nom, avatar_url)').eq('id', filId).single(),
      supabase.from('forum_missatges').select('*, profiles(nom, avatar_url)').eq('fil_id', filId).order('created_at', { ascending: true }),
      user ? supabase.from('profiles').select('nom, avatar_url').eq('id', user.id).single() : null,
    ])

    setFil(filRes.data)
    setDraftTitle(filRes.data?.titol ?? '')
    setMissatges(missatgesRes.data ?? [])
    if (profileRes?.data) setUserProfile(profileRes.data)
    setLoading(false)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`fil-${filId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_missatges', filter: `fil_id=eq.${filId}` },
        async (payload) => {
          const { data } = await supabase.from('forum_missatges').select('*, profiles(nom, avatar_url)').eq('id', payload.new.id).single()
          if (data) {
            setMissatges(prev => {
              if (prev.some(m => m.id === data.id)) return prev
              return [...prev, data]
            })
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
          }
        })
      .subscribe()
  }

  function canEditTitle() {
    return isComissioActiva() || fil?.creador_id === userId
  }

  async function handleSaveTitle() {
    if (!draftTitle.trim()) return
    const { error } = await supabase.from('forum_fils').update({ titol: draftTitle.trim() }).eq('id', filId)
    if (error) { Alert.alert('Error', error.message); return }
    setFil((prev: any) => ({ ...prev, titol: draftTitle.trim() }))
    setEditingTitle(false)
  }

  function canDeleteMsg(m: any) {
    return isComissioActiva() || m.user_id === userId
  }

  function handleLongPress(m: any) {
    if (!canDeleteMsg(m)) return
    Alert.alert('Eliminar missatge', 'Vols eliminar aquest missatge?', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('forum_missatges').delete().eq('id', m.id)
        setMissatges(prev => prev.filter(x => x.id !== m.id))
      }},
    ])
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permís necessari', 'Cal accés a la galeria per afegir fotos')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets[0]) return

    setUploadingImage(true)
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const filename = `${filId}/${Date.now()}.${ext}`
      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('forum-imatges')
        .upload(filename, blob, { contentType: `image/${ext}` })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('forum-imatges').getPublicUrl(filename)
      await handleEnviar(urlData.publicUrl)
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No s\'ha pogut pujar la imatge')
    }
    setUploadingImage(false)
  }

  async function handleEnviar(imageUrl?: string) {
    const textToSend = text.trim()
    if ((!textToSend && !imageUrl) || !userId || sending) return
    setText('')
    setSending(true)

    const tempId = `temp-${Date.now()}`
    const tempMsg = {
      id: tempId,
      fil_id: filId,
      user_id: userId,
      text: textToSend,
      image_url: imageUrl ?? null,
      created_at: new Date().toISOString(),
      profiles: userProfile,
    }
    setMissatges(prev => [...prev, tempMsg])
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)

    const { data, error } = await supabase.from('forum_missatges').insert({
      fil_id: filId,
      user_id: userId,
      text: textToSend || ' ',
      image_url: imageUrl ?? null,
    }).select('*, profiles(nom, avatar_url)').single()

    if (!error && data) {
      setMissatges(prev => prev.map(m => m.id === tempId ? data : m))
      supabase.from('forum_fils').update({ updated_at: new Date().toISOString() }).eq('id', filId)
    } else {
      setMissatges(prev => prev.filter(m => m.id !== tempId))
      if (textToSend) setText(textToSend)
    }
    setSending(false)
  }

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[600]} /></View>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          {editingTitle ? (
            <TextInput
              style={styles.titleInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              autoFocus
              onSubmitEditing={handleSaveTitle}
              returnKeyType="done"
            />
          ) : (
            <Text style={styles.title} numberOfLines={1}>{fil?.titol ?? 'Fil'}</Text>
          )}

          {canEditTitle() ? (
            editingTitle ? (
              <TouchableOpacity onPress={handleSaveTitle}>
                <Text style={styles.editAction}>Desa</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditingTitle(true)}>
                <Text style={styles.editAction}>✎</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Missatges */}
        <FlatList
          ref={flatListRef}
          data={missatges}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m, index }) => {
            const isFirst = index === 0
            const isMe = m.user_id === userId
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onLongPress={() => handleLongPress(m)}
                style={[styles.msgRow, isMe && styles.msgRowMe]}
              >
                {!isMe && (
                  <Avatar name={m.profiles?.nom ?? ''} uri={m.profiles?.avatar_url} size="sm" style={{ marginTop: 4 }} />
                )}
                <View style={[styles.bubble, isMe && styles.bubbleMe, isFirst && !isMe && styles.bubbleFirst]}>
                  {!isMe && (
                    <Text style={styles.bubbleAutor}>{m.profiles?.nom}</Text>
                  )}
                  {m.image_url ? (
                    <Image source={{ uri: m.image_url }} style={styles.msgImage} resizeMode="cover" />
                  ) : null}
                  {m.text && m.text.trim() && m.text !== ' ' ? (
                    <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{m.text}</Text>
                  ) : null}
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{tempsRelatiu(m.created_at)}</Text>
                </View>
                {isMe && (
                  <Avatar name={userProfile?.nom ?? ''} uri={userProfile?.avatar_url} size="sm" style={{ marginTop: 4 }} />
                )}
              </TouchableOpacity>
            )
          }}
        />

        {/* Input */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={[styles.imageBtn, uploadingImage && { opacity: 0.5 }]}
            onPress={handlePickImage}
            disabled={uploadingImage || sending}
          >
            {uploadingImage
              ? <ActivityIndicator size="small" color={colors.primary[600]} />
              : <Text style={{ fontSize: 20 }}>📷</Text>
            }
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Escriu un missatge..."
            placeholderTextColor={colors.gray[400]}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => handleEnviar()}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Ionicons name="send" size={18} color={colors.white} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.gray[50] },
  loader:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:      { fontSize: 22, color: colors.primary[600], width: 36 },
  title:         { ...typography.h3, color: colors.gray[900], flex: 1, textAlign: 'center', marginHorizontal: spacing[2] },
  titleInput:    { flex: 1, ...typography.h3, color: colors.gray[900], textAlign: 'center', marginHorizontal: spacing[2], borderBottomWidth: 1.5, borderBottomColor: colors.primary[600], paddingBottom: 2 },
  editAction:    { ...typography.body, color: colors.primary[600], fontWeight: '600', width: 36, textAlign: 'right' },
  list:          { padding: spacing.screenH, gap: spacing[3] },
  msgRow:        { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  msgRowMe:      { flexDirection: 'row-reverse' },
  bubble:        { maxWidth: '75%', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], gap: spacing[1], ...shadows.sm },
  bubbleMe:      { backgroundColor: colors.primary[600] },
  bubbleFirst:   { backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[100] },
  bubbleAutor:   { ...typography.label, color: colors.primary[600] },
  bubbleText:    { ...typography.body, color: colors.gray[800], lineHeight: 20 },
  bubbleTextMe:  { color: colors.white },
  bubbleTime:    { ...typography.caption, color: colors.gray[400], alignSelf: 'flex-end' },
  bubbleTimeMe:  { color: 'rgba(255,255,255,0.7)' },
  msgImage:      { width: 200, height: 160, borderRadius: radius.sm },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  imageBtn:      { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  input:         { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.gray[100], borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], ...typography.body, color: colors.gray[900] },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:{ backgroundColor: colors.gray[300] },
})
