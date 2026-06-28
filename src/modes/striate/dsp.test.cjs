// Run: node src/modes/striate/dsp.test.cjs
// Loads ESM dsp.js via babel-preset-expo (configFile:false) so 'worklet'
// directives are harmless no-ops in Node. Mirrors the other modes' dsp tests.
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
const PI = Math.PI
let pass = 0
const ok = (name, cond) => { assert.ok(cond, name); pass++ }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// lerp / clamp / ema
ok('lerp endpoints', dsp.lerp(0, 10, 0) === 0 && dsp.lerp(0, 10, 1) === 10)
ok('clamp01', dsp.clamp01(-1) === 0 && dsp.clamp01(2) === 1)
ok('emaStep', dsp.emaStep(0, 1, 0.5) === 0.5)

// binOf: range + wrap
ok('binOf 0 => 0', dsp.binOf(0, 8) === 0)
ok('binOf just under PI => last', dsp.binOf(PI - 1e-6, 8) === 7)
ok('binOf wraps PI -> 0', dsp.binOf(PI, 8) === 0)
ok('binOf negative wraps', dsp.binOf(-0.01, 8) === 7)

// bucketCenter
ok('bucketCenter 0', near(dsp.bucketCenter(0, 8), 0.5 * PI / 8))
ok('bucketCenter in range', dsp.bucketCenter(7, 8) < PI && dsp.bucketCenter(7, 8) > 0)

// histEntropyNorm: uniform -> 1, single spike -> 0, empty -> 1 (noise)
ok('entropy uniform => 1', near(dsp.histEntropyNorm([1, 1, 1, 1, 1, 1, 1, 1]), 1, 1e-9))
ok('entropy spike => 0', dsp.histEntropyNorm([0, 0, 5, 0, 0, 0, 0, 0]) === 0)
ok('entropy empty => 1', dsp.histEntropyNorm([0, 0, 0, 0, 0, 0, 0, 0]) === 1)
ok('entropy two-peak between', (() => {
  const e = dsp.histEntropyNorm([5, 0, 0, 0, 5, 0, 0, 0])
  return e > 0 && e < 1
})())

// mappings monotonic + bounded
ok('floorToThresh range', near(dsp.floorToThresh(0), 0.02) && near(dsp.floorToThresh(1), 0.2))
ok('smoothToAlpha higher smooth = lower alpha', dsp.smoothToAlpha(1) < dsp.smoothToAlpha(0))
ok('angleToPitch endpoints', near(dsp.angleToPitch(0), 110) && near(dsp.angleToPitch(PI - 1e-9), 220, 1e-3))

// detuneAt: center osc 0 offset, symmetric, zero at entropy 0
ok('detune center is 0', dsp.detuneAt(2, 30, 1) === 0)
ok('detune symmetric', dsp.detuneAt(0, 30, 1) === -dsp.detuneAt(4, 30, 1))
ok('detune zero at entropy 0', dsp.detuneAt(0, 30, 0) === 0)
ok('detune full spread', dsp.detuneAt(4, 30, 1) === 30 && dsp.detuneAt(0, 30, 1) === -30)

// parabolicDelta: centered -> 0, skew -> signed toward higher side
ok('parabolic centered => 0', dsp.parabolicDelta(1, 2, 1) === 0)
ok('parabolic skew right', dsp.parabolicDelta(1, 2, 1.5) > 0)
ok('parabolic skew left', dsp.parabolicDelta(1.5, 2, 1) < 0)
ok('parabolic flat denom => 0', dsp.parabolicDelta(2, 2, 2) === 0)

// topPeaks: single broad peak => 1, two separated => 2, frac excludes weak
ok('topPeaks single broad => 1', (() => {
  // a broad bump over buckets 3-4-5 has one local max
  const p = dsp.topPeaks([0, 0, 1, 3, 4, 3, 1, 0], 3, 0.5)
  return p.length === 1 && p[0] === 4
})())
ok('topPeaks two separated => 2', (() => {
  const p = dsp.topPeaks([5, 0, 0, 0, 5, 0, 0, 0], 3, 0.5)
  return p.length === 2
})())
ok('topPeaks excludes below frac', (() => {
  // second peak only 0.2*max -> excluded at frac 0.5
  const p = dsp.topPeaks([10, 0, 0, 0, 2, 0, 0, 0], 3, 0.5)
  return p.length === 1 && p[0] === 0
})())
ok('topPeaks empty hist => []', dsp.topPeaks([0, 0, 0, 0, 0, 0, 0, 0], 3, 0.5).length === 0)

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is Striate', manifest.id === 'Striate')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('all params sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
