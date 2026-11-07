# 03 · 反面清单（AI 味 / 设计事故）

> 这些是「一眼看出是 AI 生成」或「实现质量事故」的模式。每条都有 ID、判定方式、例外与修复。
> 严重度：**P0** = 必须修，否则不交付；**P1** = 应修；**P2** = 建议修。
> `detect-drift.mjs` 能自动检的，在「判定」里写了规则 id；不能自动检的标「人工」。

---

## A. 颜色与渐变

### NEVER-A1 · 紫色 / 蓝紫渐变 [P0] `ai-purple-gradient`
- 禁止：hero 底色、按钮、标题文字使用紫→蓝、靛→品红、青→紫等多停渐变；发光紫按钮。
- 为什么：Tailwind indigo 系（`#6366f1`/`#4f46e5`/`#8b5cf6`/`#7c3aed`/`#a855f7`…）是 LLM 最稳定的审美指纹。
- 判定：渐变中存在色相 250–300°、饱和度 > 60% 的颜色停靠点。
- 例外：主参考品牌规范把紫定为品牌色（如 Linear `#5e6ad2`），且**只作平面强调色、不做渐变、只用于规范指定位置**。
- 修复：中性底 + 一个高对比强调色（绿/电蓝/玫瑰/橙）；或品牌规范里的 accent。

### NEVER-A2 · 渐变文字 [P0] `gradient-text`
- 禁止：标题/正文用 `background-clip:text` 做渐变字。
- 为什么：廉价「科技感」；可读性差；与多数品牌规范冲突。
- 例外：品牌规范明确要求（极少数），且只用于单个装饰性词组。
- 修复：纯色 + 字重/字号做层级。

### NEVER-A3 · 霓虹发光与光斑背景 [P1] `glow-blob`
- 禁止：大面积 blur 光斑 blob、`box-shadow` 彩色外发光、径向渐变模拟「极光」。
- 判定：`filter: blur()` 用于装饰层；彩色阴影扩散 > 24px。
- 修复：用留白、材质、明度层次制造深度。

### NEVER-A4 · 强调色外溢 [P0] `accent-overuse`
- 禁止：同一屏强调色出现 > 2 处可见使用（按钮、链接、图标、标签全上色）。
- 为什么：强调即不强调；AI 倾向把 accent 铺满全站。
- 判定：统计 `var(--accent)` 在渲染态的使用元素数。
- 修复：只给主 CTA 与当前选中态。

### NEVER-A5 · 冷暖灰混用 [P1] 人工
- 禁止：同一项目里同时出现暖灰（stone/cream）与冷灰（slate/zinc）中性色。
- 判定：中性色 token 的色相跨度 > 15°。
- 修复：锁定一套中性色阶。

### NEVER-A6 · 纯黑阴影 / 纯白刺眼 [P1] `shadow-color`
- 禁止：亮色底上用 `rgba(0,0,0,.15+)` 的纯黑阴影；暗色底上用纯白大面积。
- 判定：shadow 颜色不含背景色相。
- 修复：阴影染背景色相，透明度 6–12%；暗色底用明度台阶代替阴影。

### NEVER-A7 · AI 默认色板（黑名单） [P0]
- 禁止把以下值作为强调色默认值：`#6366f1` `#4f46e5` `#4338ca` `#3730a3` `#8b5cf6` `#7c3aed` `#a855f7` `#3b82f6` `#2563eb`（无品牌依据时）。
- 例外：用户/品牌规范明确指定。
- 修复：改用品牌 accent，或从品牌规范里取色。

---

## B. 材质 / 阴影 / 玻璃

### NEVER-B1 · 玻璃拟态滥用 [P0] `glassmorphism`
- 禁止：卡片、导航、弹窗默认 `backdrop-filter: blur()` + 半透明白 + 细白描边三件套；一屏出现 2 处以上。
- 为什么：2021 年 AI 落地页的默认材质；不同背景下对比度不可控。
- 判定：`backdrop-filter` / `filter: blur(` 出现次数；一屏 > 1 处即 P1，> 2 处 P0。
- 例外：品牌规范明确使用（如 Apple 类材质），且必须提供 `prefers-reduced-transparency` 实底回退。
- 修复：实底 + 明度台阶 + 细描边；需要浮起时用阴影而非模糊。

