# Frontend Guidelines · DevNotes

> 本文件是唯一设计权威。状态：`draft` / `signed` / `frozen`。
> 任何 UI 改动前先读本文件；修改必须升版本 + 追加 `decision-log.md`。

## 0. 元信息

| 项 | 值 |
|---|---|
| 版本 | **v1.0（signed）** |
| 日期 | 2026-11-07 |
| 端 | web（响应式，1440 / 768 / 390） |
| 设计读法 | 这是开发者工具的营销落地页 + 产品内两屏（笔记列表 / 设置），给「本地优先」的工程师，语言是冷峻、克制、精密，倾向 F1 devtools-dark |
| 风格族 | F1 devtools-dark（次选 F4 enterprise-system） |
| 主参考 | Linear |
| 辅参考 | Vercel（只借一个维度：mono 元信息的克制用法） |
| 表盘 | VARIANCE 6 / MOTION 3 / DENSITY 6 |
| 签收 | v1.0 签收原文见 `decision-log.md` §v0.2 → v1.0（**演练：签收由本次演练自演，非真实用户**） |

## 1. 设计目标与受众

- **目标**：让一个「把笔记存在自己磁盘上」的工程师，在 10 秒内相信 DevNotes 是给自己做的工具，而不是又一个云端笔记 SaaS。
- **受众**：25–40 岁后端 / 基础设施 / 工具链工程师。他们判断好坏的标准不是「漂亮」，而是：信息密度是否诚实、层级是否清楚、有没有营销腔、默认值是否可靠。
- **成功标准**：
  1. 首屏能在不看正文的情况下看懂「本地文件 + 无账号 + 纯 Markdown」三个事实。
  2. 列表屏能在一屏内看出「集合 / 笔记 / 元信息」三级结构，且切换 default / empty / loading / error 四态不塌版。
  3. 任意视口下没有横向滚动；键盘可走完一屏所有可交互元素，焦点始终可见。
- **明确不做（non-goals）**：
  - 不做居中 hero + 深色 mesh 的「AI 产品页」范式。
  - 不做玻璃拟态、渐变、发光、emoji 图标、假指标与假 logo 墙。
  - 不做多语言 / 暗色以外的主题（浅色是配套主题，不是第二套设计）。
  - 不复制 Linear 的文案、logo、截图、精确布局与栏目结构。

## 2. 设计表盘

| 旋钮 | 值 | 具体含义（写进实现） |
|---|---|---|
| VARIANCE | 6 | 首屏用 7/5 非对称分栏（左文案右界面），**禁止居中 hero**；功能区用 tabs + 单栏叙事，不用三列等宽卡；定价三列但主推列用底色与顶边强调区分 |
| MOTION | 3 | 只有 `--dur-enter` 200ms / `--dur-exit` 140ms 的透明度与 1px 位移；状态切换淡入；无滚动视差、无循环动效、无数字滚动 |
| DENSITY | 6 | 区块间距 96/80/64 三档；正文 16/1.55；列表行高 40；控件高度 32/40/48；信息密度高但留白靠区块间距撑 |

## 3. 品牌参考边界

| 段 | 内容 |
|---|---|
| **keep**（保留的可控品质） | ① 近黑画布 `#08090a` 与亮度台阶（`#0f1011` / `#191a1b` / `#28282c`）；② 半透明白描边（5% / 8%）作为主要分层手段，而非阴影；③ 单一靛紫强调色（`#5e6ad2` / `#7170ff` / `#828fff`），**只作平面填充**；④ 大标题负字距 + Inter 的 510 字重（介于 400 与 500 之间的「不喊叫的强调」）；⑤ mono 作为技术元信息层（路径、快捷键、数字） |
| **change**（要改成我们的） | ① 品牌名、字标（DevNotes 用纯文字字标，不用图形 logo）；② 全部文案（自写，禁止沿用 Linear 原文）；③ 信息架构（DevNotes = 落地页 + 笔记列表 + 设置，不是 issue tracker / 项目管理）；④ 产品界面（本地文件视图、集合树、片段卡），不是 Linear 的看板；⑤ 图标体系（自绘 1.5px 描边 monoline，16/20px）；⑥ 定价与栏目结构 |
| **do-not-copy**（绝不照搬） | ① Linear 的 logo / 字标 / 品牌图形；② Linear 站上的任何原文案、标题句式、副标题；③ 产品截图与插画（一张都不用）；④ 精确布局尺寸与栏目顺序；⑤ Linear 的专有组件（issue 卡、cycle 视图、roadmap 时间轴）；⑥ `#5e6ad2` 以外的任何 Linear 品牌资产 |

