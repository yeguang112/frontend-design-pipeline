# 05 · Design Token 契约（从冻结 HTML 提取）

> Token 是「设计决策的机器可读形式」。冻结 HTML 是视觉真相，token 是数值真相。
> 目标：任何实现（Web / App / 小程序 / 组件库）都只引用 token，不写裸值。

---

## 1. 三层结构

| 层 | 例 | 谁用 | 可变性 |
|---|---|---|---|
| **Primitive（原始值）** | `--blue-500: #3b82f6`、`--gray-900: #111` | 仅内部映射 | 几乎不变 |
| **Semantic（语义）** | `--bg`、`--fg`、`--muted`、`--accent`、`--border`、`--surface` | 组件与页面 | 主题切换时变 |
| **Component（组件级）** | `--button-height-md`、`--card-radius`、`--input-border` | 组件实现 | 跟随组件契约 |

规则：
- **实现只允许引用 semantic / component**；primitive 只在 tokens.css 内部出现。
- 语义 token 必须覆盖浅色/深色两套（若声明双主题）。
- 一个语义 token 只表达一个用途；不要 `--primary2`。

---

## 2. 必备槽位（schema）

```css
:root {
  /* ── Surface ── */
  --bg:            #ffffff;   /* 页面底色 */
  --surface:       #f7f7f8;   /* 卡片/面板 */
  --surface-2:     #ffffff;   /* 浮层/弹窗 */
  --overlay:       rgba(0,0,0,.45);

  /* ── Foreground ── */
  --fg:            #111113;   /* 主文本 */
  --fg-2:          #3f3f46;   /* 次文本 */
  --muted:         #71717a;   /* 辅助/占位 */
  --meta:          #a1a1aa;   /* 元信息/禁用 */

  /* ── Border ── */
  --border:        #e4e4e7;
  --border-strong: #d4d4d8;

  /* ── Accent ── */
  --accent:        #2563eb;
  --accent-hover:  #1d4ed8;
  --accent-active: #1e40af;
  --accent-on:     #ffffff;   /* accent 上的文字 */

  /* ── Semantic status ── */
  --success: #16a34a;  --warn: #d97706;  --danger: #dc2626;
  --success-bg: #f0fdf4; --warn-bg: #fffbeb; --danger-bg: #fef2f2;

  /* ── Typography ── */
  --font-display: "…", system-ui, sans-serif;
  --font-body:    "…", system-ui, sans-serif;
  --font-mono:    ui-monospace, "SF Mono", Menlo, monospace;

  --text-xs:   12px;  --text-sm:   14px;  --text-base: 16px;
  --text-lg:   18px;  --text-xl:   24px;  --text-2xl:  32px;
  --text-3xl:  48px;  --text-4xl:  64px;

  --leading-body: 1.6; --leading-tight: 1.15;
  --tracking-display: -0.02em;
  --weight-regular: 400; --weight-medium: 500; --weight-strong: 600;

  /* ── Spacing（4pt/8pt 基准）── */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* ── Radius（一套系统，四类）── */
  --radius-sm: 6px;   /* 输入/小控件 */
  --radius-md: 10px;  /* 按钮/标签 */
  --radius-lg: 14px;  /* 卡片 */
  --radius-full: 999px; /* 仅头像/药丸 */

  /* ── Elevation ── */
  --shadow-1: 0 1px 2px rgb(0 0 0 / .06);
  --shadow-2: 0 4px 16px rgb(0 0 0 / .08);
  --shadow-3: 0 12px 32px rgb(0 0 0 / .12);

  /* ── Motion ── */
  --ease-standard: cubic-bezier(.23, 1, .32, 1);
  --dur-enter: 200ms; --dur-exit: 140ms;

  /* ── Layer ── */
  --z-base: 0; --z-sticky: 10; --z-dropdown: 100;
  --z-modal: 1000; --z-toast: 1100;
}
```

> 槽位是**契约**：跨品牌/跨项目切换时必须保持同名。品牌特有扩展放 `--brand-*`，不得改语义槽位含义。

