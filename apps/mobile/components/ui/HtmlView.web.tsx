import { createElement, useEffect, useRef } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { withBridge } from './HtmlView.shared'

interface Props {
  html: string
  style?: StyleProp<ViewStyle>
  onMessage?: (data: string) => void
}

/** Versió web: iframe amb srcdoc i postMessage cap al pare. */
export function HtmlView({ html, style, onMessage }: Props) {
  const ref = useRef<HTMLIFrameElement | null>(null)
  const cb = useRef(onMessage)
  cb.current = onMessage
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (ref.current && e.source === ref.current.contentWindow && e.data?.__lacolla) cb.current?.(String(e.data.data))
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])
  return (
    <View style={style}>
      {createElement('iframe', {
        ref,
        srcDoc: withBridge(html),
        style: { border: 0, width: '100%', height: '100%', flex: 1 },
        sandbox: 'allow-scripts allow-popups',
        title: 'map',
      })}
    </View>
  )
}
