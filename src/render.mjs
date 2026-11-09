// 渲染器：CanvasKit 出 RGBA 帧 → 管道喂 ffmpeg → mp4。
// 与 Remotion 的 renderMedia 对位，但不需要浏览器。
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { makeSurface, readFrame, framePNG, ck } from './ck.mjs'
import { renderFrame } from './engine.mjs'

import { ffmpegTool, ffprobeTool, toolEnv } from './paths.mjs'

function spawnFFmpeg(args) {
  return spawn(ffmpegTool.cmd[0], [...ffmpegTool.cmd.slice(1), ...args], { env: toolEnv() })
}
function spawnFFprobe(args) {
  return spawn(ffprobeTool.cmd[0], [...ffprobeTool.cmd.slice(1), ...args], { env: toolEnv() })
}

export function probe(file) {
  return new Promise((resolve, reject) => {
    const p = spawnFFprobe(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
    const out = []; let err = ''
    p.stdout.on('data', (d) => out.push(d))
    p.stderr.on('data', (d) => { err += d })
    p.on('error', reject)
    p.on('close', () => { try { resolve(JSON.parse(Buffer.concat(out).toString())) } catch (e) { reject(new Error('probe failed: ' + err)) } })
  })
}

/** 渲染一段视频。range=[start,end) 便于先出「样片」 */
export async function renderVideo(comp, out, opts = {}) {
  const { fps = comp.fps, range = [0, comp.durationInFrames], crf = 20, preset = 'veryfast', onProgress } = opts
  const total = range[1] - range[0]
  const { surface, ctx } = makeSurface(comp.width, comp.height)
  const t0 = Date.now()
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const args = ['-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${comp.width}x${comp.height}`, '-r', String(fps), '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
  const proc = spawnFFmpeg(args)
  let err = ''
  proc.stderr.on('data', (d) => { err += d; if (err.length > 40000) err = err.slice(-20000) })
  const code = new Promise((resolve) => { proc.on('close', resolve); proc.on('error', () => resolve(-1)) })

  let frames = 0
  for (let f = range[0]; f < range[1]; f++) {
    ctx.bg('#000000')
    renderFrame(comp, ctx, f)
    const bytes = readFrame(surface)
    if (!proc.stdin.write(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))) {
      await new Promise((r) => proc.stdin.once('drain', r))
    }
    frames++
    if (frames % 10 === 0 || frames === total) {
      fs.writeFileSync(out + '.progress', JSON.stringify({ done: frames, total, elapsedMs: Date.now() - t0, fps: +(frames / ((Date.now() - t0) / 1000)).toFixed(2) }))
      if (onProgress) onProgress(frames, total, Date.now() - t0)
    }
  }
  proc.stdin.end()
  const exit = await code
  const ms = Date.now() - t0
  if (exit !== 0) throw new Error(`ffmpeg exit ${exit}: ${err.slice(-900)}`)
  return { frames, ms, fps: +(frames / (ms / 1000)).toFixed(2), out }
}

/** 单帧 PNG（关键画面复核用） */
export function renderStill(comp, frame, out) {
  const { surface, ctx } = makeSurface(comp.width, comp.height)
  ctx.bg('#000000')
  renderFrame(comp, ctx, frame)
  const png = framePNG(surface)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, png)
  return { out, bytes: png.length }
}

/** 关键画面拼版：一格一帧，一眼看完整条片子的节奏 */
export function renderSheet(comp, frames, out, { cols = 3, cellW = 560 } = {}) {
  const cellH = Math.round(cellW * comp.height / comp.width)
  const labelH = 34
  const rows = Math.ceil(frames.length / cols)
  const { surface, ctx } = makeSurface(cols * cellW, rows * (cellH + labelH))
  const src = makeSurface(comp.width, comp.height)
  ctx.bg('#0b0d12')
  const paint = new ck.Paint()
  paint.setAntiAlias(true)
  frames.forEach((f, i) => {
    ctx.bg === undefined
    src.ctx.bg('#000000')
    renderFrame(comp, src.ctx, f)
    src.surface.flush()
    const img = src.surface.makeImageSnapshot()
    const x = (i % cols) * cellW, y = Math.floor(i / cols) * (cellH + labelH)
    ctx.canvas.drawImageRect(img, ck.XYWHRect(0, 0, comp.width, comp.height), ck.XYWHRect(x, y, cellW, cellH), paint)
    img.delete()
    ctx.text(`f${f}  ${(f / comp.fps).toFixed(2)}s`, { x: x + 10, y: y + cellH + 4, size: 20, color: '#8ea7c4' })
  })
  const png = framePNG(surface)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, png)
  return { out, bytes: png.length, cells: frames.length }
}
