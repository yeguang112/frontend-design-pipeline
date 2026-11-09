# 前端设计链路 · 规则包工具脚本

零第三方依赖：只用 **Node 24 内置模块** + 本机 **Chrome/Edge**（CDP）。
不 `npm install`，不联网，不需要构建步骤。

```
HTML 静态稿 ──freeze──> 冻结基线 ──extract──> design tokens ──detect──> 漂移报告
                                     │
                                     └──capture──> 逐状态截图 ──pixel-diff──> 验收判定
```

## 目录

```
scripts/
├── lib/
│   └── cdp.mjs                共享库：浏览器探测 + headless 启动 + WebSocket CDP 客户端 + 通用工具
├── extract-tokens.mjs         HTML/CSS → tokens.json / tokens.css / tokens.md
├── detect-drift.mjs           扫描硬编码颜色、脱 scale、AI 味样式（12 条规则）
├── capture-acceptance.mjs     route × state × viewport × theme 逐状态截图 + manifest
├── verify-freeze.mjs          冻结快照校验（sha256 + bytes + 多余文件）/ 生成 manifest
├── pixel-diff.mjs             像素级对比（CDP canvas 引擎 / 纯 Node PNG 引擎）
├── README.md                  本文件
└── __fixtures__/              自测夹具（另附 4 个测试脚本，见「自测」）
```

行数：`lib/cdp.mjs` 1043、`extract-tokens` 830、`detect-drift` 639、`pixel-diff` 473、
`capture-acceptance` 419、`verify-freeze` 217（共约 3.6k 行，全部带顶部用法注释与 `--help`）。

## 退出码约定（全部脚本一致）

| 码 | 含义 |
| --- | --- |
| `0` | 通过 / 无违规 / 未超阈值 |
| `1` | 有违规、有变更、超阈值、或运行失败 |
| `2` | 用法错误（参数/配置写错，错误信息会告诉你怎么改） |

统一行为：**JSON 写到文件 + 打印人类可读摘要**；输出顺序稳定（排序、稳定 ID），可重复生成
（只有 `extractedAt` / `generatedAt` / `frozen_at` 这类时间戳会变）。

---

## 1. `lib/cdp.mjs` — 共享库

```bash
node lib/cdp.mjs                  # 自检：探测浏览器 → headless → evaluate → 截图 → 校验 → 清理
node lib/cdp.mjs --help
node lib/cdp.mjs --browser edge   # 指定浏览器（chrome / edge / exe 绝对路径）
```

**能力**

- 自动探测 `C:\Program Files\Google\Chrome\Application\chrome.exe`、
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`、
  `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`（另含 macOS/Linux 常见路径）；
  可用 `--browser` 或环境变量 `DSH_BROWSER_PATH` / `CHROME_PATH` 覆盖。
- 启动参数：`--headless=new --remote-debugging-port=0 --user-data-dir=<tmp> --no-first-run
  --disable-gpu --hide-scrollbars`（+ 若干稳定性开关、`--allow-file-access-from-files`），
  从 stderr 的 `DevTools listening on ws://…` 取端口；同时兜底读 `<user-data-dir>/DevToolsActivePort`。
- Node 全局 `WebSocket` 实现最小 CDP 客户端：request id 映射、并发请求、事件订阅、`flatten` 会话。
- API：`launchBrowser()` / `attachBrowser(wsUrl)` / `resolveCdpUrl()`、`Browser#newPage/version/close`、
  `Page#goto/evaluate/evaluateFn/screenshot/setDeviceMetrics/setEmulatedMedia/addInitScript/addStyleTag/
  waitForSelector/click/fill/hover/scrollTo/waitForTimeout/close`。
- 超时（默认 30s，可 `timeoutMs` 覆盖）、进程清理（`exit`/`SIGINT`/`SIGTERM`/未捕获异常）、
  临时 `user-data-dir` 结束后递归删除（Windows 占用会重试）。
- **受限环境兜底**：如果进程无法创建 stdio 管道（`spawn EPERM`，如 Windows AppContainer / 沙箱），
  自动降级为「stderr 重定向到日志文件 + 轮询」，语义不变。
- 通用工具（其它脚本复用）：`sha256Buf/sha256File/walkFiles/pngSize/parseColor/toHex/rgbToHsl/
  findColorLiterals/inDeclarationValue/splitTopLevel/parseCli/readJson/writeJson/die/humanBytes`。

