# Component Contract · DevNotes

> 组件先定死、只引用。所有值引用 `design/tokens/tokens.css`，不写裸值。
> 冻结版本：v1.7（`design/frozen/index.html`）。本文件与冻结稿必须一致；不一致时以冻结稿为准并升版本。

## 组件索引

| id | 名称 | 状态 | 变体 | 使用屏 |
|---|---|---|---|---|
| button | 按钮 | active | primary / secondary / ghost / danger / icon | 全部 |
| input | 输入框 | active | text / search（带图标） | 设置 / 演示栏 |
| card | 卡片 | active | static / featured（price） | 首页 / 设置 |
| tabs | 标签页 | active | underline | 首页功能区 |
| modal | 弹窗 | active | confirm | 设置（删除） |
| switch | 开关 | active | 即时开关 | 设置 |
| badge | 标签 | active | default | 演示预览 / 定价 |
| skeleton | 骨架屏 | active | row / block | 列表加载 |
| state-block | 空/错误态 | active | empty / error | 列表 |
| nav / sidebar | 导航 | active | header / sidebar / mobile | 全部 |

---

## button

- **用途**：触发动作。一屏最多 1 个 primary。
- **anatomy**：容器 > (可选图标 `--icon-sm/md`) + 文案
- **尺寸**

| size | height | padding-x | 字体 | 圆角 |
|---|---|---|---|---|
| sm | `--control-h-sm` | `--space-3` | `--text-xs` / `--weight-ui` | `--radius-sm` |
| md | `--control-h-md` | `--space-4` | `--text-sm` / `--weight-ui` | `--radius-sm` |
| lg | `--control-h-lg` | `--space-5` | `--text-base` / `--weight-ui` | `--radius-md` |

- **颜色**

| 变体 | bg | fg | border | hover | active |
|---|---|---|---|---|---|
| primary | `--accent` | `--accent-on` | transparent | `--accent-hover` | `--accent-active` |
| secondary | `--surface-2` | `--fg` | `--border` | `--surface-3` | `--border-strong` |
| ghost | transparent | `--fg-2` | transparent | `--surface` | `--surface-2` |
| danger | `--danger` | `--accent-on` | transparent | `--red-9` | `--red-9` |
| icon | transparent | `--muted` | transparent | `--surface` | `--surface-2` |

- **状态**：default / hover / focus-visible（2px `--accent-ring` + 2px offset）/ active（位移 1px）/ disabled（opacity .45）/ loading（`--dur-spin` 指示，宽度锁定）
- **动效**：`--dur-enter` + `--ease-standard`
- **可访问性**：`<button type="button">`；图标按钮必须 `aria-label`；热区 ≥44×44
- **禁止**：文案换行；白底白字；loading 时宽度跳动；用 div 模拟
- **跨端**：RN `Pressable`（pressed 态）；小程序 `hover-class` + 重置默认样式；Flutter `FilledButton`

---

## input

- **用途**：单行文本 / 搜索
- **anatomy**：label（上方 `--text-sm` `--muted`）+ 输入框 + helper/error（下方 `--text-xs`）
- **尺寸**：高度 `--control-h-md`；padding-x `--space-3`；圆角 `--radius-sm`；带图标时左 padding `--space-8`
- **颜色**：bg `--surface-2`；border `--border`；focus border `--accent` + `--accent-ring`；error `--danger` + `--danger-text`
- **状态**：default / hover / focus / disabled / error / readonly
- **禁止**：placeholder 当 label；错误只变色不给文案；无 focus 环
- **可访问性**：`<label for>`；`aria-invalid`；`aria-describedby` 指向错误文案

---

## card

- **用途**：独立信息块（定价、设置分组）；仅当需要表达层级时使用
- **尺寸**：padding `--space-6`；radius `--radius-lg`；卡片间距 `--space-6`；border `--border`
- **颜色**：bg `--surface`；header/body 用 `--border` 分隔；阴影 `--shadow-card`（与 border 二选一，本稿选 border）
- **状态**：static / featured（`--accent` 顶边 2px + `--surface-2` 底）
- **禁止**：卡片套卡片；卡片内再放带阴影容器；用卡片代替布局分组

---

## tabs

- **用途**：同级内容切换（功能演示三态）
- **尺寸**：高 `--control-h-md`；指示条 2px `--accent`；项间距 `--space-6`
- **状态**：default / hover / active / focus-visible / disabled
- **可访问性**：`role="tablist"` / `role="tab"` / `aria-selected`；左右键切换
- **禁止**：指示条跳变；无键盘支持

---

## modal

- **用途**：需要中断的确认（删除笔记）
- **尺寸**：宽 `--modal-w`；padding `--space-6`；radius `--radius-lg`；遮罩 `--overlay`
- **状态**：open / closing；焦点陷阱；ESC 关闭；`aria-modal="true"`
- **禁止**：无关闭按钮；焦点逃逸；遮罩过浅

---

## switch

- **用途**：设置项的即时开关
- **尺寸**：`--switch-w` × `--switch-h`；knob `--switch-knob`；inset `--switch-inset`
- **状态**：off / on / hover / focus-visible / disabled
- **可访问性**：`role="switch"` + `aria-checked`；整行可点（label 包裹）
- **禁止**：仅滑杆可点；无 aria-checked；状态只靠颜色

---

## badge

- **用途**：状态/元信息标签
- **尺寸**：高 `--badge-h`；padding-x `--space-2`；radius `--radius-full`；字体 `--text-xs`
- **颜色**：bg `--surface-3`；fg `--muted`；强调态 `--success` / `--amber-9`
- **禁止**：颜色无语义；文字溢出；一屏 >3 个

---

## skeleton

- **用途**：列表加载占位
- **尺寸**：行高 `--row-h`；宽度类 `w-40/w-60`；radius `--radius-xs`
- **规则**：形状匹配最终布局；`prefers-reduced-motion` 下停用 shimmer
- **禁止**：通用转圈；骨架与内容尺寸不一致

---

## state-block

- **用途**：空态 / 错误态
- **anatomy**：图标（`--icon-md`）+ 标题（`--text-lg`）+ 描述（`--text-sm` `--muted`）+ 动作（secondary button）
- **规则**：空态必须给下一步动作；错误态给重试
- **禁止**：只有「暂无数据」；无动作

---

## nav / sidebar

- **用途**：全局导航（顶部）+ 应用内导航（侧栏）
- **尺寸**：顶栏高 `--nav-h`；侧栏宽 `--sidebar-w`；项高 `--nav-item-h`；图标 `--icon-sm`
- **状态**：default / hover / active（左侧 2px `--accent` 指示条 + `--fg`）/ collapsed / focus-visible
- **禁止**：桌面端换行；层级 >2；选中态只靠颜色
