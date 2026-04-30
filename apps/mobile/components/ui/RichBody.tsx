import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius } from '@/theme'

// ── types ──────────────────────────────────────────────────────────────────

export type RichBlock =
  | { type: 'text';      id: string; content: string }
  | { type: 'image';     id: string; uri?: string; url?: string }
  | { type: 'heading';   id: string; content: string }
  | { type: 'divider';   id: string }
  | { type: 'stats';     id: string }
  | { type: 'stat_item'; id: string; num: string; label: string; icon?: string }
  | { type: 'callout';   id: string; content: string; icon?: string; color?: string }

export type SavedBlock =
  | { type: 'text';      content: string }
  | { type: 'image';     url: string }
  | { type: 'heading';   content: string }
  | { type: 'divider' }
  | { type: 'stats' }
  | { type: 'stat_item'; num: string; label: string; icon?: string }
  | { type: 'callout';   content: string; icon?: string; color?: string }

export type CollaData = {
  nom?: string; localitat?: string; any_fundacio?: number; membresCount?: number
}

// ── helpers ─────────────────────────────────────────────────────────────────

let _seq = Date.now()
function uid() { return String(_seq++) }

export function makeTextBlock(content = ''): RichBlock {
  return { type: 'text', id: uid(), content }
}

export function blocksFromSaved(saved: SavedBlock[]): RichBlock[] {
  if (!Array.isArray(saved)) return []
  return saved.map(b => ({ ...b, id: uid() } as RichBlock))
}

// ── upload ───────────────────────────────────────────────────────────────────

