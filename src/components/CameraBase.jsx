import React, { useEffect } from 'react'
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import { Canvas } from '@shopify/react-native-skia'

export function CameraBase({
  frameProcessor,
  pixelFormat = 'yuv',
  skia,
  children,
}) {
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  useEffect(() => {
    if (!hasPermission) requestPermission()
  }, [hasPermission])

  if (!hasPermission) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.msg}>camera permission required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>allow</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.msg}>no camera</Text>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        pixelFormat={pixelFormat}
      />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {skia}
      </Canvas>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  msg: { color: '#555', fontSize: 13 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#333' },
  btnText: { color: '#888', fontSize: 12 },
})
