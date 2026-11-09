---
name: frontend-design-pipeline
zh_name: 前端设计链路
description: |
  用户要做前端 / UI（网页、落地页、App、小程序、管理后台、组件、改版、修 UI）时使用。
  流程：意图识别 → 匹配 awesome-design-md 品牌设计规范 → 与用户确认 frontend-guidelines
  （正面清单 / 反面清单）→ HTML 静态稿打磨 → 冻结为设计权威源 → 提取 tokens 与组件契约
  → 落到 app / 小程序 → 变更自检与逐状态截图验收。
  核心目的：让风格可控、实现一致、验收客观，避免 AI 生成感与长期目标漂移。
triggers:
  - 做前端
  - 写个页面
  - 设计一个页面
  - 落地页
  - landing page
  - app 界面
  - 小程序界面
  - 管理后台
  - 设计规范
  - 设计系统
  - UI 风格
  - 页面改版
  - 重构 UI
  - 调一下样式
  - frontend
  - design system
  - design guidelines
od:
  mode: design-system
  scenario: planning-and-build
---

# 前端设计链路（Frontend Design Pipeline）

> 不是「一次性生成一个好看的页面」，而是「建一套可复用、可验收、不会漂移的设计权威源」。
> 本 skill 是流程与门禁；具体规则在 `references/`，可复制模板在 `templates/`，可执行脚本在 `scripts/`。

## 0. 解决三个问题

| 问题 | 本链路的答案 |
|---|---|
| 风格不可控：每次生成都像另一个产品 | 品牌规范路由 + `frontend-guidelines.md` 正面/反面清单 |
| 实现不一致：AI 每次自己发明颜色/字号/圆角 | 冻结 HTML → 提取 tokens → 组件契约「先定死、只引用」 |
| 长期漂移：改着改着目标变了 | 变更自检矩阵 + 逐 tab/状态截图验收 + 决策日志 |

## 1. 何时用 / 何时不用

**用**：新建前端界面、改版、把设计稿/截图/参考站转成实现、跨端（Web → App / 小程序）复用同一套视觉、给已有项目补设计规范、修「AI 味」。
**不用**：纯数据/接口/后端任务；只改文案不改视觉（直接改）；纯设计评审（用 design-review 类 skill）。

## 2. 铁律（Hard Rules，违反任何一条都必须停下来说明）

1. **没有用户签收的 `frontend-guidelines.md`，不写正式实现代码。** 可以先写 HTML 探究稿，但不能直接进 app / 小程序 / 生产组件。
2. **没有冻结的 HTML，不提取 tokens、不写组件契约。** 冻结前 `prototype/` 是可改的工作区；冻结后 `design/frozen/` 只读。
3. **所有视觉值必须来自 token。** 颜色、字号、行高、字距、间距、圆角、阴影、动效时长/曲线、层级，一律 `var(--token)`；出现裸值即视为缺陷。
4. **组件先定死再使用。** 新组件必须先写进 `design/components.md`（尺寸/质感/状态）并让用户确认，之后只允许引用；禁止在使用处临时造组件。
5. **每次 UI 变更必须过「变更自检矩阵」**（`references/07-change-control.md`）：布局 / token / 字体 / 交互 / 图标 / 文案 / 无障碍 / 性能，八项全查。
6. **验收必须逐 route × state × viewport × theme 截图**，且每项判定是「命令 + 阈值 + PASS/FAIL」，不接受「看起来不错」。
7. **规范只能追加不能静默修改。** 改正面/反面清单 = 升版本 + 追加决策日志 + 用户确认；禁止为了通过检查而改规则。
8. **一次只问 1–2 个问题，且必须给可视觉化的选项**；能从上下文推断的不要问，直接写「我的读法」让用户否决。
9. **先读后写。** 每次会话开始先读 `design/design-authority.md` 指定的读取顺序，再动任何 UI 代码。
10. **客观项 AI 判，主观项用户判。** 截图 diff / 对比度 / token 一致性由 AI 出报告；「有没有品牌感、够不够高级」由用户签收。
11. **给工程师的说明不渲染。** 用户的修改要求、AI 的执行说明、设计理由、参考来源、TODO 一律写进代码注释 / `data-design-note` / change-log，**不得出现在页面可见文字，也不得塞进 `alt`/`title`/`placeholder`/`aria-label`**；交付前 `check-copy.mjs` error=0。

