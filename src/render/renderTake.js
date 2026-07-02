// Offline compositor driver (spec §4 approach A). Decodes raw.mp4 with
// Skia.Video, replays the sidecar through the unchanged makePicture, and
// pushes composited RGBA frames to the senses-render encoder. Reads only —
// the take's raw.mp4/sidecar.json are never mutated (meta.json is updated
// after success).
import { Skia } from '@shopify/react-native-skia'
import SensesRender from '../../modules/senses-render'
import { getMode } from '../modes'
import { buildFrameLookup } from './align'
import { replayFrame } from '../capture/sidecar'
import { metaAfterRender } from '../capture/takes'
import { loadTake, writeMeta } from '../capture/takes-io'

const noScheme = u => u.replace(/^file:\/\//, '')
const RENDER_NAME = 'render.mp4'

export async function renderTake(id, { onProgress, shouldCancel } = {}) {
  const { meta, sidecar, paths } = await loadTake(id)
  if ((sidecar.schema ?? 1) > 2) throw new Error(`sidecar schema ${sidecar.schema} is newer than this app`)
  const mode = (() => { try { return getMode(sidecar.effectId) } catch { return null } })()
  if (!mode) throw new Error(`effect "${sidecar.effectId}" is not installed`)
  if ((mode.manifest.version ?? 1) !== sidecar.effectVersion) {
    console.warn(`[render] effect version drift: recorded v${sidecar.effectVersion}, rendering v${mode.manifest.version ?? 1}`)
  }

  const probe = await SensesRender.probe(noScheme(paths.raw))
  const n = probe.videoPtsUs.length
  if (n === 0) throw new Error('raw video has no frames')
  const upright = probe.rotation === 90 || probe.rotation === 270
  const outW = upright ? probe.height : probe.width
  const outH = upright ? probe.width : probe.height
  const dims = { width: outW, height: outH }
  const span = probe.videoPtsUs[n - 1] - probe.videoPtsUs[0]
  const fps = n > 1 && span > 0 ? Math.max(1, Math.round((1e6 * (n - 1)) / span)) : 30
  const bitrate = Math.round(outW * outH * fps * 0.2)

  const lookup = buildFrameLookup(sidecar, probe)
  const renderPath = `${paths.dir}${RENDER_NAME}`

  const video = Skia.Video(paths.raw)
  const surface = Skia.Surface.MakeOffscreen(outW, outH)
  if (!surface) { video.dispose?.(); throw new Error(`MakeOffscreen ${outW}x${outH} failed`) }
  const canvas = surface.getCanvas()

  await SensesRender.begin(noScheme(renderPath), outW, outH, fps, bitrate, probe.hasAudio ? noScheme(paths.raw) : null)
  try {
    for (let k = 0; k < n; k++) {
      if (shouldCancel?.()) {
        await SensesRender.abort()
        video.dispose?.()
        return { cancelled: true }
      }
      const img = video.nextImage()
      if (!img) throw new Error(`decoder returned no image at frame ${k}/${n}`)
      canvas.save()
      if (probe.rotation === 90) { canvas.translate(outW, 0); canvas.rotate(90, 0, 0) }
      else if (probe.rotation === 180) { canvas.translate(outW, outH); canvas.rotate(180, 0, 0) }
      else if (probe.rotation === 270) { canvas.translate(0, outH); canvas.rotate(270, 0, 0) }
      canvas.drawImage(img, 0, 0)
      canvas.restore()
      const frame = replayFrame(sidecar, lookup.frames[k])
      canvas.drawPicture(mode.makePicture({ features: frame.features ?? {}, motion: frame.motion, params: frame.params, dims }))
      surface.flush()
      const snap = surface.makeImageSnapshot()
      const px = snap.readPixels()
      snap.dispose?.()
      img.dispose?.()
      if (!px) throw new Error(`readPixels failed at frame ${k}/${n}`)
      await SensesRender.pushFrame(px, probe.videoPtsUs[k])
      onProgress?.((k + 1) / n)
    }
    await SensesRender.finish()
  } catch (e) {
    await SensesRender.abort().catch(() => {})
    video.dispose?.()
    throw e
  }
  video.dispose?.()

  const galleryUri = await SensesRender.exportToGallery(noScheme(renderPath), `senses-${id}.mp4`, meta.galleryUri ?? null)
  await writeMeta(id, metaAfterRender(meta, {
    width: outW,
    height: outH,
    renderedWithVersion: mode.manifest.version ?? 1,
    galleryUri,
    renderedAt: Date.now(),
  }))
  return { galleryUri }
}
