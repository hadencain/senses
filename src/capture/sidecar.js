// src/capture/sidecar.js
// Pure capture timeline + deterministic replay. No RN deps; Node-tested.
// All timestamps `t` are elapsed milliseconds from record start.

function round4(v) {
  return Math.round(v * 10000) / 10000
}

// Round numbers + arrays-of-numbers + flat objects-of-numbers to 4dp to shrink
// the serialized feature stream. Arrays of arrays are handled one level deep.
export function compactFeatures(f) {
  if (f == null) return f
  const out = {}
  for (const k in f) {
    const v = f[k]
    if (typeof v === 'number') out[k] = round4(v)
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'number' ? round4(x) : x))
    else out[k] = v
  }
  return out
}

export function createSidecar(effectId, effectVersion, startParams) {
  const params = []
  const motion = []
  const features = []
  return {
    logParam(t, key, value) { params.push({ t, key, value }) },
    logMotion(t, m) {
      motion.push({ t, speed: round4(m.speed ?? 0), tilt: round4(m.tilt ?? 0), ax: round4(m.ax ?? 0), ay: round4(m.ay ?? 0) })
    },
    logFeatures(t, f) { features.push({ t, f: compactFeatures(f) }) },
    serialize(durationMs) {
      return { schema: 1, effectId, effectVersion, startParams: { ...startParams }, durationMs, params, motion, features }
    },
  }
}

export function foldParams(startParams, paramEvents, t) {
  const out = { ...startParams }
  for (let i = 0; i < paramEvents.length; i++) {
    const e = paramEvents[i]
    if (e.t <= t) out[e.key] = e.value
  }
  return out
}

export function nearestByT(arr, t) {
  if (!arr || arr.length === 0) return null
  let best = arr[0]
  let bestD = Math.abs(arr[0].t - t)
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(arr[i].t - t)
    if (d < bestD) { bestD = d; best = arr[i] }
  }
  return best
}

export function replayAt(sidecar, t) {
  const params = foldParams(sidecar.startParams, sidecar.params, t)
  const mSample = nearestByT(sidecar.motion, t)
  const fSample = nearestByT(sidecar.features, t)
  return {
    params,
    motion: mSample ? { speed: mSample.speed, tilt: mSample.tilt, ax: mSample.ax, ay: mSample.ay } : { speed: 0, tilt: 0.5, ax: 0, ay: 0 },
    features: fSample ? fSample.f : null,
  }
}