## 3. 状态机（P0 → P8）

每阶段有：**产物**、**完成判据（Gate）**。Gate 未过不进入下一阶段，除非用户明确说「跳过」。

| 阶段 | 名称 | 产物 | Gate |
|---|---|---|---|
| P0 | 意图识别 Design Read | 一句话读法 + 表盘 + 置信度 | 置信度 ≥ 0.6 且用户未反对；< 0.6 先问 1 个问题 |
| P1 | 风格路由 + 基座选择 | 1 主 + ≤1 辅品牌规范，或官方系统（`systems/`）+ keep/change/do-not-copy | 用户认可方向（可只回「可以」） |
| P2 | 准则校准 | `frontend-guidelines.md` v0.x + `decision-log.md` | **用户明确签收**（「就这个 / 确认 / 按这个做」） |
| P3 | HTML 静态稿 | `prototype/` 可交互静态稿（全状态、三档视口） | 用户签收视觉；反 AI 味审计 0 error |
| P4 | 冻结 | `design/frozen/` + `freeze-manifest.json` + `design-authority.md` | 校验哈希 PASS；用户确认「冻结」 |
| P5 | Token + 组件契约 | `design/tokens/*` + `design/components.md` + `acceptance/component-verification.md` | 提取脚本跑通（非退化）；组件清单用户确认 |
| P6 | 跨端落地 | app / 小程序 / 正式前端实现 + `design/handoff/` | drift 检测 0 error；组件全部来自契约；单位换算只在适配层 |
| P7 | 变更控制 | `change-log.md` + 自检矩阵结果 | 每次改动闭环 |
| P8 | 截图验收 | `acceptance/` 截图 + 报告 | 客观项全 PASS；主观项用户签收 |

**迭代是常态**：P2 与 P3 之间可以来回多轮。每次用户反馈都追加到 `decision-log.md`，并把结论回写进 guidelines 的新版本——这是「沉淀到全过程」的机制，不是一次性文档。

## 4. 项目内文件布局（在用户项目里生成）

```
<project>/
├── design/
│   ├── frontend-guidelines.md    # 权威规则：正面清单 + 反面清单（版本化）
│   ├── decision-log.md           # 用户偏好与每次调整的记录
│   ├── design-authority.md       # 读取顺序 + 冲突裁决 + 冻结声明 + 设计指纹
│   ├── components.md             # 组件契约（先定死，只引用）
│   ├── change-log.md             # 每次 UI 改动的八项自检记录
│   ├── change-request/           # CR-<n>.md：冻结后的视觉修改请求
│   ├── handoff/                  # 跨端交付：screen-map / component-map / platform-overrides
│   ├── frozen/
│   │   ├── index.html            # 冻结静态稿（只读）
│   │   ├── assets/               # 本地图片/字体
│   │   └── freeze-manifest.json  # sha256 + 字节数
│   └── tokens/
│       ├── tokens.json           # 机器可读（extract-tokens 输出）
│       ├── tokens.css            # CSS 变量（实现唯一来源）
│       └── tokens.md             # 人读表格
├── prototype/                    # 冻结前工作区（可改、可删）
│   └── index.html
└── acceptance/
    ├── accept.config.json
    ├── screenshots/
    ├── reference/                # 冻结基线截图
    └── acceptance-report.md
```

## 5. 读取顺序（渐进披露，按需加载）

1. 本文件（流程与门禁）
2. `references/00-intent-router.md` —— P0/P1：怎么读意图、怎么选风格族与品牌、怎么问用户
3. `references/01-brand-taxonomy.md` + `data/brand-index.json` —— 58 个品牌 → 10 个风格族的索引
4. `references/02-guidelines-spec.md` —— P2：`frontend-guidelines.md` 怎么写、怎么版本化、怎么让用户签收
5. `references/03-negative-list.md` —— 反 AI 味清单（每条带可检测判定）
6. `references/04-html-prototype.md` —— P3/P4：HTML 静态稿规范、打磨循环、冻结协议、变更请求
7. `references/05-token-contract.md` —— P5：token 分类/命名/提取/平台映射
8. `references/06-component-contract.md` —— P5：组件契约字段与「先定死」流程
9. `references/07-change-control.md` —— P7：变更自检矩阵、防漂移闸门
10. `references/08-acceptance.md` —— P8：截图矩阵与客观验收项
11. `references/09-handoff.md` —— P6：HTML 原型 → App / 小程序的映射与单位换算
12. `references/10-official-systems.md` —— P1：官方实现系统（Astryx by Meta）与「基座」选择

