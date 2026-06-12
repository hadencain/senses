import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useWindowDimensions } from 'react-native'
import { useSharedValue, useDerivedValue, runOnJS } from 'react-native-reanimated'
import { useFrameProcessor } from 'react-native-vision-camera'
import { Skia, Picture, Group } from '@shopify/react-native-skia'
import { AudioContext } from 'react-native-audio-api'
import { CameraBase } from '../../components/CameraBase'
import { quantizeColors } from './processor'
import { createQuantizeSynth } from './synth'

export function ColorQuantize() {
  const nav = useNavigation()
  const { width, height } = useWindowDimensions()
  const synthRef = useRef(null)

  useEffect(() => {
    const ctx = new AudioContext()
    synthRef.current = createQuantizeSynth(ctx)
    return () => {
      synthRef.current?.close()
      ctx.close()
    }
  }, [])

  // Store up to 4 dominant colors as flat shared value arrays
  const colorData = useSharedValue([]) // array of { r, g, b, weight, hue }

  const onColors = useCallback((colors) => {
    synthRef.current?.update(colors)
  }, [])

  const fp = useFrameProcessor((frame) => {
    'worklet'
    const colors = quantizeColors(frame)
    colorData.value = colors
    runOnJS(onColors)(colors)
  }, [colorData, onColors])

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder()
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
    const paint = Skia.Paint()

    const colors = colorData.value
    if (!colors.length) return recorder.finishRecordingAsPicture()

    // Draw color zone bands — vertical strips proportional to weight
    let x = 0
    for (const c of colors) {
      const bandW = c.weight * width
      paint.setColor(Skia.Color(`rgba(${c.r},${c.g},${c.b},0.18)`))
      canvas.drawRect(Skia.XYWHRect(x, 0, bandW, height), paint)

      // Thin bright border on each zone
      paint.setColor(Skia.Color(`rgba(${c.r},${c.g},${c.b},0.6)`))
      canvas.drawRect(Skia.XYWHRect(x, 0, 1.5, height), paint)
      x += bandW
    }

    // Dominant color indicator dots at top
    let dx = 16
    for (const c of colors) {
      const r = 4 + c.weight * 16
      paint.setColor(Skia.Color(`rgb(${c.r},${c.g},${c.b})`))
      canvas.drawCircle(dx + r, 32, r, paint)
      dx += r * 2 + 10
    }

    return recorder.finishRecordingAsPicture()
  }, [colorData])

  return (
    // RGB format needed for color sampling
    <CameraBase frameProcessor={fp} pixelFormat="rgb" onBack={() => nav.goBack()}>
      <Group>
        <Picture picture={picture} />
      </Group>
    </CameraBase>
  )
}
