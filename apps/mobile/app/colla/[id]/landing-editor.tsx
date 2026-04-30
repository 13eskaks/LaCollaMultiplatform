import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { uploadBlocks, blocksFromSaved, RichBodyView } from '@/components/ui/RichBody'
import type { RichBlock, SavedBlock, CollaData } from '@/components/ui/RichBody'

let _seq = Date.now()
function uid() { return String(_seq++) }

function makeBlock(type: RichBlock['type']): RichBlock {
  if (type === 'text')      return { type: 'text',      id: uid(), content: '' }
  if (type === 'heading')   return { type: 'heading',   id: uid(), content: '' }
  if (type === 'divider')   return { type: 'divider',   id: uid() }
  if (type === 'stats')     return { type: 'stats',     id: uid() }
  if (type === 'stat_item') return { type: 'stat_item', id: uid(), num: '', label: '', icon: '' }
  if (type === 'callout')   return { type: 'callout',   id: uid(), content: '', icon: '💡', color: '#f59e0b' }
  return { type: 'image', id: uid() }
}

function blocksToSaved(blocks: RichBlock[]): SavedBlock[] {
  return blocks.flatMap(b => {
    if (b.type === 'text' && b.content.trim())    return [{ type: 'text', content: b.content.trim() } as SavedBlock]
    if (b.type === 'heading' && b.content.trim()) return [{ type: 'heading', content: b.content.trim() } as SavedBlock]
    if (b.type === 'divider')                     return [{ type: 'divider' } as SavedBlock]
    if (b.type === 'stats')                       return [{ type: 'stats' } as SavedBlock]
    if (b.type === 'image') {
      const url = b.url ?? b.uri
      return url ? [{ type: 'image', url } as SavedBlock] : []
    }
    if (b.type === 'stat_item') return [{ type: 'stat_item', num: b.num, label: b.label, icon: b.icon } as SavedBlock]
    if (b.type === 'callout' && b.content.trim()) return [{ type: 'callout', content: b.content.trim(), icon: b.icon, color: b.color } as SavedBlock]
    return []
  })
}

const TOOLBAR_ITEMS: { type: RichBlock['type']; icon: string; label: string }[] = [
  { type: 'text',      icon: 'Aa', label: 'Text'    },
  { type: 'heading',   icon: 'H1', label: 'Títol'   },
  { type: 'image',     icon: '📷',  label: 'Foto'    },
  { type: 'divider',   icon: '—',   label: 'Línia'   },
  { type: 'stats',     icon: '📊',  label: 'Stats'   },
  { type: 'stat_item', icon: '🔢',  label: 'Stat'    },
  { type: 'callout',   icon: '💬',  label: 'Callout' },
]

const CALLOUT_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']