> `attachBrowser()` 可以连**已经运行的** Chromium（默认不会 `Browser.close` 关掉用户的浏览器）：
> 先手动 `chrome.exe --remote-debugging-port=9222 --headless=new --user-data-dir=%TEMP%\cdp-profile`，
> 再给 `capture-acceptance` / `pixel-diff` 传 `--cdp-url http://127.0.0.1:9222`。

---

## 2. `extract-tokens.mjs` — 提 token

```bash
node extract-tokens.mjs __fixtures__/sample-site --out out-tokens
node extract-tokens.mjs path/to/index.html --out tokens --name design-tokens
node extract-tokens.mjs --help
```

输入：单个 `.html`（内联 `<style>`、`style=""` 属性、本地 `<link rel=stylesheet>`）或目录
（递归 `*.html` `*.css`，忽略 `node_modules/dist/build`）。

提取分类：`color` / `fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` /
`spacing` / `radius` / `shadow` / `borderWidth` / `duration` / `easing` / `zIndex` / `breakpoint`。

输出（`--out`，默认 `./tokens`；`--name`，默认 `tokens`）：

- **`tokens.json`** — W3C DTCG **风格**子集：

```jsonc
{
  "meta": { "generator": "extract-tokens.mjs@1.0.0", "extractedAt": "…", "inputHash": "…",
            "sources": [{ "file": "index.html", "sha256": "…", "bytes": 2510, "kind": "html" }],
            "assumptions": { "rootFontSize": 16, "emApprox": true },
            "counts": { "declarations": 137, "tokens": 59, "colors": 13 },
            "fontStacks": [...], "breakpoints": [{ "px": 640, "kinds": ["min"] }], "roles": { "#08090a": "bg" } },
  "color":     { "bg": { "$value": "#08090a", "$type": "color", "role": "bg",
                         "$extensions": { "design-pipeline": { "count": 3, "props": ["background"] } } } },
  "spacing":   { "4": { "$value": "16px", "$type": "dimension", "$extensions": { "design-pipeline": { "step": 4 } } } },
  "fontSize":  { "3": { "$value": "16px", "$type": "dimension" } },
  "scale":     { "spacing": [{ "step": "4", "value": "16px", "px": 16, "count": 5 }], "fontSize": [...] },
  "unmapped":  { "fontSize": [{ "value": 15, "count": 1, "representative": 16, "unit": "px" }] }
}
```

- **`tokens.css`** — `:root { --color-bg: #08090a; --space-4: 16px; … }`，按分类分组、名称排序。
- **`tokens.md`** — 每类一张表：`token | 值 | 角色 | 使用次数` + Scale + Unmapped + 源文件。

**命名规则** `--{category}-{semantic-or-step}`：

| 分类 | 规则 | 例 |
| --- | --- | --- |
| color | `--color-<role>`（推断不出角色用 `palette-N`） | `--color-bg`、`--color-accent`、`--color-palette-3` |
| fontFamily | `--font-<slug>` | `--font-inter` |
| fontSize / lineHeight / letterSpacing / spacing / radius / shadow | `--<分类>-<step>`（step = scale 序号 1..N，0 值单独保留为 `-0`） | `--font-size-3`、`--space-4`、`--radius-2` |
| fontWeight / duration / zIndex / borderWidth / breakpoint | 值本身 | `--font-weight-600`、`--duration-150`、`--z-100`、`--bp-640` |

**语义角色推断**（`role` 字段，不确定为 `null`）：按「出现频次 + 使用位置」启发 —
`body/html` 背景→`bg`；卡片/面板背景→`surface`；按钮背景/链接文字→`accent`；
`color` 且高亮度→`text`；`.muted/.secondary/.caption`→`muted`；`border*`→`border`；
`.danger/.success/.warning/.info`→对应语义；半透明背景→`overlay`；阴影里的色→`shadow`。
同名角色按使用次数保留第一个，其余加 `-2`/`-3`。

**Scale 聚类**：数值升序后，相邻值差 ≤ `max(minAbs, tolerance×值)` 合并（代表值取使用最多的），
不落在代表值上的进 `unmapped`（默认 tolerance：spacing/fontSize 6%、radius 8%、lineHeight 4%、
duration 15%）。`rem/em` 按 `--root-font-size`（默认 16）换算为 px；`em` 是近似值，记在 `meta.assumptions`。

