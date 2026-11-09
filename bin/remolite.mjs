#!/usr/bin/env node
// remotion-lite CLI：作者层用官方 Remotion 语义，渲染层用 CanvasKit + ffmpeg。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderStill, renderSheet, renderVideo, probe } from '../src/render.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const arg = (name, def) => {
  const i = rest.indexOf('--' + name)
  return i >= 0 ? rest[i + 1] : def
}
const has = (name) => rest.includes('--' + name)

async function loadComp(file) {
  const abs = path.resolve(file)
  const mod = await import(pathToFileURL(abs).href)
  const comp = mod.default
  if (!comp) throw new Error('组合文件必须 default 导出 compose(...) 的结果')
  const propsFile = arg('props')
  if (propsFile) Object.assign(comp.props, JSON.parse(fs.readFileSync(propsFile, 'utf8')))
  return comp
}

function usage() {
  console.log(`remotion-lite —— 在手机上用代码做视频（作者层=官方 Remotion，渲染层=CanvasKit+ffmpeg）

用法:
  remolite still  <comp.mjs> --frame 90 --out out/still.png
  remolite sheet  <comp.mjs> --frames 0,40,80,120 --out out/sheet.png [--cols 3] [--cellW 560]
  remolite render <comp.mjs> --out out/video.mp4 [--range 0-150] [--crf 20] [--preset veryfast] [--props props.json]
  remolite info   <comp.mjs>
  remolite probe  <video.mp4>`)
}

if (!cmd || cmd === 'help') { usage(); process.exit(0) }

const file = rest[0]
if (!file) { usage(); process.exit(1) }
if (cmd === 'probe') {
  const info = await probe(file)
  const v = info.streams.find((s) => s.codec_type === 'video')
  const a = info.streams.find((s) => s.codec_type === 'audio')
  console.log(JSON.stringify({ format: info.format.format_name, duration: info.format.duration, size: info.format.size, video: v && { codec: v.codec_name, size: v.width + 'x' + v.height, fps: v.r_frame_rate, pix: v.pix_fmt }, audio: a && { codec: a.codec_name, rate: a.sample_rate, ch: a.channels } }, null, 1))
  process.exit(0)
}
const comp = await loadComp(file)

if (cmd === 'info') {
  console.log(JSON.stringify({ id: comp.id, fps: comp.fps, size: `${comp.width}x${comp.height}`, durationInFrames: comp.durationInFrames, seconds: +(comp.durationInFrames / comp.fps).toFixed(2), scenes: comp.scenes.map((s) => ({ from: s.from, dur: s.durationInFrames })) }, null, 1))
} else if (cmd === 'still') {
  const frame = Number(arg('frame', 0))
  const out = arg('out', `out/${comp.id}-f${frame}.png`)
  const r = renderStill(comp, frame, out)
  console.log(`still f${frame} → ${r.out} (${(r.bytes / 1024).toFixed(0)} KB)`)
} else if (cmd === 'sheet') {
  const frames = String(arg('frames', '0')).split(',').map(Number)
  const out = arg('out', `out/${comp.id}-sheet.png`)
  const r = renderSheet(comp, frames, out, { cols: Number(arg('cols', 3)), cellW: Number(arg('cellW', 560)) })
  console.log(`sheet ${r.cells} 帧 → ${r.out} (${(r.bytes / 1024).toFixed(0)} KB)`)
} else if (cmd === 'render') {
  const rangeArg = arg('range')
  const range = rangeArg ? rangeArg.split('-').map(Number) : [0, comp.durationInFrames]
  const out = arg('out', `out/${comp.id}.mp4`)
  const t0 = Number(arg('start', 0))
  const r = await renderVideo(comp, out, {
    range: [range[0] + t0, range[1] + t0],
    crf: Number(arg('crf', 20)), preset: arg('preset', 'veryfast'),
    onProgress: (done, total, ms) => process.stdout.write(`\r  ${done}/${total} 帧  ${(done / (ms / 1000)).toFixed(1)} fps  ${(ms / 1000).toFixed(1)}s`),
  })
  console.log(`\n渲染完成 → ${r.out}  帧=${r.frames} 耗时=${(r.ms / 1000).toFixed(1)}s 平均=${r.fps} fps 体积=${(fs.statSync(r.out).size / 1024 / 1024).toFixed(2)} MB`)
  const info = await probe(r.out)
  const v = info.streams.find((s) => s.codec_type === 'video')
  console.log(`  校验: ${v.width}x${v.height} ${v.codec_name} ${v.pix_fmt} ${v.r_frame_rate} 时长=${info.format.duration}s`)
} else if (cmd === 'probe') {
  const info = await probe(file)
  console.log(JSON.stringify(info.format, null, 1))
} else { usage(); process.exit(1) }
