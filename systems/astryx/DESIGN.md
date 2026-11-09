# Astryx by Meta · Design System Snapshot

> **来源**：[meta/astryx](https://github.com/meta/astryx)（MIT，Copyright (c) 2026 Meta Platforms, Inc.）
> **版本**：`@astryxdesign/core@0.7.11` + `@astryxdesign/theme-neutral@0.7.11`（Beta）
> **性质**：官方实现系统（Official Implementation System），不是品牌风格参考。
> **本文件**是 token 快照 + 使用规则的摘要，不是官方文档的复制；官方说明以 [astryx.atmeta.com](https://astryx.atmeta.com/) 与仓库 README 为准。
> 由 `systems/astryx/sync.mjs` 生成 token 快照；本文件人工维护。

---

## 1. Visual Theme & Atmosphere

Astryx 在 Meta 内部演进了 8 年，支撑 13,000+ 应用，2026 年 6 月开源（Beta）。
它的默认主题 `neutral` 是**克制的极简**：中性灰阶、单一近黑强调、Figtree 字体、紧凑但不拥挤的控件节奏。
系统负责行为、可访问性与质量；**主题只负责外观**——所有品牌化都在 token 层完成，不 fork 组件。

- 一个系统，8 个主题包：`neutral` / `stone` / `gothic` / `matcha` / `butter` / `y2k` / `chocolate` / `probe`（probe 为测试主题；官方文档当前登记 6 个 current）。
- 明暗不是两套皮肤，而是同一个 token 的 `light-dark(light, dark)` 取值。
- 组件 204 个导出（含子组件），React 19+ 与 StyleX；消费侧可以用普通 CSS/Tailwind，无样式锁定。

**适合**：生产级 Web 应用、后台、控制台、AI 产品界面——需要组件行为与可访问性被系统兜住。
**不适合**：以品牌叙事为主的营销站（先用 `brand-specs/` 的风格参考）；非 React 的组件实现（可借 token，不借组件）。

## 2. Color Palette & Roles

语义 token（`light-dark()` 左为浅色、右为深色）：

| 角色 | token | 值 |
|---|---|---|
| 页面底色 | `--color-background-body` | `light-dark(#f1f1f1, #1b1b1b)` |
| 表面 / 卡片 | `--color-background-surface` / `--color-background-card` | `light-dark(#ffffff, #262626)` / `light-dark(#ffffff, #1b1b1b)` |
| 主文本 | `--color-text-primary` | `var(--color-on-light)` → `#111111` |
| 次文本 | `--color-text-secondary` | `light-dark(#474747, #c6c6c6)` |
| 禁用文本 | `--color-text-disabled` | `light-dark(#919191, #525252)` |
| 强调 | `--color-accent` | **`var(--color-on-light)` → 近黑 `#111111`（单色强调）** |
| 强调上的文字 | `--color-on-accent` | `light-dark(#ffffff, #111111)` |
| 边框 | `--color-border` | `light-dark(#00000014, #ffffff1A)` |
| 状态 | `--color-info/success/warning/error` | 蓝 / 绿 / 黄 / 红（各有 `-muted` 与 `on-` 变体） |

- 中性主题的强调色是**近黑**，不是紫色/蓝色——天然规避「AI 紫」；需要彩色强调时用状态色或换主题。
- 调色板由 OKLCH 生成（`astryx-oklch-v1`）：neutral 主题 21 个 stop、10 个色相族；深色在 stop 5–25 收敛 chroma。
- 规则：只用语义 token；禁止在组件里写 hex；状态色不可当品牌强调滥用。

## 3. Typography

- 字体：`--font-family-body/heading` = **Figtree** + 系统回退；`--font-family-code` = 系统等宽。字体需另行加载，回退栈可独立工作。
- 字号阶（rem）：`4xs .4375` / `3xs .5` / `2xs .625` / `xs .75` / `sm .875` / `base 1` / `lg 1.1875` / `xl 1.375` / `2xl 1.625` / `3xl 1.875` / `4xl 2.25` / `5xl 2.625`。
- 字重：400 / 500 / 600 / 700。
- 语义排版角色（size / weight / leading）：`text-heading-1..6`、`text-body`、`text-large`、`text-label`、`text-code`、`text-supporting`、`text-display-1/2`。
  例：`--text-heading-1-size: var(--font-size-2xl)`、`--text-heading-1-weight: var(--font-weight-semibold)`、`--text-heading-1-leading: 1.3846`。
- 规则：标题用 heading 角色，不用裸 `font-size`；中文项目需补 CJK 回退并验证行高。

## 4. Spacing, Grid & Layout

- 间距：15 档，`--spacing-0` = 0 → `--spacing-12` = 3rem（含 `-0-5` / `-1-5` 半档）。
- 控件尺寸：`--size-element-sm/md/lg` = 28 / 32 / 36px。
- 布局：`AppShell`（顶栏/侧栏/内容/移动导航）、`Grid` / `HStack` / `VStack` / `Layout` / `Section`；内边距用 `--layout-padding-*`（默认 `--spacing-9` = 2.25rem）。
- 容器：`--container-padding-*` 与 `--container-max-height`。
- 规则：间距只用 `--spacing-*`；布局优先用系统容器组件，不手写 magic number。

## 5. Components & States

- **204 个组件导出**（core `api-report`），覆盖：Button / Input / Select / Table / Tabs / Dialog / Drawer / Toast / Tooltip / Popover / Menu / CommandPalette / DatePicker / Stepper / SideNav / TopNav / AppShell / Chat* / CodeBlock / Markdown / Calendar / Carousel / Lightbox …
- 状态分类（官方设计规范）：
  - **User states**：rest / hover / press / focus / selection / manipulation
  - **System states**：disabled / loading / processing / status / transient feedback
  - **Agentic states**：thinking / streaming / tool execution / waiting / synchronization / inspection / rendering
- 组合优先：`Stack`/`Grid`/`Layout` + 原子组件；`swizzle` 可以把组件源码 eject 出来改，但**默认不 fork**。
- 规则：组件行为（键盘、焦点、ARIA、对比度）由系统负责；项目只做主题与组合。

## 6. Depth & Elevation

- 阴影三档：`--shadow-low` / `--shadow-med` / `--shadow-high`（`light-dark()` + `oklch`，暗色用更高不透明度 + inset 高光）。
- 状态描边：`--shadow-inset-hover/selected/success/warning/error`（2px inset）。
- 层级：`Layer` / `Overlay` / `Popover` / `Dialog` 自带层级与焦点管理；不要手写 `z-index`。
- 规则：深度只用 shadow token；暗色不要用纯黑阴影。

## 7. Motion

- 时长：`fast 125ms` / `medium 300ms` / `slow 700ms`，各带 min/max；`duration-exit = fast`。
- 曲线：`--ease-standard` / `--ease-entrance` / `--ease-move` = `cubic-bezier(0.24, 1, 0.4, 1)`；`--ease-exit` = `cubic-bezier(0.3, 0, 0.6, 0.6)`。
- Reduced motion：官方规范要求跨淡入 + 立即改变，不做位移/视差。
- 规则：动效只用 duration/ease token；加载态用 Skeleton/Spinner，不用长动画掩盖加载。

## 8. Do's and Don'ts

**Do**

- 用 `@astryxdesign/core` + 一个主题包；CSS 顺序：`reset.css` → `astryx.css` → `theme.css`（主题必须在 core 之后）。
- 品牌化在 token 层：改 theme 的 token 值 / 换主题包，不改组件源码。
- 主题用 `data-astryx-theme` 作用域与 `light-dark()`，不要为暗色复制一套组件。
- 组件清单以 `components/astryx-components.json` 为准；缺组件先组合，不手搓。
- 中文/多语言项目：补 CJK 字体回退，验证每档字号的可读性。

**Don't**

- 不要 fork 组件再用 90% 覆盖——那等于放弃系统的行为与可访问性收益。
- 不要在业务组件里写死颜色/字号/圆角；不要自建一套 token 与 Astryx 并行。
- 不要把 `neutral` 的「近黑强调」误读成「没有品牌」；品牌化是换主题/改 token。
- 不要把 Astryx 的组件截图当营销素材（商标与品牌资产归 Meta）。
- 不要声称本快照是官方文档；升级必须跑 `sync.mjs` 并复核 diff。

## 9. Agent Prompt Guide（接进本规则包）

```text
实现基座：Astryx by Meta（MIT）v0.7.11 + neutral 主题
读取顺序：systems/astryx/DESIGN.md → tokens/astryx-tokens.css → components/astryx-components.json
规则：只用语义 token；组件只从 components.json 选；主题改动走 token；不 fork 组件。
验收：沿用 A1–A17；额外检查「业务代码里没有手写 hex/px 之外的新色板」。
```

- 本快照只覆盖 **neutral** 主题；换主题 = 再跑一次 `sync.mjs --theme <name>`（见 ADAPTER）。
- token 里的 `light-dark()` / `rem` / `var()` 需要现代浏览器；旧环境用官方编译产物。
