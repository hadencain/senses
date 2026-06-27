// Run: node src/modes/bloom/dsp.test.cjs
// Loads ESM dsp.js via babel-preset-expo (configFile:false) so 'worklet'
// directives are harmless no-ops in Node. Mirrors larsen/rust/zero-beat/redaction.
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

// meanDelta: null prev => 0, identical => 0, global shift detected
ok('meanDelta null => 0', dsp.meanDelta([0.5, 0.5], null) === 0)
ok('meanDelta identical => 0', dsp.meanDelta([0.5, 0.5], [0.5, 0.5]) === 0)
ok('meanDelta global shift', near(dsp.meanDelta([0.7, 0.7], [0.5, 0.5]), 0.2))

// lightStep: stir lights, idle decays, clamps, strong stir snaps to full
ok('lightStep stir raises', dsp.lightStep(0, 0.5, 0.95, 8) > 0)
ok('lightStep decays when idle', dsp.lightStep(0.8, 0, 0.95, 8) < 0.8 && near(dsp.lightStep(0.8, 0, 0.95, 8), 0.76))
ok('lightStep takes brighter of decay vs stir', dsp.lightStep(0.5, 0.9, 0.95, 8) === 1)  // stir 7.2 clamps to 1
ok('lightStep clamps to 1', dsp.lightStep(1, 1, 0.99, 8) === 1)
ok('lightStep never negative', dsp.lightStep(0, -1, 0.95, 8) === 0)
ok('lightStep fade ~2s', (() => {
  // decay 0.95 ^ 60 frames (~2s @30fps) should be well faded
  let v = 1
  for (let i = 0; i < 60; i++) v = dsp.lightStep(v, 0, 0.95, 8)
  return v < 0.1
})())

// slider mappings monotonic + bounded
ok('fadeToDecay range', near(dsp.fadeToDecay(0), 0.90) && near(dsp.fadeToDecay(1), 0.99))
ok('fadeToDecay monotonic', dsp.fadeToDecay(1) > dsp.fadeToDecay(0))
ok('brightToGain range', near(dsp.brightToGain(0), 2) && near(dsp.brightToGain(1), 8))
ok('darkToAlpha range', near(dsp.darkToAlpha(0), 0.60) && near(dsp.darkToAlpha(1), 0.98))

// yToPitch: top of frame higher than bottom, bounded
ok('yToPitch top > bottom', dsp.yToPitch(0) > dsp.yToPitch(1))
ok('yToPitch endpoints', near(dsp.yToPitch(0), 2.0) && near(dsp.yToPitch(1), 0.5))

// meanArr / maxArr
ok('meanArr', near(dsp.meanArr([0, 0.5, 1]), 0.5))
ok('maxArr', dsp.maxArr([0.1, 0.9, 0.3]) === 0.9)
ok('meanArr empty => 0', dsp.meanArr([]) === 0)

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is Bloom', manifest.id === 'Bloom')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('all params sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
