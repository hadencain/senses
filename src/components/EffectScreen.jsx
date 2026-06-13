import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useWindowDimensions } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSharedValue, useDerivedValue } from 'react-native-reanimated'
import { useFrameProcessor } from 'react-native-vision-camera'
import { Worklets } from 'react-native-worklets-core'
import { Picture } from '@shopify/react-native-skia'
import { AudioContext } from 'react-native-audio-api'
import { CameraBase } from './CameraBase'
import { LiveChrome } from './LiveChrome'
import { OverlayRail } from './OverlayRail'
import { SettingsSheet } from './SettingsSheet'
import { useMotion } from '../hooks/useMotion'
import { useRecorder } from '../hooks/useRecorder'
import { getMode } from '../modes'
import { defaultParams, loadParams, saveParams } from '../state/params'

const OVERLAY_HZ = 4

export function EffectScreen() {
  const nav = useNavigation()
  const { modeId } = useRoute().params
  const { manifest, extractFeatures, createSynth, makePicture } = getMode(modeId)
  const dims = useWindowDimensions()
  const motion = useMotion()
  const recorder = useRecorder()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [params, setParams] = useState(() => defaultParams(manifest))
  const paramsSV = useSharedValue(defaultParams(manifest))
  const paramsRef = useRef(params)
  useEffect(() => {
    loadParams(manifest.id, manifest).then(p => {
      setParams(p)
      paramsSV.value = p
      paramsRef.current = p
    })
  }, [])

  const onParamChange = useCallback((key, value) => {
    setParams(prev => {
      const next = { ...prev, [key]: value }
      paramsSV.value = next
      paramsRef.current = next
      saveParams(manifest.id, next)
      return next
    })
  }, [])

  const synthRef = useRef(null)
  useEffect(() => {
    const ctx = new AudioContext()
    synthRef.current = createSynth(ctx)
    return () => {
      synthRef.current?.dispose?.()
      synthRef.current = null
      ctx.close()
    }
  }, [])

  const featuresSV = useSharedValue({})
  const [overlay, setOverlay] = useState({})
  const lastTickRef = useRef(0)

  const onFeatures = useCallback(features => {
    const motionSnap = { speed: motion.speed.value, tilt: motion.tilt.value }
    synthRef.current?.update(features, motionSnap, paramsRef.current)
    const now = Date.now()
    if (now - lastTickRef.current > 1000 / OVERLAY_HZ) {
      lastTickRef.current = now
      setOverlay({ ...features, ...motionSnap })
    }
  }, [])

  const onFeaturesJS = useMemo(() => Worklets.createRunOnJS(onFeatures), [onFeatures])

  const fp = useFrameProcessor(
    frame => {
      'worklet'
      const features = extractFeatures(frame)
      featuresSV.value = features
      onFeaturesJS(features)
    },
    [onFeaturesJS, featuresSV],
  )

  const width = dims.width
  const height = dims.height
  const picture = useDerivedValue(() => {
    return makePicture({
      features: featuresSV.value,
      motion: { speed: motion.speed.value, tilt: motion.tilt.value, ax: motion.ax.value, ay: motion.ay.value },
      params: paramsSV.value,
      dims: { width, height },
    })
  }, [featuresSV, paramsSV, motion.speed, motion.tilt, motion.ax, motion.ay])

  const recording = recorder.state === 'recording'

  return (
    <CameraBase frameProcessor={fp} skia={<Picture picture={picture} />}>
      <OverlayRail keys={manifest.overlay} values={overlay} accent={manifest.accent} />
      <LiveChrome
        recording={recording}
        durationMs={recorder.durationMs}
        onRecord={recorder.start}
        onStop={recorder.stop}
        onSettings={() => setSettingsOpen(true)}
        onBack={() => nav.goBack()}
      />
      <SettingsSheet
        visible={settingsOpen && !recording}
        manifest={manifest}
        values={params}
        onChange={onParamChange}
        onClose={() => setSettingsOpen(false)}
        onExit={() => nav.navigate('Menu')}
      />
    </CameraBase>
  )
}
