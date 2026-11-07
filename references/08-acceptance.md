# 08 · 客观验收（逐 tab / 逐状态截图）

> 验收标准越客观，AI 的执行越稳定。本章把所有「看起来还行」换成「命令 + 阈值 + PASS/FAIL」。
> 原则：**可复现、可量化、逐状态、留证据。**

---

## 1. 验收矩阵

必须覆盖的组合：

```
routes（每一屏/每个 tab）
  × states（default / empty / loading / error / 交互后状态）
  × viewports（1440×900 / 768×1024 / 390×844）
  × themes（light / dark，若声明双主题）
```

### 1.1 什么算「一个 tab / 一个状态」

| 类型 | 枚举方式 | 例 |
|---|---|---|
| 路由/tab | 导航项逐个 | `#/home` `#/pricing` `#/settings` `#/settings/billing` |
| 数据状态 | 每个异步区域 | loading / empty / error / 有数据 |
| 组件状态 | 每个交互组件 | 默认 / hover / focus / disabled / 打开态 |
| 业务状态 | 关键流程节点 | 未登录 / 已登录 / 权限不足 / 试用到期 |
| 响应式 | 三档 | 桌面 / 平板 / 移动 |
| 主题 | 两套 | light / dark |

**最低要求**：每个 route 至少 4 张（default × 3 视口 + 1 个数据状态）；有交互的 tab 追加打开态；
带表单的追加 error 态；带列表的追加 empty 态。

### 1.2 状态可复现（关键）

每个状态必须能通过**固定入口**到达，不靠手点：

- URL hash / query：`#/settings?state=empty`
- 全局调试钩子：`window.__setState('empty')`
- 脚本动作：`click #menu-btn` / `fill #email test@example.com`
- 禁止：依赖真实后端、随机数据、时间

配置写进 `acceptance/accept.config.json`（模板见 `templates/accept.config.json`）。

---

## 2. 截图规范（不遵守就会得到不可比的结果）

| 项 | 规定 |
|---|---|
| 视口 | 固定 1440×900 / 768×1024 / 390×844，DSR=2 |
| 动画 | 截图前注入 `animation:none; transition:none`；`prefers-reduced-motion` |
| 字体 | 等 `document.fonts.ready`；本地字体，禁 CDN |
| 光标 | 隐藏 caret；不显示鼠标 |
| 滚动 | 每个 route 截「顶部」+「全页」两版；对比用顶部 |
| 数据 | 固定种子/固定 mock；无时间戳、无随机数 |
| 主题 | 通过 `data-theme` + `Emulation.setEmulatedMedia` 双保险 |
| 命名 | `<route>--<state>--<w>x<h>--<theme>.png` |
| 存储 | `acceptance/screenshots/`；参考基线 `acceptance/reference/` |

---

## 3. 客观验收项（A1–A17）

每项都必须 PASS，否则整体 FAIL。

| ID | 检查项 | 命令/方法 | 阈值 |
|---|---|---|---|
| A1 | 截图齐全 | 对比矩阵应有 vs 实有 | 缺 1 张即 FAIL |
| A2 | 截图非空/非纯色 | 文件大小 > 5KB；像素方差 > 阈值 | 纯白/纯黑 FAIL |
| A3 | 尺寸正确 | 读 PNG 宽高 | 必须等于配置 |
| A4 | 像素 diff（vs 冻结参考） | `pixel-diff.mjs ref cur` | 差异率 ≤ 0.3% |
| A5 | token 一致性 | `detect-drift.mjs` | error = 0 |
| A6 | 计算样式 ⊆ token | DOM 断言：color/font-size/radius/padding 全部命中 token 集合 | 违规 0 |
| A7 | 对比度 AA | 计算每对前景/背景 | 正文 ≥4.5:1，大字 ≥3:1 |
| A8 | 无横向溢出 | `scrollWidth ≤ clientWidth + 1` | 三档全过 |
| A9 | 无 console error | 捕获 console/pageerror | 0 |
| A10 | 状态覆盖完整 | 状态矩阵 vs 应有状态 | 缺项 0 |
| A11 | 交互脚本可执行 | 配置的 click/fill 全部成功 | 失败 0 |
| A12 | 冻结未被篡改 | `verify-freeze.mjs` | PASS |
| A16 | 无提示词泄漏 / 元说明 | `check-copy.mjs` | error = 0（说明只进注释） |
| A17 | 无 <12px 可见小字 | `check-copy.mjs` 的 `tiny-text` | warn = 0 或有理由 |

