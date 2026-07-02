// src/capture/sidecar.test.cjs
// Run: node src/capture/sidecar.test.cjs
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

const sc = loadESM('./sidecar.js')
let pass = 0
const ok = (n, c) => { assert.ok(c, n); pass++ }
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e

// build + serialize
const rec = sc.createSidecar('Rust', 1, { heal: 0.3, bite: 0.5 })
rec.logParam(100, 'heal', 0.6)
rec.logMotion(0, { speed: 0.1, tilt: 0.5, ax: 0, ay: 0 })
rec.logMotion(50, { speed: 0.9, tilt: 0.4, ax: 0.1, ay: -0.2 })
rec.logFeatures(0, { rustSum: 0.123456789, rust: [0.111111, 0.999999] })
rec.logFeatures(50, { rustSum: 0.5, rust: [0.2, 0.4] })
const s = rec.serialize(1000)

ok('schema + ids', s.schema === 2 && s.effectId === 'Rust' && s.effectVersion === 1)
ok('startParams preserved', s.startParams.heal === 0.3)
ok('duration', s.durationMs === 1000)
ok('params logged', s.params.length === 1 && s.params[0].key === 'heal')
ok('features rounded to 4dp', s.features[0].f.rustSum === 0.1235 && s.features[0].f.rust[0] === 0.1111)

// foldParams: applies changes with t<=query, ignores later
ok('fold before change', sc.foldParams({ heal: 0.3 }, [{ t: 100, key: 'heal', value: 0.6 }], 50).heal === 0.3)
ok('fold after change', sc.foldParams({ heal: 0.3 }, [{ t: 100, key: 'heal', value: 0.6 }], 150).heal === 0.6)
ok('fold does not mutate start', (() => { const sp = { heal: 0.3 }; sc.foldParams(sp, [{ t: 0, key: 'heal', value: 0.9 }], 10); return sp.heal === 0.3 })())

// nearestByT
ok('nearest picks closest', sc.nearestByT([{ t: 0 }, { t: 100 }], 60).t === 100)
ok('nearest empty => null', sc.nearestByT([], 10) === null)

// replayAt integrates all three
const r = sc.replayAt(s, 60)
ok('replay params folded', r.params.heal === 0.3)   // change is at t=100, query 60
ok('replay motion nearest', r.motion.speed === 0.9) // sample at t=50 closest to 60
ok('replay features nearest', near(r.features.rustSum, 0.5))

// full round-trip: distinct effectId, two param changes, two motion+feature samples
// query at t=250 → gain folded (logged at 200), freq not yet (logged at 400),
// motion+features both nearest t=300 (dist=50) over t=10 (dist=240)
ok('round-trip: params+motion+features at known t', (() => {
  const rec2 = sc.createSidecar('Larsen', 2, { gain: 0.4, freq: 0.7 })
  rec2.logParam(200, 'gain', 0.8)
  rec2.logParam(400, 'freq', 0.2)
  rec2.logMotion(10,  { speed: 0.2, tilt: 0.1, ax: 0.3,  ay: -0.1 })
  rec2.logMotion(300, { speed: 0.5, tilt: 0.6, ax: -0.2, ay: 0.4  })
  rec2.logFeatures(10,  { brightness: 0.3 })
  rec2.logFeatures(300, { brightness: 0.9 })
  const s2 = rec2.serialize(500)
  const r2 = sc.replayAt(s2, 250)
  return r2.params.gain === 0.8 && r2.params.freq === 0.7 &&
         near(r2.motion.speed, 0.5) && near(r2.motion.tilt, 0.6) &&
         near(r2.features.brightness, 0.9)
})())

// ---- schema 2: pts plumbed through, schema bumped ----
const rec3 = sc.createSidecar('Rust', 1, { heal: 0.3 })
rec3.logFeatures(0, { rustSum: 0.1 }, 1_000_000_000)
rec3.logMotion(0, { speed: 0.1, tilt: 0, ax: 0, ay: 0 }, 1_000_000_000)
rec3.logFeatures(33, { rustSum: 0.2 }, 1_033_000_000)
rec3.logMotion(33, { speed: 0.9, tilt: 0, ax: 0, ay: 0 }, 1_033_000_000)
const s3 = rec3.serialize(66)
ok('schema is 2', s3.schema === 2)
ok('feature pts stored', s3.features[0].pts === 1_000_000_000 && s3.features[1].pts === 1_033_000_000)
ok('motion pts stored', s3.motion[1].pts === 1_033_000_000)
ok('pts omitted when not given', !('pts' in sc.createSidecar('x', 1, {}).serialize(0)) && (() => {
  const r = sc.createSidecar('x', 1, {}); r.logFeatures(0, { a: 1 }); return !('pts' in r.serialize(0).features[0])
})())

// ---- replayFrame: direct index lookup ----
rec3.logParam(20, 'heal', 0.9)
const s4 = rec3.serialize(66)
const rf = sc.replayFrame(s4, { featureIdx: 1, motionIdx: 1, tJsMs: 33 })
ok('replayFrame picks indexed feature', near(rf.features.rustSum, 0.2))
ok('replayFrame picks indexed motion', near(rf.motion.speed, 0.9))
ok('replayFrame folds params at tJsMs', rf.params.heal === 0.9)
ok('replayFrame folds params before change', sc.replayFrame(s4, { featureIdx: 0, motionIdx: 0, tJsMs: 10 }).params.heal === 0.3)

// ---- replayFrame fallback: null index → replayAt semantics ----
const rfb = sc.replayFrame(s4, { featureIdx: null, motionIdx: null, tJsMs: 33 })
ok('replayFrame null-idx falls back to nearest-by-t', near(rfb.features.rustSum, 0.2) && near(rfb.motion.speed, 0.9))
ok('replayFrame -1 idx falls back too', near(sc.replayFrame(s4, { featureIdx: -1, motionIdx: -1, tJsMs: 33 }).features.rustSum, 0.2))

console.log(`sidecar.test: ${pass} assertions passed`)
