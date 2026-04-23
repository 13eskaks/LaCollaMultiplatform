import { Platform } from 'react-native'

const fontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' })

export const typography = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, fontFamily },
  h1:      { fontSize: 24, fontWeight: '700' as const, fontFamily },
  h2:      { fontSize: 20, fontWeight: '700' as const, fontFamily },
  h3:      { fontSize: 17, fontWeight: '600' as const, fontFamily },
  bodyLg:  { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, fontFamily },
  body:    { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily },
  bodySm:  { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, fontFamily },
  caption: { fontSize: 12, fontWeight: '400' as const, fontFamily },
  label:   { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const, fontFamily },
} as const
