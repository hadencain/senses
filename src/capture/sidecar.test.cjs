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

ok('schema + ids', s.schema === 1 && s.effectId === 'Rust' && s.effectVersion === 1)
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

console.log(`sidecar.test: ${pass} assertions passed`)
