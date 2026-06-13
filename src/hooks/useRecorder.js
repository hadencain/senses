import { useRef, useState, useCallback } from 'react'
import { PermissionsAndroid } from 'react-native'
import SensesRecorder from '../../modules/senses-recorder'

// idle → recording → saving → idle
export function useRecorder() {
  const [state, setState] = useState('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [lastUri, setLastUri] = useState(null)
  const timerRef = useRef(null)

  const start = useCallback(async () => {
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      const granted = await SensesRecorder.requestCapture()
      if (!granted) return
      await SensesRecorder.start({ withMic: true })
      const t0 = Date.now()
      setDurationMs(0)
      timerRef.current = setInterval(() => setDurationMs(Date.now() - t0), 500)
      setState('recording')
    } catch (e) {
      console.warn('recorder start failed', e)
      setState('idle')
    }
  }, [])

  const stop = useCallback(async () => {
    clearInterval(timerRef.current)
    setState('saving')
    try {
      const uri = await SensesRecorder.stop()
      setLastUri(uri)
      return uri
    } finally {
      setState('idle')
    }
  }, [])

  return { state, durationMs, lastUri, start, stop }
}
