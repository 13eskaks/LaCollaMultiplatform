import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
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
  const [fil, setFil] = useState<any>(null)
  const [missatges, setMissatges] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
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
    setMissatges(missatgesRes.data ?? [])
    if (profileRes?.data) setUserProfile(profileRes.data)
    setLoading(false)

    // Realtime per als nous missatges
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`fil-${filId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_missatges', filter: `fil_id=eq.${filId}` },
        async (payload) => {
          // Fetch the new message with profile
          const { data } = await supabase.from('forum_missatges').select('*, profiles(nom, avatar_url)').eq('id', payload.new.id).single()
          if (data) {
            setMissatges(prev => {
              // Avoid duplicates (optimistic update already added it)
              if (prev.some(m => m.id === data.id)) return prev
              return [...prev, data]
            })
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
          }
        })
      .subscribe()
  }

  async function handleEnviar() {
    if (!text.trim() || !userId || sending) return
    const textToSend = text.trim()
    setText('')
    setSending(true)

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const tempMsg = {
      id: tempId,
      fil_id: filId,
      user_id: userId,
      text: textToSend,
      created_at: new Date().toISOString(),
      profiles: userProfile,
    }
    setMissatges(prev => [...prev, tempMsg])
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)

    const { data, error } = await supabase.from('forum_missatges').insert({
      fil_id: filId,
      user_id: userId,
      text: textToSend,
    }).select('*, profiles(nom, avatar_url)').single()

    if (!error && data) {
      setMissatges(prev => prev.map(m => m.id === tempId ? data : m))
      // Update fil updated_at
      supabase.from('forum_fils').update({ updated_at: new Date().toISOString() }).eq('id', filId)
    } else {
      // Revert on error
      setMissatges(prev => prev.filter(m => m.id !== tempId))
      setText(textToSend)
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
          <Text style={styles.title} numberOfLines={1}>{fil?.titol ?? 'Fil'}</Text>
          <View style={{ width: 36 }} />
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
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                  <Avatar name={m.profiles?.nom ?? ''} uri={m.profiles?.avatar_url} size="sm" style={{ marginTop: 4 }} />
                )}
                <View style={[styles.bubble, isMe && styles.bubbleMe, isFirst && styles.bubbleFirst]}>
                  {!isMe && (
                    <Text style={styles.bubbleAutor}>{m.profiles?.nom}</Text>
                  )}
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{m.text}</Text>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{tempsRelatiu(m.created_at)}</Text>
                </View>
                {isMe && (
                  <Avatar name={userProfile?.nom ?? ''} uri={userProfile?.avatar_url} size="sm" style={{ marginTop: 4 }} />
                )}
              </View>
            )
          }}
        />

        {/* Input */}
        <View style={styles.inputBar}>
          <Avatar name={userProfile?.nom ?? ''} uri={userProfile?.avatar_url} size="sm" />
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
            onPress={handleEnviar}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.sendBtnText}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.gray[50] },
  loader:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  backText:     { fontSize: 22, color: colors.primary[600], width: 36 },
  title:        { ...typography.h3, color: colors.gray[900], flex: 1, textAlign: 'center', marginHorizontal: spacing[2] },
  list:         { padding: spacing.screenH, gap: spacing[3] },
  msgRow:       { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  msgRowMe:     { flexDirection: 'row-reverse' },
  bubble:       { maxWidth: '75%', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[3], gap: spacing[1], ...shadows.sm },
  bubbleMe:     { backgroundColor: colors.primary[600] },
  bubbleFirst:  { backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[100] },
  bubbleAutor:  { ...typography.label, color: colors.primary[600] },
  bubbleText:   { ...typography.body, color: colors.gray[800], lineHeight: 20 },
  bubbleTextMe: { color: colors.white },
  bubbleTime:   { ...typography.caption, color: colors.gray[400], alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  input:        { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.gray[100], borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], ...typography.body, color: colors.gray[900] },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:{ backgroundColor: colors.gray[300] },
  sendBtnText:  { color: colors.white, fontSize: 18, fontWeight: '700' },
})
