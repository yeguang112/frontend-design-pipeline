# Design Tokens · DevNotes

> 由冻结 HTML（`design/frozen/index.html`，sha256 `8c301eb520b5a614…`）提取 + 人工审校。
> 机器可读：`tokens.json`；实现唯一来源：`tokens.css`。修改须走 CR 并重冻结。

| 指标 | 值 |
|---|---|
| token 总数 | 111（primitive 19 + semantic 26 + 其余为 typography/space/组件尺寸） |
| 浅色主题覆盖 | 29 个语义槽位 |
| unmapped | 0（见文末说明） |
| 提取脚本 | `extract-tokens.mjs@1.0.0`（结果仅作交叉校验，见 README §已知问题 F1） |

## 1. Color · Primitive（仅内部映射）

| token | dark 值 | 用途 | 引用次数 |
| --- | --- | --- | --- |
| `--ink-0` | `#08090a` | Primitive，组件禁止直接引用 | 2 |
| `--ink-1` | `#0f1011` | Primitive，组件禁止直接引用 | 1 |
| `--ink-2` | `#101112` | Primitive，组件禁止直接引用 | 1 |
| `--ink-3` | `#16171a` | Primitive，组件禁止直接引用 | 1 |
| `--ink-4` | `#1d1f22` | Primitive，组件禁止直接引用 | 1 |
| `--ink-5` | `#0c0d0e` | Primitive，组件禁止直接引用 | 1 |
| `--snow-0` | `#f7f8f8` | Primitive，组件禁止直接引用 | 1 |
| `--snow-1` | `#d0d6e0` | Primitive，组件禁止直接引用 | 1 |
| `--snow-2` | `#8a8f98` | Primitive，组件禁止直接引用 | 1 |
| `--snow-3` | `#7d828b` | Primitive，组件禁止直接引用 | 1 |
| `--indigo-9` | `#5e6ad2` | Primitive，组件禁止直接引用 | 2 |
| `--indigo-7` | `#4f5ac0` | Primitive，组件禁止直接引用 | 2 |
| `--indigo-6` | `#434cae` | Primitive，组件禁止直接引用 | 2 |
| `--indigo-4` | `#828fff` | Primitive，组件禁止直接引用 | 1 |
| `--red-9` | `#c93a3f` | Primitive，组件禁止直接引用 | 1 |
| `--red-4` | `#ff9a9e` | Primitive，组件禁止直接引用 | 1 |
| `--green-9` | `#10b981` | Primitive，组件禁止直接引用 | 2 |
| `--amber-9` | `#e8a33d` | Primitive，组件禁止直接引用 | 1 |
| `--white` | `#ffffff` | Primitive，组件禁止直接引用 | 2 |

## 2. Color · Semantic（组件只引用这一层）

