// 把无声视频与音乐轨混流：ffmpeg -shortest，AAC 128k，视频流直接 copy
import { spawn } from 'node:child_process'
import { ffmpegTool, toolEnv } from './src/paths.mjs'
const [video, audio, out] = process.argv.slice(2)
if (!video || !audio || !out) { console.error('用法: node tools-mux.mjs <video> <audio> <out>'); process.exit(1) }
const args = ['-y', '-loglevel', 'error', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]
const p = spawn(ffmpegTool.cmd[0], [...ffmpegTool.cmd.slice(1), ...args], { env: toolEnv() })
let err = ''
p.stderr.on('data', (d) => { err += d })
p.on('close', (code) => {
  if (code !== 0) { console.error('mux failed', code, err.slice(-500)); process.exit(1) }
  console.log('muxed →', out)
})
