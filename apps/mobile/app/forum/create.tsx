import { useState } from 'react'
import { View, Text, StyleSheet, Switch, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function CreateForumFilScreen() {
  const router = useRouter()
  const { collaActiva, isComissioActiva } = useCollaStore()
  const [titol, setTitol] = useState('')
  const [cos, setCos] = useState('')
  const [fixat, setFixat] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!titol.trim()) e.titol = 'El títol és obligatori'
    if (!cos.trim()) e.cos = 'El primer missatge és obligatori'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCrear() {
    if (!validate() || !collaActiva) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: fil, error } = await supabase.from('forum_fils').insert({
        colla_id: collaActiva.id,
        creador_id: user.id,
        titol: titol.trim(),
        fixat: isComissioActiva() ? fixat : false,
      }).select().single()

      if (error || !fil) throw error ?? new Error('Error creant el fil')

      // Afegir el primer missatge
      await supabase.from('forum_missatges').insert({
        fil_id: fil.id,
        user_id: user.id,
        text: cos.trim(),
      })

      router.replace(`/forum/${fil.id}` as any)
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
        <Text style={styles.headerTitle}>Nou fil</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.form}>
        <Input
          label="Títol *"
          value={titol}
          onChangeText={t => { setTitol(t); setErrors(e => ({ ...e, titol: '' })) }}
          placeholder="Sobre de què vols parlar?"
          error={errors.titol}
        />

        <Input
          label="Primer missatge *"
          value={cos}
          onChangeText={t => { setCos(t); setErrors(e => ({ ...e, cos: '' })) }}
          placeholder="Escriu el teu missatge inicial..."
          multiline
          style={{ height: 160 }}
          error={errors.cos}
        />

        {isComissioActiva() && (
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>Fixar fil (visible per a tothom a dalt)</Text>
            <Switch value={fixat} onValueChange={setFixat} trackColor={{ true: colors.primary[600] }} />
          </View>
        )}

        <Button
          label="Publicar fil 💬"
          size="lg"
          loading={loading}
          onPress={handleCrear}
          style={{ marginTop: spacing[4] }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.white },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  headerTitle: { ...typography.h3, color: colors.gray[900] },
  form:        { padding: spacing.screenH, gap: spacing[4] },
  toggle:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel: { ...typography.body, color: colors.gray[700], flex: 1, paddingRight: spacing[4] },
})
