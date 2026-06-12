// Simplified discrete Sobel over a coarse Y-plane sample grid.
// Returns edgeStrength [0..1] and edgeCount (fraction of grid cells above threshold).

const GRID = 24
const THRESHOLD = 0.12

export function detectEdges(frame) {
  'worklet'
  const buf = frame.toArrayBuffer()
  const data = new Uint8Array(buf)
  const W = frame.width
  const H = frame.height
  const stride = frame.bytesPerRow

  // Build brightness grid
  const grid = new Array(GRID * GRID)
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((gx / GRID) * W)
      const py = Math.floor((gy / GRID) * H)
      grid[gy * GRID + gx] = data[py * stride + px] / 255
    }
  }

  // Sobel approximation on the grid (skip border cells)
  let edgeSum = 0
  let edgeCount = 0
  const edgeCells = new Array(GRID * GRID).fill(0)

  for (let gy = 1; gy < GRID - 1; gy++) {
    for (let gx = 1; gx < GRID - 1; gx++) {
      const tl = grid[(gy - 1) * GRID + (gx - 1)]
      const tc = grid[(gy - 1) * GRID + gx]
      const tr = grid[(gy - 1) * GRID + (gx + 1)]
      const ml = grid[gy * GRID + (gx - 1)]
      const mr = grid[gy * GRID + (gx + 1)]
      const bl = grid[(gy + 1) * GRID + (gx - 1)]
      const bc = grid[(gy + 1) * GRID + gx]
      const br = grid[(gy + 1) * GRID + (gx + 1)]

      const gX = -tl - 2 * ml - bl + tr + 2 * mr + br
      const gY = -tl - 2 * tc - tr + bl + 2 * bc + br
      const mag = Math.sqrt(gX * gX + gY * gY) / 4

      edgeCells[gy * GRID + gx] = mag
      edgeSum += mag
      if (mag > THRESHOLD) edgeCount++
    }
  }

  const total = (GRID - 2) * (GRID - 2)
  return {
    edgeStrength: edgeSum / total,
    edgeDensity: edgeCount / total,
    cells: edgeCells,
  }
}
