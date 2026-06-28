import { mode as GrainField } from './grain-field'
import { mode as Larsen } from './larsen'
import { mode as Rust } from './rust'
import { mode as ZeroBeat } from './zero-beat'
import { mode as Redaction } from './redaction'
import { mode as Bloom } from './bloom'
import { mode as Latent } from './latent'
import { mode as Striate } from './striate'
import { validateManifest } from './validate'

export const MODES = [GrainField, Larsen, Rust, ZeroBeat, Redaction, Bloom, Latent, Striate]

export const EDITOR_ENTRIES = [
  {
    manifest: {
      id: 'ClipEditor',
      label: 'Clip Editor',
      sub: 'effects on recorded footage — phase 2',
      accent: '#555555',
      category: 'editor',
      type: 'editor',
      params: [],
    },
  },
]

export const ALL_ENTRIES = [...MODES, ...EDITOR_ENTRIES]

export function getMode(id) {
  const m = MODES.find(m => m.manifest.id === id)
  if (!m) throw new Error(`Unknown mode: ${id}`)
  return m
}

if (__DEV__) {
  for (const entry of ALL_ENTRIES) {
    const errors = validateManifest(entry.manifest)
    if (errors.length) {
      throw new Error(`Invalid manifest '${entry.manifest?.id}':\n  ${errors.join('\n  ')}`)
    }
  }
}
