// 外部依赖定位：ffmpeg/ffprobe 与系统字体。
// 本包最初是给 Android 写的（Termux 二进制 + /system/fonts），但发布后要能在
// Linux/macOS 上用；所以这里全部走「环境变量 → 已知位置 → PATH」的降级链。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TERMUX_PREFIX = process.env.REMOLITE_TERMUX_PREFIX
  || path.join(os.homedir(), 'work', 'tbins', 'prefix', 'data', 'data', 'com.termux', 'files', 'usr')

const LINKER = '/system/bin/linker64'
const hasLinker = (() => { try { return fs.statSync(LINKER).isFile() } catch { return false } })()
const isFile = (p) => { try { return fs.statSync(p).isFile() } catch { return false } }

/** 定位一个外部工具：REMOLITE_<NAME> → Termux 前缀（Android）→ PATH 里的同名命令 */
export function resolveTool(name, envKey = `REMOLITE_${name.toUpperCase()}`) {
  const fromEnv = process.env[envKey]
  if (fromEnv) return { cmd: [fromEnv], path: fromEnv, env: {} }
  const termux = path.join(TERMUX_PREFIX, 'bin', name)
  if (isFile(termux)) {
    return {
      cmd: hasLinker ? [LINKER, termux] : [termux],
      path: termux,
      env: {
        LD_LIBRARY_PATH: path.join(TERMUX_PREFIX, 'lib'),
        PATH: `${path.join(TERMUX_PREFIX, 'bin')}:${process.env.PATH ?? ''}`,
        SSL_CERT_FILE: path.join(TERMUX_PREFIX, 'etc', 'tls', 'cert.pem'),
      },
    }
  }
  return { cmd: [name], path: name, env: {} }
}

export const ffmpegTool = resolveTool('ffmpeg')
export const ffprobeTool = resolveTool('ffprobe')

export function toolEnv(extra = {}) {
  return { ...process.env, ...ffmpegTool.env, TMPDIR: process.env.TMPDIR || os.tmpdir(), ...extra }
}

/* ---------- 字体 ---------- */
const FONT_CANDIDATES = {
  // 中文/日韩：Noto CJK（ttc）优先，其次 Android 的 HYQiHei，最后 macOS 的苹方
  NotoCJK: [
    '/system/fonts/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    'C:/Windows/Fonts/msyh.ttc',
  ],
  Roboto: [
    '/system/fonts/Roboto-Regular.ttf',
    '/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    'C:/Windows/Fonts/segoeui.ttf',
  ],
  HYQiHei: ['/system/fonts/DroidSansChinese.ttf'],
  RobotoMono: [
    '/system/fonts/DroidSansMono.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
  ],
}

/** 返回可用的字体表 [{name, file}]；REMOLITE_FONTS="名字=路径,名字=路径" 可完全接管 */
export function resolveFonts() {
  if (process.env.REMOLITE_FONTS) {
    return process.env.REMOLITE_FONTS.split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
      const [name, file] = pair.split('=').map((x) => x.trim())
      if (!isFile(file)) throw new Error(`REMOLITE_FONTS 指定的字体不存在: ${file}`)
      return { name, file }
    })
  }
  const out = []
  for (const [name, paths] of Object.entries(FONT_CANDIDATES)) {
    const file = paths.find(isFile)
    if (file) out.push({ name, file })
  }
  return out
}

/** 中英混排的字体族顺序：能用的排前面，永远留一个兜底 */
export function fontFamilies(fonts) {
  const names = fonts.map((f) => f.name)
  const order = ['NotoCJK', 'Roboto', 'HYQiHei', 'RobotoMono']
  const sorted = order.filter((n) => names.includes(n))
  return sorted.length ? sorted : names
}
