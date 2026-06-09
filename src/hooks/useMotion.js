import { useEffect } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { Accelerometer, Gyroscope } from 'expo-sensors'

const INTERVAL = 16 // ~60fps

export function useMotion() {
  const ax = useSharedValue(0)
  const ay = useSharedValue(0)
  const az = useSharedValue(1)
  const gx = useSharedValue(0)
  const gy = useSharedValue(0)
  const gz = useSharedValue(0)
  const speed = useSharedValue(0)
  const tilt = useSharedValue(0) // magnitude of gyro

  useEffect(() => {
    Accelerometer.setUpdateInterval(INTERVAL)
    Gyroscope.setUpdateInterval(INTERVAL)

    const accel = Accelerometer.addListener(({ x, y, z }) => {
      const dx = x - ax.value
      const dy = y - ay.value
      const dz = z - az.value
      ax.value = x
      ay.value = y
      az.value = z
      // decaying speed — feels more musical than raw delta
      speed.value = Math.min(1, speed.value * 0.85 + Math.sqrt(dx * dx + dy * dy + dz * dz) * 4)
    })

    const gyro = Gyroscope.addListener(({ x, y, z }) => {
      gx.value = x
      gy.value = y
      gz.value = z
      tilt.value = Math.min(1, Math.sqrt(x * x + y * y + z * z) / 6)
    })

    return () => {
      accel.remove()
      gyro.remove()
    }
  }, [])

  return { ax, ay, az, gx, gy, gz, speed, tilt }
}