> 参考自 awesome-design-md 的 `linear.app`（`design-rules-src/awesome-design-md/design-md/linear.app/DESIGN.md`），非官方设计系统，仅作风格参考。

## 4. 正面清单（MUST）

- **MUST-01 一屏一个视觉焦点**
  - 规则：每屏只有一个主视觉层（首屏标题 / 列表屏列表 / 设置屏表单），其余降级为辅助。
  - 判定：首屏最大字号 ≥ 第二层字号 × 1.4；主 CTA 与次 CTA 的填充/描边对比明显（不靠字号）。
  - 例外：无。
- **MUST-02 8pt 网格与 4px 微调**
  - 规则：间距值只允许 `--space-*`（4/8/12/16/20/24/32/40/48/64/80/96）与 0；容器最大宽 1200px。
  - 判定：源码内 `padding/margin/gap` 的数字值 ∈ spacing token 集合（脚本 A6 计算样式检查）。
  - 例外：1px 描边与 2px 焦点环属于「线宽」，不计入间距。
- **MUST-03 单一强调色，平面使用**
  - 规则：全站只有一个强调色 token（`--accent` 及其 hover/active 变体）；只用于主按钮、选中态、焦点环、链接 hover。**只允许平面填充，禁止渐变、发光、模糊光斑、彩色描边发光。**
  - 判定：一屏可见 accent 元素 ≤ 2 处；渲染态无 `linear-gradient` / `radial-gradient` / `box-shadow` 含色相 250–300°。
  - 例外：状态色（success / danger / warn）不算强调色，但只能用于状态语义，不得用于装饰。
- **MUST-04 一套圆角系统**
  - 规则：圆角只有 5 档：`--radius-xs` 2（标签/badge）、`--radius-sm` 6（按钮/输入/小控件）、`--radius-md` 8（卡片/列表容器）、`--radius-lg` 12（面板/弹窗）、`--radius-full` 999（药丸/圆点）。
  - 判定：源码 radius 值 ⊆ token 集合；无 > 24px 的非 full 圆角。
  - 例外：头像与状态圆点可用 full。
- **MUST-05 字体家族 ≤2**
  - 规则：`Inter Variable`（本地 woff2，display + body）+ `ui-monospace` 栈（mono）。不再引入第三种。
  - 判定：`font-family` 字面值唯一数量 ≤ 2（按 token 计）。
  - 例外：无。
- **MUST-06 字重与字距有阶梯**
  - 规则：字重只用 400 / 510 / 590 三档；display 字号必须负字距（≥32px 用 `--tracking-tight` -0.022em，24px 用 `--tracking-snug` -0.011em），正文 0。
  - 判定：32px 以上标题 `letter-spacing` < 0；源码仅出现 400/510/590。
  - 例外：mono 元信息可用 400，不加负字距。
- **MUST-07 真实内容**
  - 规则：文案自写、具体、可核查；笔记内容必须是看起来真实的工程片段（真实语言、真实 API、真实路径）；无 lorem、无 `feature one`、无「10× / 99.9%」类无来源指标。
  - 判定：全文检索 lorem / placeholder text / 无来源百分比；所有数字类断言必须是产品事实（如「无账号」）或标注（示例数据）。
  - 例外：虚构产品的定价是产品事实，不算假指标。
- **MUST-08 全交互状态**
  - 规则：每个交互组件具备 default / hover / focus-visible / active / disabled / loading；数据区另有 empty / error。
  - 判定：状态矩阵（§6）无缺项；`detect-drift` `missing-states` = 0。
  - 例外：hover 在触屏不可达，允许仅由 `@media (hover:hover)` 提供。
