import * as FileSystem from 'expo-file-system'
import { takePaths, makeMeta, sortTakes } from './takes'

export const TAKES_ROOT = `${FileSystem.documentDirectory}takes/`

async function ensureRoot() {
  const info = await FileSystem.getInfoAsync(TAKES_ROOT)
  if (!info.exists) await FileSystem.makeDirectoryAsync(TAKES_ROOT, { intermediates: true })
}

export async function saveTake({ id, effectId, rawTempUri, sidecar, durationMs, createdAt, width, height }) {
  await ensureRoot()
  const p = takePaths(TAKES_ROOT, id)
  await FileSystem.makeDirectoryAsync(p.dir, { intermediates: true })
  await FileSystem.moveAsync({ from: rawTempUri, to: p.raw })
  await FileSystem.writeAsStringAsync(p.sidecar, JSON.stringify(sidecar))
  const meta = makeMeta({ id, effectId, durationMs, createdAt, width, height })
  await FileSystem.writeAsStringAsync(p.meta, JSON.stringify(meta))
  return meta
}

export async function listTakes() {
  await ensureRoot()
  const ids = await FileSystem.readDirectoryAsync(TAKES_ROOT)
  const metas = []
  for (const id of ids) {
    try {
      const p = takePaths(TAKES_ROOT, id)
      const raw = await FileSystem.readAsStringAsync(p.meta)
      metas.push(JSON.parse(raw))
    } catch (e) {
      // skip dirs without a readable meta.json
    }
  }
  return sortTakes(metas)
}

export async function deleteTake(id) {
  const p = takePaths(TAKES_ROOT, id)
  await FileSystem.deleteAsync(p.dir, { idempotent: true })
}
