# remotion-lite

**用代码做视频，但不用浏览器。** 作者层直接拿官方 [Remotion](https://www.remotion.dev) 的帧模型与数学库，
渲染层换成 **CanvasKit（Skia 的 WASM 版）+ ffmpeg** —— 于是它能在 **Android 手机上**（没有 Chrome、没有 GPU）跑起来。

Programmatic video without a browser: keep Remotion's authoring layer (`interpolate`, `spring`, `Easing`, `Sequence`),
swap the renderer for CanvasKit + ffmpeg. Runs on Android (Termux/DSH), Linux and macOS — anywhere Node 20+ and ffmpeg exist.

```
npm i remotion-lite
```

## 为什么不是 Remotion 本体

Remotion 官方的渲染器要一个 **Chrome Headless Shell** 去截 DOM 帧。在 Android 上：

```js
import { ensureBrowser } from '@remotion/renderer'
await ensureBrowser()
// Error: Unsupported platform: android      ← 0ms 就抛，连下载都不尝试
```

Chrome-for-Testing 根本没有 android 构建，装 Chrome 也救不了（bionic 与 glibc）。
**但 `remotion` 这个包本身能跑**：`spring({frame:10,fps:30,config:{damping:10,mass:1,stiffness:100}}) = 1.1552855913778497` —— 数学是真的。

所以能做的是：**复用它的作者层，换掉「谁把这一帧画成像素」**。

| Remotion | remotion-lite | 备注 |
|---|---|---|
| `interpolate` / `spring` / `Easing` / `interpolateColors` / `random` | **同一个函数**（直接 re-export 官方包） | 数学逐位一致，不是仿制 |
| `useCurrentFrame()` / `useVideoConfig()` | 同名 hook | 场景内是局部帧，等同 `<Sequence>` 语义 |
| `<Sequence from durationInFrames>` | `scene(from, durationInFrames, draw)` | |
| `<Composition id fps width height durationInFrames>` | `compose({...})` | |
| `<AbsoluteFill>` / CSS | `ctx.rect/circle/text/image` | **没有 DOM**，布局自己算坐标 |
| `renderMedia()`（Chrome 截帧） | `renderVideo()`（CanvasKit → RGBA → ffmpeg） | 没有浏览器 |

## 一条命令

```sh
npx remolite info   comp.mjs
npx remolite still  comp.mjs --frame 90 --out out/k.png        # 关键画面
npx remolite sheet  comp.mjs --frames 60,120,180 --out out/sheet.png
npx remolite render comp.mjs --out out/sample.mp4 --range 0-170   # 样片
npx remolite render comp.mjs --out out/final.mp4 --crf 20 --props props.json
npx remolite probe  out/final.mp4
```

## 写一条片子

```js
// comp.mjs
import { compose, scene, spring, interpolate, useVideoConfig, getInputProps } from 'remotion-lite'
import { bgImage } from 'remotion-lite/src/paint.mjs'

function hook(ctx, f) {
  const { fps } = useVideoConfig()
  ctx.image(bgImage({ w: 1920, h: 1080, top: '#101a2c', bottom: '#04060b' }), 0, 0)
  const s = spring({ frame: f, fps, config: { damping: 13, mass: 0.9, stiffness: 108 } })
  ctx.text('用代码做视频', {
    x: 0, y: interpolate(s, [0, 1], [660, 392]),
    size: 176, weight: 700, align: 'center', maxWidth: 1920, opacity: s,
  })
}

export default compose({
  id: 'demo', fps: 30, width: 1920, height: 1080, durationInFrames: 300,
  scenes: [scene(0, 300, hook)],
})
```

场景是 **`(ctx, localFrame) => void` 的纯函数**：同一个帧号必然画出同一张图（实测同帧渲染 PNG 的 md5 一致）。
全片级的叠加层（字幕、进度条、水印）写在 `compose({ draw })` 里，拿到的是全局帧号。

画布 API：`rect` / `circle` / `line` / `path` / `text` / `image` / `radial` / `glow`，加 `save/restore/translate/scale/rotate/clipRect`。
`ctx.text` 支持 `align: 'center'|'right'`、`maxWidth` 自动折行（中英混排走字体 fallback 链）、`weight>=600` 用「双击偏移」模拟粗体（多数系统没有 CJK 粗体面）。

## 实测（1920×1080 / 30fps，Android arm64，纯 CPU）

| 项目 | 数字 |
|---|---|
| 1260 帧（42 秒）渲染 | **124.5 s**，平均 **10.1 fps** |
| 成片体积 | 2.10 MB（h264 yuv420p，crf 20） |
| `remotion` 包导入 | 47 ms |
| CanvasKit wasm 初始化 | 52 ms |

**画像素的 5 条坑（都在这台机器上量过，决定了引擎怎么写）**：

1. 带 alpha 的图片贴图 ≈ **30–40 ms / 800×180**，不透明图 1:1 贴图 **0.1 ms** —— 所以静态背景一律在 JS 里算像素、
   烘成**不透明**图（`src/paint.mjs` + `bakeOpaque`），每帧只做一次 1:1 blit。
2. **缩放贴图**（`drawImageRect` 拉伸，即使 nearest）≈ **420–600 ms/帧**。
3. `MaskFilter` 高斯模糊（光晕）≈ **133 ms/帧**（半径 160）；用多圈低 alpha 圆或直接烘进背景代替。
4. 全屏渐变 shader ≈ **157 ms/帧**；在 JS 里算进背景图（一次性 ~84 ms）。
5. 便宜的是：实心矩形/线段/小圆（0–3 ms）、文本段落（132 px ≈ 9 ms，带缓存）、不透明 1:1 贴图（0.1 ms）。

## 外部依赖

- **ffmpeg / ffprobe**：按 `REMOLITE_FFMPEG` / `REMOLITE_FFPROBE` → Termux 前缀（Android）→ `PATH` 的顺序找。
- **字体**：按已知位置自动探测（`/system/fonts`、`/usr/share/fonts`、macOS 西文/CJK）；
  也可以 `REMOLITE_FONTS="NotoCJK=/path/NotoSansCJK-Regular.ttc,Roboto=/path/Roboto-Regular.ttf"` 完全接管。
- 装不上/找不到字体时会直接抛错，不会静默画成豆腐块。

## 边界

- 没有 DOM/CSS：flex、grid、CSS 动画、`<Html5Video>` 都没有；
- 视频素材嵌入未实现（要先用 ffmpeg 解帧再贴图）；
- 单线程 CPU 渲染：手机 10 fps 量级、桌面会快很多，但别指望 `@remotion/renderer` 那种并行度。
- **关于 Remotion 的许可**：本包自己的代码是 MIT；但它 `dependencies` 里的 `remotion` 受
  [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) 约束（个人与小公司免费，
  达到规模的公司需要商业许可）。用之前请按你的实体类型确认。
- 本项目与 Remotion 官方无隶属关系，只是复用了它公开的 npm 包。

## 目录

```
bin/remolite.mjs   CLI
src/engine.mjs     Remotion 数学再导出 + 帧上下文 + compose/scene
src/ck.mjs         CanvasKit 封装：颜色、段落缓存、绘制原语、烘焙
src/render.mjs     渲染循环：帧 → RGBA → ffmpeg 管道
src/paint.mjs      JS 逐像素生成背景（渐变/网格/光晕/暗角）
src/paths.mjs      ffmpeg / 字体的跨平台定位
src/ui.mjs         卡片、章节标签、勾叉、代码框、字幕渐隐带
src/videos/*.mjs   示例片子
tools-music.mjs    Node 合成 BGM（无依赖）
tools-mux.mjs      ffmpeg 混流
tools-frames.mjs   从成片抽帧复核
```

MIT © 2026 Verchiel666

## English

`remotion-lite` renders video with Remotion's authoring layer and a CanvasKit(Skia/WASM) + ffmpeg backend —
no Chrome, no DOM, works on Android. Compositions are pure functions of the frame index, so renders are deterministic.
The package is MIT; the `remotion` dependency keeps its own license.