---

## 3. `detect-drift.mjs` — 变更防漂移

```bash
node detect-drift.mjs __fixtures__/drift-project --tokens __fixtures__/tokens.json
node detect-drift.mjs ./src --tokens tokens/tokens.json --rules drift-rules.json \
     --json report.json --fail-on warn
node detect-drift.mjs --help
```

扫描 `.html .htm .css .scss .tsx .jsx .vue .wxss .wxml`（递归，忽略 `node_modules/dist/build/out/…`）。

**12 条内置规则**（可被 `--rules` 覆盖）：

| rule | 默认 severity | 说明 / 可配项 |
| --- | --- | --- |
| `hardcoded-color` | error | 颜色不在 tokens.json 的 color 集合；`allow: ["#ffffff"]` 白名单 |
| `ai-purple-gradient` | error | gradient 里 hue 250–300° 且饱和 > 60%；`hueMin/hueMax/satMin` |
| `glassmorphism` | error | `backdrop-filter` / `filter: …blur(` |
| `raw-font-family` | error | 非 token 字体（`var(--font-x)` 与 generic 家族不算） |
| `off-scale-font-size` | warn | `font-size` 不在字号阶梯；`tolerance` |
| `off-scale-spacing` | warn | `margin/padding/gap/inset` 不在间距刻度 |
| `off-scale-radius` | warn | `border-radius` 不在圆角刻度 |
| `inline-style` | warn | `style="…"` 内联样式 |
| `excessive-radius` | warn | `border-radius > 24px`；`max` |
| `emoji-icon` | warn | emoji 当图标；`allow: ["→","★"]` |
| `shadow-stack` | warn | 单条 `box-shadow` > 2 层；`maxLayers` |
| `magic-zindex` | info | `z-index` 不来自 token |

`rules.json` 示例：

```json
{
  "failOn": "error",
  "ignore": ["**/*.min.css", "vendor/**"],
  "rules": {
    "excessive-radius": { "max": 24, "severity": "warn" },
    "hardcoded-color": { "enabled": true, "severity": "error", "allow": ["#ffffff"] },
    "emoji-icon": { "allow": ["→"] }
  }
}
```

**`report.json` schema**

```jsonc
{
  "tool": "detect-drift.mjs@1.0.0", "generatedAt": "…", "projectDir": "…",
  "tokens": { "file": "…", "sha256": "…", "counts": { "colors": 6, "fontSize": 6, "spacing": 8, "radius": 3, "fontFamilies": 2, "zIndex": 2 } },
  "config": { "failOn": "error", "rules": { … }, "ignore": [] },
  "scanned": { "files": 4, "skippedByIgnore": 0, "bytes": 4123 },
  "summary": { "total": 40, "bySeverity": { "error": 21, "warn": 17, "info": 2 },
               "byRule": [{ "rule": "hardcoded-color", "severity": "error", "count": 16 }] },
  "violations": [
    { "rule": "hardcoded-color", "severity": "error", "file": "sample.css", "line": 15, "column": 15,
      "snippet": "background: #1a1b20;", "message": "硬编码颜色 #1a1b20（#1a1b20）不在 tokens.json 的 color 集合里",
      "howToFix": "改用 var(--color-<role>)；…", "detail": { "color": "#1a1b20" } }
  ]
}
```

排序：severity（error→info）→ file → line → column → rule，**确定性输出**。
有 `severity >= --fail-on`（默认 `error`）的违规即 `exit 1`。

---

## 4. `capture-acceptance.mjs` — 逐状态截图验收

```bash
node capture-acceptance.mjs --config __fixtures__/accept.config.json
node capture-acceptance.mjs --config accept.config.json --dry-run     # 只校验矩阵，不起浏览器
node capture-acceptance.mjs --config accept.config.json --cdp-url http://127.0.0.1:9222
node capture-acceptance.mjs --help
```

配置（字段与示例见 `__fixtures__/accept.config.json`）：