| token | dark | light | 角色 | 引用次数 |
| --- | --- | --- | --- | --- |
| `--bg` | `var(--ink-0)` | `#f7f8f8` | 页面底色 | 3 |
| `--bg-elevated` | `var(--ink-1)` | `#ffffff` | 面板/侧栏底色 | 5 |
| `--surface` | `var(--ink-2)` | `#ffffff` | 卡片与列表底色 | 4 |
| `--surface-2` | `var(--ink-3)` | `#f2f3f4` | 输入框/次级表面 | 16 |
| `--surface-3` | `var(--ink-4)` | `#e9ebee` | 悬停/选中表面 | 7 |
| `--code-bg` | `var(--ink-5)` | `#f2f3f4` | 代码块底色 | 1 |
| `--overlay` | `rgb(0 0 0 / .72)` | `rgb(8 9 10 / .45)` | 弹窗遮罩 | 1 |
| `--fg` | `var(--snow-0)` | `var(--ink-0)` | 主文本 | 23 |
| `--fg-2` | `var(--snow-1)` | `#3b3f45` | 次文本 | 18 |
| `--muted` | `var(--snow-2)` | `#5f646c` | 辅助文本 | 25 |
| `--meta` | `var(--snow-3)` | `#666b72` | 元信息（mono 小字） | 21 |
| `--border-subtle` | `rgb(255 255 255 / .05)` | `rgb(8 9 10 / .06)` | 细分隔线与弱描边 | 20 |
| `--border` | `rgb(255 255 255 / .08)` | `rgb(8 9 10 / .10)` | 默认描边 | 13 |
| `--border-strong` | `rgb(255 255 255 / .14)` | `rgb(8 9 10 / .18)` | 强调描边（hover） | 8 |
| `--accent` | `var(--indigo-9)` | `var(--indigo-9)` | 强调色：主 CTA/选中/焦点 | 16 |
| `--accent-hover` | `var(--indigo-7)` | `var(--indigo-7)` | 强调色 hover | 1 |
| `--accent-active` | `var(--indigo-6)` | `var(--indigo-6)` | 强调色 active | 1 |
| `--accent-on` | `var(--white)` | `var(--white)` | 强调色上的文字 | 8 |
| `--accent-ring` | `rgb(94 106 210 / .30)` | `rgb(94 106 210 / .22)` | 焦点环 | 2 |
| `--link` | `var(--indigo-4)` | `#4b56bd` | 链接与交互文本 | 1 |
| `--success` | `var(--green-9)` | `#0e7a55` | 成功状态 | 2 |
| `--success-text` | `var(--green-9)` | `#0e7a55` | 成功状态文字 | 1 |
| `--warn` | `var(--amber-9)` | `#9a6512` | 警告状态 | 1 |
| `--danger` | `var(--red-9)` | `#c62f34` | 危险操作底色 | 4 |
| `--danger-text` | `var(--red-4)` | `#a51f24` | 危险状态文字 | 2 |
| `--danger-bg` | `rgb(201 58 63 / .14)` | `rgb(198 47 52 / .08)` | 危险状态浅底 | 2 |

## 3. Typography

| token | 值 | 角色 | 引用次数 |
| --- | --- | --- | --- |
| `--font-display` | `"InterVar", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | 标题族（Inter Variable） | 1 |
| `--font-body` | `"InterVar", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | 正文族（Inter Variable） | 6 |
| `--font-mono` | `ui-monospace, "SF Mono", "Berkeley Mono", Menlo, Consolas, monospace` | 代码与元信息族（ui-monospace 栈） | 17 |
| `--text-xs` | `12px` | 12px：mono 元信息/标签 | 26 |
| `--text-sm` | `13px` | 13px：按钮/导航/辅助正文 | 29 |
| `--text-md` | `14px` | 14px：输入框与紧凑正文 | 3 |
| `--text-base` | `16px` | 16px：正文/列表标题 | 8 |
| `--text-lg` | `18px` | 18px：引导段落/区块标题 | 4 |
| `--text-xl` | `24px` | 24px：页面标题/特性标题 | 4 |
| `--text-2xl` | `32px` | 32px：区块标题 | 3 |
| `--text-3xl` | `48px` | 48px：首屏 Displays | 1 |
| `--leading-display` | `1.02` | Displays 行高 | 1 |
| `--leading-heading` | `1.2` | 标题行高 | 1 |
| `--leading-body` | `1.55` | 正文行高 | 2 |
| `--leading-ui` | `1.4` | 控件/标签行高 | 6 |
| `--tracking-display` | `-0.022em` | Displays 负字距 | 3 |
| `--tracking-heading` | `-0.011em` | 标题负字距 | 2 |
| `--tracking-normal` | `0` | 正文/控件字距 | 5 |
| `--weight-regular` | `400` | 阅读字重 | 3 |
| `--weight-ui` | `510` | Linear 签名中间字重（510） | 23 |
| `--weight-strong` | `590` | 强调字重（590） | 1 |

> `face = "InterVar"` 是 `@font-face` 描述符里的族名字面量（CSS 描述符不接受 `var()`），不计入「组件引用了裸值」。

字号阶梯：12 / 13 / 14 / 16 / 18 / 24 / 32 / 48 px；行高：1.02 / 1.2 / 1.4 / 1.55；字重：400 / 510 / 590。

## 4. Spacing（4pt 基准）

4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px — 所有 padding / margin / gap 只允许取这些值与 0。

## 5. Radius（5 档系统）

