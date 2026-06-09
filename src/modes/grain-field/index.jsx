import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useWindowDimensions } from 'react-native'
import { useSharedValue, useDerivedValue, runOnJS } from 'react-native-reanimated'
import { useFrameProcessor } from 'react-native-vision-camera'
import { Skia, Picture, Group } from '@shopify/react-native-skia'
import { AudioContext } from 'react-native-audio-api'
import { CameraBase } from '../../components/CameraBase'
import { useMotion } from '../../hooks/useMotion'
import { sampleBrightness, sampleVariance } from './processor'
import { createGrainSynth } from './synth'

const GRAIN_N = 60

export function GrainField() {
  const nav = useNavigation()
  const { width, height } = useWindowDimensions()
  const motion = useMotion()
  const synthRef = useRef(null)

  useEffect(() => {
    const ctx = new AudioContext()
    synthRef.current = createGrainSynth(ctx)
    return () => ctx.close()
  }, [])

  const brightness = useSharedValue(0.5)
  const variance = useSharedValue(0)

  const triggerBurst = useCallback((spd, bright, vari) => {
    synthRef.current?.burst(spd, bright, vari)
  }, [])

  const fp = useFrameProcessor((frame) => {
    'worklet'
    const b = sampleBrightness(frame)
    const v = sampleVariance(frame)
    brightness.value = b
    variance.value = v
    runOnJS(triggerBurst)(motion.speed.value, b, v)
  }, [brightness, variance, motion.speed, triggerBurst])

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder()
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
    const paint = Skia.Paint()

    const spd = motion.speed.value
    const b = brightness.value

    // scattered grain rects — position jittered by simulated random from speed + brightness
    for (let i = 0; i < GRAIN_N; i++) {
      const t = i / GRAIN_N
      // deterministic-ish scatter using trig
      const cx = (width * 0.5) + Math.cos(t * 37.4 + spd * 3) * (width * 0.45) * (0.3 + spd * 0.7)
      const cy = (height * 0.5) + Math.sin(t * 29.1 + spd * 2) * (height * 0.45) * (0.3 + spd * 0.7)
      const sz = 2 + (1 - t) * 18 * (0.2 + variance.value * 2)
      const alpha = Math.max(0, Math.min(1, (0.05 + spd * 0.4) * (1 - t * 0.6)))

      // hue shifts from warm (low speed) to cool (high speed)
      const r = Math.floor(200 - spd * 100)
      const g = Math.floor(160 + b * 60)
      const a_byte = Math.floor(alpha * 255)
      paint.setColor(Skia.Color(`rgba(${r},${g},180,${alpha.toFixed(2)})`))
      canvas.drawRect(Skia.XYWHRect(cx - sz / 2, cy - sz / 2, sz, sz * 0.4), paint)
    }

    return recorder.finishRecordingAsPicture()
  }, [motion.speed, motion.ax, brightness, variance])

  return (
    <CameraBase frameProcessor={fp} onBack={() => nav.goBack()}>
      <Group>
        <Picture picture={picture} />
      </Group>
    </CameraBase>
  )
}
