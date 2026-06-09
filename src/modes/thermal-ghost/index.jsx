import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useWindowDimensions } from 'react-native'
import { useSharedValue, useDerivedValue, runOnJS } from 'react-native-reanimated'
import { useFrameProcessor } from 'react-native-vision-camera'
import { Skia, Picture, Group } from '@shopify/react-native-skia'
import { AudioContext } from 'react-native-audio-api'
import { CameraBase } from '../../components/CameraBase'
import { diffFrames, DIFF_GRID } from './processor'
import { createGhostSynth } from './synth'

const GRID = DIFF_GRID
const DECAY = 0.92 // ghost trail decay per frame

export function ThermalGhost() {
  const nav = useNavigation()
  const { width, height } = useWindowDimensions()
  const synthRef = useRef(null)

  useEffect(() => {
    const ctx = new AudioContext()
    synthRef.current = createGhostSynth(ctx)
    return () => {
      synthRef.current?.close()
      ctx.close()
    }
  }, [])

  const motionMap = useSharedValue(new Array(GRID * GRID).fill(0))
  const ghostMap = useSharedValue(new Array(GRID * GRID).fill(0))
  const totalMotion = useSharedValue(0)

  // prevSnapshot lives in worklet context via shared value
  const prevSnapshot = useSharedValue([])

  const onMotion = useCallback((motion, ghostIntensity) => {
    synthRef.current?.update(motion, ghostIntensity)
  }, [])

  const fp = useFrameProcessor((frame) => {
    'worklet'
    const result = diffFrames(frame, prevSnapshot.value)
    prevSnapshot.value = result.current

    // Decay existing ghost and add new motion
    const ghost = ghostMap.value.slice()
    const motion = result.motionMap
    let ghostIntensity = 0
    for (let i = 0; i < ghost.length; i++) {
      ghost[i] = ghost[i] * DECAY + motion[i] * (1 - DECAY)
      ghostIntensity += ghost[i]
    }
    ghostIntensity /= ghost.length

    ghostMap.value = ghost
    motionMap.value = motion
    totalMotion.value = result.totalMotion

    runOnJS(onMotion)(result.totalMotion, ghostIntensity)
  }, [prevSnapshot, ghostMap, motionMap, totalMotion, onMotion])

  const cellW = width / GRID
  const cellH = height / GRID

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder()
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
    const paint = Skia.Paint()

    const ghost = ghostMap.value
    const motion = motionMap.value

    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const idx = gy * GRID + gx
        const g = ghost[idx]
        const m = motion[idx]

        if (g < 0.01 && m < 0.01) continue

        const x = gx * cellW
        const y = gy * cellH

        // Ghost: blue-tinted trail that persists
        if (g > 0.01) {
          const a = Math.min(0.7, g * 4)
          paint.setColor(Skia.Color(`rgba(110,138,200,${a.toFixed(3)})`))
          canvas.drawRect(Skia.XYWHRect(x, y, cellW, cellH), paint)
        }

        // Fresh motion: hot white flash
        if (m > 0.05) {
          const a = Math.min(0.9, m * 5)
          paint.setColor(Skia.Color(`rgba(220,230,255,${a.toFixed(3)})`))
          canvas.drawRect(Skia.XYWHRect(x + cellW * 0.1, y + cellH * 0.1, cellW * 0.8, cellH * 0.8), paint)
        }
      }
    }

    return recorder.finishRecordingAsPicture()
  }, [ghostMap, motionMap])

  return (
    <CameraBase frameProcessor={fp} onBack={() => nav.goBack()}>
      <Group>
        <Picture picture={picture} />
      </Group>
    </CameraBase>
  )
}
