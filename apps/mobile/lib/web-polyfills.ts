/**
 * A react-native-web, Alert.alert no fa res. El substituïm per diàlegs del
 * navegador perquè les confirmacions (esborrar, eixir, etc.) funcionen a la web.
 */
import { Alert, Platform, type AlertButton } from 'react-native'

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n')
    if (!buttons || buttons.length === 0) {
      window.alert(text)
      return
    }
    if (buttons.length === 1) {
      window.alert(text)
      buttons[0].onPress?.()
      return
    }
    const cancel = buttons.find(b => b.style === 'cancel')
    const actions = buttons.filter(b => b !== cancel)
    if (actions.length === 1) {
      if (window.confirm(text)) actions[0].onPress?.()
      else cancel?.onPress?.()
      return
    }
    // Més d'una acció: preguntem una per una
    for (const a of actions) {
      if (window.confirm(`${text}\n\n→ ${a.text ?? 'OK'}?`)) {
        a.onPress?.()
        return
      }
    }
    cancel?.onPress?.()
  }
}
