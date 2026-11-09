import { ck } from './ck.mjs'
// 背景层：用纯 JS 算像素再一次性烘成不透明图（本机最快的路径，约 1ms/帧贴回）。
const cache = new Map()

function hex2rgb(h) {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

/**
 * 生成一张「渐变底 + 网格 + 中心光晕 + 暗角」的背景原图
 * spec: { w, h, top, bottom, grid, gridStep, glow:{x,y,r,color,strength}, vignette }
 */
export function backgroundPixels(spec) {
  const { w, h, top = '#101a2c', bottom = '#04060b', grid = '#12203a', gridStep = 60,
    glow = null, vignette = 600 } = spec
  const [tr, tg, tb] = hex2rgb(top)
  const [br, bg, bb] = hex2rgb(bottom)
  const [gr, gg, gb] = hex2rgb(grid)
  const gCol = glow ? hex2rgb(glow.color) : [0, 0, 0]
  const buf = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const ty = y / (h - 1)
    const lr = tr + (br - tr) * ty, lg = tg + (bg - tg) * ty, lb = tb + (bb - tb) * ty
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r = lr, g = lg, b = lb
      if (glow) {
        const dx = (x - glow.x) / glow.r, dy = (y - glow.y) / glow.r
        const d2 = dx * dx + dy * dy
        if (d2 < 1) {
          const k = (1 - Math.sqrt(d2)) ** 2 * (glow.strength ?? 0.55)
          r += (gCol[0] - r) * k; g += (gCol[1] - g) * k; b += (gCol[2] - b) * k
        }
      }
      if (gridStep > 0 && (x % gridStep === 0 || y % gridStep === 0)) { r += (gr - r) * 0.12; g += (gg - g) * 0.12; b += (gb - b) * 0.12 }
      if (vignette > 0) {
        const vx = Math.min(x, w - x) / (vignette * 0.9), vy = Math.min(y, h - y) / (vignette * 0.52)
        const v = Math.min(1, Math.max(vx, vy))
        const vf = 1 - (1 - v) * (1 - v) * 0.72
        r *= vf; g *= vf; b *= vf
      }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255
    }
  }
  return buf
}

export function bgImage(spec) {
  const key = JSON.stringify(spec)
  let img = cache.get(key)
  if (img) return img
  const px = backgroundPixels(spec)
  img = ck.MakeImage({
    width: spec.w, height: spec.h, colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Opaque, colorSpace: ck.ColorSpace.SRGB,
  }, px, spec.w * 4)
  cache.set(key, img)
  return img
}