- **MUST-09 对比度 AA**
  - 规则：正文 ≥ 4.5:1，大字（≥24px 或 ≥18.66px 粗体）≥ 3:1，图形边界（输入框描边）≥ 3:1。
  - 判定：A7 脚本按每对前景/背景计算，深色与浅色主题各算一遍。
  - 例外：禁用态（opacity < 0.5）不参与 AA 判定，但必须仍可辨认。
- **MUST-10 键盘可达 + 可见焦点**
  - 规则：所有交互元素可 Tab 到达，`:focus-visible` 显示 2px `--accent` 轮廓 + 2px offset；弹窗内焦点陷阱，ESC 关闭。
  - 判定：A11 键盘走查（Tab/Shift+Tab/Enter/Esc）+ 计算样式断言 outline-width = 2px。
  - 例外：无。
- **MUST-11 动效 token 化 + reduced-motion**
  - 规则：时长只允许 `--dur-enter` 200ms / `--dur-exit` 140ms，曲线只允许 `--ease-standard`；`prefers-reduced-motion: reduce` 时全局关闭位移与过渡。
  - 判定：源码时长/曲线 ⊆ token；`@media (prefers-reduced-motion: reduce)` 存在且 `transition-duration: 0.01ms`。
  - 例外：无。
- **MUST-12 响应式三档无溢出**
  - 规则：1440 / 768 / 390 三档都可用；任意视口 `scrollWidth ≤ clientWidth + 1`；内容最大宽 1200，移动端左右 padding ≥ 16。
  - 判定：A8 三档脚本测量；截图目测无破版。
  - 例外：mono 代码块允许自身横向滚动（`overflow-x:auto`），不得让页面滚动。
- **MUST-13 token-first**
  - 规则：所有视觉值来自 `design/tokens/tokens.css` 的 CSS 变量；组件里不出现裸 hex / px 视觉值。
  - 判定：`detect-drift.mjs` error = 0；A6 计算样式 ⊆ token 集合。
  - 例外：`1px` 描边、`0`、百分比与 `auto` 等结构性值；允许清单在 `tokens.md` 末尾列出。
- **MUST-14 组件先定死再引用**
  - 规则：只允许使用 `design/components.md` 里 status=active 的组件；新组件先补契约（proposed）再用。
  - 判定：源码 class 名 ⊆ 契约清单（A6 附带检查）。
  - 例外：布局容器（`section` / `grid` wrapper）不算组件。
- **MUST-15 双主题语义对齐**
  - 规则：深色为默认（`data-theme="dark"` 亦须显式可用），浅色通过 `data-theme="light"` 覆盖**同一套语义 token**，不重复组件规则。
  - 判定：两套主题下所有语义 token 均有值；A7 双主题各跑一次对比度。
  - 例外：无需跟随系统 `prefers-color-scheme`（demo 用显式切换保证截图可复现）。

## 5. 反面清单（NEVER）

> 完整库见规则包 `references/03-negative-list.md`；此处只列本项目**必须执行**的项。P0 一条不可删。

- **NEVER-01 紫色 / 蓝紫渐变（P0 / `ai-purple-gradient`）**
  - 禁止：任何 `linear-gradient` / `radial-gradient` 出现在底色、按钮、文字；彩色外发光。
  - 为什么：Tailwind indigo 系是 LLM 最稳定的审美指纹；本项目把紫压缩为「单一平面强调」。
  - 判定：渲染态 `background-image` 含 gradient 即 FAIL；渐变色相 250–300° 且 sat>60% 即 FAIL。
  - 例外：**无**（v0.2 起取消唯一例外，见 `decision-log.md`）。
  - 修复：中性亮度台阶 + 平面 accent。
- **NEVER-02 玻璃拟态（P0 / `glassmorphism`）**
  - 禁止：卡片/导航/弹窗使用 `backdrop-filter: blur()` + 半透明白 + 细白描边三件套；一屏 > 1 处即 P1，> 2 处 P0。
  - 判定：源码 `backdrop-filter` 计数为 0。
  - 例外：无（半透明**描边**是 Linear 语言的一部分，允许；半透明**材质**不允许）。
- **NEVER-03 大圆角卡片滥用（P0 / `excessive-radius`）**
  - 禁止：统一 16–24px+ 圆角；圆角值 ≥ 4 种且不成体系。
  - 判定：radius 值 ⊆ 5 档 token；> 12px 的非 full 圆角元素占比 = 0。
  - 例外：无。
