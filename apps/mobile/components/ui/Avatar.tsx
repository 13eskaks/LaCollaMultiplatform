import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native'
import { radius } from '@/theme'

const BG_COLORS = ['#1D6FE8','#F97316','#22C55E','#EAB308','#EF4444','#8B5CF6','#EC4899','#14B8A6']

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length]
}

const SIZES = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64, '2xl': 80 } as const
type AvatarSize = keyof typeof SIZES

interface AvatarProps {
  name?: string
  uri?: string | null
  size?: AvatarSize
  border?: boolean
  style?: ViewStyle
}

export function Avatar({ name = '', uri, size = 'md', border = false, style }: AvatarProps) {
  const dim = SIZES[size]
  const fontSize = dim * 0.36
  const initials = name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?'
  const bg = getColor(name)

  return (
    <View style={[
      styles.base,
      { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg },
      border && styles.border,
      style,
    ]}>
      {uri
        ? <Image source={{ uri }} style={{ width: dim, height: dim, borderRadius: dim / 2 }} />
        : <Text style={{ fontSize, fontWeight: '700', color: '#fff' }}>{initials}</Text>
      }
    </View>
  )
}

const styles = StyleSheet.create({
  base:   { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  border: { borderWidth: 2, borderColor: '#fff' },
})