### NEVER-B2 · 阴影堆叠 [P1] `shadow-stack`
- 禁止：单个元素 > 2 层 `box-shadow` 叠加出「悬浮感」。
- 修复：一层环境阴影 + 一层接触阴影。

### NEVER-B3 · 卡片内嵌卡片 [P1] `nested-card`
- 禁止：卡片里再套卡片（> 2 层容器），尤其带圆角+阴影+边框三件套。
- 修复：内层用分隔线 / 留白 / 明度差表达层级。

### NEVER-B4 · 半透明文字 [P1] 人工
- 禁止：正文用 `opacity` 低于 0.7 的白/黑字制造「柔和」。
- 判定：正文对比度 < 4.5:1。
- 修复：用语义灰阶 token（muted），不用 opacity。

### NEVER-B5 · 纹理/噪点滥用 [P2] 人工
- 禁止：全屏噪点、颗粒、扫描线作为「质感」默认手段。
- 例外：品牌明确要求复古/印刷质感。

---

## C. 形状 / 圆角 / 卡片

### NEVER-C1 · 大圆角卡片滥用 [P0] `excessive-radius`
- 禁止：所有元素统一 16–24px+ 圆角；按钮、卡片、输入框、图片全圆；卡片圆角 + 大阴影组合。
- 为什么：最典型的「AI 卡片堆」；圆角应有系统，不是默认值。
- 判定：radius > 24px 的元素占比 > 30%；或圆角值出现 ≥4 种不成体系的值。
- 例外：品牌规范定义（如消费类 12–16px 体系），但必须全站一致且在 guidelines 写明。
- 修复：锁定一套 radius scale（如 4/8/12，按钮 8、卡片 12、输入 8），全站只引用 token。

### NEVER-C2 · 形状系统不一致 [P0] `radius-inconsistent`
- 禁止：同一页面混用「按钮全圆角 + 卡片直角 + 输入框 6px」且无文档规则。
- 判定：radius token 集合外的值出现；或同一组件族半径不一致。
- 修复：在 guidelines 写死「按钮/卡片/输入/标签」四类半径，其余引用 token。

### NEVER-C3 · 卡片代替布局 [P1] `card-overuse`
- 禁止：所有内容都装进卡片（导航、列表、页脚也卡片化）。
- 为什么：卡片是「层级工具」，不是容器默认值。
- 判定：非交互、非独立信息块使用卡片占比 > 50%。
- 修复：用间距、分隔线、分组标题组织内容。

### NEVER-C4 · 彩色左边框卡片 [P1] `left-border-card`
- 禁止：圆角白卡片 + 左侧 4px 彩色竖条（AI 仪表盘经典形状）。
- 修复：去掉一边（去圆角或去边条），或改用图标/标签表达类别。

### NEVER-C5 · 三张等宽功能卡 [P0] `three-equal-cards`
- 禁止：首屏下方默认「三列等宽图标+标题+两行描述」功能区。
- 判定：连续 3 个结构完全一致的卡片，且无内容差异。
- 修复：改为非对称 bento / 主次分栏 / 一条纵向叙事。

### NEVER-C6 · 药丸标签泛滥 [P1] `pill-overuse`
- 禁止：每个标题上方都加 uppercase 小药丸/eyebrow；同一页 > 3 个。
- 修复：最多首屏 1 个；其余用排版层级。

---

## D. 排版

### NEVER-D1 · 字体家族过多 [P0] `font-family-count`
- 禁止：一个页面 > 2 个字体家族（display + mono 计 2；body 与 display 可同族）。
- 判定：`font-family` 唯一值数量 > 2。
- 修复：合并为一套可变字体 + 可选 mono。

### NEVER-D2 · 衬线默认化 [P1] `serif-default`
- 禁止：把衬线当「创意/高级」默认解；默认使用 Fraunces / Instrument Serif / Playfair。
- 为什么：这是被反复验证的 AI 默认审美。
- 例外：品牌规范点名衬线；或编辑/出版/传承类品牌且有具体理由。
- 修复：无衬线 display（Geist / Cabinet Grotesk / Söhne 类）或品牌字体。

### NEVER-D3 · Inter + slate 默认组合 [P1] `default-stack`
- 禁止：无品牌依据时默认 Inter + slate-900 + 灰阶。
- 例外：用户明确要中性/Linear 感，或公共部门/无障碍优先项目。
- 修复：换 display 字体或至少启用品牌化 OpenType 特性/字距。