- **NEVER-04 三张等宽功能卡（P0 / `three-equal-cards`）**
  - 禁止：首屏下方默认「三列等宽 图标+标题+两行描述」。
  - 判定：连续 3 个结构完全一致的卡片且无内容差异。
  - 例外：定价表（三列但主推列有明确视觉差异）不算。
- **NEVER-05 emoji 当图标（P0 / `emoji-icon`）**
  - 禁止：`✨🚀🎯⚡🔥💡` 出现在按钮、标题、列表图标位。
  - 判定：非正文语境出现 emoji 即 FAIL。
  - 例外：无。
- **NEVER-06 假数据 / 假指标 / 假 logo 墙（P0 / `fake-metric`）**
  - 禁止：无来源的「10× faster」「99.9% uptime」；Jane Doe / Acme；虚构公司 logo 墙。
  - 判定：检索 `10x|99.9|3x faster|Jane Doe|Acme|lorem`。
  - 例外：虚构产品自身的定价与功能陈述（「无账号」「纯 Markdown」）不算指标。
- **NEVER-07 只有成功态（P0 / `missing-states`）**
  - 禁止：按钮/表单/列表只有默认态。
  - 判定：§6 状态矩阵缺项 = FAIL。
  - 例外：无。
- **NEVER-08 组件内裸值（P0 / `hardcoded-value`）**
  - 禁止：组件里写死颜色 / 字号 / 圆角 / 间距。
  - 判定：`detect-drift` 的 `hardcoded-*` > 0。
  - 例外：见 MUST-13 允许清单。
- **NEVER-09 渐变文字 / 彩色发光（P0 / `gradient-text`）**
  - 禁止：`background-clip:text` 渐变字；`box-shadow` 彩色外发光。
  - 判定：源码检索 `background-clip:text` / 彩色 shadow。
  - 例外：无。
- **NEVER-10 卡片套卡片（P1 / `nested-card`）**
  - 禁止：卡片里再套圆角+描边+底色的卡片（> 2 层）。
  - 判定：DOM 中 card 后代 card 计数 > 0 需人工裁定（分隔线/底色块不算卡片）。
  - 例外：弹窗内表单分组可用「无描边底色块」，不算卡片。
- **NEVER-11 卡片代替布局（P1 / `card-overuse`）**
  - 禁止：导航、列表、页脚也卡片化；卡片占比 > 50%。
  - 判定：人工 + DOM 计数。
  - 例外：定价列、模态框属于「独立信息块」，可用容器。
- **NEVER-12 衬线当默认（P1 / `serif-default`）**
  - 禁止：Fraunces / Instrument Serif / Playfair 作为 display。
  - 判定：font-family 检索。
  - 例外：无。
- **NEVER-13 装饰性 pill / 编号 eyebrow（P1 / `pill-overuse`）**
  - 禁止：每个标题上方 uppercase 小药丸；`01 ·` 式编号；同页 > 3 个。
  - 判定：计数（本项目上限：首屏 0 个，全页 ≤ 2 个功能性标签）。
  - 例外：功能标签（如 Pro 计划的推荐标记）可用，但必须带信息量。
- **NEVER-14 手搓 SVG 插画 / div 拼假截图（P1 / 人工）**
  - 禁止：手写复杂 SVG 路径作插画；用 div 拼出「假产品截图」当视觉装饰。
  - 判定：人工；SVG 只允许 monoline 图标（≤ 24px，`currentColor`，1.5px 描边）。
  - 例外：**产品预览必须是真实 DOM**（可交互、内容真实），并标 `data-placeholder="product-preview"`；无真实截图可用时这是唯一允许的替代。
  - 修复：用真实 DOM 复刻产品界面，或去掉该区块。
- **NEVER-15 外链占位图 / CDN（P1 / `external-placeholder`）**
  - 禁止：unsplash / picsum / placehold.co；CDN 字体；外链脚本。
  - 判定：源码检索 `http://` / `https://` 资源引用（纯文本链接除外）。
  - 例外：无（字体已本地化）。