---

## 3. 从冻结 HTML 提取

### 3.1 流程

```text
1. 跑脚本： node scripts/extract-tokens.mjs design/frozen/index.html --out design/tokens
2. 审校 tokens.json：
   - role 为空/错误的补语义名
   - 合并近似值（#111113 与 #101012 只留一个）
   - 删除未使用 token
3. 把 tokens.css 回填进 prototype（替换内联值），确认视觉不变
4. 重新冻结（v1.1），保证「冻结稿用的就是 tokens」
5. 写 tokens.md 表格给人读
```

### 3.2 提取原则

| 原则 | 说明 |
|---|---|
| 频次优先 | 出现次数多的值更可能是系统值 |
| 聚类成阶 | 间距取 4/8/16/24/32…；字号取 12/14/16/18/24/32/48/64 |
| 语义命名 | `bg` 而不是 `color-1`；`danger-bg` 而不是 `red-light` |
| 宁可少 | 20–40 个 token 足够；> 60 个通常是没聚类 |
| 记录未归类 | 落不进 scale 的值进 `unmapped`，人工决定是合并还是新增阶 |

### 3.3 tokens.json 结构（DTCG 风格）

```json
{
  "meta": {
    "source": "design/frozen/index.html",
    "source_sha256": "…",
    "extracted_at": "2026-11-07T12:00:00+08:00",
    "generator": "extract-tokens.mjs@1"
  },
  "color": {
    "bg":      {"$type": "color", "$value": "#ffffff", "role": "页面底色", "count": 12},
    "fg":      {"$type": "color", "$value": "#111113", "role": "主文本",   "count": 34}
  },
  "typography": {
    "font-display": {"$type": "fontFamily", "$value": "…", "role": "标题"},
    "text-base":    {"$type": "dimension",  "$value": "16px", "role": "正文"},
    "leading-body": {"$type": "number",     "$value": 1.6}
  },
  "space": {"space-4": {"$type": "dimension", "$value": "16px", "count": 22}},
  "radius": {"radius-md": {"$type": "dimension", "$value": "10px"}},
  "shadow": {"shadow-1": {"$type": "shadow", "$value": "0 1px 2px rgb(0 0 0 / .06)"}},
  "motion": {"dur-enter": {"$type": "duration", "$value": "200ms"}},
  "scale": {"space": [4,8,12,16,20,24,32,40,48,64,80,96], "fontSize": [12,14,16,18,24,32,48,64]},
  "unmapped": [{"kind": "fontSize", "value": "17px", "where": ["index.html:88"]}]
}
```

---

### 3.4 脚本实际输出（以 `extract-tokens.mjs` 为准）

上面的 3.3 是概念示意。脚本真实输出是**按类别分组的扁平表**，不要手改结构：

```json
{
  "$description": "Design tokens extracted from ...",
  "meta": {
    "generator": "extract-tokens.mjs@1.x",
    "extractedAt": "2026-11-07T11:58:32.158Z",
    "root": "…/prototype",
    "inputHash": "sha256…",
    "sources": [{"file": "index.html", "sha256": "…", "bytes": 118675, "kind": "html"}],
    "assumptions": {"rootFontSize": 16, "emApprox": true},
    "counts": {"declarations": 1161, "tokens": 48, "colors": 29, "skipped": 77, "warnings": 0, "degenerate": false}
  },
  "color":      {"bg": {"$value": "#08090a", "$type": "color", "role": "页面底色",
                        "$extensions": {"design-pipeline": {"count": 12, "props": ["--bg"], "selectors": [":root"]}}}},
  "fontFamily": {"font-display": {"$value": "\"Inter\", system-ui", "$type": "fontFamily", "$extensions": {"…": {"count": 6}}}},
  "lineHeight": {"leading-body": {"$value": "1.6", "$type": "number", "$extensions": {"…": {"count": 9}}}},
  "spacing":    {"space-4": {"$value": "16px", "$type": "dimension", "$extensions": {"…": {"count": 22, "step": 16}}}},
  "radius":     {"radius-md": {"$value": "10px", "$type": "dimension", "$extensions": {"…": {"step": 10}}}},
  "shadow":     {"shadow-1": {"$value": "0 1px 2px rgb(0 0 0 / .06)", "$type": "shadow", "$extensions": {"…": {"layers": 2}}}},
  "borderWidth":{"1": {"$value": "1px", "$type": "dimension", "$extensions": {"…": {"step": 1}}}},
  "easing":     {"ease-standard": {"$value": "cubic-bezier(.23,1,.32,1)", "$type": "string"}},
  "breakpoint": {"768": {"$value": 768, "$type": "number"}},
  "scale":      {"spacing": [{"step": "4", "value": "4px", "px": 4, "count": 12}], "fontSize": […]},
  "unmapped":   [{"kind": "fontSize", "value": "17px", "where": ["index.html:88"]}]
}
```

