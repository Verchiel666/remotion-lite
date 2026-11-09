// 复用的画面组件（全部按 1920x1080 设计空间写坐标）
export const C = {
  ink: '#f2f7ff', dim: '#8ea7c4', faint: '#4d6480',
  teal: '#5eead4', amber: '#ffb347', pink: '#ff6b8b', blue: '#7dd3fc',
  panel: '#0d1726', panelEdge: '#1d3350',
}

export function fadeWindow(f, total, inF = 10, outF = 10) {
  const a = Math.min(1, f / inF)
  const b = Math.min(1, (total - f) / outF)
  return Math.max(0, Math.min(a, b))
}

/** 带阴影的文字：先画一遍深色偏移，再画正文（比 blur 便宜得多） */
export function shadowText(ctx, str, o) {
  const { opacity = 1, ...rest } = o
  if (opacity <= 0) return { w: 0, h: 0 }
  ctx.text(str, { ...rest, color: '#000000', opacity: opacity * 0.55, y: (rest.y ?? 0) + 3, x: (rest.x ?? 0) + 1 })
  return ctx.text(str, { ...rest, opacity })
}

export function centerText(ctx, str, o) {
  const m = ctx.measure(str, o)
  return shadowText(ctx, str, { ...o, x: (o.cx ?? 960) - m.w / 2, y: o.cy - m.h / 2 })
}

/** 章节标签：一条竖色块 + 编号 + 名称 */
export function sectionLabel(ctx, num, name, color, f) {
  const a = Math.min(1, f / 8)
  ctx.rect(120, 84, 6, 34, { fill: color, opacity: a })
  ctx.text(`${num}`, { x: 148, y: 82, size: 28, color, weight: 700, opacity: a, family: 'latin' })
  ctx.text(name, { x: 190, y: 80, size: 30, color: C.dim, opacity: a, letterSpacing: 2 })
}

export function headline(ctx, text, { y = 150, size = 92, color = C.ink, s = 1, opacity = 1 } = {}) {
  if (opacity <= 0) return
  ctx.save()
  ctx.translate(120, y + size * 0.82)
  ctx.scale(s, s)
  shadowText(ctx, text, { x: 0, y: -size * 0.82, size, weight: 700, color, opacity })
  ctx.restore()
}

/** 卡片：底+描边+左侧色条+编号+标题+说明 */
export function card(ctx, { x, y, w, h, color, num, title, body, appear = 1, lift = 0 }) {
  if (appear <= 0) return
  const yy = y + (1 - appear) * 26 - lift
  ctx.rect(x, yy, w, h, { fill: C.panel, r: 20, opacity: 0.92 * appear })
  ctx.rect(x, yy, 4, h, { fill: color, r: 2, opacity: appear })
  ctx.rect(x, yy, w, h, { fill: color, r: 20, opacity: 0.055 * appear })
  ctx.text(num, { x: x + 32, y: yy + 28, size: 26, color, weight: 700, opacity: appear * 0.9, family: 'latin' })
  ctx.text(title, { x: x + 32, y: yy + 68, size: 46, weight: 700, color: C.ink, opacity: appear })
  ctx.text(body, { x: x + 32, y: yy + 140, size: 26, color: C.dim, opacity: appear * 0.95, maxWidth: w - 64, lineHeight: 1.5 })
}

/** 勾/叉图标 */
export function tick(ctx, cx, cy, size, color, opacity = 1) {
  ctx.line(cx - size * 0.5, cy, cx - size * 0.12, cy + size * 0.42, { color, width: size * 0.16, opacity })
  ctx.line(cx - size * 0.12, cy + size * 0.42, cx + size * 0.55, cy - size * 0.42, { color, width: size * 0.16, opacity })
}
export function cross(ctx, cx, cy, size, color, opacity = 1) {
  const d = size * 0.42
  ctx.line(cx - d, cy - d, cx + d, cy + d, { color, width: size * 0.16, opacity })
  ctx.line(cx + d, cy - d, cx - d, cy + d, { color, width: size * 0.16, opacity })
}

/** 终端风格的代码行 */
export function codeBox(ctx, { x, y, w, h, lines, appear = 1, color = C.teal }) {
  ctx.rect(x, y, w, h, { fill: '#070d16', r: 16, opacity: 0.95 * appear })
  ctx.rect(x, y, w, h, { stroke: true, color: C.panelEdge, width: 2, r: 16, opacity: appear })
  lines.forEach((ln, i) => {
    ctx.text(ln, { x: x + 26, y: y + 26 + i * 46, size: 22, color: i === 0 ? color : '#a8bdd6', family: 'mono', opacity: appear, maxWidth: w - 52, lineHeight: 1.35 })
  })
}

/** 底部渐隐带：用 26 条细矩形模拟渐变，避免字幕区出现一条硬边 */
export function bottomFade(ctx, { y0 = 880, y1 = 1080, color = '#04060b', alpha = 0.72, w = 1920, steps = 26 } = {}) {
  const hh = (y1 - y0) / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    ctx.rect(0, y0 + i * hh, w, hh + 1, { fill: color, opacity: alpha * t * t })
  }
}
