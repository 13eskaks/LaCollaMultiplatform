import { useState } from 'react'
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, typography, spacing, radius } from '@/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Tipus = 'si_no' | 'opcions' | 'puntuacio'

export default function CreateVotacioScreen() {
  const { id: collaId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [pregunta, setPregunta] = useState('')
  const [descripcio, setDescripcio] = useState('')
  const [tipus, setTipus] = useState<Tipus>('si_no')
  const [opcions, setOpcions] = useState(['', ''])
  const [votsAnonims, setVotsAnonims] = useState(false)
  const [permetComentaris, setPermetComentaris] = useState(true)
  const [mostrarTempsReal, setMostrarTempsReal] = useState(true)
  const [dataLimit, setDataLimit] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!pregunta.trim()) e.pregunta = 'La pregunta és obligatòria'
    if (tipus === 'opcions' && opcions.filter(o => o.trim()).length < 2)
      e.opcions = 'Calen almenys 2 opcions'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCrear() {
    if (!validate()) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: v, error } = await supabase.from('votacions').insert({
        colla_id: collaId,
        creador_id: user.id,
        pregunta: pregunta.trim(),
        descripcio: descripcio.trim() || null,
        tipus,
        vots_anonims: votsAnonims,
        permet_comentaris: permetComentaris,
        mostrar_resultats_temps_real: mostrarTempsReal,
        data_limit: dataLimit || null,
      }).select().single()

      if (error || !v) throw error ?? new Error('Error')

      if (tipus === 'opcions') {
        const opts = opcions.filter(o => o.trim()).map((text, i) => ({
          votacio_id: v.id, text: text.trim(), ordre: i,
        }))
        await supabase.from('votacio_opcions').insert(opts)
      } else if (tipus === 'si_no') {
        await supabase.from('votacio_opcions').insert([
          { votacio_id: v.id, text: 'Sí', ordre: 0 },
          { votacio_id: v.id, text: 'No', ordre: 1 },
        ])
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
        <Text style={styles.headerTitle}>Nova votació</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Input label="Pregunta *" value={pregunta} onChangeText={setPregunta} placeholder="Ex: Canviem el dia de la quedada?" error={errors.pregunta} />
        <Input label="Descripció (opcional)" value={descripcio} onChangeText={setDescripcio} placeholder="Context addicional..." multiline style={{ height: 80 }} />

        <Text style={styles.sectionLabel}>Tipus de votació</Text>
        <View style={styles.tipusRow}>
          {([
            { key: 'si_no', label: 'Sí/No' },
            { key: 'opcions', label: 'Opcions' },
            { key: 'puntuacio', label: 'Puntuació' },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tipusBtn, tipus === t.key && styles.tipusBtnActive]}
              onPress={() => setTipus(t.key)}
            >
              <Text style={[styles.tipusText, tipus === t.key && styles.tipusTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tipus === 'opcions' && (
          <View style={{ gap: spacing[2] }}>
            <Text style={styles.sectionLabel}>Opcions</Text>
            {opcions.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={o}
                    onChangeText={text => setOpcions(opts => opts.map((x, j) => j === i ? text : x))}
                    placeholder={`Opció ${i + 1}`}
                    error={i === 0 && errors.opcions ? errors.opcions : undefined}
                  />
                </View>
                {opcions.length > 2 && (
                  <TouchableOpacity onPress={() => setOpcions(opts => opts.filter((_, j) => j !== i))}>
                    <Text style={{ fontSize: 20, color: colors.gray[400] }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <Button label="+ Afegir opció" variant="ghost" size="sm" onPress={() => setOpcions(o => [...o, ''])} />
          </View>
        )}

        <Text style={styles.sectionLabel}>Configuració</Text>
        {[
          { label: 'Vots anònims', value: votsAnonims, onChange: setVotsAnonims },
          { label: 'Permet comentaris', value: permetComentaris, onChange: setPermetComentaris },
          { label: 'Mostrar resultats en temps real', value: mostrarTempsReal, onChange: setMostrarTempsReal },
        ].map(({ label, value, onChange }) => (
          <View key={label} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary[600] }} />
          </View>
        ))}

        <Input
          label="Data límit (opcional)"
          value={dataLimit}
          onChangeText={setDataLimit}
          placeholder="2026-07-01"
          keyboardType="numeric"
        />

        <Button label="Crear votació 🗳️" size="lg" loading={loading} onPress={handleCrear} style={{ marginTop: spacing[4] }} />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.white },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenH, paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  headerTitle:  { ...typography.h3, color: colors.gray[900] },
  form:         { padding: spacing.screenH, gap: spacing[4] },
  sectionLabel: { ...typography.label, color: colors.gray[500] },
  tipusRow:     { flexDirection: 'row', backgroundColor: colors.gray[100], borderRadius: radius.sm, padding: 3, gap: 3 },
  tipusBtn:     { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.xs },
  tipusBtnActive:{ backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tipusText:    { fontSize: 13, color: colors.gray[500], fontWeight: '500' },
  tipusTextActive:{ color: colors.gray[900], fontWeight: '700' },
  toggle:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  toggleLabel:  { ...typography.body, color: colors.gray[700], flex: 1 },
})
