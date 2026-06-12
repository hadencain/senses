import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useWindowDimensions } from 'react-native'
import { useSharedValue, useDerivedValue, runOnJS } from 'react-native-reanimated'
import { useFrameProcessor } from 'react-native-vision-camera'
import { Skia, Picture, Group } from '@shopify/react-native-skia'
import { AudioContext } from 'react-native-audio-api'
import { CameraBase } from '../../components/CameraBase'
import { detectEdges } from './processor'
import { createEdgeSynth } from './synth'

const GRID = 24
const ACCENT = '#6ec8b4'

export function EdgeErosion() {
  const nav = useNavigation()
  const { width, height } = useWindowDimensions()
  const synthRef = useRef(null)

  useEffect(() => {
    const ctx = new AudioContext()
    synthRef.current = createEdgeSynth(ctx)
    return () => ctx.close()
  }, [])

  const edgeStrength = useSharedValue(0)
  const edgeDensity = useSharedValue(0)
  const edgeCells = useSharedValue(new Array(GRID * GRID).fill(0))

  const onEdges = useCallback((strength, density) => {
    synthRef.current?.update(strength, density)
  }, [])

  const fp = useFrameProcessor((frame) => {
    'worklet'
    const result = detectEdges(frame)
    edgeStrength.value = result.edgeStrength
    edgeDensity.value = result.edgeDensity
    edgeCells.value = result.cells
    runOnJS(onEdges)(result.edgeStrength, result.edgeDensity)
  }, [edgeStrength, edgeDensity, edgeCells, onEdges])

  const cellW = width / GRID
  const cellH = height / GRID

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder()
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
    const paint = Skia.Paint()

    const cells = edgeCells.value
    const strength = edgeStrength.value

    for (let gy = 1; gy < GRID - 1; gy++) {
      for (let gx = 1; gx < GRID - 1; gx++) {
        const mag = cells[gy * GRID + gx]
        if (mag < 0.05) continue

        const alpha = Math.min(1, mag * 2.5 + strength * 0.3)
        paint.setColor(Skia.Color(`rgba(110,200,180,${alpha.toFixed(3)})`))

        // Draw edge as a small horizontal line
        const x = gx * cellW
        const y = gy * cellH
        canvas.drawRect(Skia.XYWHRect(x, y + cellH * 0.45, cellW, cellH * 0.1), paint)

        // Occasional vertical accent on strong edges
        if (mag > 0.3) {
          paint.setColor(Skia.Color(`rgba(255,255,255,${(alpha * 0.5).toFixed(3)})`))
          canvas.drawRect(Skia.XYWHRect(x + cellW * 0.45, y, cellW * 0.1, cellH), paint)
        }
      }
    }

    return recorder.finishRecordingAsPicture()
  }, [edgeCells, edgeStrength])

  return (
    <CameraBase frameProcessor={fp} onBack={() => nav.goBack()}>
      <Group>
        <Picture picture={picture} />
      </Group>
    </CameraBase>
  )
}