### NEVER-D4 · 字号不成阶梯 [P1] `off-scale-font-size`
- 禁止：字号出现 13/15/17/19/21 等非阶梯值；正文 < 14px（中文 < 14px 更糟）。
- 判定：`detect-drift` 的 `off-scale-font-size`。
- 修复：锁定 6–8 档字号 scale，全部 token 化。

### NEVER-D5 · 大标题溢出/换行失控 [P0] 人工
- 禁止：hero 标题 > 2 行（桌面）、正文行宽 > 75ch、标题被裁切。
- 判定：截图目测 + `scrollWidth > clientWidth` 检测。
- 修复：缩字号、砍文案、调容器宽度。

### NEVER-D6 · 字距/行高全靠默认 [P1] 人工
- 禁止：display 字号不做负字距；正文行高 < 1.4 或 > 1.8。
- 修复：display `-0.01~-0.03em`，正文 1.5–1.7。

### NEVER-D7 · 斜体/衬线混排做强调 [P2] 人工
- 禁止：无衬线标题里塞一个衬线词做「设计感」。
- 修复：同族 italic/bold 强调；斜体带降部字母时留足行高。

---

## E. 布局

### NEVER-E1 · 居中 hero + 深色 mesh 默认页 [P0] 人工
- 禁止：无品牌依据时默认「居中大标题 + 副标题 + 双按钮 + 深色渐变 mesh 背景」。
- 判定：VARIANCE > 4 时仍用居中 hero；背景含多色 mesh。
- 修复：非对称分栏 / 左文右图 / 编辑式宣言 / 产品截图主导。

### NEVER-E2 · 均匀三列/四列流 [P1] `uniform-grid`
- 禁止：整页每个区块都是等宽多列，节奏完全一致。
- 修复：至少 3 种布局家族（全宽、分栏、错位、列表、引用墙）。

### NEVER-E3 · 8pt 网格外间距 [P0] `off-scale-spacing`
- 禁止：padding/margin/gap 出现 7/13/18/22 等非 4 或 8 倍数。
- 判定：`off-scale-spacing`。
- 修复：全部改用 spacing token。

### NEVER-E4 · 内容贴边/无最大宽度 [P1] 人工
- 禁止：桌面端内容宽度 > 1400px 且无 max-width；移动端左右 padding < 16px。
- 修复：`max-width: 1200–1400px` + 容器 padding。

### NEVER-E5 · 横向溢出 / 破版 [P0] 人工
- 禁止：任意视口出现横向滚动；固定宽度元素撑破容器。
- 判定：`document.documentElement.scrollWidth > clientWidth + 1`。
- 修复：`min-width:0`、`max-width:100%`、grid 代替 flex 百分比。

### NEVER-E6 · 首屏信息过载 [P1] 人工
- 禁止：hero 内超过 4 个文本元素（eyebrow/标题/副文案/CTA 之外再加标签、信任条、价格）。
- 修复：把次要信息移到下一屏。

### NEVER-E7 · 对齐破坏 [P0] 人工
- 禁止：同组元素的左边缘/基线/间距不一致；卡片高度参差且无对齐逻辑。
- 判定：截图叠加 8pt 网格检查。

---

## F. 图标 / 插画 / 图像

### NEVER-F1 · emoji 当图标 [P0] `emoji-icon`
- 禁止：`✨🚀🎯⚡🔥💡` 等出现在按钮、标题、列表图标位。
- 判定：emoji 出现在非正文语境。
- 例外：明确要求「轻松/社交原生」风格，且仅限文案内。
- 修复：一套 1.5–2px 描边 monoline 图标，`currentColor`。

### NEVER-F2 · 图标风格混用 [P1] `icon-mix`
- 禁止：同一项目混用线性/面性/双色/不同 strokeWidth 的图标。
- 修复：锁定一套图标库 + 全局 strokeWidth。

### NEVER-F3 · 手搓 SVG 装饰 [P1] 人工
- 禁止：手写复杂 SVG 路径做插画/装饰；div 拼假截图/假图表。
- 修复：用真实图片/生成图/图标库；占位必须标注 `data-placeholder`。

### NEVER-F4 · 外链占位图 CDN [P1] `external-placeholder`
- 禁止：`unsplash` / `picsum` / `placehold.co` 等外链占位图进交付物。
- 修复：本地占位资产或真实素材。