- **NEVER-16 CTA 语义重复（P1 / `cta-duplicate`）**
  - 禁止：同页多个同意图 CTA（「联系我们 / 聊聊 / 开始合作」并存）。
  - 判定：同页 CTA 文案意图去重。
  - 例外：导航栏与页脚可复用同一文案（同一组件布局位）。
- **NEVER-17 无限循环装饰动效（P1 / `infinite-motion`）**
  - 禁止：背景粒子、漂浮元素、循环 marquee。
  - 判定：`animation-iteration-count: infinite` 检索。
  - 例外：loading 骨架允许（功能性），且必须在 reduced-motion 下停止。
- **NEVER-18 文字换行 / 破版（P0 / 人工）**
  - 禁止：桌面端 hero 标题 > 2 行、正文行宽 > 75ch、CTA 文案换 2 行、标题被裁切、任意视口横向滚动。
  - 判定：截图目测 + `scrollWidth` 测量 + `max-width` 检查。
  - 例外：无。

## 6. 交付范围

| 项 | 内容 |
|---|---|
| 端 | web（响应式）；app / 小程序不在本次范围 |
| 屏清单 | `#/home`（hero + 功能 tabs + 代码片段区 + 定价 + 页脚）、`#/notes`（列表 + 搜索 + 集合）、`#/settings`（表单 + 开关 + 保存 + 危险操作弹窗） |
| 状态清单 | notes：default / empty / loading / error；settings：default / dirty / form-error / modal-open / saved；交互：hover / focus-visible / active / disabled / loading |
| 断点 | 1440×900 / 768×1024 / 390×844 |
| 主题 | dark（默认，产品原生）+ light（配套）；`data-theme` 显式切换 |
| 交付物 | `prototype/index.html`（P3）→ `design/frozen/`（P4）→ tokens + components（P5）→ `acceptance/`（P8） |

## 7. 变更授权与流程

- 改文案 / 修 bug（对齐、溢出）：AI 直接改，记 `change-log.md`。
- 改 token 值 / 新增组件 / 改布局：必须 CR（`templates/change-request.md`），用户批准后重冻结。
- 改本文件：升版本 + 追加 `decision-log.md` + 用户确认变更点。
- 冻结后：`design/frozen/**` 只读，禁止「顺手优化」。

## 8. 验收定义

**客观项（AI 判，全 PASS 才交付）**：A1 截图齐全 / A2 非空 / A3 尺寸 / A4 像素 diff ≤0.3% / A5 drift=0 / A6 样式 ⊆ token / A7 对比度 AA / A8 无溢出 / A9 无 console error / A10 状态覆盖 / A11 交互脚本 / A12 冻结未篡改。
**主观项（用户签收）**：品牌感、氛围、文案语气、「有没有 AI 味」。
**不通过处理**：实现问题修实现；设计问题走 CR；同一项 3 轮不过 → 停下来问用户。

> 本次为**链路演练**：客观项由脚本 + CDP 探针出数，主观项标注「演练自签，未由真实用户签收」。

## 9. 决策日志索引

详见 `decision-log.md`。关键转折：
- 2026-11-07 · v0.1 初稿（15 MUST + 12 NEVER，hero 允许 accent 径向渐变衬底）
- 2026-11-07 · v0.1 → v0.2（淘汰紫渐变：NEVER-01 取消唯一例外，MUST-03 改为「只允许平面」）
- 2026-11-07 · v0.2 → v1.0 签收（演练自签，原文记录在 decision-log）

## 10. 版本历史（追加式，不覆盖）

| 版本 | 日期 | 变更 | 触发 |
|---|---|---|---|
| v0.1 | 2026-11-07 | 初稿：15 条 MUST + 12 条 NEVER；NEVER-01 例外条款允许「主参考品牌色在 hero 做 ≤12% 透明度径向渐变衬底」 | P2 初稿 |
| v0.2 | 2026-11-07 | 删除 NEVER-01 例外；MUST-03 增加「只允许平面填充，禁止渐变/发光」；新增 MUST-15 双主题语义对齐 | 用户反馈「不要紫色渐变，紫只作平面强调」 |
| v1.0 | 2026-11-07 | 状态 draft → signed；补齐 NEVER-14 的 `data-placeholder` 例外、NEVER-18 破版条款 | 用户签收 |
