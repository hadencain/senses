// src/render/align.js
// Pure sidecar↔video alignment for the offline compositor. No RN deps; Node-tested.
// Units: video PTS µs (from senses-render probe); sidecar `t` ms (JS clock);
// sidecar `pts` ns (camera clock, frame.timestamp).
//
// Three regimes:
//  exact     — schema-2 sidecar AND muxed PTS share the camera clock: direct match.
//  anchored  — schema-2 but muxer rebased PTS to ~0: anchor the video's END to the
//              last logged feature frame; residual error ≤1 frame, global shift only.
//  heuristic — schema-1 (or pts missing): offset = sidecar durationMs − video
//              duration; per-frame lookup degrades to nearest-by-t via replayAt.

const SAME_CLOCK_SLACK_US = 10_000_000 // 10 s

function median(xs) {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function hasCameraPts(samples) {
  return samples.length > 0 && samples.every(x => typeof x.pts === 'number' && Number.isFinite(x.pts))
}

// Nearest index in ascending sampleUs for each ascending query — O(n+m).
function nearestIndices(sampleUs, queriesUs) {
  const out = new Array(queriesUs.length)
  let j = 0
  for (let k = 0; k < queriesUs.length; k++) {
    const q = queriesUs[k]
    while (j + 1 < sampleUs.length && Math.abs(sampleUs[j + 1] - q) <= Math.abs(sampleUs[j] - q)) j++
    out[k] = j
  }
  return out
}

export function buildFrameLookup(sidecar, probe) {
  const videoPtsUs = probe?.videoPtsUs ?? []
  if (videoPtsUs.length === 0) return { mode: 'empty', frames: [] }
  const videoDurUs = videoPtsUs[videoPtsUs.length - 1] - videoPtsUs[0]

  const feats = sidecar.features ?? []
  const motions = sidecar.motion ?? []
  const exactCapable = (sidecar.schema ?? 1) >= 2 && hasCameraPts(feats)

  if (!exactCapable) {
    const offsetMs = (sidecar.durationMs ?? 0) - videoDurUs / 1000
    const frames = videoPtsUs.map(p => ({
      featureIdx: null,
      motionIdx: null,
      tJsMs: (p - videoPtsUs[0]) / 1000 + offsetMs,
    }))
    return { mode: 'heuristic', frames }
  }

  const featUs = feats.map(x => x.pts / 1000)
  const sameClock =
    videoPtsUs[0] >= featUs[0] - SAME_CLOCK_SLACK_US &&
    videoPtsUs[0] <= featUs[featUs.length - 1] + SAME_CLOCK_SLACK_US
  // Rebased: place the video so its last frame coincides with the last logged frame.
  const baseUs = sameClock ? 0 : featUs[featUs.length - 1] - videoDurUs - videoPtsUs[0]
  const camUs = videoPtsUs.map(p => p + baseUs)

  // Camera→JS clock offset (features carry both clocks) — maps params.
  const offMs = median(feats.map(x => x.t - x.pts / 1e6))

  const fIdx = nearestIndices(featUs, camUs)
  const motUs = hasCameraPts(motions) ? motions.map(x => x.pts / 1000) : null
  const mIdx = motUs ? nearestIndices(motUs, camUs) : null
  const frames = camUs.map((c, k) => ({
    featureIdx: fIdx[k],
    motionIdx: mIdx ? mIdx[k] : (motions.length ? Math.min(fIdx[k], motions.length - 1) : -1),
    tJsMs: c / 1000 + offMs,
  }))
  return { mode: sameClock ? 'exact' : 'anchored', frames }
}
