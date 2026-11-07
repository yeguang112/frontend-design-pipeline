# Component Contract · <项目名>

> 组件先定死、只引用。任何未列在此的组件，必须先补契约并经用户确认才能实现。
> 所有尺寸/颜色/字体/圆角/动效引用 `design/tokens/tokens.css`，不写裸值。

## 组件索引

| id | 名称 | 状态 | 变体 | 使用屏 |
|---|---|---|---|---|
| button | 按钮 | active | primary / secondary / ghost / danger | 全部 |
| icon-button | 图标按钮 | active | default / ghost | 全站 |
| input | 输入框 | active | text / password / search | 表单 |
| card | 卡片 | active | static / interactive | 列表/首页 |
| tabs | 标签页 | active | underline / pill | 详情 |
| modal | 弹窗 | active | confirm / form | 全站 |

---

## button

- **用途**：触发主要或次要动作。一屏最多 1 个 primary。
- **anatomy**：容器 > (可选图标 16/20px) + 文案
- **尺寸**

| size | height | padding-x | 字体 | 图标 | 圆角 |
|---|---|---|---|---|---|
| sm | 32px | `--space-3` | `--text-sm` / 500 | 16px | `--radius-md` |
| md | 40px | `--space-4` | `--text-sm` / 500 | 16px | `--radius-md` |
| lg | 48px | `--space-5` | `--text-base` / 500 | 20px | `--radius-md` |

- **颜色**

| 变体 | bg | fg | border | hover | active |
|---|---|---|---|---|---|
| primary | `--accent` | `--accent-on` | transparent | `--accent-hover` | `--accent-active` |
| secondary | `--surface-2` | `--fg` | `--border` | `--surface` | `--border-strong` |
| ghost | transparent | `--fg-2` | transparent | `--surface` | `--surface` |
| danger | `--danger` | `#fff` | transparent | 深 1 级 | 深 2 级 |

- **状态**：default / hover / focus-visible(2px `--accent` 轮廓 + 2px offset) / active(位移 1px) / disabled(opacity .45) / loading(文案换骨架，宽度不变)
- **动效**：`--dur-enter --ease-standard`（背景色变化）
- **可访问性**：`<button type="button">`；图标按钮必须 `aria-label`；最小热区 44×44
- **禁止**：文案换行；白底白字；loading 时宽度跳动；用 div 模拟
- **跨端**：RN `<Pressable>`（pressed 态）；小程序 `<button hover-class>`（重置默认样式）；Flutter `FilledButton`

---

## input

- **用途**：单行文本输入
- **anatomy**：label（上方）+ 输入框 + helper/error（下方）
- **尺寸**：高度 40（md）/ 48（lg）；padding-x `--space-3`；圆角 `--radius-sm`
- **颜色**：bg `--surface-2`；border `--border`；focus border `--accent` + ring；error `--danger`；placeholder `--muted`
- **状态**：default / hover / focus / disabled / error / readonly
- **禁止**：placeholder 当 label；错误只变色不给文案；无 focus 环
- **可访问性**：`<label for>`；`aria-invalid`；`aria-describedby` 指向错误文案

---

## card

- **用途**：一组相关信息的容器；仅当需要表达独立层级时使用
- **anatomy**：容器 > 可选 media + body + footer
- **尺寸**：padding `--space-6`；radius `--radius-lg`；卡片间距 `--space-6`
- **颜色**：bg `--surface-2`；border `--border`；shadow `--shadow-1`（border 与 shadow 二选一）
- **状态**：static / interactive（hover 边框加深，不放大）
- **禁止**：卡片套卡片；卡片内再放带阴影容器；用卡片代替布局分组

---

## tabs

- **用途**：同级内容切换
- **尺寸**：高 40；指示条 2px；项间距 `--space-6`
- **状态**：default / hover / active / focus / disabled
- **可访问性**：`role="tablist"` / `role="tab"` / `aria-selected`；左右键切换
- **禁止**：指示条滑动跳变；无键盘支持

---

## modal

- **用途**：需要中断当前任务的确认/表单
- **尺寸**：宽度档 400 / 560 / 720；padding `--space-6`；radius `--radius-lg`
- **状态**：open / closing；遮罩 `--overlay`；焦点陷阱；ESC 关闭
- **禁止**：无关闭按钮；焦点逃逸；遮罩过浅

---

## 新增组件模板

```md
## <name>
- 用途：
- anatomy：
- 尺寸（token）：
- 颜色（token）：
- 状态：
- 动效：
- 可访问性：
- 禁止：
- 跨端：
- status: proposed | active
```

---

## 其余核心组件骨架（填完再实现）

> 06 要求最小 13 个；以下 7 个是骨架，**实现前必须填满**（至少：用途 / 尺寸表 / 状态 / 禁止）。

### icon-button
- 用途：只有图标的操作（关闭、更多、工具栏）。
- 尺寸：方形 = 32/40/48；图标 16/20；热区 ≥44×44。
- 状态：default / hover / focus-visible / active / disabled。
- 禁止：无 `aria-label`；图标尺寸不统一。

### select
- 用途：从固定选项里单选。
- 尺寸：触发器同 input；菜单项高 36；最大高 320 + 滚动。
- 状态：default / open / hover / focus / disabled / error。
- 禁止：键盘不可用；被容器裁切；选项没有分组。

### checkbox-radio-switch
- 用途：布尔选择 / 单选项 / 即时开关。
- 尺寸：控件 20×20（checkbox/radio）、开关 36×20；标签间距 `--space-2`。
- 状态：default / hover / focus-visible / checked / disabled / error。
- 禁止：只有控件本身可点（整行应可点）；开关无 aria-checked。

### table
- 用途：结构化数据列表。
- 尺寸：行高 44/52；表头 sticky；数字右对齐、文本左对齐。
- 状态：default / hover / selected / loading / empty / error。
- 禁止：列宽跳动；无空态；行内操作超过 2 个。

### toast
- 用途：临时反馈（成功/失败/提示）。
- 尺寸：宽度 320–420；padding `--space-4`；圆角 `--radius-md`。
- 状态：enter / exit / 可关闭；同屏最多 1 条。
- 禁止：遮挡主操作；无限停留；无 `aria-live`。

### empty-skeleton
- 用途：空数据引导 / 加载占位。
- 规则：空态必须有引导动作；骨架形状匹配最终布局，避免布局跳动。
- 禁止：通用转圈；骨架与内容尺寸不一致。

### nav-sidebar
- 用途：全局导航 / 侧栏。
- 尺寸：顶栏高 56/64；侧栏项高 36/40；图标 16/20。
- 状态：default / hover / active / collapsed / focus。
- 禁止：桌面端两项换行；层级 >2；选中态只靠颜色（需加粗或指示条）。