约定：
- 键名即 token 名（去掉 `--` 前缀）。**颜色类保留 `color-` 前缀**（`--color-bg` → `color["color-bg"]`），其余类别用原名（`--space-4` → `spacing["space-4"]`）；以脚本实际输出为准，`--list` 或 `tokens.md` 可核对。
- `$extensions.design-pipeline.count/props/selectors` 是溯源信息，可留可删。
- `meta.counts.degenerate=true` 表示输入是 `var()` 形态但提取退化——**此时不要使用该 token 集**，先修输入或提取方式。
- 人工审校只做三件事：补 `role`、合并近似值、删除未使用项；**不改结构与键名**。



| 平台 | 单位 | 换算 | 备注 |
|---|---|---|---|
| Web | px / rem | 1rem = 16px | 用 CSS 变量 |
| iOS (SwiftUI) | pt | 1pt = 1px | 字号用 `Font.system` 或自定义字重 |
| Android (Compose) | dp / sp | 1dp = 1px | 字号用 sp，允许系统缩放 |
| React Native | dp | 1dp = 1px | `fontSize` 数值相同；`allowFontScaling` 视需求 |
| Flutter | logical px | 1 = 1px | `MediaQuery.textScaler` 注意 |
| 微信小程序 | rpx | **1px = 2rpx**（750 设计宽 ÷ 375 逻辑宽） | 字号建议仍用 px 防缩放；边框用 1rpx |

规则：
1. **设计值不变**：12px 在任何平台都是 12 个单位，换算只发生在适配层。
2. 小程序不要用 rpx 写字号（会随屏宽缩放），用 px。
3. 平台差异（安全区、状态栏、点击热区 ≥44pt）单独列 `platform-overrides`，不改基础 token。

---

## 5. Token 变更规则

| 操作 | 允许？ | 流程 |
|---|---|---|
| 新增 token | ✅ | 追加，跑 drift，更新 tokens.md |
| 修改值 | ⚠️ | 走 CR → 重冻结 → 全量截图对比 |
| 改名 | ⚠️ | 提供 migration 映射，全仓替换，保留旧别名 1 个版本 |
| 删除 | ✅（确认无引用） | grep 引用 = 0 才可删 |
| 在实现里覆盖 | ❌ | 禁止局部覆盖 token |

---

## 6. 校验

```bash
node scripts/detect-drift.mjs <project> --tokens design/tokens/tokens.json
```

必须满足：
- `hardcoded-color` = 0
- `off-scale-font-size` = 0
- `off-scale-spacing` = 0
- `inline-style` = 0（动态计算除外，白名单）
- `accent-overuse` = 0

---

## 7. 反模式

- ❌ 先写组件再补 token（值会散）。
- ❌ token 名按视觉命名（`--purple`）而不是语义（`--accent`）。
- ❌ 双主题只换底色不换文字/边框（对比度崩）。
- ❌ 平台层「顺手」改字号/间距（跨端走样）。
- ❌ token 数量爆炸（80+）——说明没有 scale。
