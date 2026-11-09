# 前端设计链路（Frontend Design Pipeline）

[![CI](https://github.com/yeguang112/frontend-design-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/yeguang112/frontend-design-pipeline/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![AE](https://img.shields.io/badge/agent-skill-6f42c1.svg)](SKILL.md)

> **An agent skill that turns "make it look good" into a governed pipeline:**
> intent → brand DESIGN.md → signed guidelines (do / never) → frozen HTML → tokens & component contract → change control → screenshot acceptance.
> 中文说明为主，规则可直接用于 Claude Code / Codex / DSH / Cursor 等 agent。

> 让 AI 前端「风格可控、实现一致、验收客观、长期不漂移」。
> 形态：**Agent Skill（主）+ Prompt 存根（备）**。品牌规范库来自 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)（MIT），
> 结构参考 [open-design](https://github.com/nexu-io/open-design)（Apache-2.0）。

---

## 1. 它解决什么

```
用户一句话
   │
   ▼
P0 意图识别 ──► Design Read（产物/受众/氛围/表盘/置信度）
   │
   ▼
P1 风格路由 ──► 10 风格族 ──► 58 品牌 DESIGN.md ──► 1 主 + ≤1 辅参考
   │
   ▼
P2 准则校准 ──► frontend-guidelines.md（正面清单 + 反面清单）◄──┐
   │              │ 用户签收 v1.0                              │ 迭代
   │              ▼                                           │
P3 HTML 静态稿 ──► prototype/index.html（全状态/三档视口）──────┘
   │
   ▼
P4 冻结 ──► design/frozen/ + freeze-manifest.json（只读）
   │
   ▼
P5 Token + 组件 ──► tokens.json/css/md + components.md（先定死）
   │
   ▼
P6 跨端落地 ──► App / 小程序（只换单位，不换视觉）
   │
   ▼
P7 变更控制 ──► 八项自检矩阵 + 漂移检测（每次改动）
   │
   ▼
P8 截图验收 ──► 逐 route × state × viewport 截图 + A1–A12 客观判定
```

AI 做前端有三个稳定失败模式：

1. **风格不可控**：每次生成的都像另一个产品，且默认滑向「紫渐变 + 玻璃 + 大圆角卡片」。
2. **实现不一致**：同一个按钮在不同页面三种高度，颜色/字号/圆角每次重新发明。
3. **长期漂移**：改到第 20 屏时，已经没人记得最初的设计方向。

本链路的答案：

| 失败模式 | 机制 |
|---|---|
| 风格不可控 | 意图识别 → 10 个风格族 → 58 个品牌 DESIGN.md → 与用户确认 `frontend-guidelines.md`（正面/反面清单） |
| 实现不一致 | HTML 静态稿冻结 → 提取 tokens → 组件契约「先定死、只引用」 |
| 长期漂移 | 变更自检矩阵 + 设计指纹 + 逐 tab/状态截图验收 + 决策日志 |

---

## 2. 为什么是 Skill 而不是 Prompt

| | Prompt | Skill |
|---|---|---|
| 生效范围 | 单轮对话 | 整个项目生命周期，每次会话自动加载 |
| 内容容量 | 受上下文限制，越长越容易被忽略 | 主文件短，细则按需加载（渐进披露） |
| 可执行 | 只能「要求 AI 做」 | 附带脚本（token 提取 / 漂移检测 / 截图验收），可验证 |
| 产物 | 对话里的文本 | 项目内真实文件（guidelines / tokens / frozen HTML / 验收报告） |

结论：**主形态用 Skill**；对不支持 skill 的宿主（网页版、临时脚本），用 `prompt-stub.md`（一页纸，保留 80% 约束力）。

---

## 3. 三种用法

### 3.1 装成技能（推荐）

```bash
# 1) 克隆
git clone https://github.com/yeguang112/frontend-design-pipeline.git
cd frontend-design-pipeline

# 2a) Windows
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1

# 2b) macOS / Linux
./install.sh

# 或指定目标目录
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target "C:\Users\<你>\.agents\skills"
./install.sh "/path/to/skills"
```

默认安装到 `~/.agents/skills/frontend-design-pipeline`（DSH / Claude Code / Codex / Cursor 通用的 skills 目录）。
装好后，用户说「做个落地页 / 设计个 App 界面 / 改一下 UI」即自动触发。

### 3.2 项目内引用

把本目录放进项目（如 `.design-pipeline/`），在 `AGENTS.md` / `CLAUDE.md` 里加一行：

```md
涉及任何 UI/前端任务时，先读 .design-pipeline/SKILL.md 并按流程执行。
```

### 3.3 纯提示词

把 `prompt-stub.md` 全文粘到系统提示词或项目规则里。约束力弱于 skill，但零安装。

---

## 4. 目录结构

```
design-pipeline/
├── SKILL.md                    # 主文件：流程状态机 + 11 条铁律 + 门禁
├── skill-budget.json           # 体量预算（唯一真源）
├── README.md                   # 本文件
├── prompt-stub.md              # 纯提示词版
├── references/                 # 细则是按需加载的
│   ├── 00-intent-router.md     # 意图识别 / 风格族 / 品牌选择 / 提问话术
│   ├── 01-brand-taxonomy.md    # 10 个风格族路由层（轻量）
│   ├── 01b-brand-families.md   # 逐族细节（选定候选族后再读）
│   ├── 02-guidelines-spec.md   # frontend-guidelines 写法与版本迭代
│   ├── 03-negative-list.md     # 反 AI 味清单（50+ 条，带检测方式）
│   ├── 04-html-prototype.md    # HTML 静态稿规范 / 打磨 / 冻结 / CR
│   ├── 05-token-contract.md    # token 分类 / 提取 / 平台映射
│   ├── 06-component-contract.md# 组件契约字段与先定死流程
│   ├── 07-change-control.md    # 变更自检矩阵 + 防漂移
│   ├── 08-acceptance.md        # 逐状态截图验收（A1–A12）
│   ├── 09-handoff.md           # HTML 原型 → App / 小程序映射
│   ├── 10-official-systems.md  # 官方实现系统（Astryx）与基座选择
│   └── 11-skill-budget.md      # 体量预算 + 整合协议
├── templates/                  # 可直接复制的项目文件模板
│   ├── frontend-guidelines.md  # 正面/反面清单模板（含 12+15 条可用规则）
│   ├── decision-log.md         # 用户偏好沉淀
│   ├── design-authority.md     # 权威源 + 冲突裁决 + 设计指纹
│   ├── components.md           # 组件契约模板（6 个完整示例 + 7 个骨架）
│   ├── component-verification.md # 组件验证记录（C1–C10）
│   ├── change-log.md           # 每次改动的八项自检记录
│   ├── change-request.md       # 变更请求（冻结后）
│   ├── tokens.css              # token 契约骨架（浅/深双主题）
│   ├── tokens.json             # 审校后 tokens.json 最小示例
│   ├── accept.config.json      # 截图矩阵配置
│   ├── acceptance-report.md    # 验收报告
│   └── freeze-manifest.json    # 冻结哈希清单
├── brand-specs/                # 58 个品牌的 DESIGN.md + preview（原样 vendored）
├── systems/                    # 官方实现系统（Astryx by Meta）：tokens + components + adapter
├── schemas/                    # system.manifest.json 等数据契约
├── data/brand-index.json       # 品牌 → 风格族 → 关键词 → 配色/字体索引
├── data/systems-index.json     # 官方系统索引（Astryx 等）
└── scripts/                    # 零依赖 Node 工具链
    ├── extract-tokens.mjs      # 冻结 HTML → tokens.json/css/md
    ├── detect-drift.mjs        # 裸值 / 紫渐变 / 玻璃 / 大圆角 / emoji 检测
    ├── capture-acceptance.mjs  # 逐 route×state×viewport×theme 截图（CDP）
    ├── verify-freeze.mjs       # 冻结 sha256 校验
    ├── pixel-diff.mjs          # 截图像素对比
    ├── check-copy.mjs          # 提示词泄漏 / 元说明 / <12px 小字检查
    └── accept-verify.mjs       # A1–A17 一键判定（PASS/FAIL/未检）
```

---

## 5. 最小可用路径（赶时间时 30 分钟内可跑完一轮）

```text
1. 说「做一个 <页面>」→ AI 给 Design Read（一句话 + 表盘 + 主参考品牌）
2. 确认方向 → AI 出 frontend-guidelines v0.1（10 条正面 + 10 条反面）
3. 回「就这个」→ AI 写单页 HTML 静态稿（桌面 + 移动 + 全状态）
4. 回「冻结」→ AI 生成 freeze-manifest + design-authority
5. AI 提取 tokens + 写 5 个核心组件契约
6. AI 跑截图验收，出 PASS/FAIL 报告
```

---

## 6. 用户说什么 → 触发什么

| 用户说 | 触发 |
|---|---|
| 做个落地页 / 官网 / 页面 | P0→P8 全链路 |
| 设计个 App / 小程序界面 | P0→P8，端 = app/mini-program |
| 改一下 UI / 调样式 | P7 变更控制（先读权威源） |
| 这个不好看 / 没有高级感 | P2 准则校准（给可视觉化选项） |
| 换一种风格 | P1 重新路由 + P2 升 v2.0 |
| 把设计用到 App 里 | P5→P6 跨端映射 |
| 检查一下设计有没有跑偏 | P7 健康检查 + P8 验收 |

---

## 7. 与现有设计类技能的关系

- `design-taste-frontend` / `frontend-design`：偏「审美方向与反模板」，回答「怎么好看」。
- 本 skill：偏「流程与治理」，回答「怎么保证一直好看、且能被验收」。
- 二者可叠加：用 taste 类技能做 P0/P1 的审美判断，用本 skill 做 P2–P8 的固化与验收。

---

## 7.5 官方实现系统（systems/）

`brand-specs/` 回答「长得像谁」；`systems/` 回答「用什么建」。

| 层 | 内容 | 例 |
|---|---|---|
| 风格参考 | 从公开网站提取的视觉语言 | 58 个品牌（Linear、Stripe…） |
| 官方实现系统 | 生产级组件 + 行为 + 可访问性 + token 主题 | **Astryx by Meta** |

**已收录：Astryx by Meta**（`systems/astryx/`）

- Meta 内部 8 年、13,000+ 应用，2026-06 开源（Beta 0.7.x），**MIT**。
- React 19 + StyleX；204 个组件导出；token 为 CSS 自定义属性；8 个主题、暗色、token 级品牌化。
- neutral 主题强调色是**近黑**，天然避开「AI 紫」。
- 快照：`DESIGN.md` / `tokens/`（314 token）/ `components/`（204）/ `ADAPTER.md` / `sync.mjs`。
- 规则见 [`references/10-official-systems.md`](references/10-official-systems.md)。

> 升级 `node systems/astryx/sync.mjs`；换主题 `--theme stone`。上游 Beta，锁版本并复核 token diff。

## 8. 数据与许可

| 来源 | 许可 | 用途 |
|---|---|---|
| [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | MIT | 58 个品牌的 `DESIGN.md`（公开网站提取，**非官方设计系统**，仅作风格参考；商标归各自所有者） |
| [nexu-io/open-design](https://github.com/nexu-io/open-design) | Apache-2.0 | 设计系统包结构（manifest + DESIGN.md + tokens.css）、craft 规则思路（**未复制源码**） |
| [meta/astryx](https://github.com/meta/astryx) | MIT | systems/astryx/ 的 token 快照与组件清单（**未复制组件源码**；摘要非官方文档） |
| 本仓库新增内容 | MIT | 规则、模板、脚本、示例 |

- 完整许可：[LICENSE](LICENSE) · 第三方说明：[NOTICE](NOTICE) · 原始许可证：[THIRD_PARTY/](THIRD_PARTY/)
- **免责声明**：`brand-specs/` 中的规范是从公开网站提取的近似值，颜色/字体/间距可能与官方有偏差；不得声称是官方设计系统，不得复制品牌 logo/版权图片/原文案，不得暗示品牌背书。

---

## 8.5 体量预算（整合时做适应性调整）

技能会随「再加一个系统/品牌/规则」持续膨胀。本仓库用三层加载 + 预算强制约束：

| 层 | 何时加载 | 预算 |
|---|---|---|
| T0 always | 每次会话语境 | `SKILL.md` ≤ 16 KB |
| T1 on-demand | 进入阶段才读 | `references/*` 单文件 ≤ 42 KB；总计 ≤ 170 KB |
| T2 data | 按 id 查 | `brand-specs/`、`systems/`、`examples/` 不整体加载 |

- 整合协议：分类（路由/规则/数据）→ 落位 → 去重 → **裁剪** → 测量；一个 release 最多 1 个整合。
- 发版前 `node scripts/check-skill-size.mjs`；超预算按「拆 → 删 → 下沉 → 提预算（最后手段）」处理。
- 案例：v1.2.0 把 38 KB 的 `01-brand-taxonomy.md` 拆成路由层（15 KB）+ 按需细节（20 KB），P1 首次加载 −60%。
- 规则全文见 [`references/11-skill-budget.md`](references/11-skill-budget.md)。

## 9. 维护

- **更新品牌库**：重新 clone awesome-design-md，覆盖 `brand-specs/`，重跑索引生成（`data/brand-index.json`）。
- **新增风格族**：改 `data/brand-index.json` 的 `families` + `references/01-brand-taxonomy.md`，保持 id 稳定。
- **调验收阈值**：改 `templates/accept.config.json` 的 `thresholds`，并同步写进 guidelines（不可临时改）。
- **新增脚本**：遵守零依赖 + `--help` + 退出码约定（0 通过 / 1 违规 / 2 用法错误）。

## 10. 已知限制

- **沙箱内 Chromium 可能起不来**（crashpad 的 `OpenProcess` 被拒）。`capture-acceptance` 先 `--dry-run` 校验矩阵；或手动起 Chrome 用 `--cdp-url` 附着；或降级为宿主截图工具，**判定项与阈值不变**。无浏览器时报告写「未检」，不许写 PASS。
- 截图脚本依赖本机 Chrome/Edge + CDP；`pixel-diff` 的 auto 引擎会降级到纯 Node PNG 实现（8-bit 非隔行）。
- 品牌规范是「风格参考」不是「可商用设计系统」，正式项目需自行确认字体/图片/商标授权。
- 像素 diff 对字体渲染敏感：跨机器/跨平台对比时阈值需放宽或只比布局区域。
- `detect-drift` 是行级正则启发式：跨行选择器、emoji 区段可能误判，用 `rules.json` 调白名单；文案类靠 `check-copy` 补充。
- 规则能约束「可检测的 AI 味」，不能替代人的审美判断——主观项始终由用户签收。
- **A1–A17 由 8 个脚本支撑**：`accept-verify.mjs` 一键输出 PASS/FAIL/未检（浏览器不可用时 A6/A7/A8/A11 记「未检」，不会伪装成 PASS）；`capture` / `pixel-diff` / `detect-drift` / `verify-freeze` / `check-copy` / `extract-tokens` 分别负责矩阵、像素、漂移、冻结、文案与 token。

## 11. 反馈与贡献

- 发现规则不可执行 / 自相矛盾？开 issue 时贴上**具体文件、行号、可复现命令**，这类反馈最有价值。
- 新增品牌规范：走 `data/brand-index.json` 的 schema 与 `references/01-brand-taxonomy.md` 的族定义，保持 id 稳定。
- 新增规则：必须同时给出「判定方式」（脚本规则名或人工步骤）与「例外」，否则不合并。
- 新增脚本：遵守零依赖 + `--help` + 退出码约定（0 通过 / 1 违规 / 2 用法错误），并加进 `scripts/__fixtures__/self-test.mjs`。

## 12. 致谢

- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)：58 个 DESIGN.md 的来源。
- [nexu-io/open-design](https://github.com/nexu-io/open-design)：设计系统包结构与 anti-AI-slop 思路的参考。
- 以及 `design-taste-frontend`、`frontend-design` 等社区 skill 在「反模板、反 AI 味」上的长期积累。
