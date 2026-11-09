// 最小示例：一张烘焙背景 + 几个 spring 进场。
// 关键性能约定：片子里「贵」的东西（渐变/模糊/暗角）只算一次，烘成不透明图后每帧 1:1 贴回（约 1ms）。
import { compose, scene, interpolate, spring, Easing, useVideoConfig } from '../engine.mjs'
import { bgImage } from '../paint.mjs'

const W = 1920, H = 1080
const C = { ink: '#f2f7ff', dim: '#8ea7c4', accent: '#5eead4' }

function hook(ctx, f) {
  const { fps } = useVideoConfig()
  ctx.image(bgImage({
    w: W, h: H, top: '#101a2c', bottom: '#04060b', grid: '#12203a', gridStep: 60,
    glow: { x: 960, y: 470, r: 820, color: '#17395f', strength: 0.6 }, vignette: 640,
  }), 0, 0)

  const s1 = spring({ frame: f, fps, config: { damping: 13, mass: 0.9, stiffness: 108 } })
  ctx.text('用代码做视频', {
    x: 0, y: interpolate(s1, [0, 1], [660, 392]),
    size: 176, weight: 700, align: 'center', maxWidth: W, color: C.ink, opacity: Math.min(1, s1 * 1.7),
  })
  const s2 = spring({ frame: f - 12, fps, config: { damping: 15, mass: 0.9, stiffness: 95 } })
  ctx.text('remotion-lite · 作者层=Remotion · 渲染层=CanvasKit + ffmpeg', {
    x: 0, y: 648, size: 42, align: 'center', maxWidth: W, color: C.accent, opacity: s2,
  })
  const grow = interpolate(f, [20, 50], [0, 520], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  ctx.rect(W / 2 - grow / 2, 760, grow, 3, { fill: C.accent, opacity: 0.8 })
}

export default compose({
  id: 'test', fps: 30, width: W, height: H, durationInFrames: 150,
  scenes: [scene(0, 150, hook)],
})