| token | 值 | 用在哪 |
| --- | --- | --- |
| `--radius-xs` | 2px | 标签 / badge / 分隔块 |
| `--radius-sm` | 6px | 按钮 / 输入框 / 小控件 |
| `--radius-md` | 8px | 卡片 / 列表容器 |
| `--radius-lg` | 12px | 面板 / 弹窗 / 产品预览 |
| `--radius-full` | 999px | 药丸 / 圆点 / 头像 |

## 6. Elevation / Motion / Layer

| token | 值（dark） | 值（light） | 用途 |
| --- | --- | --- | --- |
| `--shadow-card` | `none` | `0 1px 2px rgb(8 9 10 / .06)` | 卡片投影（dark=none，层级靠亮度台阶） |
| `--shadow-1` | `0 1px 2px rgb(0 0 0 / .30)` | `0 1px 2px rgb(8 9 10 / .08)` | 微浮起（产品预览） |
| `--shadow-2` | `0 12px 32px rgb(0 0 0 / .45)` | `0 16px 40px rgb(8 9 10 / .16)` | 弹窗浮起 |
| `--ease-standard` | `cubic-bezier(.23, 1, .32, 1)` | `同 dark` | 标准曲线 |
| `--dur-enter` | `200ms` | `同 dark` | 进入时长 |
| `--dur-exit` | `140ms` | `同 dark` | 退出时长 |
| `--dur-spin` | `700ms` | `同 dark` | 加载指示时长 |
| `--z-sticky` | `10` | `同 dark` | 粘性顶栏 |
| `--z-dropdown` | `100` | `同 dark` | 下拉/移动菜单 |
| `--z-modal` | `1000` | `同 dark` | 弹窗 |

## 7. Layout & component sizes

| token | 值 | 角色 |
| --- | --- | --- |
| `--container` | `1200px` | 内容最大宽 |
| `--container-text` | `680px` | 可读行宽 |
| `--gutter` | `var(--space-6)` | 页面左右边距（引用 space-6） |
| `--nav-h` | `56px` | 顶栏高度 |
| `--sidebar-w` | `240px` | 侧栏宽度 |
| `--control-h-sm` | `32px` | 控件高：小（工具栏） |
| `--control-h-md` | `40px` | 控件高：中（按钮/输入） |
| `--control-h-lg` | `48px` | 控件高：大（首屏 CTA） |
| `--row-h` | `64px` | 列表行最小高 |
| `--nav-item-h` | `32px` | 导航项高 |
| `--badge-h` | `20px` | 标签高 |
| `--icon-sm` | `16px` | 图标 16px |
| `--icon-md` | `20px` | 图标 20px |
| `--switch-w` | `36px` | 开关宽 |
| `--switch-h` | `20px` | 开关高 |
| `--switch-knob` | `14px` | 开关滑块直径 |
| `--switch-inset` | `2px` | 开关内边距 |
| `--modal-w` | `480px` | 弹窗宽度 |

## 8. unmapped（未归类值）

**0 个。** 提取脚本从冻结 HTML 里看到 29 个字面量颜色与 0/1/2px 线宽，逐个对应到 primitive 或线宽常量：
- 29 个颜色字面量全部是 `Primitive` 段的值，组件里 0 处直接引用字面量（探针 `authoredViolationCount = 0`）。
- `0px` 归零；`1px` 描边、`2px` 焦点环/指示条/开关内边距属于线宽，不计入 4pt 间距阶梯。
- 无「落不进 scale 的字号/间距/圆角」。

## 9. 已知偏差（与规则包 05 的差异）

1. **token 数量 111 个**，高于 `05-token-contract.md` §3.2 建议的 20–40：因为本文件同时承担 primitive（19）、semantic（46）与组件尺寸（~30）三层；跨端落地时组件尺寸层可下沉为平台映射，semantic 层保持不变。
2. **dark 是默认主题**（`:root` 即 dark），与模板 `tokens.css` 的「light 为 :root、dark 覆盖」相反。理由：产品本身 dark-native（参考 Linear），浅色是配套主题。两套语义槽位名称完全一致，跨端映射不受影响。
