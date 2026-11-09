// 《用代码做视频》——remotion-lite 的验收片。
// 每个场景都是纯函数 (ctx, localFrame)：给定帧号必然给出同一张画面。
import { compose, scene, interpolate, spring, Easing, useVideoConfig, getInputProps, rand } from '../engine.mjs'
import { bgImage } from '../paint.mjs'
import { C, sectionLabel, headline, card, codeBox, tick, cross, shadowText, centerText, bottomFade } from '../ui.mjs'

const W = 1920, H = 1080
const BASE_BG = {
  w: W, h: H, top: '#101a2c', bottom: '#04060b',
  grid: '#12203a', gridStep: 60,
  glow: { x: 960, y: 470, r: 800, color: '#17395f', strength: 0.62 },
  vignette: 640,
}
const bg = (ctx, spec) => ctx.image(bgImage({ ...BASE_BG, ...spec }), 0, 0)

/* ============ 01 钩子 ============ */
function hook(ctx, f) {
  const { fps } = useVideoConfig()
  bg(ctx)
  for (let i = 0; i < 52; i++) {
    const s = i * 7.13
    const x = 100 + rand(s) * (W - 200)
    const y = ((rand(s + 1) * H - f * (0.35 + rand(s + 2) * 0.8)) % H + H) % H
    ctx.circle(x, y, 1.4 + rand(s + 4) * 2.4, { fill: i % 6 === 0 ? C.teal : '#a6c8e8', opacity: 0.05 + rand(s + 3) * 0.16 })
  }
  const s1 = spring({ frame: f, fps, config: { damping: 13, mass: 0.9, stiffness: 108 } })
  const ty = interpolate(s1, [0, 1], [660, 392])
  ctx.text('用代码做视频', { x: 0, y: ty, size: 176, weight: 700, align: 'center', maxWidth: W, color: C.ink, opacity: Math.min(1, s1 * 1.7) })
  const s2 = spring({ frame: f - 14, fps, config: { damping: 15, mass: 0.9, stiffness: 95 } })
  ctx.text('一篇公众号文章，变成这台手机上跑通的生产线', { x: 0, y: 640, size: 44, align: 'center', maxWidth: W, color: C.dim, opacity: s2 })
  const steps = ['学习', '研究', '部署', '应用']
  steps.forEach((t, i) => {
    const a = Math.min(1, Math.max(0, (f - 30 - i * 6) / 10))
    const x = 660 + i * 200
    ctx.circle(x - 22, 760, 5, { fill: [C.teal, C.blue, C.amber, C.pink][i], opacity: a })
    ctx.text(t, { x: x, y: 742, size: 32, color: C.ink, opacity: a * 0.9 })
  })
  const a3 = Math.min(1, Math.max(0, (f - 56) / 14))
  ctx.text('remotion 4.0.542  ·  node 24.22.1  ·  Android / bionic  ·  CanvasKit + ffmpeg', { x: 0, y: 856, size: 26, align: 'center', maxWidth: W, color: C.faint, opacity: a3, family: 'latin' })
}

