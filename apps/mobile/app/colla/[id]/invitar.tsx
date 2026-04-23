import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

export default function InvitarScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { collaActiva } = useCollaStore()
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSlug() }, [collaId])

  async function loadSlug() {
    const { data } = await supabase
      .from('colles')
      .select('slug')
      .eq('id', collaId)
      .single()
    setSlug(data?.slug ?? null)
    setLoading(false)
  }

  const inviteUrl = slug
    ? `https://lacolla.app/colla/${slug}`
    : `https://lacolla.app/join/${collaId}`

  async function handleCopy() {
    await Clipboard.setStringAsync(inviteUrl)
    Alert.alert('Copiat!', 'L\'enllaç ha sigut copiat al porta-retalls')
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Uneix-te a ${collaActiva?.nom ?? 'la nostra colla'} a LaColla! 🌩\n${inviteUrl}`,
        url: inviteUrl,
        title: `Uneix-te a ${collaActiva?.nom ?? 'la colla'}`,
      })
    } catch (e) {}
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Convidar membres" />

      <View style={styles.content}>
        {/* Header colla */}
        <View style={styles.collaHeader}>
          <Avatar
            name={collaActiva?.nom ?? ''}
            uri={collaActiva?.avatar_url}
            size="2xl"
          />
          <Text style={styles.collaNom}>{collaActiva?.nom}</Text>
          {collaActiva?.localitat && (
            <Text style={styles.collaLoc}>📍 {collaActiva.localitat}</Text>
          )}
        </View>

        {/* Instruccions */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Com funciona?</Text>
          <View style={styles.passos}>
            {[
              { num: '1', text: 'Comparteix l\'enllaç amb la persona que vols invitar' },
              { num: '2', text: 'L\'usuari crea el compte o accedeix amb el seu email' },
              { num: '3', text: 'La sol·licitud arriba a la comissió per aprovar-la' },
            ].map(pas => (
              <View key={pas.num} style={styles.pas}>
                <View style={styles.pasNum}>
                  <Text style={styles.pasNumText}>{pas.num}</Text>
                </View>
                <Text style={styles.pasText}>{pas.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Url box */}
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Enllaç d'invitació</Text>
          <TouchableOpacity style={styles.urlRow} onPress={handleCopy}>
            <Text style={styles.urlText} numberOfLines={1}>{inviteUrl}</Text>
            <Text style={styles.copyIcon}>📋</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="📋 Copiar enllaç"
            variant="secondary"
            size="lg"
            onPress={handleCopy}
            style={{ flex: 1 }}
          />
          <Button
            label="📤 Compartir"
            size="lg"
            onPress={handleShare}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.gray[50] },
  content:    { flex: 1, padding: spacing.screenH, gap: spacing[5] },
  collaHeader:{ alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  collaNom:   { ...typography.h2, color: colors.gray[900], textAlign: 'center' },
  collaLoc:   { ...typography.body, color: colors.gray[500] },
  infoCard:   { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], ...shadows.sm, gap: spacing[3] },
  infoTitle:  { ...typography.h3, color: colors.gray[900] },
  passos:     { gap: spacing[3] },
  pas:        { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  pasNum:     { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },
  pasNumText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  pasText:    { ...typography.body, color: colors.gray[600], flex: 1, lineHeight: 22 },
  urlBox:     { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing[4], ...shadows.sm, gap: spacing[2] },
  urlLabel:   { ...typography.label, color: colors.gray[500] },
  urlRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray[50], borderRadius: radius.sm, padding: spacing[3], gap: spacing[2] },
  urlText:    { flex: 1, ...typography.bodySm, color: colors.primary[600], fontWeight: '600' },
  copyIcon:   { fontSize: 18 },
  actions:    { flexDirection: 'row', gap: spacing[3] },
})
