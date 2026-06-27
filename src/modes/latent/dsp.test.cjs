// Run: node src/modes/latent/dsp.test.cjs
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
let pass = 0
const ok = (name, cond) => { assert.ok(cond, name); pass++ }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// lerp / clamps
ok('lerp endpoints', dsp.lerp(0, 10, 0) === 0 && dsp.lerp(0, 10, 1) === 10)
ok('clamp01', dsp.clamp01(-1) === 0 && dsp.clamp01(2) === 1)
ok('clampSigned', dsp.clampSigned(-3) === -1 && dsp.clampSigned(3) === 1 && dsp.clampSigned(0.4) === 0.4)

// emaStep: moves toward cur, converges
ok('emaStep moves toward cur', dsp.emaStep(0, 1, 0.5) === 0.5)
ok('emaStep converges', (() => {
  let v = 0
  for (let i = 0; i < 2000; i++) v = dsp.emaStep(v, 0.7, 0.01)
  return near(v, 0.7, 1e-3)
})())

// deviation: sign + clamp. fast above plate => positive (silver), below => brown
ok('deviation positive when fast > slow', dsp.deviation(0.6, 0.5, 6) > 0)
ok('deviation negative when fast < slow', dsp.deviation(0.4, 0.5, 6) < 0)
ok('deviation zero at equal', dsp.deviation(0.5, 0.5, 6) === 0)
ok('deviation clamps to [-1,1]', dsp.deviation(1, 0, 10) === 1 && dsp.deviation(0, 1, 10) === -1)

// plate behavior sketch: a placed object flares then fades as the plate catches up
ok('plate develops out a placed object', (() => {
  // object appears: cur jumps 0.3 -> 0.6, fast tracks quickly, slow lags then catches up
  let fast = 0.3, slow = 0.3
  const cur = 0.6
  const a = dsp.developToAlpha(0.5)
  let firstDev = null, lastDev = null
  for (let i = 0; i < 4000; i++) {
    fast = dsp.emaStep(fast, cur, 0.3)
    slow = dsp.emaStep(slow, cur, a)
    const d = dsp.deviation(fast, slow, 6)
    if (i === 5) firstDev = d
    lastDev = d
  }
  return firstDev > 0.2 && Math.abs(lastDev) < 0.05   // flares, then sinks into plate
})())

// slider mappings monotonic + bounded
ok('developToAlpha range', near(dsp.developToAlpha(0), 0.001) && near(dsp.developToAlpha(1), 0.01))
ok('developToAlpha monotonic', dsp.developToAlpha(1) > dsp.developToAlpha(0))
ok('contrastToGain range', near(dsp.contrastToGain(0), 2) && near(dsp.contrastToGain(1), 10))

// yToBufferFrac: top of frame recent (1), bottom oldest (0)
ok('yToBufferFrac top recent', near(dsp.yToBufferFrac(0), 1))
ok('yToBufferFrac bottom old', near(dsp.yToBufferFrac(1), 0))

// meanAbs / peakAbs handle signed input
ok('meanAbs signed', near(dsp.meanAbs([-0.5, 0.5, -1, 1]), 0.75))
ok('peakAbs signed', dsp.peakAbs([-0.9, 0.3, -0.2]) === 0.9)
ok('meanAbs empty => 0', dsp.meanAbs([]) === 0)

// --- manifest ---
const { manifest } = loadESM('./manifest.js')
const { validateManifest } = loadESM('../validate.js')
ok('manifest validates clean', validateManifest(manifest).length === 0)
ok('manifest id is Latent', manifest.id === 'Latent')
ok('overlay <= 4 keys', Array.isArray(manifest.overlay) && manifest.overlay.length <= 4)
ok('all params sane defaults',
  manifest.params.every(p => p.default >= p.min && p.default <= p.max))

console.log(`dsp.test: ${pass} assertions passed`)
