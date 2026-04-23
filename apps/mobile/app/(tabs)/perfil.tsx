import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/auth'
import { useCollaStore } from '@/stores/colla'
import { colors, typography, spacing, radius, shadows } from '@/theme'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

interface MenuItem {
  icon: string
  label: string
  route?: string
  onPress?: () => void
  danger?: boolean
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

export default function PerfilScreen() {
  const router = useRouter()
  const { profile, signOut } = useAuthStore()
  const { collaActiva, membershipActiva, colles } = useCollaStore()

  function handleSignOut() {
    Alert.alert('Tancar sessió', 'Estàs segur/a que vols tancar sessió?', [
      { text: 'Cancel·lar', style: 'cancel' },
      { text: 'Tancar sessió', style: 'destructive', onPress: signOut },
    ])
  }

  const anysMembreColla = membershipActiva?.data_ingres
    ? new Date().getFullYear() - new Date(membershipActiva.data_ingres).getFullYear()
    : null

  const sections: MenuSection[] = [
    {
      title: 'Compte',
      items: [
        { icon: '✏️', label: 'Editar perfil', route: '/perfil/edit' },
        { icon: '🔒', label: 'Canviar contrasenya', route: '/perfil/password' },
        { icon: '🔔', label: 'Notificacions', route: '/perfil/notifications' },
      ],
    },
    {
      title: 'Colla',
      items: [
        { icon: '🌩', label: 'Les meues colles', route: '/perfil/colles' },
        { icon: '👋', label: 'Convidar membres', route: collaActiva ? `/colla/${collaActiva.id}/invitar` : undefined },
        { icon: '🔒', label: 'Privacitat', route: '/perfil/privacitat' },
      ],
    },
    {
      title: 'Suport',
      items: [
        { icon: '❓', label: 'Ajuda i FAQ', onPress: () => {} },
        { icon: '📬', label: 'Contacta amb nosaltres', onPress: () => {} },
        { icon: '⭐', label: 'Valora LaColla', onPress: () => {} },
      ],
    },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header perfil */}
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            <Avatar
              name={`${profile?.nom ?? ''} ${profile?.cognoms ?? ''}`}
              uri={profile?.avatar_url}
              size="2xl"
            />
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => router.push('/perfil/edit' as any)}>
              <Text style={{ fontSize: 14 }}>✏️</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.nom}>{profile?.nom} {profile?.cognoms ?? ''}</Text>
          {profile?.sobrenom && <Text style={styles.sobrenom}>"{profile.sobrenom}"</Text>}

          {collaActiva && (
            <View style={styles.collaInfo}>
              <Text style={styles.collaText}>🌩 {collaActiva.nom}</Text>
              {membershipActiva && (
                <Badge
                  label={membershipActiva.rol}
                  variant={membershipActiva.rol === 'president' ? 'premium' : membershipActiva.rol === 'tresorer' ? 'success' : 'default'}
                  size="sm"
                />
              )}
            </View>
          )}

          <Text style={styles.metaText}>
            {profile?.email}
            {anysMembreColla ? ` · Membre des de ${new Date().getFullYear() - anysMembreColla}` : ''}
            {profile?.localitat ? ` · 📍 ${profile.localitat}` : ''}
          </Text>
        </View>

        {/* Banner Premium */}
        {!(profile as any)?.is_premium && (
          <TouchableOpacity style={styles.premiumBanner} onPress={() => router.push('/perfil/premium-individual' as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>⭐ Prova LaColla Premium</Text>
              <Text style={styles.premiumSub}>Sense publicitat · Funcions exclusives · 7 dies gratis</Text>
            </View>
            <Text style={styles.premiumArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Configuració */}
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, idx) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={item.onPress ?? (() => item.route && router.push(item.route as any))}
                  >
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                    <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>{item.label}</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Tancar sessió */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Tancar sessió</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.gray[50] },
  header:         { alignItems: 'center', paddingTop: spacing[4], paddingBottom: spacing[5], paddingHorizontal: spacing.screenH, gap: spacing[2] },
  avatarWrapper:  { position: 'relative', marginBottom: spacing[2] },
  editAvatarBtn:  { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...shadows.sm, borderWidth: 1, borderColor: colors.gray[200] },
  nom:            { ...typography.h1, color: colors.gray[900] },
  sobrenom:       { ...typography.body, color: colors.gray[500] },
  collaInfo:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  collaText:      { ...typography.bodySm, color: colors.gray[700], fontWeight: '600' },
  metaText:       { ...typography.caption, color: colors.gray[400], textAlign: 'center' },
  premiumBanner:  { marginHorizontal: spacing.screenH, marginBottom: spacing[5], backgroundColor: colors.gold[100], borderRadius: radius.lg, padding: spacing[4], flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.gold[500] },
  premiumTitle:   { ...typography.h3, color: colors.gray[900] },
  premiumSub:     { ...typography.bodySm, color: colors.gray[600], marginTop: 3 },
  premiumArrow:   { ...typography.h2, color: colors.gold[500] },
  section:        { marginHorizontal: spacing.screenH, marginBottom: spacing[4] },
  sectionTitle:   { ...typography.label, color: colors.gray[400], marginBottom: spacing[2] },
  menuCard:       { backgroundColor: colors.white, borderRadius: radius.md, ...shadows.sm, overflow: 'hidden' },
  menuItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  menuIcon:       { fontSize: 18, marginRight: spacing[3], width: 24, textAlign: 'center' },
  menuLabel:      { flex: 1, ...typography.body, color: colors.gray[800] },
  menuLabelDanger:{ color: colors.danger[500] },
  menuArrow:      { fontSize: 20, color: colors.gray[300] },
  divider:        { height: 1, backgroundColor: colors.gray[100], marginLeft: 52 },
  signOutBtn:     { backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', borderWidth: 1.5, borderColor: colors.danger[100], ...shadows.sm },
  signOutText:    { ...typography.body, color: colors.danger[500], fontWeight: '600' },
})
