// Run: node src/modes/zero-beat/dsp.test.cjs
// Loads ESM dsp.js via babel-preset-expo (configFile:false) so 'worklet'
// directives are harmless no-ops in Node. Mirrors larsen/rust dsp tests.
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
ok('clamp01', dsp.clamp01(-1) === 0 && dsp.clamp01(2) === 1 && dsp.clamp01(0.3) === 0.3)

// splitLR: build a 4x4 grid, left columns 0.2, right columns 0.8
const g = []
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.push(x < 2 ? 0.2 : 0.8)
const [L, R] = dsp.splitLR(g, 4)
ok('splitLR left mean', near(L, 0.2))
ok('splitLR right mean', near(R, 0.8))
ok('splitLR balanced => equal', (() => {
  const f = new Array(16).fill(0.5)
  const [l, r] = dsp.splitLR(f, 4)
  return near(l, 0.5) && near(r, 0.5)
})())

// beatHz: zero at balance, magnitude only, scales with range
ok('beatHz 0 at diff 0', dsp.beatHz(0, 12) === 0)
ok('beatHz magnitude', dsp.beatHz(-0.5, 12) === 6 && dsp.beatHz(0.5, 12) === 6)
ok('beatHz scales with range', dsp.beatHz(0.5, 30) > dsp.beatHz(0.5, 12))

// detuneFreq: unison at diff 0, signed offset otherwise
ok('detune unison at 0', dsp.detuneFreq(220, 0, 12) === 220)
ok('detune sign', dsp.detuneFreq(220, 0.5, 12) === 226 && dsp.detuneFreq(220, -0.5, 12) === 214)

// advancePhase: stays in [0, 2π), frozen at hz 0, advances otherwise
ok('phase frozen at hz 0', dsp.advancePhase(1.0, 0, 0.033) === 1.0)
ok('phase advances', dsp.advancePhase(0, 1, 0.1) > 0)
ok('phase wraps', (() => {
  let p = 0
  for (let i = 0; i < 1000; i++) p = dsp.advancePhase(p, 5, 0.033)
  return p >= 0 && p < dsp.TWO_PI
})())

// lockThreshFromParam: monotonic, bounded
ok('lockThresh range', near(dsp.lockThreshFromParam(0), 0.01) && near(dsp.lockThreshFromParam(1), 0.08))
ok('lockThresh monotonic', dsp.lockThreshFromParam(1) > dsp.lockThreshFromParam(0))

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is ZeroBeat (PascalCase nav key)', manifest.id === 'ZeroBeat')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('all params sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
