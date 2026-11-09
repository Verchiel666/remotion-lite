// 从成片里抽帧做复核（不重新渲染，验证的是真正编码后的像素）
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ffmpegTool, toolEnv } from './src/paths.mjs'
const [file, times = '1,8,15', outDir = 'out/frames'] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
for (const t of times.split(',')) {
  const out = path.join(outDir, `t${t.replace('.', '_')}.png`)
  await new Promise((res, rej) => {
    const p = spawn(ffmpegTool.cmd[0], [...ffmpegTool.cmd.slice(1), '-y', '-loglevel', 'error', '-ss', t, '-i', file, '-frames:v', '1', out], { env: toolEnv() })
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))))
  })
  console.log('→', out, fs.statSync(out).size, 'B')
}
