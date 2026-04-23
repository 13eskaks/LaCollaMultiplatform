import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Button } from '@/components/ui/Button'

const BENEFICIS = [
  { icon: '🚫', text: 'Sense publicitat' },
  { icon: '📊', text: 'Estadístiques avançades' },
  { icon: '🗂', text: 'Arxiu il·limitat de fotos' },
  { icon: '👥', text: 'Fins a 5 colles simultànies' },
  { icon: '⚡', text: 'Funcions prioritàries' },
  { icon: '📧', text: 'Suport prioritari' },
]

export default function PremiumIndividualScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<'mensual' | 'anual'>('anual')

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>⭐</Text>
          <Text style={styles.heroTitle}>LaColla Premium</Text>
          <Text style={styles.heroSub}>La teua colla, sense límits ni interrupcions</Text>
        </View>

        {/* Selector pla */}
        <View style={styles.planSelector}>
          {([
            { key: 'mensual', label: 'Mensual', preu: '4,99€/mes', badge: null },
            { key: 'anual', label: 'Anual', preu: '39,99€/any', badge: '-33%' },
          ] as const).map(pla => (
            <TouchableOpacity
              key={pla.key}
              style={[styles.planCard, selected === pla.key && styles.planCardActive]}
              onPress={() => setSelected(pla.key)}
            >
              {pla.badge && (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{pla.badge}</Text>
                </View>
              )}
              <Text style={[styles.planLabel, selected === pla.key && styles.planLabelActive]}>{pla.label}</Text>
              <Text style={[styles.planPreu, selected === pla.key && styles.planPreuActive]}>{pla.preu}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selected === 'anual' && (
          <Text style={styles.savings}>🎉 Estalvia 20€ a l'any respecte al pla mensual</Text>
        )}

        {/* Beneficis */}
        <View style={styles.beneficis}>
          {BENEFICIS.map(b => (
            <View key={b.text} style={styles.beneficiRow}>
              <Text style={styles.beneficiIcon}>{b.icon}</Text>
              <Text style={styles.beneficiText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Button
          label="Comença 7 dies gratis →"
          size="lg"
          variant="premium"
          onPress={() => {}}
          style={{ marginTop: spacing[4] }}
        />

        <Text style={styles.legal}>
          Cancel·la quan vulgues · Sense compromisos{'\n'}
          Renova automàticament cada {selected === 'mensual' ? 'mes' : 'any'}
        </Text>

        <TouchableOpacity>
          <Text style={styles.restore}>Restaurar compra</Text>
        </TouchableOpacity>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.white },
  header:          { paddingHorizontal: spacing.screenH, paddingTop: spacing[3], alignItems: 'flex-end' },
  closeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  closeBtnText:    { fontSize: 14, color: colors.gray[600] },
  content:         { paddingHorizontal: spacing.screenH, gap: spacing[5] },
  hero:            { alignItems: 'center', gap: spacing[2], paddingTop: spacing[4] },
  heroIcon:        { fontSize: 64 },
  heroTitle:       { ...typography.display, color: colors.gray[900] },
  heroSub:         { ...typography.bodyLg, color: colors.gray[500], textAlign: 'center' },
  planSelector:    { flexDirection: 'row', gap: spacing[3] },
  planCard:        { flex: 1, borderRadius: radius.md, padding: spacing[4], alignItems: 'center', backgroundColor: colors.gray[50], borderWidth: 2, borderColor: colors.gray[200], gap: spacing[1], position: 'relative', overflow: 'hidden' },
  planCardActive:  { borderColor: colors.gold[500], backgroundColor: colors.gold[100] },
  planBadge:       { position: 'absolute', top: 0, right: 0, backgroundColor: colors.gold[500], paddingHorizontal: 6, paddingVertical: 2 },
  planBadgeText:   { ...typography.caption, color: colors.white, fontWeight: '700' },
  planLabel:       { ...typography.body, color: colors.gray[500], fontWeight: '600' },
  planLabelActive: { color: colors.gray[800] },
  planPreu:        { ...typography.h3, color: colors.gray[400] },
  planPreuActive:  { color: colors.gold[500] },
  savings:         { ...typography.bodySm, color: colors.gold[500], textAlign: 'center', fontWeight: '600' },
  beneficis:       { gap: spacing[3] },
  beneficiRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  beneficiIcon:    { fontSize: 22, width: 30, textAlign: 'center' },
  beneficiText:    { ...typography.bodyLg, color: colors.gray[700] },
  legal:           { ...typography.caption, color: colors.gray[400], textAlign: 'center' },
  restore:         { ...typography.bodySm, color: colors.primary[600], textAlign: 'center' },
})