```jsonc
{
  "baseUrl": "file:///D:/proj/prototype/index.html",   // 或相对 config 的路径（自动转 file://）、http(s)
  "out": "acceptance",                                  // 相对 config 文件目录
  "viewport": { "width": 1440, "height": 900, "deviceScaleFactor": 2 },
  "viewports": [ { "width": 1440, "height": 900 }, { "width": 390, "height": 844 } ],  // 可选多视口
  "themes": ["light", "dark"],
  "routes": [ { "id": "home", "path": "#/home" }, { "id": "settings", "path": "#/settings" } ],
  "states": [
    { "id": "default", "actions": [] },
    { "id": "menu-open", "actions": [ { "type": "click", "selector": "#menu-btn" } ] },
    { "id": "empty", "actions": [ { "type": "eval", "script": "window.__setEmpty && window.__setEmpty()" } ] }
  ],
  "freezeAnimations": true,   // 注入 *,*::before,*::after{animation:none!important;transition:none!important;
                              // caret-color:transparent!important} + prefers-reduced-motion: reduce
  "waitMs": 300,              // 截图前静置
  "fullPage": true,           // 默认整页；false = 仅视口
  "settleAfterActions": 0, "timeoutMs": 30000, "format": "png", "themeStrategy": "both"
}
```

动作：`click` / `fill` / `eval` / `wait`（`ms` 或 `selector`）/ `scroll` / `hover` / `none`（`screenshot-only`）。
主题切换同时做四件事：`documentElement.dataset.theme` + `classList`(`dark`/`light`) +
`style.colorScheme` + CDP `Emulation.setEmulatedMedia(prefers-color-scheme)`；
若有 `window.__setTheme(theme)` 也会调用；并在新文档注入脚本预设 `localStorage.theme`（适配自己读存储的原型）。

输出：

```
<out>/<route>/<state>--<w>x<h>--<theme>.png     # 每张截图
<out>/manifest.json
```

```jsonc
{
  "tool": "capture-acceptance.mjs@1.0.0", "startedAt": "…", "finishedAt": "…",
  "config": { … }, "browser": { "name": "Google Chrome", "path": "…", "version": "…" },
  "summary": { "total": 8, "ok": 8, "failed": 0, "bytes": 2_400_000,
               "byTheme": { "light": 4, "dark": 4 }, "byRoute": { "home": 4, "settings": 4 } },
  "captures": [ { "index": 0, "route": "home", "state": "default", "theme": "light",
                  "viewport": { "width": 1440, "height": 900, "deviceScaleFactor": 2 },
                  "url": "file:///…#/home", "file": "home/default--1440x900--light.png",
                  "ok": true, "durationMs": 812, "sha256": "…", "bytes": 302_113,
                  "width": 2880, "height": 1800, "error": null } ],
  "failed": [ { "file": "…", "error": "action#1 (click #menu-btn) 失败: …" } ]
}
```

单个组合失败不会中断其它组合，最后汇总 `failed[]` 并 `exit 1`。

---

## 5. `verify-freeze.mjs` — 冻结 / 校验

```bash
# 冻结（生成基线 manifest）
node verify-freeze.mjs --write path/to/prototype --label "v1 baseline"
# 校验
node verify-freeze.mjs freeze-manifest.json [--base path/to/prototype] [--json freeze-report.json]
node verify-freeze.mjs --help
```

manifest 格式：

```json
{ "version": 1, "frozen_at": "2026-11-07T11:43:11.495Z",
  "files": { "index.html": { "sha256": "…", "bytes": 484 },
             "css/app.css": { "sha256": "…", "bytes": 812 } },
  "meta": { "tool": "verify-freeze.mjs@1.0.0", "root": "…", "fileCount": 3, "totalBytes": 1200, "label": "v1 baseline" } }
```

校验结果四类：**PASS**（sha256+bytes 一致）/ **MODIFIED** / **MISSING** / **EXTRA**（目录里多出来的
UI 文件）。UI 扩展名：`html css scss sass less styl tsx jsx ts js mjs cjs vue svelte wxml wxss svg png jpg
jpeg webp avif gif ico json md`；`--strict-extras` 时任意扩展名都算 EXTRA。
`freeze-manifest.json` / `freeze-report.json` / `drift-report.json` 自动排除。

```jsonc
{ "tool": "verify-freeze.mjs@1.0.0", "generatedAt": "…",
  "manifest": { "file": "…", "version": 1, "frozen_at": "…", "fileCount": 3, "label": "v1 baseline" },
  "baseDir": "…",
  "summary": { "total": 3, "pass": 1, "modified": 1, "missing": 1, "extra": 1, "changed": 3, "status": "FAIL", "strictExtras": false },
  "modified": [ { "file": "index.html", "expectedSha256": "…", "actualSha256": "…", "expectedBytes": 484, "actualBytes": 515, "reason": "sha256 13d332… -> 6c4def…; bytes 484 -> 515" } ],
  "missing": [ { "file": "css/app.css" } ],
  "extra":   [ { "file": "new-page.html", "bytes": 34 } ],
  "pass": ["assets/logo.svg"] }
```