/* ============ 02 学习 ============ */
const LEARN = [
  ['01', '脚本', '先让 AI 写分镜与视频提示词，别自己憋'],
  ['02', '关键画面', '确认构图与风格，画面脏就重来'],
  ['03', '样片', '几秒钟试动画、字幕、配音，别急着出全片'],
  ['04', '成片', '第一版字幕对不上，改一版约 20 分钟'],
]
function learning(ctx, f) {
  const { fps } = useVideoConfig()
  bg(ctx, { glow: { x: 960, y: 520, r: 900, color: '#14405e', strength: 0.5 } })
  sectionLabel(ctx, '01', '学习', C.teal, f)
  headline(ctx, '原文方法：四步流水线', { y: 150, s: 1 })
  ctx.text('豆包工作 + Remotion：AI 写代码，代码出动画', { x: 120, y: 268, size: 34, color: C.dim, opacity: Math.min(1, f / 12) })

  const cardW = 384, gap = 32, x0 = (W - (cardW * 4 + gap * 3)) / 2
  const cy = 400, ch = 250
  // 连接线 + 流动光点
  const lineA = interpolate(f, [10, 34], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const ly = cy - 46
  ctx.line(x0 + cardW / 2, ly, x0 + cardW / 2 + (cardW + gap) * 3 * lineA, ly, { color: C.panelEdge, width: 2, opacity: 0.9 })
  const travel = ((f - 20) % 70) / 70
  if (travel > 0 && lineA > 0.99) {
    const dx = x0 + cardW / 2 + (cardW + gap) * 3 * travel
    ctx.circle(dx, ly, 5, { fill: C.teal, opacity: 0.9 })
    ctx.circle(dx, ly, 14, { fill: C.teal, opacity: 0.12 })
  }
  LEARN.forEach(([num, title, body], i) => {
    const ap = spring({ frame: f - 12 - i * 7, fps, config: { damping: 14, mass: 0.8, stiffness: 110 } })
    card(ctx, { x: x0 + i * (cardW + gap), y: cy, w: cardW, h: ch, color: [C.teal, C.blue, C.amber, C.pink][i], num, title, body, appear: ap })
  })
  const n = Math.min(1, Math.max(0, (f - 60) / 16))
  ctx.text('原文作者踩的坑：先出全片再改，额度与时间都白花', { x: 120, y: 760, size: 30, color: C.faint, opacity: n })
  ctx.text('→ 于是把「关键画面 + 样片」提前成两道闸门', { x: 120, y: 812, size: 34, color: C.amber, opacity: n, weight: 700 })
}

/* ============ 03 研究 ============ */
function research(ctx, f) {
  const { fps } = useVideoConfig()
  bg(ctx, { glow: { x: 960, y: 560, r: 900, color: '#3a1f2a', strength: 0.42 } })
  sectionLabel(ctx, '02', '研究', C.pink, f)
  headline(ctx, '先验死路：Remotion 靠什么出帧', { y: 150 })

  const pw = 760, ph = 330, py = 360
  const leftX = 120, rightX = W - 120 - pw
  const ap = spring({ frame: f - 10, fps, config: { damping: 15, mass: 0.85, stiffness: 100 } })
  // 左：官方渲染器
  ctx.rect(leftX, py - (1 - ap) * 20, pw, ph, { fill: C.panel, r: 22, opacity: 0.92 * ap })
  ctx.rect(leftX, py - (1 - ap) * 20, pw, ph, { stroke: true, color: '#5b2233', width: 2, r: 22, opacity: ap })
  ctx.text('官方 Remotion 渲染器', { x: leftX + 34, y: py + 26, size: 38, weight: 700, color: C.ink, opacity: ap })
  ctx.text('要一个 Chrome Headless Shell 截 DOM 帧', { x: leftX + 34, y: py + 86, size: 27, color: C.dim, opacity: ap })
  cross(ctx, leftX + pw - 70, py + 56, 46, C.pink, ap)
  codeBox(ctx, { x: leftX + 34, y: py + 150, w: pw - 68, h: 130, appear: ap, color: C.pink, lines: [
    "await ensureBrowser()",
    "→ Unsupported platform: android",
  ] })

  // 右：我们的后端
  const ap2 = spring({ frame: f - 22, fps, config: { damping: 15, mass: 0.85, stiffness: 100 } })
  ctx.rect(rightX, py - (1 - ap2) * 20, pw, ph, { fill: C.panel, r: 22, opacity: 0.92 * ap2 })
  ctx.rect(rightX, py - (1 - ap2) * 20, pw, ph, { stroke: true, color: '#1f6b5f', width: 2, r: 22, opacity: ap2 })
  ctx.text('remotion-lite 渲染后端', { x: rightX + 34, y: py + 26, size: 38, weight: 700, color: C.ink, opacity: ap2 })
  ctx.text('作者层留官方包，出帧换 CanvasKit(WASM) + ffmpeg', { x: rightX + 34, y: py + 86, size: 25, color: C.dim, opacity: ap2, maxWidth: pw - 140 })
  tick(ctx, rightX + pw - 70, py + 56, 46, C.teal, ap2)
  codeBox(ctx, { x: rightX + 34, y: py + 150, w: pw - 68, h: 130, appear: ap2, color: C.teal, lines: [
    "import { spring } from 'remotion'   // 7ms",
    "spring({frame:10,fps:30}) = 1.1552855",
  ] })

  // 中间箭头
  const mid = spring({ frame: f - 34, fps, config: { damping: 16, mass: 0.8, stiffness: 120 } })
  ctx.circle(W / 2, py + ph / 2 - 20, 34 * mid, { fill: '#0f1b2b', opacity: mid })
  ctx.text('→', { x: W / 2 - 17, y: py + ph / 2 - 46, size: 40, color: C.amber, opacity: mid, family: 'latin' })

  const n = Math.min(1, Math.max(0, (f - 70) / 16))
  ctx.text('本机不是「没装 Chrome」这么简单：Android 是 bionic，Chrome-for-Testing 根本没有 android 构建', { x: 120, y: 760, size: 30, color: C.faint, opacity: n })
  ctx.text('结论：能复用的是「帧 = 纯函数 + 数学库」这套模型，不是它的浏览器', { x: 120, y: 812, size: 34, color: C.teal, opacity: n, weight: 700 })
}

/* ============ 04 部署 ============ */
const FEATURES = [
  ['Composition', '分辨率/帧率/总帧数，一条声明'],
  ['useCurrentFrame', '帧号是唯一输入，画面必然可复现'],
  ['Sequence', '把片子切成场景，局部帧号各管一段'],
  ['spring + interpolate', '直接用官方 remotion 包的数学'],
  ['字幕轨', '时间码驱动，改文案不用改代码'],
  ['音乐轨', 'Node 合成 WAV，ffmpeg 混流'],
]
function deploy(ctx, f) {
  const { fps } = useVideoConfig()
  bg(ctx, { glow: { x: 960, y: 540, r: 900, color: '#123c52', strength: 0.5 } })
  sectionLabel(ctx, '03', '部署', C.amber, f)
  headline(ctx, '引擎落地的六个抽象', { y: 150 })

  const cw = 512, chh = 128, gx = 40, gy = 28
  const x0 = (W - (cw * 3 + gx * 2)) / 2
  FEATURES.forEach(([name, desc], i) => {
    const col = i % 3, row = Math.floor(i / 3)
    const ap = spring({ frame: f - 8 - i * 5, fps, config: { damping: 15, mass: 0.8, stiffness: 115 } })
    const x = x0 + col * (cw + gx), y = 340 + row * (chh + gy) - (1 - ap) * 18
    ctx.rect(x, y, cw, chh, { fill: C.panel, r: 18, opacity: 0.9 * ap })
    ctx.rect(x, y, cw, chh, { stroke: true, color: C.panelEdge, width: 2, r: 18, opacity: ap })
    ctx.text(name, { x: x + 28, y: y + 24, size: 34, weight: 700, color: [C.teal, C.blue, C.amber][col], opacity: ap, family: 'latin' })
    ctx.text(desc, { x: x + 28, y: y + 74, size: 24, color: C.dim, opacity: ap * 0.95, maxWidth: cw - 56 })
  })

  // 打字机终端
  const cmd = 'node bin/remolite.mjs render src/videos/make-video.mjs --out out/final.mp4'
  const typed = Math.max(0, Math.min(cmd.length, Math.floor((f - 40) * 1.6)))
  const boxA = Math.min(1, Math.max(0, (f - 34) / 12))
  ctx.rect(120, 660, W - 240, 120, { fill: '#070d16', r: 18, opacity: 0.96 * boxA })
  ctx.rect(120, 660, W - 240, 120, { stroke: true, color: '#1d3350', width: 2, r: 18, opacity: boxA })
  ctx.text('$', { x: 152, y: 692, size: 26, color: C.teal, opacity: boxA, family: 'mono' })
  ctx.text(cmd.slice(0, typed), { x: 190, y: 690, size: 26, color: C.ink, opacity: boxA, family: 'mono' })
  if (typed < cmd.length && Math.floor(f / 8) % 2 === 0) {
    const tw = ctx.measure(cmd.slice(0, typed), { size: 26, family: 'mono' }).w
    ctx.rect(190 + tw + 2, 690, 13, 32, { fill: C.teal, opacity: 0.9 * boxA })
  }
  const n = Math.min(1, Math.max(0, (f - 80) / 16))
  ctx.text('同一条命令既出样片（--range 0-150）也出成片；--props 把实测数字喂回下一版', { x: 120, y: 836, size: 30, color: C.faint, opacity: n })
}

/* ============ 05 应用 ============ */
function apply(ctx, f) {
  const { fps } = useVideoConfig()
  const p = getInputProps()
  bg(ctx, { glow: { x: 960, y: 500, r: 950, color: '#14364f', strength: 0.55 } })
  sectionLabel(ctx, '04', '应用', C.blue, f)
  headline(ctx, '这条片子本身就是证据', { y: 150 })

  const stats = [
    ['总帧数', String(p.frames ?? '—')],
    ['渲染耗时', p.seconds != null ? p.seconds + 's' : '—'],
    ['平均帧率', p.fps != null ? p.fps + ' fps' : '—'],
    ['成片体积', p.megabytes != null ? p.megabytes + ' MB' : '—'],
  ]
  stats.forEach(([k, v], i) => {
    const ap = spring({ frame: f - 10 - i * 6, fps, config: { damping: 14, mass: 0.8, stiffness: 110 } })
    const x = 140 + i * 420
    ctx.text(k, { x, y: 330, size: 28, color: C.dim, opacity: ap })
    shadowText(ctx, v, { x, y: 372, size: 92, weight: 700, color: [C.teal, C.blue, C.amber, C.pink][i], opacity: ap, family: 'latin' })
  })

  const s = spring({ frame: f - 40, fps, config: { damping: 13, mass: 0.9, stiffness: 100 } })
  const ty = interpolate(s, [0, 1], [660, 588])
  ctx.text('代码是镜头语言', { x: 0, y: ty, size: 132, weight: 700, align: 'center', maxWidth: W, color: C.ink, opacity: Math.min(1, s * 1.7) })
  const n = Math.min(1, Math.max(0, (f - 62) / 16))
  centerText(ctx, '1920×1080 · 30fps · 纯 Node + WASM，没有浏览器', { cx: W / 2, cy: 792, size: 34, color: C.dim, opacity: n })
  ctx.text('remotion-lite  ·  MIT  ·  在 Android 手机上渲染', { x: 0, y: 846, size: 26, align: 'center', maxWidth: W, color: C.faint, opacity: n, family: 'latin' })
}

/* ============ 全局叠加：字幕 / 进度条 / 水印 ============ */
const SUBS = [
  [15, 168, '一篇公众号讲的是：让 AI 写代码，用 Remotion 出动画视频。'],
  [180, 300, '原文方法其实只有四步：脚本、关键画面、样片、成片。'],
  [300, 436, '豆包工作第一版成片字幕对不上，改一版花了 20 分钟。'],
  [446, 560, '先查死路：Remotion 的渲染器要 Chrome，Android 直接报不支持。'],
  [560, 706, '于是留下它的作者层与数学库，把渲染后端换成 CanvasKit + ffmpeg。'],
  [716, 860, '六个抽象撑起整条链路，一条命令同时出样片和成片。'],
  [866, 1010, '这条片子就是它渲染出来的：每一帧都是同一个函数的返回值。'],
  [1016, 1250, '学习、研究、部署、应用——闭环落在手机上。'],
]

const TOTAL = 1260
function overlay(ctx, f) {
  const sub = SUBS.find(([a, b]) => f >= a && f < b)
  if (sub) {
    const a = Math.min(1, (f - sub[0]) / 8, (sub[1] - f) / 8)
    bottomFade(ctx, { y0: 878, y1: 1080, alpha: 0.8 * a })
    ctx.text(sub[2], { x: 0, y: 946, size: 34, align: 'center', maxWidth: W - 240, color: '#eef4fc', opacity: a })
  }
  // 场景切换：黑场 7 帧淡入；片尾 14 帧淡出
  const cuts = [170, 440, 710, 980]
  for (const c of cuts) if (f >= c && f < c + 7) ctx.rect(0, 0, W, H, { fill: '#000000', opacity: 0.9 * (1 - (f - c) / 7) })
  if (f > TOTAL - 15) ctx.rect(0, 0, W, H, { fill: '#000000', opacity: (f - (TOTAL - 15)) / 14 })
  ctx.rect(0, H - 8, W * (f / TOTAL), 8, { fill: C.teal, opacity: 0.55 })
  ctx.text('remotion-lite', { x: W - 260, y: H - 62, size: 24, color: C.faint, opacity: 0.5, family: 'latin' })
}

const comp = compose({
  id: 'make-video', fps: 30, width: W, height: H, durationInFrames: TOTAL,
  scenes: [
    scene(0, 170, hook),
    scene(170, 270, learning),
    scene(440, 270, research),
    scene(710, 270, deploy),
    scene(980, 280, apply),
  ],
  draw: overlay,
})
export default comp
