import AsyncStorage from '@react-native-async-storage/async-storage'

const keyFor = id => `senses:params:${id}`

export function defaultParams(manifest) {
  const out = {}
  for (const p of manifest.params) out[p.key] = p.default
  return out
}

export async function loadParams(id, manifest) {
  const defaults = defaultParams(manifest)
  try {
    const raw = await AsyncStorage.getItem(keyFor(id))
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch {
    return defaults
  }
}

export async function saveParams(id, values) {
  try {
    await AsyncStorage.setItem(keyFor(id), JSON.stringify(values))
  } catch {}
}
