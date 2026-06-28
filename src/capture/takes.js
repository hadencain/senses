// Take = a recorded project: raw video + sidecar + meta in one directory.
// PURE helpers here; expo-file-system I/O is added in the next task.

export function takeId(createdAt, effectId) {
  return `${createdAt}-${effectId}`
}

export function takePaths(root, id) {
  const dir = `${root}${id}/`
  return { dir, raw: `${dir}raw.mp4`, sidecar: `${dir}sidecar.json`, meta: `${dir}meta.json` }
}

export function makeMeta({ id, effectId, durationMs, createdAt, width, height }) {
  return { schema: 1, id, effectId, durationMs, createdAt, width, height, rendered: false }
}

export function sortTakes(metas) {
  return [...metas].sort((a, b) => b.createdAt - a.createdAt)
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