async function uploadImg(uri: string, entityType: string, entityId: string): Promise<string | null> {
  const rawExt = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg'
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  const path = `${entityType}/${entityId}/${Date.now()}.${ext}`
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { console.error('[RichBody] no session'); return null }
    console.log('[RichBody] upload user:', session.user?.id?.slice(0, 8), 'role:', session.user?.role, 'token:', session.access_token?.slice(0, 20))
    const form = new FormData()
    form.append('file', { uri, type: mime, name: `upload.${ext}` } as any)
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
    if (!res.ok) { console.error('[RichBody upload]', res.status, await res.text()); return null }
    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/imatges/${path}`
  } catch (e: any) {
    console.error('[RichBody upload]', e?.message ?? e)
    return null
  }
}

export async function uploadBlocks(
  blocks: RichBlock[],
  entityType: string,
  entityId: string,
): Promise<SavedBlock[]> {
  const out: SavedBlock[] = []
  for (const b of blocks) {
    if (b.type === 'text') {
      if (b.content.trim()) out.push({ type: 'text', content: b.content.trim() })
    } else if (b.type === 'heading') {
      if (b.content.trim()) out.push({ type: 'heading', content: b.content.trim() })
    } else if (b.type === 'divider') {
      out.push({ type: 'divider' })
    } else if (b.type === 'stats') {
      out.push({ type: 'stats' })
    } else if (b.type === 'image') {
      if (b.url) {
        out.push({ type: 'image', url: b.url })
      } else if (b.uri) {
        const url = await uploadImg(b.uri, entityType, entityId)
        if (url) out.push({ type: 'image', url })
      }
    } else if (b.type === 'stat_item') {
      out.push({ type: 'stat_item', num: b.num, label: b.label, ...(b.icon ? { icon: b.icon } : {}) })
    } else if (b.type === 'callout') {
      if (b.content.trim()) out.push({ type: 'callout', content: b.content.trim(), ...(b.icon ? { icon: b.icon } : {}), ...(b.color ? { color: b.color } : {}) })
    }
  }
  return out
}

// ── editor ───────────────────────────────────────────────────────────────────

function applyListFormatting(newText: string, oldText: string): string {
  // Replace "- " or "* " at start of a line with "• "
  let text = newText.replace(/(^|\n)([-*]) /g, '$1• ')

  // Auto-continue list when a new line was added
  const added = (text.match(/\n/g) ?? []).length - (oldText.match(/\n/g) ?? []).length
  if (added <= 0 || !text.endsWith('\n')) return text

  const lines = text.split('\n')
  const prev = lines[lines.length - 2] ?? ''

  // Empty bullet → stop list
  if (prev === '•' || prev === '• ') {
    lines[lines.length - 2] = ''
    return lines.slice(0, -1).join('\n')
  }
  // Continue bullet
  if (prev.startsWith('• ')) return text + '• '
  // Continue numbered list (only if the line has actual content)
  const num = prev.match(/^(\d+)\. .+/)
  if (num) return text + `${Number(num[1]) + 1}. `

  return text
}

export function RichBodyEditor({
  blocks,
  onChange,
  placeholder = 'Escriu aquí...',
  minHeight = 120,
}: {
  blocks: RichBlock[]
  onChange: (blocks: RichBlock[]) => void
  placeholder?: string
  minHeight?: number
}) {
  function updateText(id: string, newContent: string) {
    const old = (blocks.find(b => b.id === id) as { type: 'text'; content: string } | undefined)?.content ?? ''
    const content = applyListFormatting(newContent, old)
    onChange(blocks.map(b => b.id === id && b.type === 'text' ? { ...b, content } : b))
  }

  function removeBlock(id: string) {
    const next = blocks.filter(b => b.id !== id)
    onChange(next.length === 0 ? [makeTextBlock()] : next)
  }

  async function addImageAfter(idx: number) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 })
    if (res.canceled) return
    const imgBlock: RichBlock = { type: 'image', id: uid(), uri: res.assets[0].uri }
    const next = [...blocks]
    next.splice(idx + 1, 0, imgBlock)
    if (!next[idx + 2] || next[idx + 2].type === 'image') {
      next.splice(idx + 2, 0, makeTextBlock())
    }
    onChange(next)
  }

  return (
    <View style={ed.wrap}>
      {blocks.map((block, i) => (
        <View key={block.id} style={ed.blockWrap}>
          {block.type === 'text' ? (
            <TextInput
              style={[ed.textInput, i === 0 && { minHeight }]}
              value={block.content}
              onChangeText={t => updateText(block.id, t)}
              multiline
              placeholder={i === 0 ? placeholder : 'Continua...'}
              placeholderTextColor={colors.gray[400]}
              textAlignVertical="top"
            />
          ) : (
            <View style={ed.imgWrap}>
              <Image source={{ uri: block.uri ?? block.url }} style={ed.previewImg} resizeMode="cover" />
              <TouchableOpacity style={ed.removeBtn} onPress={() => removeBlock(block.id)}>
                <Text style={ed.removeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={ed.addBtn} onPress={() => addImageAfter(i)}>
            <Text style={ed.addBtnTxt}>📷 Inserir imatge</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

// ── viewer ───────────────────────────────────────────────────────────────────

function renderTextContent(content: string, textStyle?: object) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    const bullet = line.match(/^[•\-*]\s+(.+)/)
    if (bullet) {
      return (
        <View key={i} style={vw.listRow}>
          <Text style={[vw.text, textStyle, vw.bulletDot]}>•</Text>
          <Text style={[vw.text, textStyle, vw.listText]}>{bullet[1]}</Text>
        </View>
      )
    }
    const numbered = line.match(/^(\d+)\.\s+(.+)/)
    if (numbered) {
      return (
        <View key={i} style={vw.listRow}>
          <Text style={[vw.text, textStyle, vw.bulletDot]}>{numbered[1]}.</Text>
          <Text style={[vw.text, textStyle, vw.listText]}>{numbered[2]}</Text>
        </View>
      )
    }
    return <Text key={i} style={[vw.text, textStyle]}>{line}</Text>
  })
}

function StatsCard({ colla }: { colla: CollaData }) {
  const years = colla.any_fundacio ? new Date().getFullYear() - colla.any_fundacio : null
  const items = [
    colla.membresCount != null && { num: String(colla.membresCount), lbl: 'Membres' },
    years != null            && { num: String(years), lbl: 'Anys' },
    colla.localitat          && { num: '📍', lbl: colla.localitat },
  ].filter(Boolean) as { num: string; lbl: string }[]
  if (items.length === 0) return null
  return (
    <View style={vw.statsCard}>
      {items.map((item, i) => (
        <View key={i} style={[vw.statItem, i > 0 && vw.statItemBorder]}>
          <Text style={vw.statNum}>{item.num}</Text>
          <Text style={vw.statLbl}>{item.lbl}</Text>
        </View>
      ))}
    </View>
  )
}

export function RichBodyView({
  blocks,
  textStyle,
  colla,
}: {
  blocks: SavedBlock[] | null | undefined
  textStyle?: object
  colla?: CollaData
}) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  return (
    <View style={vw.wrap}>
      {blocks.map((b, i) => {
        if (b.type === 'text')    return <View key={i} style={vw.textBlock}>{renderTextContent(b.content, textStyle)}</View>
        if (b.type === 'image')   return <Image key={i} source={{ uri: b.url }} style={vw.img} resizeMode="cover" />
        if (b.type === 'heading') return <Text key={i} style={vw.heading}>{b.content}</Text>
        if (b.type === 'divider') return <View key={i} style={vw.divider} />
        if (b.type === 'stats')   return colla ? <StatsCard key={i} colla={colla} /> : null
        if (b.type === 'stat_item') return (
          <View key={i} style={vw.statItemCard}>
            {b.icon ? <Text style={vw.statItemIconEl}>{b.icon}</Text> : null}
            <Text style={vw.statItemNumEl}>{b.num}</Text>
            <Text style={vw.statItemLblEl}>{b.label}</Text>
          </View>
        )
        if (b.type === 'callout') {
          const color = b.color ?? '#f59e0b'
          return (
            <View key={i} style={[vw.callout, { backgroundColor: color + '15', borderLeftColor: color }]}>
              {b.icon ? <Text style={vw.calloutIconEl}>{b.icon}</Text> : null}
              <Text style={vw.calloutTextEl}>{b.content}</Text>
            </View>
          )
        }
        return null
      })}
    </View>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const ed = StyleSheet.create({
  wrap:      { gap: spacing[1] },
  blockWrap: { gap: spacing[1] },
  textInput: { borderWidth: 1, borderColor: colors.gray[200], borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[3], ...typography.body, color: colors.gray[900], backgroundColor: colors.white },
  imgWrap:   { position: 'relative' },
  previewImg:{ width: '100%', height: 200, borderRadius: radius.sm },
  removeBtn: { position: 'absolute', top: spacing[2], right: spacing[2], width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  removeTxt: { color: colors.white, fontSize: 12, fontWeight: '700' },
  addBtn:    { flexDirection: 'row', alignSelf: 'flex-start', paddingVertical: spacing[1], paddingHorizontal: spacing[1] },
  addBtnTxt: { ...typography.caption, color: colors.gray[400] },
})

const vw = StyleSheet.create({
  wrap:          { gap: spacing[3] },
  textBlock:     { gap: 2 },
  text:          { ...typography.bodyLg, color: colors.gray[700], lineHeight: 24 },
  listRow:       { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  bulletDot:     { minWidth: 18 },
  listText:      { flex: 1 },
  img:           { width: '100%', height: 220, borderRadius: radius.md },
  heading:       { fontSize: 22, fontWeight: '700', color: colors.gray[900], lineHeight: 28 },
  divider:       { height: 1, backgroundColor: colors.gray[200], marginVertical: spacing[1] },
  statsCard:     { flexDirection: 'row', backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing[3], justifyContent: 'center' },
  statItem:      { flex: 1, alignItems: 'center', gap: 2 },
  statItemBorder:{ borderLeftWidth: 1, borderLeftColor: colors.gray[200] },
  statNum:       { fontSize: 22, fontWeight: '800', color: colors.gray[900] },
  statLbl:       { ...typography.caption, color: colors.gray[500] },
  statItemCard:  { backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing[4], alignItems: 'center', gap: spacing[1], borderWidth: 1, borderColor: colors.gray[200] },
  statItemIconEl:{ fontSize: 28 },
  statItemNumEl: { fontSize: 32, fontWeight: '800', color: colors.gray[900] },
  statItemLblEl: { ...typography.caption, color: colors.gray[500], textAlign: 'center' },
  callout:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], borderLeftWidth: 4, padding: spacing[4], borderRadius: radius.sm },
  calloutIconEl: { fontSize: 20 },
  calloutTextEl: { flex: 1, ...typography.body, color: colors.gray[800], lineHeight: 22 },
})
