// CanvasKit(Skia/WASM) 绘制层：把「视频帧」画成 RGBA 像素。
// 为什么用它：Remotion 的渲染后端是 Chrome Headless Shell，Android 上没有；
// CanvasKit 是纯 wasm，Node 直接能跑，且 Skia 的排版/渐变/阴影质量与浏览器同源。
import CanvasKitInit from 'canvaskit-wasm'
import fs from 'node:fs'
import { dirname as pathDirname } from 'node:path'
import { createRequire } from 'node:module'
import { resolveFonts, fontFamilies } from './paths.mjs'

// 用 createRequire 定位 canvaskit 的 bin 目录：安装到任意位置、或被提升到上层 node_modules 都能找到
const BIN = pathDirname(createRequire(import.meta.url).resolve('canvaskit-wasm/bin/canvaskit.wasm')) + '/'
export const ck = await CanvasKitInit({ locateFile: (f) => BIN + f })

// 字体：Roboto 覆盖拉丁/数字，HYQiHei（系统 DroidSansChinese.ttf 的实际族名）覆盖中文。
// 通过 FontCollection 的 fallback 链混排，中英混写下不会出现豆腐块。
export const fonts = resolveFonts()
if (!fonts.length) throw new Error('找不到任何可用字体：用 REMOLITE_FONTS="名字=路径,名字=路径" 指定')
const FONT_FILES = fonts.map((f) => [f.name, f.file])
const provider = ck.TypefaceFontProvider.Make()
for (const [name, file] of FONT_FILES) provider.registerFont(fs.readFileSync(file), name)
export const fontCollection = ck.FontCollection.Make()
fontCollection.setDefaultFontManager(provider)
fontCollection.enableFontFallback()
const FAMILIES = fontFamilies(fonts)

/* ---------- 颜色 ---------- */
const colorCache = new Map()
export function color(input, alpha = 1) {
  const key = input + '|' + alpha
  const hit = colorCache.get(key)
  if (hit) return hit
  let r = 255, g = 255, b = 255, a = 1
  if (typeof input === 'string') {
    const s = input.trim()
    if (s[0] === '#') {
      const h = s.slice(1)
      if (h.length === 3 || h.length === 4) {
        r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16)
        a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1
      } else if (h.length === 6 || h.length === 8) {
        r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16)
        a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      }
    } else if (s.startsWith('rgb')) {
      const nums = s.replace(/[^0-9.,]/g, '').split(',').map(Number)
      r = nums[0]; g = nums[1]; b = nums[2]; a = nums.length > 3 ? nums[3] : 1
    } else if (s === 'transparent') { a = 0 } else if (s === 'black') { r = g = b = 0 }
  } else if (Array.isArray(input)) {
    r = input[0]; g = input[1]; b = input[2]; a = input.length > 3 ? input[3] : 1
  }
  const c = { r, g, b, a: a * alpha }
  colorCache.set(key, c)
  return c
}
const ckColor = (c) => ck.Color(c.r, c.g, c.b, c.a)
const ckColorF = (c) => ck.Color4f(c.r / 255, c.g / 255, c.b / 255, c.a)

/* ---------- 文本段落缓存 ---------- */
const paraCache = new Map()
const PARA_CACHE_MAX = 3000
function buildPara(text, o) {
  const col = color(o.color ?? '#ffffff', o.opacity ?? 1)
  const style = new ck.ParagraphStyle({
    textStyle: {
      color: ckColorF(col),
      fontFamilies: o.family === 'mono' ? ['RobotoMono', 'Roboto', 'NotoCJK'] : o.family === 'latin' ? ['Roboto', 'NotoCJK'] : FAMILIES,
      fontSize: o.size ?? 48,
      heightMultiplier: o.lineHeight ?? 1.35,
      fontStyle: { weight: o.weight ?? 400, width: 5, slant: 0 },
      letterSpacing: o.letterSpacing ?? 0,
    },
    textAlign: o.align === 'center' ? ck.TextAlign.Center : o.align === 'right' ? ck.TextAlign.Right : ck.TextAlign.Left,
    maxLines: o.maxLines ?? 0,
  })
  const b = ck.ParagraphBuilder.MakeFromFontCollection(style, fontCollection)
  b.pushStyle(style.textStyle)
  b.addText(String(text))
  const p = b.build()
  p.layout(o.maxWidth ?? 4000)
  return p
}
function getPara(text, o) {
  const key = [text, o.size, o.color, o.weight, o.align, o.maxWidth, o.lineHeight, o.letterSpacing, o.maxLines, o.opacity, o.family].join('\u0001')
  let p = paraCache.get(key)
  if (p) return p
  p = buildPara(text, o)
  if (paraCache.size > PARA_CACHE_MAX) paraCache.clear()
  paraCache.set(key, p)
  return p
}

