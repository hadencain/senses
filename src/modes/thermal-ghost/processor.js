// Frame differencing on Y plane at coarse grid.
// Compares current brightness samples to a rolling previous snapshot.
// Returns motionMap: flat array [0..1] of motion magnitude per cell,
// and totalMotion [0..1].

const GRID = 28

// Previous frame stored as a shared array in worklet context.
// Worklets share memory via _prevSnapshot stored on the module-level closure.
// This won't work directly across worklet instantiations — caller must pass prevRef.

export function diffFrames(frame, prevSnapshot) {
  'worklet'
  const buf = frame.toArrayBuffer()
  const data = new Uint8Array(buf)
  const W = frame.width
  const H = frame.height
  const stride = frame.bytesPerRow

  const N = GRID * GRID
  const current = new Array(N)
  const motionMap = new Array(N)
  let totalMotion = 0

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((gx / GRID) * W)
      const py = Math.floor((gy / GRID) * H)
      const y = data[py * stride + px] / 255
      const idx = gy * GRID + gx
      current[idx] = y

      const diff = prevSnapshot.length ? Math.abs(y - prevSnapshot[idx]) : 0
      motionMap[idx] = diff
      totalMotion += diff
    }
  }

  return {
    current,
    motionMap,
    totalMotion: totalMotion / N,
  }
}

export const DIFF_GRID = GRID
