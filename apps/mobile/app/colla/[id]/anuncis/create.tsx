import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Switch, Alert, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RichBodyEditor, RichBodyView, uploadBlocks, blocksFromSaved, makeTextBlock } from '@/components/ui/RichBody'
import type { RichBlock, SavedBlock } from '@/components/ui/RichBody'

export default function CreateAnunciScreen() {
  const { id: collaId, anunciId } = useLocalSearchParams<{ id: string; anunciId?: string }>()
  const router = useRouter()
  const isEdit = !!anunciId
  const [titol, setTitol] = useState('')
  const [blocks, setBlocks] = useState<RichBlock[]>([makeTextBlock()])
  const [fixat, setFixat] = useState(false)
  const [public_, setPublic] = useState(false)
  const [notificar, setNotificar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!anunciId) return
    supabase.from('anuncis').select('*').eq('id', anunciId).single().then(({ data }) => {
      if (!data) return
      setTitol(data.titol ?? '')
      setFixat(data.fixat)
      setPublic(data.public)
      if (data.cos_blocks) {
        setBlocks(blocksFromSaved(data.cos_blocks as SavedBlock[]))
      } else if (data.cos) {
        setBlocks([makeTextBlock(data.cos)])
      }
    })
  }, [anunciId])

  async function handlePublicar() {
    const hasContent = blocks.some(b =>
      (b.type === 'text' && b.content.trim()) || (b.type === 'image' && (b.uri || b.url))
    )
    if (!hasContent) { setError('El cos és obligatori'); return }
    setLoading(true)
    try {
      if (isEdit) {
        const { data: { user } } = await supabase.auth.getUser()
        const saved = await uploadBlocks(blocks, 'anunci', anunciId!)
        const { error: err } = await supabase.from('anuncis').update({
          titol: titol.trim() || null,
          cos: saved.filter(b => b.type === 'text').map(b => (b as any).content).join('\n\n') || null,
          cos_blocks: saved,
          fixat,
          public: public_,
        }).eq('id', anunciId!)
        if (err) throw err
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: anunci, error: err } = await supabase.from('anuncis').insert({
          colla_id: collaId,
          autor_id: user.id,
          titol: titol.trim() || null,
          cos: null,
          fixat,
          public: public_,
        }).select('id').single()
        if (err) throw err
        const saved = await uploadBlocks(blocks, 'anunci', anunci.id)
        await supabase.from('anuncis').update({
          cos: saved.filter(b => b.type === 'text').map(b => (b as any).content).join('\n\n') || null,
          cos_blocks: saved,
        }).eq('id', anunci.id)
      }
      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Button label="✕" variant="ghost" size="sm" onPress={() => router.back()} style={{ width: 44 }} />
        <Text style={styles.headerTitle}>{isEdit ? 'Editar anunci' : 'Nou anunci'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Input label="Títol (opcional)" value={titol} onChangeText={setTitol} placeholder="Títol de l'anunci..." />

        <View style={{ gap: spacing[1] }}>
          <Text style={{ ...typography.label, color: colors.gray[500] }}>Cos *</Text>
          <RichBodyEditor
            blocks={blocks}
            onChange={b => { setBlocks(b); setError('') }}
            placeholder="Escriu l'anunci aquí..."
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {[
          { label: 'Fixar anunci', value: fixat, onChange: setFixat },
          { label: 'Visible públicament', value: public_, onChange: setPublic },
          ...(!isEdit ? [{ label: 'Notificar als membres', value: notificar, onChange: setNotificar }] : []),
        ].map(({ label, value, onChange }) => (
          <View key={label} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary[600] }} />
          </View>
        ))}

        <Button
          label={isEdit ? 'Guardar canvis ✏️' : 'Publicar anunci 📢'}
          size="lg"
          loading={loading}
          onPress={handlePublicar}
          style={{ marginTop: spacing[4] }}
        />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.white },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  headerTitle: { ...typography.h3, color: colors.gray[900] },
  form:        { padding: spacing.screenH, gap: spacing[4] },
  toggle:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel: { ...typography.body, color: colors.gray[700], flex: 1 },
  errorText:   { ...typography.caption, color: colors.danger[500] },
})
