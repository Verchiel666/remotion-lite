// 用 Node 合成一条 42s 的氛围音乐（无外部依赖、可复现）
import fs from 'node:fs'
const SR = 44100, DUR = 42, N = SR * DUR
const L = new Float32Array(N), R = new Float32Array(N)
const noteHz = (m) => 440 * Math.pow(2, (m - 69) / 12) // MIDI -> Hz
const CHORDS = [
  [48, 55, 60, 64, 67], // Cmaj7-ish
  [45, 52, 57, 60, 64], // Am7
  [41, 48, 53, 57, 60], // Fmaj7
  [43, 50, 55, 59, 62], // G
]
const CHORD_LEN = 42 / 8
for (let c = 0; c < 8; c++) {
  const chord = CHORDS[c % 4]
  const t0 = c * CHORD_LEN, t1 = t0 + CHORD_LEN + 1.4
  for (const m of chord) {
    const f = noteHz(m)
    const pan = ((m % 7) / 7) * 2 - 1
    for (let i = Math.floor(t0 * SR); i < Math.min(N, t1 * SR); i++) {
      const t = i / SR - t0
      const env = Math.min(1, t / 0.9) * Math.exp(-Math.max(0, t - 1.2) * 0.55)
      const v = (Math.sin(2 * Math.PI * f * t) * 0.60 + Math.sin(2 * Math.PI * f * 2 * t) * 0.14 + Math.sin(2 * Math.PI * f * 3.02 * t) * 0.05) * env * 0.052
      L[i] += v * (1 - pan) ; R[i] += v * (1 + pan)
    }
  }
}
// 低音脉冲 + 钟声点缀
for (let beat = 0; beat < DUR; beat += 1) {
  const t0 = beat
  for (let i = Math.floor(t0 * SR); i < Math.min(N, (t0 + 0.5) * SR); i++) {
    const t = i / SR - t0
    const v = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 12) * 0.10
    L[i] += v; R[i] += v
  }
}
const PENTA = [72, 74, 76, 79, 81, 84]
for (let b = 2; b < DUR; b += 2) {
  const m = PENTA[(Math.floor(b / 2) * 3) % PENTA.length]
  const f = noteHz(m)
  for (let i = Math.floor(b * SR); i < Math.min(N, (b + 2.2) * SR); i++) {
    const t = i / SR - b
    const v = (Math.sin(2 * Math.PI * f * t) * 0.7 + Math.sin(2 * Math.PI * f * 2.01 * t) * 0.2) * Math.exp(-t * 1.9) * 0.030
    L[i] += v * 0.8; R[i] += v
  }
}
// 首尾淡入淡出 + 归一化
for (let i = 0; i < N; i++) {
  const t = i / SR
  const fade = Math.min(1, t / 1.5) * Math.min(1, (DUR - t) / 2.5)
  L[i] *= fade; R[i] *= fade
}
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
const g = 0.62 / (peak || 1)
const data = Buffer.alloc(44 + N * 4)
data.write('RIFF', 0); data.writeUInt32LE(36 + N * 4, 4); data.write('WAVE', 8)
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22)
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34)
data.write('data', 36); data.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * g * 32767))), 44 + i * 4)
  data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * g * 32767))), 46 + i * 4)
}
fs.mkdirSync('out', { recursive: true })
fs.writeFileSync('out/music.wav', data)
console.log('out/music.wav', (data.length / 1024 / 1024).toFixed(1), 'MB', DUR + 's', 'peak(归一前)', peak.toFixed(3))
