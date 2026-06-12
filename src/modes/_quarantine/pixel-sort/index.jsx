import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useWindowDimensions } from 'react-native'
import { useSharedValue, useDerivedValue, runOnJS } from 'react-native-reanimated'
import { useFrameProcessor } from 'react-native-vision-camera'
import { Skia, Picture, Group } from '@shopify/react-native-skia'
import { AudioContext } from 'react-native-audio-api'
import { CameraBase } from '../../components/CameraBase'
import { analyzeColumns } from './processor'
import { createPixelSortSynth } from './synth'

const COLS = 32

export function PixelSort() {
  const nav = useNavigation()
  const { width, height } = useWindowDimensions()
  const synthRef = useRef(null)

  useEffect(() => {
    const ctx = new AudioContext()
    synthRef.current = createPixelSortSynth(ctx)
    return () => ctx.close()
  }, [])

  const columns = useSharedValue([])

  const onColumns = useCallback((cols) => {
    synthRef.current?.update(cols)
  }, [])

  const fp = useFrameProcessor((frame) => {
    'worklet'
    const cols = analyzeColumns(frame)
    columns.value = cols
    runOnJS(onColumns)(cols)
  }, [columns, onColumns])

  const colW = width / COLS

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder()
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
    const paint = Skia.Paint()

    const cols = columns.value
    if (!cols.length) return recorder.finishRecordingAsPicture()

    for (let c = 0; c < cols.length; c++) {
      const col = cols[c]
      const x = c * colW
      const brightness = col.brightness
      const variance = col.variance

      // Sorted column: draw from bottom, height proportional to brightness
      // Color: purple-ish, brighter = more saturated
      const r = Math.floor(80 + variance * 400)
      const g = Math.floor(40 + brightness * 60)
      const b = Math.floor(180 + brightness * 60)
      const alpha = 0.1 + variance * 2.5

      paint.setColor(Skia.Color(`rgba(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)},${Math.min(1,alpha).toFixed(3)})`))

      // "Sorted" strip — starts at peakRow, extends down
      const topY = col.peakRow * height
      const stripH = height * (0.05 + brightness * 0.4)
      canvas.drawRect(Skia.XYWHRect(x, topY, colW - 1, stripH), paint)

      // Bright cap at top of sorted strip
      if (variance > 0.02) {
        paint.setColor(Skia.Color(`rgba(200,180,255,${Math.min(1, variance * 8).toFixed(3)})`))
        canvas.drawRect(Skia.XYWHRect(x, topY, colW - 1, 2), paint)
      }
    }

    return recorder.finishRecordingAsPicture()
  }, [columns])

  return (
    <CameraBase frameProcessor={fp} onBack={() => nav.goBack()}>
      <Group>
        <Picture picture={picture} />
      </Group>
    </CameraBase>
  )
}