### NEVER-F5 · 图片无尺寸/无 alt [P1] 人工
- 禁止：`<img>` 缺宽高（CLS）或缺 alt（内容图）。
- 修复：写死宽高比 + 语义 alt。

---

## G. 动效

### NEVER-G1 · 全元素 hover 放大/发光 [P1] `hover-everything`
- 禁止：每个卡片、图标、链接都 hover 位移/放大/发光。
- 修复：只给可点击元素 1 种反馈（颜色/位移 1–2px）。

### NEVER-G2 · 无限循环装饰动效 [P1] `infinite-motion`
- 禁止：背景粒子、漂浮元素、循环 marquee（> 1 处）。
- 例外：品牌要求且提供 reduced-motion 停止。

### NEVER-G3 · 动效时长/曲线不统一 [P1] `motion-token`
- 禁止：同一产品混用 100/300/600ms 与 ease-in/linear/bounce。
- 修复：token 化（建议 enter 200ms / exit 140ms / `cubic-bezier(.23,1,.32,1)`）。

### NEVER-G4 · 无 reduced-motion 兜底 [P0] `reduced-motion`
- 禁止：动效存在但无 `prefers-reduced-motion` 分支。
- 修复：全局媒体查询关闭位移/视差/自动播放。

### NEVER-G5 · 动画掩盖加载 [P2] 人工
- 禁止：用长动画掩盖慢加载/无骨架屏。
- 修复：骨架屏匹配最终布局形状。

---

## H. 内容 / 文案

### NEVER-H1 · 假数据与假指标 [P0] `fake-metric`
- 禁止：「10× faster」「99.9% uptime」「3× more productive」无来源；Jane Doe / Acme / 假公司 logo 墙。
- 修复：真实数据或标注 `（示例数据）`；logo 墙用真实 SVG 或去掉。

### NEVER-H2 · 占位文案 [P0] `lorem`
- 禁止：lorem ipsum、feature one/two/three、placeholder text、sample content。
- 修复：写真实文案；写不出就砍区块。

### NEVER-H3 · 空洞营销词 [P1] `buzzword`
- 禁止：empower / seamless / unleash / revolutionary / 一站式 / 赋能 / 颠覆 堆叠。
- 修复：具体动词 + 具体对象 + 具体结果。

### NEVER-H4 · Em dash 与装饰性微文案 [P2] 人工
- 禁止：文案里大量 `—`；标题下加「Each of these is a feature we ship today」类解释；页脚加版本号 `v1.4.2`。
- 修复：删。

### NEVER-H5 · CTA 语义重复 [P1] `cta-duplicate`
- 禁止：同页出现多个同意图 CTA（「联系我们」「聊聊」「开始合作」并存）。
- 修复：一个意图一个文案，全站统一。

### NEVER-H6 · 中文排版事故 [P1] 人工
- 禁止：中英混排缺空格；全角标点混半角；中文用 400 以下字重；行高 < 1.6。
- 修复：中文正文 400/500，行高 1.6–1.75，中英之间留半角空格。

---

## I. 组件 / 交互状态

### NEVER-I1 · 只有成功态 [P0] `missing-states`
- 禁止：按钮/表单/列表只有默认态，没有 hover/focus/disabled/loading/empty/error。
- 判定：状态覆盖矩阵缺项。
- 修复：每个交互组件补齐状态（见 `06-component-contract.md`）。

### NEVER-I2 · 焦点不可见 [P0] `focus-visible`
- 禁止：`outline: none` 无替代；键盘无法到达。
- 修复：`:focus-visible` 2px 强调色轮廓 + offset。

### NEVER-I3 · 按钮对比度不足 [P0] `contrast`
- 禁止：白底白字、浅灰按钮浅灰字、透明按钮叠图无描边。
- 判定：正文 4.5:1、大字 3:1。
- 修复：改色或加描边/底色。

### NEVER-I4 · 按钮文字换行 [P1] `cta-wrap`
- 禁止：桌面端 CTA 文案换成 2 行。
- 修复：缩短到 3 词内或加宽按钮。

### NEVER-I5 · 组件内裸值 [P0] `hardcoded-value`
- 禁止：组件里写死颜色/字号/圆角/间距。
- 修复：全部引用 token。

### NEVER-I6 · 自造组件 [P1] `adhoc-component`
- 禁止：使用处临时拼一个不在 `components.md` 里的组件。
- 修复：先补契约再用。

