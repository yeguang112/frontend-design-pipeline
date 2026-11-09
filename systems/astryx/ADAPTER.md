# Astryx 接入本流程（Adapter）

> 适用：项目决定以 **Astryx 作为实现基座**（而不是只用品牌风格参考）。
> 前面三份文件：`DESIGN.md`（设计语言）、`tokens/`（token 快照）、`components/`（组件清单）。

---

## 1. 先判断：要不要用它

| 信号 | 选 Astryx | 选 `brand-specs/` 风格参考 |
|---|---|---|
| 产物 | 生产级后台 / 控制台 / 工具型 Web 应用 | 营销落地页 / 品牌官网 / 活动页 |
| 团队栈 | React 19+ | 任意（HTML/CSS/小程序/Vue…） |
| 需要 150+ 现成可访问组件 | ✅ | ❌ |
| 需要组件行为（键盘/焦点/ARIA）由系统兜底 | ✅ | ❌（自己实现 + 验收） |
| 想要强品牌叙事、非标准布局 | 可做但受组件语言约束 | ✅ |
| 需要多主题 / 暗色 / 白标 | ✅（token 级主题） | 需自建 |

两者也可以叠加：**Astryx 做应用内页，品牌参考做营销页**；但共享同一套 `frontend-guidelines.md`。

## 2. 接入方式 A：React 应用（完整体验）

```bash
npm install @astryxdesign/core @astryxdesign/theme-neutral
```

```tsx
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';

import {XDSTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

export default function App() {
  return <XDSTheme theme={neutralTheme}>{/* app */}</XDSTheme>;
}
```

- 组件从 `components/astryx-components.json` 里选（204 个导出）。
- **样式顺序不能反**：reset → core → theme。
- 字体（Figtree）需自行加载；不加载则走系统回退（官方接受这一点）。

## 3. 接入方式 B：HTML 静态稿 / 非 React（本流程默认）

P3 阶段用冻结前 HTML 打磨视觉时：

```html
<link rel="stylesheet" href="systems/astryx/tokens/astryx-tokens.css">
<html data-astryx-theme="neutral">
  <body>
    <button style="background:var(--color-accent); color:var(--color-on-accent);
                   height:var(--size-element-md); padding:0 var(--spacing-4);
                   border-radius:var(--radius-element); font:500 var(--font-size-sm)/1 var(--font-family-body);">
      保存
    </button>
  </body>
</html>
```

- token 里的 `light-dark()` / `rem` / `var()` 需要现代浏览器；兼容旧环境时改用官方编译产物。
- 组件行为（焦点、键盘）仍由你实现；**组件外观必须严格按 token 组合**，不要另造视觉。

## 4. 与 P0–P8 的映射

| 阶段 | 用 Astryx 时怎么做 |
|---|---|
| P0 意图识别 | 读法里多一句「实现基座：Astryx neutral」 |
| P1 风格路由 | 基座 = Astryx；不再选品牌主参考（或只用品牌参考定「气质」，不覆盖组件） |
| P2 准则校准 | guidelines 增补：只用 Astryx token；组件只从 components.json 选；主题不改组件源码 |
| P3 HTML 静态稿 | 引入 `tokens/astryx-tokens.css`，用 token 组合页面；全状态仍要自己补齐 |
| P4 冻结 | 不变（sha256 + 只读） |
| P5 token/组件契约 | 项目的 `tokens.css` = Astryx token 别名层（`--app-bg: var(--color-background-body)`）；组件契约映射到 Astryx 组件名 |
| P6 跨端 | 只借 token（颜色/字号/间距/圆角/动效），组件换成平台实现 |
| P7 变更控制 | drift 检查「业务代码不得引入 Astryx 之外的新色板」；主题改动走 CR |
| P8 验收 | A1–A17 不变；额外断言业务样式只引用 token |

## 5. 主题定制（唯一允许的品牌化方式）

1. **换主题包**：`@astryxdesign/theme-stone` 等；重跑 `sync.mjs --theme stone` 更新快照。
2. **改 token 值**：在项目层覆盖语义 token（`[data-astryx-theme]` 作用域内），不改组件。
3. **禁止** fork 组件后用 90% 覆盖——会丢掉系统的行为与可访问性收益。

```css
/* 项目层：只覆盖语义 token，不碰组件 */
[data-astryx-theme="neutral"] {
  --color-accent: #0f766e;
  --color-on-accent: #ffffff;
  --radius-element: 8px;
}
```

## 6. 同步与升级

```bash
# 同步最新版本（读 manifest 里的版本；联网）
node systems/astryx/sync.mjs

# 指定版本 + 复用缓存
node systems/astryx/sync.mjs --version 0.7.11 --skip-download

# 换主题
node systems/astryx/sync.mjs --theme stone
```

升级流程：`sync.mjs` → 看 tokens diff → 若有破坏性变更，走 CR 并重冻结 → 更新 `design-authority.md` 的基座版本。

## 7. 风险与边界

- **Beta**：0.7.x，API 仍可能变；锁版本，升级前读 CHANGELOG。
- **React 19 + StyleX**：非 React 项目只能借 token，不能借组件。
- **字体**：Figtree 默认不打包；中文项目必须补 CJK 回退并重测行高。
- **许可证**：Astryx 为 MIT；本快照保留版权头与 LICENSE。品牌/商标归 Meta，不得暗示背书。
- **快照不是官方文档**：以官方站点与仓库为准；`DESIGN.md` 是本项目的摘要。
