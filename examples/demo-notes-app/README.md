# DevNotes · 前端设计链路演练包

> **这是一次端到端演练，不是真实项目。** 用户的「签收」由演练者自演（见 `design/decision-log.md`）。
> 目的：验证 `frontend-design-pipeline` 规则包从「一句话需求」到「截图验收报告」整条链路可执行。

## 一句话需求

> 「做一个面向开发者的本地优先笔记工具 DevNotes 的落地页 + 两个产品内页面，要冷、克制、像给工程师做的，不要 AI 味。」

## 走了哪条链路

```text
P0 读法：开发者工具落地页，给 25–40 岁后端/基础设施工程师，冷峻克制精密 → F1 devtools-dark
P1 路由：主参考 Linear（keep 近黑画布/半透明描边/单一靛紫/负字距/510 字重），辅参考 Vercel（只借 mono 元信息）
P2 准则：frontend-guidelines v0.1 → 用户否掉「紫色渐变 + 玻璃」→ v0.2 → 签收 v1.0（15 MUST / 18 NEVER）
P3 静态稿：prototype/index.html（单文件、3 route、全状态、3 视口、双主题）
P4 冻结：design/frozen/ v1.7 + freeze-manifest（3 文件，verify-freeze PASS）
P5 Token + 组件：111 个 CSS 变量 / tokens.json+md / 10 个组件契约
P6 跨端：见规则包 references/09-handoff.md（本演练未落 App）
P7 变更：change-log 4 条，含一次「去渐变」迭代
P8 验收：36 张截图（dark 24 + light 12）+ probe/interaction 报告 → A1–A12
```

## 文件树

```
demo-notes-app/
├── design/
│   ├── frontend-guidelines.md    # 15 MUST + 18 NEVER，含判定/例外/为什么/修复
│   ├── decision-log.md           # 路由记录 + v0.1→v0.2→v1.0 签收 + 偏好画像
│   ├── design-authority.md       # 权威源 / 读取顺序 / 冲突裁决 / 设计指纹
│   ├── components.md             # 10 个组件契约（尺寸/颜色/状态/禁止/跨端）
│   ├── change-log.md             # 4 条改动 + 八项矩阵
│   ├── frozen/                   # 冻结静态稿 v1.7（只读）+ manifest
│   └── tokens/                   # tokens.css / tokens.json / tokens.md
├── prototype/index.html          # P3 工作稿（单文件，与 frozen 同源）
├── acceptance/
│   ├── accept.config.json        # 截图矩阵（route × state × viewport × theme）
│   ├── screenshots/              # 24 张 dark
│   ├── screenshots-light/        # 12 张 light
│   ├── reference/                # 冻结基线（与 screenshots 同源，diff 0）
│   ├── capture-manifest-*.json   # 每张图的 sha256/尺寸/耗时
│   ├── probe-report.json         # 计算样式/对比度/溢出/console（34 次测量）
│   ├── interaction-report.json   # 13 条交互用例（9 PASS / 4 FAIL）
│   ├── drift-report.json         # 0 违规
│   └── acceptance-report.md      # A1–A12 结论 + 失败详情 + 修复计划
└── README.md
```

## 怎么复现

```powershell
cd examples\demo-notes-app

# 1) 冻结校验
node ..\..\scripts\verify-freeze.mjs design\frozen\freeze-manifest.json --base design\frozen

# 2) token 提取（对照用；design/tokens 已人工审校）
node ..\..\scripts\extract-tokens.mjs design\frozen\index.html --out "$env:TEMP\dn-tokens"

# 3) 漂移检测（demo 自带 rules.json 忽略设计源文件）
node ..\..\scripts\detect-drift.mjs . --tokens design\tokens\tokens.json --rules acceptance\rules.json --json -

# 4) 截图（需可用的 Chrome/Edge；沙箱内可能需 --dry-run）
node ..\..\scripts\capture-acceptance.mjs --config acceptance\accept.config.json --out acceptance\screenshots

# 5) 像素对比（reference vs screenshots）
node ..\..\scripts\pixel-diff.mjs acceptance\reference\home\default--1440x900--dark.png acceptance\screenshots\home\default--1440x900--dark.png
```

## 结果摘要

| 项 | 结果 |
|---|---|
| 正面/反面清单 | 15 MUST / 18 NEVER（每条含判定；NEVER 含为什么/修复） |
| 冻结 | v1.7，3 文件 sha256 PASS |
| Token | 111 个 CSS 变量，10 类；双主题 |
| 组件 | 10 个契约（button/input/card/tabs/modal/switch/badge/skeleton/state-block/nav） |
| 截图 | 36 张（3 视口 × 8 组合 dark + 4 组合 light） |
| 漂移 | total 0（error/warn/info 均 0） |
| 计算样式 | 越界 0；对比度失败 0；横向溢出 0；console error 0 |
| 验收结论 | **FAIL**：A11 交互 9/13（4 条真实缺陷，见 acceptance-report） |

## 这次演练抓到了什么

1. **规则能约束 AI 味**：v0.1 的「紫色渐变 + 玻璃 hero」被反面清单挡下，v0.2 改实底后通过。
2. **客观验收真的能抓 bug**：A11 抓到 modal 焦点回归、移动菜单、CTA hover token 三处实现缺陷——这些在「看截图」时看不出来。
3. **规则包自身的问题**：token 提取最初不支持 `var()`（已修）、drift 对 `@font-face`/JS 字符串误报（已修）、accept 模板结构不一致（已修）。演练推动了工具链修正。

## 已知限制

- 签收是自演，主观项（品牌感/文案语气）仍需真人判断。
- 未落 App / 小程序；跨端映射见规则包 `09-handoff.md`。
- 截图依赖本机字体，跨机器像素对比需重新生成 reference。
