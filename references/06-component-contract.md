# 06 · 组件契约（先定死，只引用）

> 目标：**AI 在实现任何 UI 时不允许「临时发明」组件**。组件的高度、内边距、圆角、字体、颜色、状态、动效全部由契约固定；后续只允许引用与组合。
> 组件契约 = `design/components.md`（人读）+ 组件库代码（机器用），两者必须一致。

---

## 1. 什么时候写契约

| 时机 | 动作 |
|---|---|
| P5（token 提取后） | 从冻结 HTML 里盘点组件 → 写进 components.md |
| 需要新组件（P6/P7） | 先补契约 → 用户确认 → 再实现 |
| 组件行为变更 | 走 CR，改契约 + 实现 + 截图 |

**没有契约的组件不准进代码库。**

---

## 2. 契约字段（每个组件必须有）

```md
### <ComponentName>
- id: `button`
- 用途：一句话，写清「什么时候用它 / 什么时候不用」
- anatomy：结构（容器/图标/文字/间距）
- 尺寸（全部引用 token）：
  | size | height | padding-x | font | icon |
  | sm   | 32px   | --space-3 | --text-sm | 16px |
  | md   | 40px   | --space-4 | --text-sm | 16px |
  | lg   | 48px   | --space-5 | --text-base | 20px |
- 形状：--radius-md
- 颜色：bg / fg / border / hover / active / disabled（全部 token）
- 状态矩阵：default / hover / focus-visible / active / disabled / loading
- 动效：--dur-enter + --ease-standard
- 可访问性：语义标签、键盘、ARIA、最小热区 44×44
- 跨端映射：Web 按钮 / RN Pressable / 小程序 button / Flutter FilledButton 的对应
- 禁止用法：3 个反例
```

---

## 3. 必须定义的核心组件（最小集）

| 组件 | 关键固定项 | 易错点 |
|---|---|---|
| **Button** | 三档高度 32/40/48、radius-md、padding-x、字重 500、禁用透明度 | 文字换行、对比度、loading 时宽度跳动 |
| **IconButton** | 方形尺寸 = 高度、热区 ≥44、icon 20px | 无 aria-label、hover 无反馈 |
| **Input** | 高度 40/48、padding、border、focus ring、helper/error 位置 | placeholder 当 label、错误态缺失 |
| **Select / Dropdown** | 触发器同 Input、菜单项高度 36、最大高 + 滚动 | 键盘不可用、层级被裁切 |
| **Checkbox / Radio / Switch** | 20px 控件、标签间距、点击整行 | 只有控件可点、无 focus 环 |
| **Card** | padding、radius-lg、border 或 shadow（二选一） | 卡片套卡片、滥用阴影 |
| **Tabs** | 高度 40、指示条 2px、间距 | 指示条跳动、无键盘切换 |
| **Table** | 行高 44/52、表头 sticky、对齐规则、空态 | 密集无呼吸、数字不对齐 |
| **Modal / Dialog** | 宽度档 400/560/720、padding 24、遮罩、焦点陷阱 | 无 ESC、焦点逃逸 |
| **Toast** | 位置、时长、最多 1 条、可关闭 | 遮挡操作、无 aria-live |
| **Badge / Tag** | 高度 20/24、radius-full 或 sm、颜色语义 | 颜色乱用、文字溢出 |
| **Empty / Skeleton** | 空态有引导动作；骨架形状匹配最终布局 | 通用转圈、骨架跳动 |
| **Nav / Sidebar** | 高度 56/64、项高 36/40、选中态、折叠规则 | 两项换行、层级过深 |

> 这 13 个组件覆盖 80% 界面。先定死这些，其余按需补。

---

## 4. 组件与 token 的关系

```css
/* ✅ 正确 */
.button { height: var(--button-height-md); background: var(--accent); color: var(--accent-on);
          border-radius: var(--radius-md); padding: 0 var(--space-4); font: 500 var(--text-sm)/1 var(--font-body); }

/* ❌ 错误：任何裸值 */
.button { height: 40px; background: #2563eb; border-radius: 10px; }
```

组件级 token（`--button-height-md`）要么由 semantic token 组合，要么直接引用 semantic token；**不引入新的颜色来源**。

---

## 5. 状态矩阵（每个交互组件都要有）

| 状态 | 视觉变化（必须有） | 实现 |
|---|---|---|
| default | — | — |
| hover | 背景/边框变化 ≥ 1 级 | `:hover` |
| focus-visible | 2px 轮廓 + offset 2px | `:focus-visible` |
| active | 位移 1px 或背景再深一级 | `:active` |
| disabled | 透明度 .45 或 muted 色 | `[disabled]` |
| loading | 内容替换为骨架/转圈，宽度不变 | `[data-loading]` |
| error（表单） | 边框 danger + 错误文案在下方 | `[aria-invalid]` |
| empty（数据区） | 空态图 + 引导动作 | — |

**缺一个状态 = 一个 NEVER-I1 违规。**

---

## 6. 跨端复用

同一契约在四端实现，只允许「平台适配差异」，不允许「视觉差异」：

| 平台 | Button | 注意 |
|---|---|---|
| Web | `<button class="btn">` | 默认样式重置 |
| React Native | `<Pressable>` | 无 hover，用 pressed 态；热区 ≥44 |
| 微信小程序 | `<button>` | 默认边框/背景需重置；`hover-class` |
| Flutter | `FilledButton` | 主题映射 token |

适配差异清单（必须记录在契约里）：hover 缺失、系统字号缩放、安全区、点击热区、滚动行为。

---

## 7. 新增组件流程（硬门禁）

```text
1. 判断：现有组件能否组合出来？能 → 停止，用组合。
2. 写契约草稿（字段齐全）→ 存 components.md，标 status: proposed
3. 用户确认（可以只回「可以」）
4. 实现（引用 token）
5. 出 3 态截图（default / hover / focus）→ 进 acceptance/reference/
6. 填 `acceptance/component-verification.md` 的 C1–C10（尺寸/颜色/圆角/字体/状态/焦点/对比度/跨端/禁止用法/loading 不跳动）
7. status: active，写 change-log
```

**禁止**：先写代码再补文档；一个页面一个按钮样式；用 div 模拟 button。

---

## 8. 反模式

- ❌ 组件里出现裸 hex / px。
- ❌ 同一个按钮在三个页面三种高度。
- ❌ 组件自带 margin（应外层控制间距）。
- ❌ 组件内部写死文案（文案应外部传入）。
- ❌ 用「变体」掩盖没有系统（variant 应该有明确枚举，不是任意传值）。
- ❌ 只实现成功态，loading/error 让调用方自己拼。