---

## 6. `pixel-diff.mjs` — 像素对比

```bash
node pixel-diff.mjs ref.png cur.png                      # 默认 threshold 0.003，auto 引擎
node pixel-diff.mjs ref.png cur.png --threshold 0 --out diff.json
node pixel-diff.mjs ref.png cur.png --engine node --channel-threshold 2
node pixel-diff.mjs --help
```

两种引擎：

- **`cdp`**（`auto` 下优先）：起 headless → 空白页 → 两张 PNG 以 `dataURL` 载入 `<canvas>` →
  `getImageData` 逐像素比较 → `toDataURL` 生成差异图。半透明像素有 ±1 舍入。
- **`node`**：纯 Node 解码 PNG（`zlib.inflateSync` + 逐行反滤波），逐字节精确；支持 8-bit、
  非隔行、colorType 0/2/3/4/6（含 PLTE/tRNS）。不需要浏览器。
- **`auto`**：先试 `cdp`，失败自动降级 `node` 并打印原因（受限环境 / 无浏览器时仍然可用）。

`比例 = changedPixels / totalPixels`；`默认阈值 0.003 = 0.3%`，超阈值 FAIL；**尺寸不一致直接 FAIL**。
`--channel-threshold n`：单像素任一通道差 ≤ n 视为相同（1–2 可吸收字体抗锯齿抖动）。

输出：diff JSON（默认 `<cur>.diff.json`）+ 差异图（默认 `<cur>.diff.png`，差异像素涂纯红 `#ff0000`，
其余像素保留 cur 原样）。

```jsonc
{ "tool": "pixel-diff.mjs@1.0.0", "generatedAt": "…",
  "ref": { "path": "…", "sha256": "…", "bytes": 849, "width": 240, "height": 160, "format": "png" },
  "cur": { … },
  "params": { "threshold": 0.003, "channelThreshold": 0, "engine": "auto" },
  "engine": "node",
  "result": { "width": 240, "height": 160, "totalPixels": 38400, "changedPixels": 1,
              "ratio": 0.000026, "maxChannelDelta": 237, "meanChannelDelta": 237,
              "bbox": { "x": 120, "y": 80, "width": 1, "height": 1 }, "identical": false },
  "status": "PASS", "reason": "ratio 0.000026 <= threshold 0.003（1 像素差异，在容忍范围内）",
  "diffImage": "D:\\…\\one-pixel.diff.png" }
```

---

## 自测

```bash
cd scripts
node __fixtures__/self-test.mjs          # 一条命令跑全部（21 项断言）
```

实际输出（本机 Node v24.17.0 / Windows 11）：

```
✔ --help extract-tokens.mjs                  exit 0
✔ --help detect-drift.mjs                    exit 0
✔ --help capture-acceptance.mjs              exit 0
✔ --help verify-freeze.mjs                   exit 0
✔ --help pixel-diff.mjs                      exit 0
✔ --help lib/cdp.mjs                         exit 0
✔ lib/cdp.mjs mock 协议层                       exit 0        （12 项：并发 id 映射/事件/异常/超时/PNG）
✔ extract-tokens fixture 站点                  exit 0        13 色 / 8 间距步进 / 6 字号步进
✔ detect-drift 违规 fixture                    exit 1        40 条违规 / 12 规则全命中 / error 21
✔ detect-drift 干净 fixture（0 误报）              exit 0        total=0
✔ verify-freeze --write                      exit 0        3 文件
✔ verify-freeze PASS                         exit 0
✔ verify-freeze 有变更 FAIL                     exit 1        MODIFIED 1 / MISSING 1 / EXTRA 1
✔ capture-acceptance dry-run                 exit 0
✔ capture-acceptance 真实截图（mock CDP）          exit 0        8 张 PNG（2 route × 2 state × 2 theme）
✔ gen-pixel-fixtures                         exit 0
✔ pixel-diff 同图 PASS                         exit 0        changed=0 ratio=0
✔ pixel-diff 改 1 像素默认阈值 PASS                 exit 0        1/38400, ratio=0.000026
✔ pixel-diff 改 1 像素 --threshold 0 FAIL       exit 1
✔ pixel-diff 16x16 超阈值 FAIL                  exit 1        ratio=0.003906 > 0.003
✔ pixel-diff 尺寸不一致 FAIL                      exit 1        尺寸不一致: ref 240x160 vs cur 120x80

✔ 21/21 通过
```

