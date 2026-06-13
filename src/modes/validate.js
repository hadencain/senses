export function validateManifest(m) {
  const errors = []
  for (const k of ['id', 'label', 'sub', 'accent', 'category', 'type']) {
    if (typeof m?.[k] !== 'string' || !m[k]) errors.push(`${k}: missing or not a string`)
  }
  if (m?.type && !['live', 'editor'].includes(m.type)) errors.push(`type: must be 'live' or 'editor', got '${m.type}'`)
  if (!Array.isArray(m?.params)) {
    errors.push('params: must be an array')
  } else {
    m.params.forEach((p, i) => {
      for (const k of ['key', 'label']) {
        if (typeof p?.[k] !== 'string' || !p[k]) errors.push(`params[${i}].${k}: missing or not a string`)
      }
      for (const k of ['min', 'max', 'default', 'step']) {
        if (typeof p?.[k] !== 'number') errors.push(`params[${i}].${k}: must be a number`)
      }
      if (typeof p?.min === 'number' && typeof p?.max === 'number' && p.min >= p.max) {
        errors.push(`params[${i}]: min must be < max`)
      }
      if (typeof p?.default === 'number' && typeof p?.min === 'number' && typeof p?.max === 'number' &&
          (p.default < p.min || p.default > p.max)) {
        errors.push(`params[${i}].default: outside [min, max]`)
      }
    })
  }
  if (m?.type === 'live' && !Array.isArray(m?.overlay)) errors.push('overlay: must be an array of feature/param keys')
  return errors
}
