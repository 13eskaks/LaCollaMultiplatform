import { Platform } from 'react-native'

const shadow = (elevation: number, opacity: number, radius: number, offsetY: number) =>
  Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: offsetY } },
    android: { elevation },
    default: {},
  })

export const shadows = {
  sm: shadow(2,  0.06, 3,  1),
  md: shadow(6,  0.08, 12, 4),
  lg: shadow(12, 0.10, 30, 10),
} as const
