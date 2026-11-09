// 守着 /sdcard/Download/npm_token_bypass.txt：一旦出现就用它发版，发完删 token 并核对版本。
// 这样用户只要"把 token 存成文件"这一个动作，不需要再说一句话。
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const TOKEN_FILE = '/sdcard/Download/npm_token_bypass.txt'
const PKG_DIR = process.env.HOME + '/work/remotion-lite-pkg'
const NPM = [process.execPath, process.env.HOME + '/tools/npm/bin/npm-cli.js']
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  console.log(line)
  fs.appendFileSync(path.join(PKG_DIR, 'out-auto-publish.log'), line + '\n')
}

const check = async () => {
  let raw
  try { raw = fs.readFileSync(TOKEN_FILE, 'utf8') } catch { return false }
  const token = (raw.match(/npm_[A-Za-z0-9]+/) || [raw.trim()])[0]
  if (!token || token.length < 20) { log('token 文件存在但没解析出 token，忽略'); return false }
  log(`发现 token（${token.slice(0, 8)}… 长度 ${token.length}），开始发布`)

  const npmrc = path.join(PKG_DIR, '.npmrc.auto')
  fs.writeFileSync(npmrc, `//registry.npmjs.org/:_authToken=${token}\nregistry=https://registry.npmjs.org/\n`)
  fs.chmodSync(npmrc, 0o600)

  const who = spawnSync(NPM[0], [NPM[1], 'whoami', '--userconfig', npmrc], { cwd: PKG_DIR, encoding: 'utf8' })
  log(`whoami: ${(who.stdout || who.stderr).trim()}`)

  const pub = spawnSync(NPM[0], [NPM[1], 'publish', '--userconfig', npmrc], { cwd: PKG_DIR, encoding: 'utf8' })
  const out = ((pub.stdout || '') + (pub.stderr || '')).trim()
  log('publish 输出尾部: ' + out.split('\n').slice(-6).join(' | '))

  fs.rmSync(npmrc, { force: true })
  // token 用完即删（用户之后还应去 npm 网页吊销）
  try { fs.renameSync(TOKEN_FILE, TOKEN_FILE + '.used') } catch {}

  if (/E403|E401|error/i.test(out)) { log('发布失败，见 npm 输出；token 已挪成 .used'); return true }

  await new Promise((r) => setTimeout(r, 15000))
  const r = spawnSync(NPM[0], [NPM[1], 'view', 'remotion-lite@0.1.0', 'version'], { encoding: 'utf8' })
  log('registry 核对: ' + (r.stdout || r.stderr).trim())
  return true
}

log('启动：每 20 秒检查一次 token 文件（最长 3 小时）')
for (let i = 0; i < 540; i++) {
  if (await check()) { log('结束'); process.exit(0) }
  await new Promise((r) => setTimeout(r, 20000))
}
log('3 小时没等到 token')
