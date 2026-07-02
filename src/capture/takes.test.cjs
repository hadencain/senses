// src/capture/takes.test.cjs
// Run: node src/capture/takes.test.cjs
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

const tk = loadESM('./takes.js')
let pass = 0
const ok = (n, c) => { assert.ok(c, n); pass++ }

ok('takeId combines time + effect', tk.takeId(1719500000000, 'Rust') === '1719500000000-Rust')

const p = tk.takePaths('file:///takes/', '1719500000000-Rust')
ok('dir', p.dir === 'file:///takes/1719500000000-Rust/')
ok('raw path', p.raw === 'file:///takes/1719500000000-Rust/raw.mp4')
ok('sidecar path', p.sidecar === 'file:///takes/1719500000000-Rust/sidecar.json')
ok('meta path', p.meta === 'file:///takes/1719500000000-Rust/meta.json')

const meta = tk.makeMeta({ id: 'a', effectId: 'Bloom', durationMs: 5000, createdAt: 10, width: 1920, height: 1080 })
ok('meta schema + rendered flag', meta.schema === 1 && meta.rendered === false)
ok('meta carries fields', meta.effectId === 'Bloom' && meta.width === 1920)

const sorted = tk.sortTakes([{ createdAt: 1 }, { createdAt: 3 }, { createdAt: 2 }])
ok('sort newest first', sorted[0].createdAt === 3 && sorted[2].createdAt === 1)
ok('sort non-mutating', (() => { const a = [{ createdAt: 1 }, { createdAt: 2 }]; tk.sortTakes(a); return a[0].createdAt === 1 })())

ok('formatDuration', tk.formatDuration(65000) === '1:05')
ok('formatDuration zero', tk.formatDuration(0) === '0:00')

// ---- metaAfterRender ----
const base = tk.makeMeta({ id: 'x', effectId: 'Rust', durationMs: 1000, createdAt: 5, width: 0, height: 0 })
const after = tk.metaAfterRender(base, { width: 1080, height: 1920, renderedWithVersion: 3, galleryUri: 'content://media/9', renderedAt: 77 })
ok('metaAfterRender sets dims', after.width === 1080 && after.height === 1920)
ok('metaAfterRender marks rendered', after.rendered === true && after.renderedAt === 77)
ok('metaAfterRender records version + uri', after.renderedWithVersion === 3 && after.galleryUri === 'content://media/9')
ok('metaAfterRender does not mutate', base.rendered === false && base.width === 0)
ok('metaAfterRender keeps identity', after.id === 'x' && after.effectId === 'Rust' && after.schema === 1)

console.log(`takes.test: ${pass} assertions passed`)