单项复跑（等价于 self-test 里的一行）：

```bash
node extract-tokens.mjs __fixtures__/sample-site --out __fixtures__/out-tokens
node detect-drift.mjs __fixtures__/drift-project --tokens __fixtures__/tokens.json --json out/drift.json
node verify-freeze.mjs --write __fixtures__/freeze --force
node verify-freeze.mjs __fixtures__/freeze/freeze-manifest.json
node verify-freeze.mjs __fixtures__/freeze/freeze-manifest.json --base out/mutated     # 改/删/增后 -> 1
node capture-acceptance.mjs --config __fixtures__/accept.config.json --dry-run
node __fixtures__/gen-pixel-fixtures.mjs
node pixel-diff.mjs __fixtures__/pixel/ref.png __fixtures__/pixel/same.png --engine node
node pixel-diff.mjs __fixtures__/pixel/tiny-ref.png __fixtures__/pixel/tiny-one-pixel.png --engine node
```

测试资产（`__fixtures__/`）：`sample-site/`（干净 token 站点，含外链 CSS + @media）、
`drift-project/`（sample.html + sample.css + component.tsx + **clean.css 零违规对照组**）、
`tokens.json`（drift 用 token 基线）、`accept-site/` + `accept.config.json` / `accept.config.extended.json`、
`freeze/`（冻结基线）、`pixel/`（由 `gen-pixel-fixtures.mjs` 生成的 7 张 PNG）、
`mock-cdp-server.mjs` + `test-lib-cdp.mjs`（假 CDP 服务器，用于无浏览器环境验证协议层）、
`self-test.mjs`（总控）。
负例（验证用法错误退出码）：`bad.config.json`（非法 action → 2）、`bad-rules.json`（未知规则 → 2）、
`drift-rules.json`（规则覆盖示例：`excessive-radius.max=40` + `hardcoded-color.severity=warn`）。
`out-*/` 是自测产物（可随时删除，重跑 `self-test.mjs` 会重新生成）。

---

## 已知限制

### 环境限制（重要）

**在 DSH 的 Windows 文件沙箱会话里，Chrome / Edge 都启动不了。** 不是脚本 bug：
Chromium 的 crashpad 需要 `OpenProcess`，被沙箱 token 拒绝后会自己退出：

```
[ERROR:crashpad_client_win.cc:431] OpenProcess: 拒绝访问。 (0x5)
[ERROR:crashpad_client_win.cc:145] crash server failed to launch, self-terminating
```

实测 Chrome `149.x` 与 Edge 同样退出（`--disable-breakpad` / `--no-sandbox` / `--disable-crash-reporter`
等都无效）。因此：

- 在本会话内，**`capture-acceptance` 只验证到 `--dry-run`**（矩阵/命名/配置校验），
  实际截图用 **mock CDP** 验证了整条链路（8/8 PNG 落盘 + manifest + sha256）；
- **`pixel-diff` 默认 `auto` 会自动降级到 `node` 引擎**，功能完整可用。

在**普通终端 / CI**（不受沙箱限制）里直接 `node lib/cdp.mjs` 自检即可确认浏览器链路；也可以先手动起
Chrome（`--remote-debugging-port=9222`）再用 `--cdp-url` 连上去。脚本对这类失败会给出一句话可执行的提示，
而不是抛堆栈。

### 工具本身

- **CDP 后端只支持 Chromium**（Chrome / Edge / Chromium 系）。Firefox 用 WebDriver BiDi，Safari 用 WebKit
  调试协议，均不支持。
- **`file://` 截图存在字体差异**：不同机器/DPI/字体版本渲染同一页面像素必然不同；跨机对比前先统一字体环境
  （或改用容器内固定字体渲染）。对比同一机器同一浏览器的两张图没有这个问题。