---

## J. 工程 / 实现

### NEVER-J1 · 无 token 层 [P0]
- 禁止：直接写 hex/px；无 CSS 变量。
- 修复：先建 tokens.css 再写样式。

### NEVER-J2 · 内联样式 [P1] `inline-style`
- 禁止：`style="..."` 散落（动态计算除外）。
- 修复：类 + token。

### NEVER-J3 · 魔法数字 [P1] `magic-number`
- 禁止：`z-index: 9999`、`margin-top: 37px`、`width: 317px`。
- 修复：token 或明确布局计算。

### NEVER-J4 · 无骨架/无错误边界 [P1] 人工
- 禁止：异步内容无 loading/error 兜底。
- 修复：骨架 + 错误态 + 空态。

### NEVER-J5 · 忽略减少动态/深色模式 [P1] `theme-missing`
- 禁止：声明支持深色但只有一套 token；或动效无 reduced-motion。
- 修复：双主题 token + 媒体查询。

---

## K. 文案 / 提示词泄漏（AI 把自己的说明写进页面）

> 这一类最伤：用户看到的不是产品文案，而是「AI 的工作汇报」。
> 规则一句话：**给用户的内容进页面；给工程师的说明进注释。**
> K 组 4 条由独立脚本 `scripts/check-copy.mjs` 检测，不计入 `detect-drift` 的 40 条规则清单（两者互补）。

### NEVER-K1 · 提示词 / 说明 / 设计理由渲染成可见文案 [P0] `prompt-leak`
- 禁止：把用户的修改要求（「把标题放大、冷一点」）、AI 的执行说明（「说明：这里用了 8pt 网格」）、设计理由（「非对称分栏，参考自 Linear」）、参考来源、占位解释，写进页面可见文字——包括 `text`、`alt`、`title`、`placeholder`、`aria-label`、`value`。
- 为什么：这些是给工程师的元信息，不是用户内容；一眼就能看出「这是 AI 生成的」，也是最常见的「多余小字」来源。
- 判定：`node scripts/check-copy.mjs <dir>` 规则 `prompt-leak`；或人工搜 `说明：` `备注：` `参考自` `设计意图` `本页` `演示`。
- 例外：**无**。产品本身确实要给用户看的「说明/帮助」文本不算（例如设置项下的说明文案），但要写得像产品文案，不要写成开发备注。
- 修复：写进 HTML 注释 `<!-- design: … -->`、`<!-- copy: … -->`，或 `change-log.md` / `decision-log.md`；页面只保留用户需要的内容。

### NEVER-K2 · TODO / lorem / 占位残留 [P0] `todo-leftover`
- 禁止：可见文案里出现 `TODO` `FIXME` `lorem ipsum` `待补充` `待定`。
- 判定：`check-copy` 规则 `todo-leftover`。
- 修复：删除；或改成注释 + 在 change-log 记一条待办。

### NEVER-K3 · 未标注的示例数据 [P1] `placeholder-unlabeled`
- 禁止：页面出现「示例数据」「假数据」但不标注来源/性质，用户误以为是真实数据。
- 判定：`check-copy` 规则 `placeholder-unlabeled`。
- 例外：明确标注「（示例数据）」且不涉及指标承诺。
- 修复：标注或换真实数据。

### NEVER-K4 · 装饰性微文案与 <12px 小字 [P1] `tiny-text`
- 禁止：为了「设计感」加一行无信息量的小字（「Scroll」「v1.4.2」「BRAND. MOTION.」）；可见字号 < 12px。
- 判定：`check-copy` 规则 `tiny-text`；人工判断「删掉它用户会损失信息吗」。
- 修复：删除，或合并进正文；确需小字 ≥12px 且承载真实信息（时间、单位、快捷键）。

---

## 附：严重度与交付

| 级别 | 含义 | 交付影响 |
|---|---|---|
| P0 | 硬伤 | 不修不能交付，验收直接 FAIL |
| P1 | 明显缺陷 | 本次迭代内修，可带风险说明 |
| P2 | 打磨项 | 记录，后续迭代 |

**一张图记住优先级**：紫渐变、玻璃、大圆角卡片、三张等宽卡、emoji 图标、假数据、只有成功态、裸值 —— 这 8 个是「AI 味」的核心指纹，先修这些。
