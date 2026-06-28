import React, { useEffect, useState, useCallback } from 'react'
import { View, StyleSheet, Text, TouchableOpacity, DevSettings } from 'react-native'
import {
  Camera,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  getCameraDevice,
} from 'react-native-vision-camera'
import { Canvas } from '@shopify/react-native-skia'

// Cold-launch enumeration race: vision-camera snapshots the device list once at
// JS module-load (getConstants) and thereafter updates it only via a
// 'CameraDevicesChanged' event. Under heavy native startup (Oboe + recorder +
// skia all initializing), CameraX finishes enumerating AFTER that snapshot but
// the change event can land before the hook's listener attaches — so the hook
// stays empty for the whole process and the screen dead-ends at "no camera"
// until a full app restart. The module-scoped list behind
// Camera.getAvailableCameraDevices() is still updated by vision-camera's own
// top-level listener, so re-reading it on a bounded poll recovers the device
// in place, without a restart.
const RETRY_INTERVAL_MS = 800
const RETRY_WINDOW_MS = 8000

export function CameraBase({
  frameProcessor,
  pixelFormat = 'yuv',
  skia,
  children,
  cameraRef,
  recordable = false,
}) {
  const { hasPermission, requestPermission } = useCameraPermission()
  const hookDevices = useCameraDevices()
  const hookDevice = useCameraDevice('back')

  // Fallback list re-read straight from vision-camera's module-scoped cache when
  // the hook comes up empty (see note above).
  const [polled, setPolled] = useState([])
  const [retrying, setRetrying] = useState(false)

  // Re-read the live device list and stash it if it has anything. Returns the
  // count found so callers can stop polling.
  const forceRead = useCallback(() => {
    try {
      const fresh = Camera.getAvailableCameraDevices() ?? []
      if (fresh.length) setPolled(fresh)
      return fresh.length
    } catch {
      return 0
    }
  }, [])

  // Prefer the hook's device; fall back to back-lens selection over the polled
  // list using vision-camera's own selector so multi-lens picking matches.
  const polledBack = polled.length ? getCameraDevice(polled, 'back') : undefined
  const device = hookDevice ?? polledBack ?? null
  const count = hookDevices.length || polled.length

  useEffect(() => {
    if (!hasPermission) requestPermission()
  }, [hasPermission])

  // While permission is granted but no device has resolved, poll the live list
  // for a bounded window — recovers the cold-launch race in place.
  useEffect(() => {
    if (!hasPermission || device) {
      setRetrying(false)
      return
    }
    setRetrying(true)
    const startedAt = Date.now()
    const id = setInterval(() => {
      const found = forceRead()
      if (found || Date.now() - startedAt > RETRY_WINDOW_MS) {
        setRetrying(false)
        clearInterval(id)
      }
    }, RETRY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [hasPermission, device, forceRead])

  // DIAGNOSTIC: surface how the back device resolved (hook vs poll fallback).
  useEffect(() => {
    console.log(
      `[CameraBase] perm=${hasPermission} hook=${hookDevices.length} ` +
      `polled=${polled.length} back=${device ? device.id : 'null'}`
    )
  }, [hasPermission, hookDevices, polled, device])

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
        <Text style={styles.msg}>{retrying ? 'starting camera…' : 'no camera'}</Text>
        <Text style={styles.diag}>
          {count === 0
            ? retrying
              ? 'waiting for camera enumeration…'
              : 'device list empty — native enumeration failed'
            : `${count} found (no back lens)`}
        </Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={forceRead} style={styles.btn}>
            <Text style={styles.btnText}>retry</Text>
          </TouchableOpacity>
          {__DEV__ && !retrying && (
            <TouchableOpacity onPress={() => DevSettings.reload()} style={styles.btn}>
              <Text style={styles.btnText}>reload</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        pixelFormat={pixelFormat}
        video={recordable}
        audio={recordable}
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
  diag: { color: '#444', fontSize: 11, textAlign: 'center', paddingHorizontal: 24 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#333' },
  btnText: { color: '#888', fontSize: 12 },
})