- `pixel-diff` 的 `node` 引擎只支持 **8-bit、非隔行 PNG**（Chrome 截图、canvas 导出、`toDataURL` 都满足）；
  16-bit / Adam7 会明确报错并建议用 `--engine cdp`。cdp 引擎经 canvas 往返，**半透明像素可能有 ±1 舍入**。
- `detect-drift` 是**行级正则 + 启发式**，没有完整 AST：
  - 颜色是否处于「声明值位置」用启发式判断，跨行选择器（`#abc,\n.def {`）极少见写法可能误判；
  - `inline-style` 只看 `style="…"`（以及 JSX 的 `style={{…}}` 不会被判为内联——那本来就是对象写法）；
  - emoji 检测按 Unicode 区段，箭头/数学符号等已默认白名单，仍可能有误报，用 `rules.json` 的 `allow` 调；
  - JS 里形如 `https://` 的 `//` 已排除，但 `font: 14px/1.5 "X"` 这类简写只抓字号/行高。
- `extract-tokens`：
  - `em` 按 `rootFontSize` 近似换算为 px（`assumptions.emApprox`），不解析实际继承链；
  - 只解析 HTML 内联/外链 CSS 与 `.css` 文件，**不解析** SCSS/Less 变量与 `@use`；
  - `var(--x)` 引用不会展开（正常情况本来也不需要展开）；
  - 角色推断是启发式，`role: null` 是正常输出（用 `palette-N` 命名）。
- `capture-acceptance` 的 `waitMs` 是**固定静置**，不做视觉稳定性检测；异步数据页面请在 `states[].actions`
  里加 `{"type":"wait","selector":"#loaded"}` 之类的显式等待。
- `verify-freeze` 只校验**文件内容**（sha256 + bytes），不校验文件权限/时间戳（时间戳会变，不适合做基线）。
- 所有时间戳（`extractedAt` / `generatedAt` / `frozen_at`）会变化；其余排序与 ID 都是确定性的。

## 与规则包其它部分的衔接

1. **设计稿定稿** → `node verify-freeze.mjs --write prototype/ --label "v1"`
2. **提 token** → `node extract-tokens.mjs prototype/ --out design/tokens`
3. **改代码后查漂移** → `node detect-drift.mjs src/ --tokens design/tokens/tokens.json --json reports/drift.json`
4. **验收截图** → `node capture-acceptance.mjs --config accept.config.json`
5. **比对基线** → `node pixel-diff.mjs baseline/home.png acceptance/home/default--1440x900--light.png`
6. **确认未改冻结稿** → `node verify-freeze.mjs freeze-manifest.json --base prototype/`

建议把 3/5/6 串成 CI 步骤：任一 `exit 1` 即挡住合并。


## check-copy.mjs（文案 / 提示词泄漏检查）

背景：AI 容易把「说明：…」「参考自 …」「TODO」这类元信息渲染成页面小字。它们属于工程注释，不是用户内容。

用法：
```bash
node check-copy.mjs <file.html|dir> [--config rules.json] [--json -] [--fail-on error|warn] [--min-font 12]
```

规则：
- prompt-leak：可见文案（含 alt/title/placeholder/aria-label）出现说明、设计理由、参考来源、演示字样
- todo-leftover：TODO / FIXME / lorem ipsum / 待补充
- placeholder-unlabeled：示例数据未标注
- tiny-text：可见字号 < --min-font（默认 12px）

退出码：0 通过 / 1 违规 / 2 用法错误。

已知限制：正则启发式；产品本身确有「说明」类文案时用 config 的 allow 白名单；只扫 HTML 静态文本，JS 动态插入的文本需在验收阶段用 DOM 断言补充（A16/A17）。


## check-skill-size.mjs（体量预算检查）

背景：技能会随整合持续膨胀。本脚本读 `skill-budget.json`，测量 T0（SKILL.md）/ T1（references）/ T2（数据）体量，超预算 exit 1。

用法：
```bash
node check-skill-size.mjs [--json <file|->] [--budget <file>]
```

检查项：SKILL.md 行数/字节、触发词数、references 文件数/总字节/单文件行数、分阶段加载量、templates/scripts 数量、brand-specs/examples/systems 体积。

退出码：0 通过 / 1 超预算 / 2 用法错误。

超预算处理顺序：拆（split）→ 删（retire）→ 下沉（T1→T2）→ 提预算（最后手段，需写理由）。协议见 `references/11-skill-budget.md`。
