import WebView from 'react-native-webview'
import type { StyleProp, ViewStyle } from 'react-native'
import { withBridge } from './HtmlView.shared'

interface Props {
  html: string
  style?: StyleProp<ViewStyle>
  /** Missatges enviats des de l'HTML amb `send(text)` */
  onMessage?: (data: string) => void
}

/** Mostra HTML (p. ex. un mapa Leaflet). Versió nativa amb WebView. */
export function HtmlView({ html, style, onMessage }: Props) {
  return (
    <WebView
      style={style}
      source={{ html: withBridge(html) }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={e => onMessage?.(e.nativeEvent.data)}
    />
  )
}

