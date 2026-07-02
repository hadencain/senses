// src/render/align.test.cjs
// Run: node src/render/align.test.cjs
const assert = require('node:assert')
const path = require('node:path')
const Module = require('node:module')
const { transformFileSync } = require('@babel/core')

function loadESM(rel) {
  const abs = path.join(__dirname, rel)
  const { code } = transformFileSync(abs, { configFile: false, babelrc: false, presets: ['babel-preset-expo'] })
  const m = new Module(abs, module)
  m.filename = abs
  m.paths = Module._nodeModulePaths(path.dirname(abs))
  m._compile(code, abs)
  return m.exports
}

const al = loadESM('./align.js')
let pass = 0
const ok = (n, c) => { assert.ok(c, n) ; pass++ }
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e

// Synthetic schema-2 sidecar: 30fps-ish, camera clock base 5e12 ns,
// JS clock offset +120ms over camera-ms, small per-sample jitter on t.
const BASE_NS = 5e12
const N = 20
const FRAME_US = 33_000
const features = [], motion = []
for (let i = 0; i < N; i++) {
  const pts = BASE_NS + i * FRAME_US * 1000
  const t = pts / 1e6 - BASE_NS / 1e6 + 120 + (i % 3) // jitter 0..2ms
  features.push({ t, pts, f: { idx: i } })
  motion.push({ t, pts, speed: i / N, tilt: 0, ax: 0, ay: 0 })
}
const sidecar2 = {
  schema: 2, effectId: 'Rust', effectVersion: 1,
  startParams: { heal: 0.3 }, durationMs: 800,
  params: [{ t: 120 + 5 * 33, key: 'heal', value: 0.9 }], // flipped at ~frame 5
  motion, features,
}

// ---- exact mode: video PTS on the same (camera) clock ----
// recording started at camera frame 3, 10 frames long
const sameClockPts = Array.from({ length: 10 }, (_, k) => (BASE_NS / 1000) + (3 + k) * FRAME_US)
{
  const { mode, frames } = al.buildFrameLookup(sidecar2, { videoPtsUs: sameClockPts })
  ok('exact mode detected', mode === 'exact')
  ok('exact: one entry per video frame', frames.length === 10)
  ok('exact: frame k maps to feature 3+k', frames.every((e, k) => e.featureIdx === 3 + k))
  ok('exact: motion follows features', frames.every((e, k) => e.motionIdx === 3 + k))
  // params: tJsMs ≈ camera-ms-from-start + 120ms offset (jitter median = 1)
  ok('exact: param flip lands at frame 5', (() => {
    const before = frames[1], after = frames[7]
    const fold = (t) => (t >= 120 + 5 * 33)
    return !fold(before.tJsMs) && fold(after.tJsMs)
  })())
}

// ---- anchored mode: muxer rebased video PTS to 0 ----
{
  const rebased = sameClockPts.map(p => p - sameClockPts[0])
  const { mode, frames } = al.buildFrameLookup(sidecar2, { videoPtsUs: rebased })
  ok('anchored mode detected', mode === 'anchored')
  // anchor: last video frame ↔ last logged feature ⇒ frame k → feature (N-1) - (9-k) = 10+k
  ok('anchored: ≤1 frame from truth', frames.every((e, k) => Math.abs(e.featureIdx - (10 + k)) <= 1))
  ok('anchored: monotonic feature indices', frames.every((e, k) => k === 0 || e.featureIdx >= frames[k - 1].featureIdx))
}

// ---- heuristic: schema-1 sidecar (no pts) ----
{
  const s1 = { schema: 1, startParams: {}, durationMs: 500, params: [], motion: [{ t: 0, speed: 0 }], features: [{ t: 0, f: {} }] }
  const vid = [0, 33_000, 66_000, 99_000] // 99ms video, sidecar 500ms ⇒ offset 401ms
  const { mode, frames } = al.buildFrameLookup(s1, { videoPtsUs: vid })
  ok('heuristic mode for schema 1', mode === 'heuristic')
  ok('heuristic: null indices', frames.every(e => e.featureIdx === null && e.motionIdx === null))
  ok('heuristic: offset = durationMs - videoDurMs', near(frames[0].tJsMs, 500 - 99) && near(frames[3].tJsMs, 500 - 99 + 99))
}

// ---- schema 2 recorded without pts (defensive) → heuristic ----
{
  const s2NoPts = { ...sidecar2, features: sidecar2.features.map(({ pts, ...r }) => r) }
  ok('schema2 minus pts degrades to heuristic', al.buildFrameLookup(s2NoPts, { videoPtsUs: sameClockPts }).mode === 'heuristic')
}

// ---- edges ----
ok('empty video → empty', al.buildFrameLookup(sidecar2, { videoPtsUs: [] }).mode === 'empty')
ok('single feature sample still maps', (() => {
  const one = { ...sidecar2, features: [features[0]], motion: [motion[0]] }
  const { frames } = al.buildFrameLookup(one, { videoPtsUs: sameClockPts })
  return frames.every(e => e.featureIdx === 0)
})())

console.log(`align.test: ${pass} assertions passed`)
