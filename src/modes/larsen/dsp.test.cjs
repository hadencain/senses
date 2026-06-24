// Run: node src/modes/larsen/dsp.test.cjs
// Loads the ESM dsp.js via babel-preset-expo (configFile:false bypasses the
// worklet/reanimated plugins so 'worklet' directives are harmless no-ops in Node).
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
const ok = (name, cond) => { assert.ok(cond, name); pass++; }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// lerp / emaStep
ok('lerp endpoints', dsp.lerp(0, 10, 0) === 0 && dsp.lerp(0, 10, 1) === 10)
ok('emaStep moves toward next', dsp.emaStep(0, 1, 0.5) === 0.5)

// computeMotion
ok('motion: null prev => 0', dsp.computeMotion([0.5, 0.5], null) === 0)
ok('motion: identical => 0', dsp.computeMotion([0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]) === 0)
ok('motion: global shift => ~0 (exposure immunity)',
  near(dsp.computeMotion([0.7, 0.7, 0.7, 0.7], [0.5, 0.5, 0.5, 0.5]), 0, 1e-9))
ok('motion: local change => > 0',
  dsp.computeMotion([0.9, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]) > 0)

// mappings
ok('mapSensitivity monotonic', dsp.mapSensitivity(0) === 0.04 && dsp.mapSensitivity(1) === 0.005)
ok('mapBuildSeconds monotonic', dsp.mapBuildSeconds(0) === 12 && dsp.mapBuildSeconds(1) === 1.5)

// updateGain: builds below threshold, slams above, clamps
ok('gain builds when still',
  dsp.updateGain(0, 0.0, 1.0, 0.5, 1) > 0)            // dt 1s, fast build
ok('gain slams when moving',
  dsp.updateGain(0.5, 0.5, 0.1, 0.5, 0.4) < 0.5)      // motion >> threshold
ok('gain clamps to 1', dsp.updateGain(0.99, 0.0, 100, 0.5, 1) === 1)
ok('gain clamps to 0', dsp.updateGain(0.01, 1.0, 100, 0.5, 1) === 0)

// gainToMaster: clamps to ceiling and to 0.6 absolute
ok('master = ceiling*gain', near(dsp.gainToMaster(0.5, 0.4), 0.2))
ok('master capped at ceiling', dsp.gainToMaster(1, 0.35) === 0.35)
ok('master capped at 0.6 absolute', dsp.gainToMaster(1, 0.9) === 0.6)
ok('master 0 at gain 0', dsp.gainToMaster(0, 0.5) === 0)

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is Larsen', manifest.id === 'Larsen')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('ceiling param max <= 0.6', manifest.params.find(p => p.key === 'ceiling').max <= 0.6)
ok('all params have sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
