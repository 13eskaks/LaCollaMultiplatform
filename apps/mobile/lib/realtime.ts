import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

/**
 * Substitut del Realtime de Supabase: crida `onTick` cada `intervalMs`
 * mentre la pantalla està muntada i l'app en primer pla.
 */
export function usePolling(onTick: () => void, intervalMs: number, enabled = true) {
  const cb = useRef(onTick)
  cb.current = onTick
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!timer) timer = setInterval(() => cb.current(), intervalMs) }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }
    start()
    const sub = AppState.addEventListener('change', s => (s === 'active' ? start() : stop()))
    return () => { stop(); sub.remove() }
  }, [intervalMs, enabled])
}
