// Run: node src/modes/redaction/dsp.test.cjs
// Loads ESM dsp.js via babel-preset-expo (configFile:false) so 'worklet'
// directives are harmless no-ops in Node. Mirrors larsen/rust/zero-beat tests.
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

// meanDelta: null prev => 0, global shift detected, identical => 0
ok('meanDelta null => 0', dsp.meanDelta([0.5, 0.5], null) === 0)
ok('meanDelta identical => 0', dsp.meanDelta([0.5, 0.5], [0.5, 0.5]) === 0)
ok('meanDelta global shift', near(dsp.meanDelta([0.7, 0.7], [0.5, 0.5]), 0.2))

// pressureStep: attack raises, leak lowers, clamps to 1, never negative
ok('pressure attack raises', dsp.pressureStep(0, 0.2, 6, 0.01) > 0)
ok('pressure leaks when idle', dsp.pressureStep(0.5, 0, 6, 0.03) < 0.5)
ok('pressure clamps to 1', dsp.pressureStep(0.9, 1, 10, 0.01) === 1)
ok('pressure never negative', dsp.pressureStep(0, -1, 6, 0.01) === 0)
ok('attack >> heal asymmetry', (() => {
  // one frame of strong motion adds far more than one frame of idle removes
  const up = dsp.pressureStep(0.3, 0.2, 6, 0.01) - 0.3
  const down = 0.3 - dsp.pressureStep(0.3, 0, 6, 0.01)
  return up > down * 10
})())

// meanArr / maxArr
ok('meanArr', near(dsp.meanArr([0, 0.5, 1]), 0.5))
ok('maxArr', dsp.maxArr([0.1, 0.9, 0.3]) === 0.9)
ok('meanArr empty => 0', dsp.meanArr([]) === 0)

// slider mappings monotonic + bounded
ok('sensToAttack range', near(dsp.sensToAttack(0), 2) && near(dsp.sensToAttack(1), 10))
ok('sensToAttack monotonic', dsp.sensToAttack(1) > dsp.sensToAttack(0))
ok('healToLeak range', near(dsp.healToLeak(0), 0.003) && near(dsp.healToLeak(1), 0.03))
ok('healToLeak monotonic', dsp.healToLeak(1) > dsp.healToLeak(0))

// detuneTriple: base and ±grind
ok('detuneTriple', (() => {
  const [a, b, c] = dsp.detuneTriple(90, 15)
  return a === 90 && b === 105 && c === 75
})())

// gateGain: silent at 0 coverage, scales, clamps
ok('gate silent at 0', dsp.gateGain(0.4, 0) === 0)
ok('gate scales', near(dsp.gateGain(0.4, 0.5), 0.2))
ok('gate clamps to 1', dsp.gateGain(2, 1) === 1)

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is Redaction', manifest.id === 'Redaction')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('all params sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