/* ---------- 画布包装 ---------- */
export class Ctx {
  constructor(surface, canvas) {
    this.surface = surface
    this.canvas = canvas
    this.w = surface.width()
    this.h = surface.height()
  }
  save() { this.canvas.save(); return this }
  restore() { this.canvas.restore(); return this }
  translate(x, y) { this.canvas.translate(x, y); return this }
  scale(x, y = x) { this.canvas.scale(x, y); return this }
  rotate(rad) { this.canvas.rotate(rad * 180 / Math.PI); return this }
  alpha(a) { this.canvas.saveLayer(new ck.Paint().setAlphaf(a)); return this }
  clipRect(x, y, w, h) { this.canvas.clipRect(ck.XYWHRect(x, y, w, h), ck.ClipOp.Intersect, true); return this }
  clipRRect(x, y, w, h, r) { this.canvas.clipRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), r, r), ck.ClipOp.Intersect, true); return this }

  bg(c) { this.canvas.clear(ckColor(color(c))); return this }

  /** 纯色/渐变矩形；r 圆角；opacity 直接乘进 alpha */
  rect(x, y, w, h, o = {}) {
    const p = this.paint(o)
    if (o.grad) p.setShader(this.shader(o.grad, x, y, w, h, o.gradAngle))
    if (o.r) this.canvas.drawRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), o.r, o.r), p)
    else this.canvas.drawRect(ck.XYWHRect(x, y, w, h), p)
    return this
  }
  circle(cx, cy, r, o = {}) {
    const p = this.paint(o)
    if (o.grad) p.setShader(this.shader(o.grad, cx - r, cy - r, r * 2, r * 2, o.gradAngle))
    this.canvas.drawCircle(cx, cy, r, p)
    return this
  }
  line(x1, y1, x2, y2, o = {}) {
    const p = this.paint({ ...o, stroke: true })
    this.canvas.drawLine(x1, y1, x2, y2, p)
    return this
  }
  path(svg, o = {}) {
    const p = ck.Path.MakeFromSVGString(svg)
    if (!p) return this
    const paint = this.paint(o)
    this.canvas.drawPath(p, paint)
    p.delete()
    return this
  }

  /** 文本：返回 {w,h}，align=center/right 时按 maxWidth 定位 */
  /** 文本。weight>=600 时用「双击」模拟粗体（系统没有 CJK 粗体面） */
  text(str, o = {}) {
    const p = getPara(str, o)
    const x = o.x ?? 0, y = o.y ?? 0
    this.canvas.drawParagraph(p, x, y)
    const w = (o.weight ?? 400) >= 600 ? Math.max(0.8, Math.min(2.2, (o.size ?? 48) * 0.022)) : 0
    if (w > 0) this.canvas.drawParagraph(p, x + w, y)
    return { w: p.getLongestLine() + w, h: p.getHeight(), lines: p.getNumberOfLines() }
  }
  measure(str, o = {}) {
    const p = getPara(str, o)
    return { w: p.getLongestLine(), h: p.getHeight(), lines: p.getNumberOfLines() }
  }
  /** 带描边阴影的发光效果 */
  glow(cx, cy, r, c, blur = 60, opacity = 0.5) {
    const p = new ck.Paint()
    p.setAntiAlias(true)
    p.setColor(ckColor(color(c, opacity)))
    p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, blur, true))
    this.canvas.drawCircle(cx, cy, r, p)
    return this
  }

  /** 直接贴一张已烘焙的图（背景层/光晕层用，比每帧重算渐变快两个数量级） */
  image(img, x = 0, y = 0, w, h, opacity = 1) {
    const p = new ck.Paint()
    p.setAntiAlias(true)
    if (opacity !== 1) p.setAlphaf(opacity)
    if (w === undefined) this.canvas.drawImage(img, x, y, p)
    else this.canvas.drawImageRect(img, ck.XYWHRect(0, 0, img.width(), img.height()), ck.XYWHRect(x, y, w, h), p)
    return this
  }

  /** 径向渐变（光晕/暗角） */
  radial(cx, cy, r, stops, rect) {
    const cs = [], ps = []
    for (const [pos, c] of stops) { cs.push(...ckColor(color(c))); ps.push(pos) }
    const p = new ck.Paint(); p.setAntiAlias(true)
    p.setShader(ck.Shader.MakeRadialGradient([cx, cy], r, cs, ps, ck.TileMode.Clamp))
    this.canvas.drawRect(ck.XYWHRect(...(rect ?? [0, 0, this.w, this.h])), p)
    return this
  }

  paint(o) {
    const p = new ck.Paint()
    p.setAntiAlias(true)
    const c = color(o.fill ?? o.color ?? '#ffffff', o.opacity ?? 1)
    if (o.stroke) {
      p.setStyle(ck.PaintStyle.Stroke)
      p.setStrokeWidth(o.width ?? 2)
      p.setColor(ckColor(color(o.color ?? '#ffffff', o.opacity ?? 1)))
    } else {
      p.setColor(ckColor(c))
    }
    if (o.blur) p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, o.blur, true))
    return p
  }
  shader(stops, x, y, w, h, angle) {
    const cs = []
    const ps = []
    for (const [pos, c] of stops) { cs.push(...ckColor(color(c))); ps.push(pos) }
    let p0 = [x, y], p1 = [x + w, y + h]
    if (angle !== undefined) {
      const rad = angle * Math.PI / 180
      const dx = Math.cos(rad), dy = Math.sin(rad)
      p0 = [x + w / 2 - dx * w / 2, y + h / 2 - dy * h / 2]
      p1 = [x + w / 2 + dx * w / 2, y + h / 2 + dy * h / 2]
    }
    return ck.Shader.MakeLinearGradient(p0, p1, cs, ps, ck.TileMode.Clamp)
  }
}

