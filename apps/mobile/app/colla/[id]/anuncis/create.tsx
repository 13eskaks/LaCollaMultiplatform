import { useState } from 'react'
import { View, Text, StyleSheet, Switch, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function CreateAnunciScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [titol, setTitol] = useState('')
  const [cos, setCos] = useState('')
  const [fixat, setFixat] = useState(false)
  const [public_, setPublic] = useState(false)
  const [notificar, setNotificar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePublicar() {
    if (!cos.trim()) { setError('El cos és obligatori'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error: err } = await supabase.from('anuncis').insert({
        colla_id: collaId,
        autor_id: user.id,
        titol: titol.trim() || null,
        cos: cos.trim(),
        fixat,
        public: public_,
      })
      if (err) throw err
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
        <Text style={styles.headerTitle}>Nou anunci</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.form}>
        <Input label="Títol (opcional)" value={titol} onChangeText={setTitol} placeholder="Títol de l'anunci..." />
        <Input
          label="Cos *"
          value={cos}
          onChangeText={text => { setCos(text); setError('') }}
          placeholder="Escriu l'anunci aquí..."
          multiline
          style={{ height: 140 }}
          error={error}
        />

        {[
          { label: 'Fixar anunci', value: fixat, onChange: setFixat },
          { label: 'Visible públicament', value: public_, onChange: setPublic },
          { label: 'Notificar als membres', value: notificar, onChange: setNotificar },
        ].map(({ label, value, onChange }) => (
          <View key={label} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary[600] }} />
          </View>
        ))}

        <Button label="Publicar anunci 📢" size="lg" loading={loading} onPress={handlePublicar} style={{ marginTop: spacing[4] }} />
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
  toggleLabel: { ...typography.body, color: colors.gray[700], flex: 1 },
})