> A4 的阈值可按项目调（品牌站可放到 0.5%），但**必须写进 guidelines**，不能临时改。

---

## 4. 执行流程

```bash
# 0) 一键判定（推荐；浏览器不可用时 A6/A7/A8/A11 自动记「未检」）
node scripts/accept-verify.mjs --config acceptance/accept.config.json

# 1) 冻结参考截图（P4 时做一次）
node scripts/capture-acceptance.mjs --config acceptance/accept.config.json --out acceptance/reference

# 2) 每次验收
node scripts/capture-acceptance.mjs --config acceptance/accept.config.json --out acceptance/screenshots

# 3) 逐张对比
node scripts/pixel-diff.mjs acceptance/reference/home--default--1440x900--light.png \
                           acceptance/screenshots/home--default--1440x900--light.png

# 4) token/漂移
node scripts/detect-drift.mjs . --tokens design/tokens/tokens.json

# 4.5) 文案 / 提示词泄漏
node scripts/check-copy.mjs design/frozen --json -

# 5) 冻结校验
node scripts/verify-freeze.mjs design/frozen/freeze-manifest.json --base design/frozen
```

AI 的循环：**跑 → 读报告 → 修 → 重跑**，最多 3 轮；3 轮不过就问用户（可能是设计本身要改，不是实现问题）。

### 4.1 无浏览器环境（沙箱 / CI）

部分沙箱内 Chromium 无法启动（crashpad 需要 `OpenProcess` 被拒）。表现是浏览器进程立刻退出。
处理顺序：

1. `capture-acceptance.mjs --dry-run` 先校验截图矩阵（不渲染）。
2. 在普通终端手动起浏览器再附着：`chrome --remote-debugging-port=9222` → `capture-acceptance.mjs --cdp-url http://127.0.0.1:9222`。
3. 仍不行则降级：用宿主自带的截图工具（或 `ego_*` / 浏览器 MCP）按同一矩阵截图，**文件名与判定阈值不变**。
4. 报告里如实写「未检（无浏览器）」——**不许把未检写成 PASS**。


---

## 5. 报告格式（`acceptance/acceptance-report.md`）

```md
# 验收报告 · <项目> · <日期> · <commit/版本>

## 结论：FAIL（A4、A7 未过）

| ID | 项 | 结果 | 证据 |
|---|---|---|---|
| A1 | 截图齐全 | PASS | 42/42 |
| A4 | 像素 diff ≤0.3% | **FAIL** | home--1440 差异 1.8% → diff-home.png |
| A7 | 对比度 AA | **FAIL** | .muted 在 surface 上 3.9:1 |

## 失败详情
### A4 · home--default--1440x900--light（1.8%）
- 区域：hero 右侧卡片整体下移 12px
- 原因：padding 用了 28px（token 是 24px）
- 修复：改 --space-6

## 已修复 / 待确认
- …

## 主观项（待用户签收）
- [ ] 品牌感 / 氛围是否符合 frontend-guidelines §1
```

---

## 6. 主观项（AI 不判）

以下只提供证据，由用户签收：
- 是否「看起来像目标品牌」
- 是否「高级 / 克制 / 有呼吸感」
- 文案语气是否合适
- 是否有「说不上来的 AI 味」

AI 的职责：给截图、给对比、给客观项结论；**不许替用户说「这样好看」。**

---

## 7. 验收失败的处理

| 情况 | 动作 |
|---|---|
| 实现与冻结稿不一致 | 修实现（不改冻结稿） |
| 冻结稿本身有问题 | 走 CR，重冻结 |
| token 与冻结稿不一致 | 以冻结稿为准修 token，再重冻结 |
| 同一项 3 轮修不过 | 停下来问用户：是设计要改，还是实现难度问题 |
| 截图环境不稳定（字体/动画） | 先修环境，不接受「环境问题」当 PASS |

---

## 8. 反模式

- ❌ 只截首屏，不截状态与移动端。
- ❌ 用「人工看一遍」代替 diff。
- ❌ 截图前不冻结动画，导致每次都不一样。
- ❌ diff 阈值临时放宽以通过。
- ❌ 把「主观不满意」记成 PASS（应记「主观未签收」）。
- ❌ 验收报告只写结论不写证据路径。