export function makeSurface(w, h) {
  const surface = ck.MakeSurface(w, h)
  return { surface, ctx: new Ctx(surface, surface.getCanvas()) }
}

/** 取一帧的 RGBA（供 ffmpeg 原样吃） */
export function readFrame(surface) {
  surface.flush()
  const img = surface.makeImageSnapshot()
  const info = {
    width: surface.width(), height: surface.height(),
    colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Opaque, colorSpace: ck.ColorSpace.SRGB,
  }
  const bytes = img.readPixels(0, 0, info)
  img.delete()
  return bytes
}

export function framePNG(surface) {
  surface.flush()
  const img = surface.makeImageSnapshot()
  const png = img.encodeToBytes(ck.ImageFormat.PNG, 90)
  img.delete()
  return Buffer.from(png)
}

/** 离屏烘焙一层静态画面，返回可复用的 ck.Image（背景、网格、光晕都该走这里） */
export function bake(w, h, fn, { clear = '#000000' } = {}) {
  const { surface, ctx } = makeSurface(w, h)
  if (clear) ctx.bg(clear)
  fn(ctx)
  surface.flush()
  return surface.makeImageSnapshot()
}

/**
 * 把一段绘制烘焙成「不透明」原图。
 * 实测：本机 Skia 软件光栅下，带 alpha 的图片贴图约 30–40ms/800x180，
 * 不透明图片 1:1 贴图 0.1ms —— 差三个数量级。所以静态背景一律烘焙成不透明图。
 */
export function bakeOpaque(w, h, fn) {
  const { surface, ctx } = makeSurface(w, h)
  fn(ctx)
  surface.flush()
  const snap = surface.makeImageSnapshot()
  const info = {
    width: w, height: h, colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Opaque, colorSpace: ck.ColorSpace.SRGB,
  }
  const px = snap.readPixels(0, 0, info)
  snap.delete()
  return ck.MakeImage(info, px, w * 4)
}
