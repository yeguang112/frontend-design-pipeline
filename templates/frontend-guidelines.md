# Frontend Guidelines · <项目名>

> 本文件是唯一设计权威。状态：`draft` / `signed` / `frozen`。
> 任何 UI 改动前先读本文件；修改必须升版本 + 追加 `decision-log.md`。

## 0. 元信息

| 项 | 值 |
|---|---|
| 版本 | v0.1（draft） |
| 日期 | YYYY-MM-DD |
| 端 | web / app / mini-program |
| 设计读法 | 这是 <产物类型>，给 <受众>，语言是 <氛围>，倾向 <品牌/风格族> |
| 风格族 | F<n> <名称> |
| 主参考 | <brand> |
| 辅参考 | <brand / none> |
| 实现基座 | 自定义 / `systems/<id>`（如 Astryx 0.7.11 + neutral） |
| 表盘 | VARIANCE <n> / MOTION <n> / DENSITY <n> |
| 签收 | 未签收（v1.0 时填用户原话） |

## 1. 设计目标与受众

- **目标**：<一句话，例如「让技术买家在 10 秒内相信这是给工程师做的产品」>
- **受众**：<画像 + 他们判断好坏的标准>
- **成功标准**：
  1. <可观察的结果，例如「首屏 CTA 点击率高于旧版」>
  2. <…>
  3. <…>
- **明确不做（non-goals）**：<例如「不做暗色主题」「不做多语言」「不做移动端 App」>

## 2. 设计表盘

| 旋钮 | 值 | 具体含义（写进实现） |
|---|---|---|
| VARIANCE | <n> | <例如「首屏用左文右图非对称，禁止居中 hero」> |
| MOTION | <n> | <例如「只有进入淡入 + 按钮 1px 位移，无滚动驱动」> |
| DENSITY | <n> | <例如「区块间距 96px，正文 16px/1.6」> |

## 3. 品牌参考边界

| 段 | 内容 |
|---|---|
| **keep**（保留的可控品质） | <3–5 条，例如「近黑画布、半透明描边、单一强调色、负字距标题」> |
| **change**（要改成我们的） | <例如「品牌名、文案、信息架构、产品截图、栏目结构」> |
| **do-not-copy**（绝不照搬） | <例如「原站 logo、版权图、精确布局、原文案、专有组件」> |

> 参考自 awesome-design-md 的 `<brand>`，非官方设计系统，仅作风格参考。

## 4. 正面清单（MUST）

- **MUST-01 一个视觉焦点**
  - 规则：每屏只有一个主视觉层，其余降级为辅助。
  - 判定：首屏最大字号与第二层字号差 ≥1.4×；主 CTA 与次 CTA 权重不同。
  - 例外：品牌站的双焦点对称构图，需在本文件注明。
- **MUST-02 网格与对齐**
  - 规则：所有间距是 4 的倍数，桌面容器 1200–1400px。
  - 判定：spacing 值 ∈ token scale；截图叠加 8pt 网格无偏移。
- **MUST-03 单一强调色**
  - 规则：全站一个 accent，只用于主 CTA 与选中态。
  - 判定：一屏可见 accent 使用 ≤2 处。
- **MUST-04 一套圆角系统**
  - 规则：按钮/输入用 `--radius-md`，卡片用 `--radius-lg`，头像用 full。
  - 判定：源码 radius 值 ⊆ tokens。
- **MUST-05 字体 ≤2 家族**
  - 规则：display 与 body 可同族，mono 最多 1 个。
  - 判定：`font-family` 唯一值 ≤2。
- **MUST-06 真实内容**
  - 规则：文案真实；图片本地化；占位标 `data-placeholder`。
  - 判定：无 lorem / 假指标 / 外链占位图。
- **MUST-07 全交互状态**
  - 规则：每个交互组件具备 default/hover/focus/disabled/loading（数据区另有 empty/error）。
  - 判定：状态矩阵无缺项。
- **MUST-08 对比度 AA**
  - 规则：正文 ≥4.5:1，大字 ≥3:1。
  - 判定：脚本计算每对前景/背景。
- **MUST-09 可见焦点**
  - 规则：`:focus-visible` 2px 轮廓 + 2px offset。
  - 判定：Tab 走查可见。
- **MUST-10 token-first**
  - 规则：所有视觉值来自 tokens.css。
  - 判定：`detect-drift.mjs` error = 0。
- **MUST-11 动效统一**
  - 规则：进入 200ms / 退出 140ms / `--ease-standard`；有 reduced-motion 分支。
  - 判定：源码只出现 token 时长/曲线。
- **MUST-12 响应式三档**
  - 规则：1440 / 768 / 390 均可用，无横向溢出。
  - 判定：`scrollWidth ≤ clientWidth+1`。
- **MUST-13 说明只进注释，不进页面**
  - 规则：用户的修改要求、AI 的执行说明、设计理由、参考来源、TODO，只写 `<!-- design: … -->` / `data-design-note` / change-log；页面只保留用户需要的文案。
  - 判定：`check-copy.mjs` error=0（含 alt/title/placeholder/aria-label）。
  - 例外：产品本身要给用户看的说明文案（要写成产品语气，不是开发备注）。