export default function LandingEditorScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [blocks, setBlocks] = useState<RichBlock[]>([{ type: 'text', id: uid(), content: '' }])
  const [collaData, setCollaData] = useState<CollaData | null>(null)
  const [portadaUrl, setPortadaUrl] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadBlocks() }, [collaId])

  async function loadBlocks() {
    const [collaRes, countRes] = await Promise.all([
      supabase.from('colles')
        .select('landing_blocks, nom, localitat, any_fundacio, portada_url, avatar_url')
        .eq('id', collaId).single(),
      supabase.rpc('get_colla_membres_count', { p_colla_id: collaId }),
    ])

    if (collaRes.data?.landing_blocks && Array.isArray(collaRes.data.landing_blocks) && collaRes.data.landing_blocks.length > 0) {
      setBlocks(blocksFromSaved(collaRes.data.landing_blocks as SavedBlock[]))
    }

    if (collaRes.data) {
      setCollaData({
        nom: collaRes.data.nom,
        localitat: collaRes.data.localitat,
        any_fundacio: collaRes.data.any_fundacio,
        membresCount: countRes.data ?? 0,
      })
      setPortadaUrl(collaRes.data.portada_url ?? null)
      setAvatarUrl(collaRes.data.avatar_url ?? null)
    }

    setLoading(false)
  }

  // ── Block operations ──────────────────────────────────────────────────────

  function updateBlock(id: string, patch: Partial<RichBlock>) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } as RichBlock : b))
  }

  function removeBlock(id: string) {
    setBlocks(prev => {
      const next = prev.filter(b => b.id !== id)
      return next.length === 0 ? [makeBlock('text')] : next
    })
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function addBlock(type: RichBlock['type']) {
    if (type === 'image') {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 })
      if (res.canceled) return
      setBlocks(prev => [...prev, { type: 'image', id: uid(), uri: res.assets[0].uri }])
    } else {
      setBlocks(prev => [...prev, makeBlock(type)])
    }
  }

  async function changeImage(id: string) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 })
    if (res.canceled) return
    updateBlock(id, { uri: res.assets[0].uri, url: undefined } as any)
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await uploadBlocks(blocks, 'colla-landing', collaId)
      const { error } = await supabase.from('colles').update({ landing_blocks: saved }).eq('id', collaId)
      if (error) throw error
      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing[8] }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={s.headerBack}>←</Text>
          </TouchableOpacity>
          <View style={s.headerTabs}>
            <TouchableOpacity
              style={[s.headerTab, mode === 'edit' && s.headerTabActive]}
              onPress={() => setMode('edit')}
            >
              <Text style={[s.headerTabText, mode === 'edit' && s.headerTabTextActive]}>Editor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.headerTab, mode === 'preview' && s.headerTabActive]}
              onPress={() => setMode('preview')}
            >
              <Text style={[s.headerTabText, mode === 'preview' && s.headerTabTextActive]}>Vista prèvia</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={s.saveBtnText}>Guardar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Preview mode — faithful replica of landing.tsx */}
        {mode === 'preview' && (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Hero portada */}
            <View style={s.pvHero}>
              {portadaUrl
                ? <Image source={{ uri: portadaUrl }} style={s.pvPortada} resizeMode="cover" />
                : <View style={[s.pvPortada, { backgroundColor: colors.primary[600] }]} />
              }
              <View style={s.pvHeroOverlay} />
            </View>

            {/* Capçalera — idèntica a landing.tsx */}
            <View style={s.pvContent}>
              <Avatar
                name={collaData?.nom ?? ''}
                uri={avatarUrl}
                size="2xl"
                border
                style={s.pvAvatar}
              />
              <Text style={s.pvNom}>{collaData?.nom ?? ''}</Text>
              {collaData?.localitat && (
                <Text style={s.pvLocalitat}>📍 {collaData.localitat}</Text>
              )}
              {collaData?.any_fundacio && (
                <Text style={s.pvMeta}>
                  Fundada el {collaData.any_fundacio} · {new Date().getFullYear() - collaData.any_fundacio} anys
                </Text>
              )}

              {/* Rich body */}
              <View style={s.pvBody}>
                <RichBodyView blocks={blocksToSaved(blocks)} colla={collaData ?? undefined} />
              </View>

              <View style={{ height: 100 }} />
            </View>
          </ScrollView>
        )}

        {/* Edit mode */}
        {mode === 'edit' && (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {blocks.map((block, i) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  isFirst={i === 0}
                  isLast={i === blocks.length - 1}
                  onUpdate={patch => updateBlock(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, -1)}
                  onMoveDown={() => moveBlock(block.id, 1)}
                  onChangeImage={() => changeImage(block.id)}
                />
              ))}
              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Toolbar */}
            <View style={s.toolbar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbarInner}>
                {TOOLBAR_ITEMS.map(item => (
                  <TouchableOpacity key={item.type} style={s.toolItem} onPress={() => addBlock(item.type)}>
                    <Text style={s.toolIcon}>{item.icon}</Text>
                    <Text style={s.toolLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Block row component ────────────────────────────────────────────────────

function BlockRow({
  block, isFirst, isLast,
  onUpdate, onRemove, onMoveUp, onMoveDown, onChangeImage,
}: {
  block: RichBlock
  isFirst: boolean; isLast: boolean
  onUpdate: (patch: Partial<RichBlock>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onChangeImage: () => void
}) {
  return (
    <View style={s.blockRow}>
      {/* Controls */}
      <View style={s.blockControls}>
        <TouchableOpacity style={[s.ctrlBtn, isFirst && s.ctrlBtnDisabled]} onPress={onMoveUp} disabled={isFirst}>
          <Text style={s.ctrlText}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ctrlBtn, isLast && s.ctrlBtnDisabled]} onPress={onMoveDown} disabled={isLast}>
          <Text style={s.ctrlText}>↓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ctrlBtn, s.ctrlBtnDelete]} onPress={onRemove}>
          <Text style={s.ctrlTextDelete}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={s.blockContent}>
        {block.type === 'text' && (
          <TextInput
            style={s.textInput}
            value={block.content}
            onChangeText={content => onUpdate({ content } as any)}
            multiline
            placeholder="Escriu text..."
            placeholderTextColor={colors.gray[400]}
            textAlignVertical="top"
          />
        )}

        {block.type === 'heading' && (
          <TextInput
            style={s.headingInput}
            value={block.content}
            onChangeText={content => onUpdate({ content } as any)}
            placeholder="Títol de secció..."
            placeholderTextColor={colors.gray[300]}
          />
        )}

        {block.type === 'image' && (
          <TouchableOpacity style={s.imgBlock} onPress={onChangeImage} activeOpacity={0.8}>
            {(block.uri || block.url) ? (
              <>
                <Image source={{ uri: block.uri ?? block.url }} style={s.imgPreview} resizeMode="cover" />
                <View style={s.imgOverlay}>
                  <Text style={s.imgOverlayText}>📷 Canviar foto</Text>
                </View>
              </>
            ) : (
              <View style={s.imgPlaceholder}>
                <Text style={s.imgPlaceholderIcon}>📷</Text>
                <Text style={s.imgPlaceholderText}>Toca per afegir foto</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {block.type === 'divider' && (
          <View style={s.dividerBlock}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>separador</Text>
            <View style={s.dividerLine} />
          </View>
        )}

        {block.type === 'stats' && (
          <View style={s.statsBlock}>
            <Text style={s.statsIcon}>📊</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.statsTitle}>Estadístiques de la colla</Text>
              <Text style={s.statsSub}>Membres, anys i localitat · es mostren en temps real</Text>
            </View>
          </View>
        )}

        {block.type === 'stat_item' && (
          <View style={s.statItemBlock}>
            <TextInput
              style={s.statItemIconInput}
              value={block.icon ?? ''}
              onChangeText={icon => onUpdate({ icon } as any)}
              placeholder="🏆"
              maxLength={2}
            />
            <View style={{ flex: 1, gap: spacing[1] }}>
              <TextInput
                style={s.statItemNumInput}
                value={block.num}
                onChangeText={num => onUpdate({ num } as any)}
                placeholder="42"
                placeholderTextColor={colors.gray[300]}
              />
              <TextInput
                style={s.statItemLabelInput}
                value={block.label}
                onChangeText={label => onUpdate({ label } as any)}
                placeholder="Membres actius"
                placeholderTextColor={colors.gray[400]}
              />
            </View>
          </View>
        )}

        {block.type === 'callout' && (
          <View style={[s.calloutBlock, { borderColor: (block.color ?? '#f59e0b') + '88', backgroundColor: (block.color ?? '#f59e0b') + '12' }]}>
            <View style={s.calloutTop}>
              <TextInput
                style={s.calloutIconInput}
                value={block.icon ?? ''}
                onChangeText={icon => onUpdate({ icon } as any)}
                placeholder="💡"
                maxLength={2}
              />
              <View style={s.calloutColors}>
                {CALLOUT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.colorDot, { backgroundColor: c }, block.color === c && s.colorDotActive]}
                    onPress={() => onUpdate({ color: c } as any)}
                  />
                ))}
              </View>
            </View>
            <TextInput
              style={s.calloutInput}
              value={block.content}
              onChangeText={content => onUpdate({ content } as any)}
              multiline
              placeholder="Text destacat..."
              placeholderTextColor={colors.gray[400]}
              textAlignVertical="top"
            />
          </View>
        )}
      </View>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.gray[50] },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  headerBack:         { fontSize: 22, color: colors.primary[600], width: 32 },
  headerTabs:         { flex: 1, flexDirection: 'row', gap: 4, backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3 },
  headerTab:          { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: radius.sm - 1 },
  headerTabActive:    { backgroundColor: colors.white, ...shadows.sm },
  headerTabText:      { fontSize: 12, color: colors.gray[500], fontWeight: '600' },
  headerTabTextActive:{ color: colors.gray[900] },
  saveBtn:            { backgroundColor: colors.primary[600], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, minWidth: 72, alignItems: 'center' },
  saveBtnText:        { color: colors.white, fontWeight: '700', fontSize: 13 },

  // Preview — mirrors landing.tsx exactly
  pvHero:        { height: 200, position: 'relative' },
  pvPortada:     { width: '100%', height: '100%' },
  pvHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  pvContent:     { backgroundColor: colors.white, paddingHorizontal: spacing.screenH, alignItems: 'center', gap: spacing[3] },
  pvAvatar:      { marginTop: -40 },
  pvNom:         { ...typography.h1, color: colors.gray[900], textAlign: 'center' },
  pvLocalitat:   { ...typography.body, color: colors.gray[500] },
  pvMeta:        { ...typography.caption, color: colors.gray[400] },
  pvBody:        { alignSelf: 'stretch' },

  // Editor list
  list:    { padding: spacing.screenH, gap: spacing[2] },

  // Block row
  blockRow:      { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  blockControls: { gap: spacing[1], paddingTop: spacing[1] },
  ctrlBtn:       { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  ctrlBtnDisabled:{ opacity: 0.3 },
  ctrlBtnDelete: { backgroundColor: 'rgba(220,38,38,0.08)' },
  ctrlText:      { fontSize: 12, color: colors.gray[500], fontWeight: '700' },
  ctrlTextDelete:{ fontSize: 12, color: '#dc2626', fontWeight: '700' },
  blockContent:  { flex: 1 },

  // Text / Heading
  textInput:    { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900], backgroundColor: colors.white, minHeight: 80, textAlignVertical: 'top' },
  headingInput: { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], fontSize: 22, fontWeight: '700', color: colors.gray[900], backgroundColor: colors.white },

  // Image
  imgBlock:          { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.gray[100], minHeight: 160 },
  imgPreview:        { width: '100%', height: 180 },
  imgOverlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  imgOverlayText:    { color: colors.white, fontWeight: '600', fontSize: 14 },
  imgPlaceholder:    { height: 160, justifyContent: 'center', alignItems: 'center', gap: spacing[2] },
  imgPlaceholderIcon:{ fontSize: 32 },
  imgPlaceholderText:{ ...typography.body, color: colors.gray[400] },

  // Divider
  dividerBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
  dividerLine:  { flex: 1, height: 1, backgroundColor: colors.gray[200] },
  dividerLabel: { ...typography.caption, color: colors.gray[400], textTransform: 'uppercase', letterSpacing: 1 },

  // Stats (auto block)
  statsBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.primary[50], borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.primary[100] },
  statsIcon:  { fontSize: 24 },
  statsTitle: { ...typography.body, color: colors.primary[800], fontWeight: '700' },
  statsSub:   { ...typography.caption, color: colors.primary[500], marginTop: 2 },

  // Stat item (custom KPI)
  statItemBlock:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.gray[200] },
  statItemIconInput: { fontSize: 28, width: 44, height: 44, textAlign: 'center', borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, backgroundColor: colors.white },
  statItemNumInput:  { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1], fontSize: 22, fontWeight: '800', color: colors.gray[900], backgroundColor: colors.white },
  statItemLabelInput:{ borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1], ...typography.caption, color: colors.gray[600], backgroundColor: colors.white },

  // Callout
  calloutBlock:   { borderWidth: 1.5, borderRadius: radius.md, padding: spacing[3], gap: spacing[2] },
  calloutTop:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  calloutIconInput:{ fontSize: 20, width: 40, height: 40, textAlign: 'center', borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, backgroundColor: colors.white },
  calloutColors:  { flexDirection: 'row', gap: spacing[2], flex: 1 },
  colorDot:       { width: 22, height: 22, borderRadius: 11 },
  colorDotActive: { borderWidth: 3, borderColor: colors.white, ...shadows.sm },
  calloutInput:   { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[2], ...typography.body, color: colors.gray[900], backgroundColor: colors.white, minHeight: 60, textAlignVertical: 'top' },

  // Toolbar
  toolbar:      { borderTopWidth: 1, borderTopColor: colors.gray[100], backgroundColor: colors.white, paddingVertical: spacing[2] },
  toolbarInner: { paddingHorizontal: spacing.screenH, gap: spacing[2] },
  toolItem:     { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2], backgroundColor: colors.gray[50], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.gray[200], minWidth: 60 },
  toolIcon:     { fontSize: 18, fontWeight: '800', color: colors.gray[700] },
  toolLabel:    { ...typography.caption, color: colors.gray[500], marginTop: 2 },
})
