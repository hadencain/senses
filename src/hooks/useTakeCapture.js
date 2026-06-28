import { useRef, useState, useCallback } from 'react'
import { PermissionsAndroid } from 'react-native'
import { createSidecar } from '../capture/sidecar'
import { takeId } from '../capture/takes'
import { saveTake } from '../capture/takes-io'

// idle → recording → saving → idle
// Matches useRecorder shape (state/durationMs) so chrome wiring is unchanged.
// Extra: lastTakeId, logFeatures, logParam
export function useTakeCapture(cameraRef) {
  const [state, setState] = useState('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [lastTakeId, setLastTakeId] = useState(null)

  const sidecarRef = useRef(null)
  const t0Ref = useRef(0)
  const timerRef = useRef(null)
  const metaRef = useRef({ effectId: null, effectVersion: 1 })
  const rawUriRef = useRef(null)
  const activeRef = useRef(false)

  const start = useCallback(async (effectId, effectVersion, startParams) => {
    if (activeRef.current) return
    activeRef.current = true
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      if (!cameraRef.current) { activeRef.current = false; return }
      metaRef.current = { effectId, effectVersion }
      sidecarRef.current = createSidecar(effectId, effectVersion, startParams)
      rawUriRef.current = null
      t0Ref.current = Date.now()
      setDurationMs(0)
      timerRef.current = setInterval(() => setDurationMs(Date.now() - t0Ref.current), 500)

      cameraRef.current.startRecording({
        onRecordingFinished: (video) => { rawUriRef.current = video.path },
        onRecordingError: (e) => { console.warn('[take] recording error', e?.message) },
      })
      setState('recording')
    } catch (e) {
      console.warn('[take] start failed', e?.message)
      activeRef.current = false
      setState('idle')
    }
  }, [cameraRef])

  const logFeatures = useCallback((features, motion) => {
    const sc = sidecarRef.current
    if (!sc) return
    const t = Date.now() - t0Ref.current
    sc.logFeatures(t, features)
    sc.logMotion(t, motion)
  }, [])

  const logParam = useCallback((key, value) => {
    const sc = sidecarRef.current
    if (!sc) return
    sc.logParam(Date.now() - t0Ref.current, key, value)
  }, [])

  const stop = useCallback(async () => {
    if (!activeRef.current) return null
    clearInterval(timerRef.current)
    setState('saving')
    try {
      await cameraRef.current?.stopRecording()
      const dur = Date.now() - t0Ref.current
      // wait briefly for onRecordingFinished to deliver the path
      for (let i = 0; i < 50 && !rawUriRef.current; i++) {
        await new Promise(r => setTimeout(r, 100))
      }
      const sc = sidecarRef.current
      if (!sc || !rawUriRef.current) { setState('idle'); return null }
      const createdAt = t0Ref.current
      const id = takeId(createdAt, metaRef.current.effectId)
      await saveTake({
        id,
        effectId: metaRef.current.effectId,
        rawTempUri: rawUriRef.current,
        sidecar: sc.serialize(dur),
        durationMs: dur,
        createdAt,
        width: 0,   // filled by compositor in Phase 2 (sensor res from the video)
        height: 0,
      })
      setLastTakeId(id)
      return id
    } catch (e) {
      console.warn('[take] stop/save failed', e?.message)
      return null
    } finally {
      activeRef.current = false
      sidecarRef.current = null
      rawUriRef.current = null
      setState('idle')
    }
  }, [cameraRef])

  return { state, durationMs, lastTakeId, start, logFeatures, logParam, stop }
}