品牌规范原文：`brand-specs/<brand>/DESIGN.md`（来自 awesome-design-md，非官方，仅作风格参考）。
官方实现系统：`systems/<id>/`（如 `systems/astryx/`：DESIGN.md + tokens + components + ADAPTER）。
模板：`templates/`（含 `component-verification.md` 组件验证记录）。脚本：`scripts/README.md`。

## 6. P0 的固定输出格式（必须逐字给出，便于用户否决）

```text
Design Read：这是 <页面类型>，给 <受众>，语言是 <氛围词>，倾向 <品牌/风格族>。
表盘：VARIANCE=<1-10> MOTION=<1-10> DENSITY=<1-10>（理由：……）
主参考：<brand>（keep：… / change：… / do-not-copy：…）
辅参考：<brand 或 none>（只借 <一个维度>）
置信度：0.x
```

置信度 < 0.6 时，**只问一个问题**，例如：
> 「更接近 A（Linear 那种冷峻工程感）还是 B（Stripe 那种克制但更有温度）？」——给两张品牌规范的一句话描述 + 各自代价。

## 7. P2 的签收话术（不要问「这样可以吗」）

> 我把准则写到 `design/frontend-guidelines.md` v0.1 了。
> 正面清单 N 条、反面清单 M 条，其中和你上一个项目不同的有：<3 条以内>。
> 你只需要回三种之一：**「就这个」** / **「第 X 条改成 …」** / **「反面清单再加 …」**。
> 你确认后我会把它当唯一权威，后面只按它做。

## 8. 与脚本的契约

| 脚本 | 何时跑 | 判定 |
|---|---|---|
| `scripts/extract-tokens.mjs` | P5 | 生成 tokens.json/css/md；`meta.counts.degenerate=false` |
| `scripts/detect-drift.mjs` | 每次 UI 改动后、P6、P8 | `--list-rules` 查 40 条规则（12 自动 + 28 人工）；error=0 |
| `scripts/capture-acceptance.mjs` | P8、每次改版后 | 截图齐全、非空；无浏览器时 `--dry-run` |
| `scripts/verify-freeze.mjs` | P4、每次会话开始 | frozen 未被篡改 |
| `scripts/pixel-diff.mjs` | P8 对比冻结参考 | 差异率 ≤ 阈值（默认 0.3%） |
| `scripts/check-copy.mjs` | P3/P8、每次改文案 | 提示词泄漏/元说明/TODO/<12px 小字；error=0 |
| `scripts/accept-verify.mjs` | P8 汇总 | 一键出 A1–A17 的 PASS/FAIL/未检 |
| `systems/astryx/sync.mjs` | 使用/升级 Astryx 时 | 重新生成 `systems/astryx/` 的 token 快照与 manifest |

没有脚本环境时（无 Node）：降级为人工清单 + `ego_*` / 浏览器截图工具，但**验收项与阈值不变**。

## 9. 失败模式与回退

| 现象 | 处理 |
|---|---|
| 用户说不清想要什么 | 给 2–3 个品牌规范的一句话对比 + 「各付什么代价」，让用户选，而不是追问形容词 |
| 用户否掉了整版 | 不要重画；先问「是方向错还是执行错」；方向错回 P1，执行错回 P3 |
| 用户中途加需求 | 先判断是否触碰 token/组件/布局；触碰则走变更请求（CR），不静默改 |
| 参考品牌自带 AI 味（如紫色强调） | 只在品牌规范明确指定的位置允许其品牌色，禁止外溢成通用渐变；写进 guidelines 例外 |
| 跨端实现走样 | 只允许在平台适配层做单位换算，设计值不变；drift 检测覆盖 app/小程序源码 |
| 规则与实际冲突 | 以冻结 HTML 为视觉真相，tokens 为数值真相；冲突时改规则文件并升版本，不改记忆 |

## 10. 最小可用路径（赶时间时）

P0 读法 → P1 选 1 个品牌 → P2 guidelines v0.1（只写 10 条正面 + 10 条反面）→ P3 单页 HTML → P4 冻结 → P5 tokens + 5 个核心组件 → P8 截图验收。
**可以砍阶段，不能砍 Gate：签收、冻结、token 化、截图验收这四件事不能省。**
