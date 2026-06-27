// Run: node src/modes/rust/dsp.test.cjs
// Mirrors larsen/dsp.test.cjs — loads the ESM dsp.js via babel-preset-expo with
// configFile:false so the 'worklet' directives become harmless no-ops in Node.
const assert = require('node:assert')
const path = require('node:path')
const Module = require('node:module')
const { transformFileSync } = require('@babel/core')

function loadESM(rel) {
  const abs = path.join(__dirname, rel)
  const { code } = transformFileSync(abs, {
    configFile: false, babelrc: false, presets: ['babel-preset-expo'],
  })
  const m = new Module(abs, module)
  m.filename = abs
  m.paths = Module._nodeModulePaths(path.dirname(abs))
  m._compile(code, abs)
  return m.exports
}

const dsp = loadESM('./dsp.js')
let pass = 0
const ok = (name, cond) => { assert.ok(cond, name); pass++ }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// lerp / clamp
ok('lerp endpoints', dsp.lerp(0, 10, 0) === 0 && dsp.lerp(0, 10, 1) === 10)
ok('lerp clamps t', dsp.lerp(0, 10, -1) === 0 && dsp.lerp(0, 10, 2) === 10)
ok('clamp01', dsp.clamp01(-1) === 0 && dsp.clamp01(2) === 1 && dsp.clamp01(0.4) === 0.4)

// accumStep: adds activity, leaks, never negative, converges to activity/leak
ok('accum adds', dsp.accumStep(0, 0.1, 0.0002) > 0)
ok('accum leaks toward equilibrium', (() => {
  let a = 0
  for (let i = 0; i < 100000; i++) a = dsp.accumStep(a, 0.05, 0.0002)
  return near(a, 0.05 / 0.0002, 5)   // equilibrium = activity/leak = 250
})())
ok('accum decays to ~0 when idle', (() => {
  let a = 250
  for (let i = 0; i < 100000; i++) a = dsp.accumStep(a, 0, 0.0002)
  return a < 1
})())
ok('accum never negative', dsp.accumStep(0, -5, 0.0002) === 0)

// oxidize: 0 at 0, monotonic, bounded <1, more accumulation = more rust
ok('oxidize 0 => 0', dsp.oxidize(0, 0.012) === 0)
ok('oxidize bounded', dsp.oxidize(1e6, 0.012) <= 1 && dsp.oxidize(1e6, 0.012) > 0.99)
ok('oxidize monotonic', dsp.oxidize(250, 0.012) > dsp.oxidize(10, 0.012))

// slider mappings monotonic + bounded
ok('healToLeak range', near(dsp.healToLeak(0), 0.00005) && near(dsp.healToLeak(1), 0.001))
ok('healToLeak monotonic', dsp.healToLeak(1) > dsp.healToLeak(0))
ok('biteToK range', near(dsp.biteToK(0), 0.006) && near(dsp.biteToK(1), 0.02))

// edgeMagAt: flat field => 0, edge => > 0
ok('edge flat => 0', (() => {
  const g = new Array(16).fill(0.5)
  return dsp.edgeMagAt(g, 1, 1, 4) === 0
})())
ok('edge step => > 0', (() => {
  // 4x4: left columns 0, right columns 1 -> vertical edge
  const g = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.push(x < 2 ? 0 : 1)
  return dsp.edgeMagAt(g, 1, 1, 4) > 0
})())

// meanArr / maxArr
ok('meanArr', near(dsp.meanArr([0, 0.5, 1]), 0.5))
ok('maxArr', dsp.maxArr([0.1, 0.9, 0.3]) === 0.9)
ok('meanArr empty => 0', dsp.meanArr([]) === 0)

// sagFreq: sinks with rust, never below half base, base at zero rust
ok('sag at 0 rust = base', dsp.sagFreq(110, 0, 1) === 110)
ok('sag drops with rust', dsp.sagFreq(110, 1, 1) < 110)
ok('sag floor = half base', near(dsp.sagFreq(110, 1, 1), 55))
ok('sag scales with depth', dsp.sagFreq(110, 1, 0.5) > dsp.sagFreq(110, 1, 1))

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is Rust', manifest.id === 'Rust')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('all params have sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
