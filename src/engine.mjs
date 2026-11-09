// 作者层：时间轴语义与数学全部来自官方 remotion 包（4.0.542），
// 只把「渲染」换成 CanvasKit。因此 interpolate/spring/Easing 的行为与 Remotion 逐位一致。
import { spring as remotionSpring } from 'remotion'
export { interpolate, spring, Easing, interpolateColors, random, measureSpring } from 'remotion'

/* ---------- 帧上下文（对标 useCurrentFrame / useVideoConfig） ---------- */
let STATE = { frame: 0, config: { fps: 30, width: 1920, height: 1080, durationInFrames: 0 }, props: {} }

export const useCurrentFrame = () => STATE.frame
export const useVideoConfig = () => STATE.config
export const getInputProps = () => STATE.props

export function __enter(frame, config, props) {
  const prev = STATE
  STATE = { frame, config, props }
  return prev
}
export function __exit(prev) { STATE = prev }

/* ---------- 组合模型 ---------- */
export function compose(spec) {
  return {
    id: spec.id ?? 'untitled',
    fps: spec.fps ?? 30,
    width: spec.width ?? 1920,
    height: spec.height ?? 1080,
    designWidth: spec.designWidth ?? spec.width ?? 1920,
    designHeight: spec.designHeight ?? spec.height ?? 1080,
    durationInFrames: spec.durationInFrames
      ?? Math.max(0, ...(spec.scenes ?? []).map((s) => s.from + s.durationInFrames)),
    scenes: spec.scenes ?? [],
    draw: spec.draw,
    props: spec.props ?? {},
  }
}

/** 场景：只在 [from, from+duration) 内绘制，draw 收到局部帧（与 Remotion <Sequence> 语义一致） */
export function scene(from, durationInFrames, draw) { return { from, durationInFrames, draw } }

export function renderFrame(comp, ctx, globalFrame) {
  const config = { fps: comp.fps, width: comp.width, height: comp.height, durationInFrames: comp.durationInFrames }
  const prev = __enter(globalFrame, config, comp.props)
  ctx.save()
  // 设计空间：场景永远按 1920x1080 坐标画，实际输出分辨率由渲染器缩放
  const dw = comp.designWidth ?? comp.width, dh = comp.designHeight ?? comp.height
  const k = comp.width / dw
  if (k !== 1) { ctx.scale(k); const w0 = ctx.w, h0 = ctx.h; ctx.w = dw; ctx.h = dh }
  ctx.designW = dw; ctx.designH = dh; ctx.k = k
  try {
    for (const s of comp.scenes) {
      const local = globalFrame - s.from
      if (local < 0 || local >= s.durationInFrames) continue
      ctx.save()
      const p2 = __enter(local, config, comp.props)
      try { s.draw(ctx, local, s.durationInFrames) } finally { __exit(p2) }
      ctx.restore()
    }
    if (comp.draw) {
      ctx.save()
      const p3 = __enter(globalFrame, config, comp.props)
      try { comp.draw(ctx, globalFrame) } finally { __exit(p3) }
      ctx.restore()
    }
  } finally { __exit(prev); ctx.restore(); ctx.w = comp.width; ctx.h = comp.height }
}

/* ---------- 常用小工具 ---------- */
export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/** 进场进度：官方 spring 归一化到 0..1（durationInFrames 内收敛） */
export function pop(frame, fps, { stiffness = 120, damping = 14, mass = 0.8, delay = 0, durationInFrames = 30 } = {}) {
  const f = frame - delay
  if (f <= 0) return 0
  return remotionSpring({ frame: f, fps, config: { stiffness, damping, mass }, durationInFrames: Math.max(2, durationInFrames) })
}

/** 0→1→0 的脉冲（用于高亮） */
export function pulse(frame, period = 60, offset = 0) {
  return 0.5 - 0.5 * Math.cos(((frame + offset) / period) * Math.PI * 2)
}

/** 稳定伪随机（同 frame 同 seed 必然同值，保证渲染可复现） */
export function rand(seed) {
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}