> 按项目增删，最终 10–18 条。

## 5. 反面清单（NEVER）

> 完整库见 skill 的 `references/03-negative-list.md`；此处只列本项目**必须执行**的项，可增删但不可删掉 P0。
> **复制后逐条补齐「为什么」「修复」两栏**（前 3 条为示例）；缺字段的条目在 P2 Gate 不算通过。

- **NEVER-01 紫蓝渐变**（P0）
  - 为什么：LLM 默认审美（indigo #6366f1 系）的典型指纹，一眼 AI 味。
  - 判定：渐变含 hue 250–300°、sat>60%；或 accent 为 #6366f1 系。
  - 例外：主参考品牌明确指定（只平面、不外溢）。
  - 修复：改中性底 + 一个高对比强调色，或换品牌 accent。
- **NEVER-02 玻璃拟态**（P0）
  - 为什么：2021 年 AI 落地页默认材质；对比度不可控。
  - 判定：`backdrop-filter` / `filter: blur(` 用于卡片或导航；一屏 >1 处。
  - 例外：品牌规范明确指定，且提供 `prefers-reduced-transparency` 实底回退。
  - 修复：实底 + 明度台阶 + 细描边；浮起用阴影不用模糊。
- **NEVER-03 大圆角卡片滥用**（P0）
  - 为什么：最典型的「AI 卡片堆」，圆角缺乏系统。
  - 判定：radius >24px 的元素占比 >30%；或圆角 ≥4 种不成体系。
  - 例外：品牌规范定义（如消费类 12–16px 体系），但须全站一致。
  - 修复：锁定 4 档 radius scale，全部引用 token。
- **NEVER-04 三张等宽功能卡**（P0）· 判定：连续 3 个结构相同的卡片且无内容差异。
- **NEVER-05 emoji 当图标**（P0）· 判定：emoji 出现在按钮/标题/图标位。
- **NEVER-06 假数据/假指标**（P0）· 判定：无来源的「10× / 99.9%」；Jane Doe / Acme。
- **NEVER-07 只有成功态**（P0）· 判定：状态矩阵缺项。
- **NEVER-08 组件内裸值**（P0）· 判定：`detect-drift` 的 `hardcoded-*` >0。
- **NEVER-09 渐变文字 / 发光**（P0）· 判定：`background-clip:text` 渐变；彩色外发光。
- **NEVER-10 默认 Inter + slate + 居中 hero + 深色 mesh**（P1）· 判定：无品牌依据时命中组合。
- **NEVER-11 卡片套卡片**（P1）· 判定：>2 层卡片容器。
- **NEVER-12 衬线当默认**（P1）· 判定：Fraunces / Instrument Serif / Playfair 作为默认 display。
- **NEVER-13 CTA 语义重复**（P1）· 判定：同页多个同意图文案。
- **NEVER-14 装饰性 pill / 编号 eyebrow**（P1）· 判定：同页 >3 个 uppercase 小药丸；`01 ·` 式编号。
- **NEVER-15 手搓 SVG / 假截图**（P1）· 判定：复杂 SVG 路径做插画；div 拼假 UI。
- **NEVER-16 提示词泄漏**（P0）· 判定：可见文案/alt/title/placeholder 出现「说明：」「参考自」「演示」「TODO」等元信息（`check-copy` 的 `prompt-leak`）。
- **NEVER-17 装饰性 <12px 小字**（P1）· 判定：`check-copy` 的 `tiny-text`；或删掉后用户无信息损失的微文案。


## 6. 交付范围

| 项 | 内容 |
|---|---|
| 端 | web（响应式）；后续 <app / 小程序> |
| 屏清单 | `#/home` `#/pricing` `#/docs` `#/settings` … |
| 状态清单 | 每个 route：default / empty / loading / error；交互：hover/focus/disabled |
| 断点 | 1440 / 768 / 390 |
| 主题 | light（dark：<是/否/后续>） |
| 交付物 | `prototype/index.html`（P3）→ `design/frozen/`（P4）→ tokens + components（P5） |

## 7. 变更授权与流程

- 改文案/修 bug：AI 直接改，记 `change-log.md`。
- 改 token 值 / 新增组件 / 改布局：必须 CR（`templates/change-request.md`），用户批准后重冻结。
- 改本文件：升版本 + 追加 `decision-log.md` + 用户确认变更点。
- 冻结后：`design/frozen/**` 只读。

## 8. 验收定义

**客观项（AI 判，全 PASS 才交付）**：A1 截图齐全 / A2 非空 / A3 尺寸 / A4 diff ≤0.3% / A5 drift=0 / A6 样式 ⊆ token / A7 对比度 / A8 无溢出 / A9 无 console error / A10 状态覆盖 / A11 交互脚本 / A12 冻结未篡改。

**主观项（用户签收）**：品牌感、氛围、文案语气、「有没有 AI 味」。

**不通过处理**：实现问题修实现；设计问题走 CR；同一项 3 轮不过 → 停下来问用户。

## 9. 决策日志索引

详见 `decision-log.md`。关键转折：
- v0.1 初稿（YYYY-MM-DD）
- v0.x <用户否掉了什么>
- v1.0 用户签收（原话：「…」）
