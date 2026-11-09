# 01 · 品牌风格族分类（Brand Taxonomy）

> **注意**：本文件只覆盖「风格参考」（像谁）。**官方实现系统**（用什么组件/行为建，如 Astryx by Meta）是另一层，不参与这 10 个风格族的路由，见 `references/10-official-systems.md` 与 `systems/`。

> **定位**：这是「前端设计链路」规则包的第一层——把 58 个知名品牌的 `DESIGN.md` 规范聚类成 10 个可路由的**风格族**，供 agent 在做意图识别后选出 1 个主参考品牌（+ 至多 1 个辅参考）。

| 项 | 值 |
|---|---|
| 版本 | 1 |
| 生成时间 | 2026-11-07T11:36:56.049Z |
| 数据源 | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) |
| 许可证 | MIT License |
| 品牌数 | 58 |
| 风格族数 | 10 |
| 配套机器可读索引 | `data/brand-index.json` |
| 品牌原文副本 | `brand-specs/<brand>/`（DESIGN.md / preview.html / preview-dark.html / README.md） |

---

## 0. 怎么用这份文档

```
用户意图
   └─1─▶ 查 §3「意图 → 风格族」路由表，定 1 个主族（必要时再定 1 个辅族）
          └─2─▶ 查该族在 §2 的品牌分组表，用 best_for / avoid_for / theme 初筛
                 └─3─▶ 用 §5 选择规则收敛到「1 主参考 + 至多 1 辅参考」
                        └─4─▶ 从 brand-index.json 取该品牌的 palette/fonts/radius/signature
                               └─5─▶ 以 §4 的族级表盘为起点，按品牌的 density/formality/energy 微调
```

**关键原则**：族决定"往哪个方向设计"，品牌决定"具体长什么样"。**不要跳过族直接选品牌**——直接挑品牌会让 58 个选项变成凭印象的抓阄。

---

## 1. 十个风格族总览

| 族 | name | 中文 | 品牌数 | 主参考候选（示例） |
|---|---|---|---|---:|---|
| **F1** | `devtools-dark` | 深色工程感开发者工具 | 17 | Linear、Vercel、Supabase |
| **F2** | `premium-minimal` | 高端极简/消费电子 | 3 | Apple、Superhuman、Cal.com |
| **F3** | `fintech-trust` | 金融科技信任感 | 5 | Stripe、Coinbase、Revolut |
| **F4** | `enterprise-system` | 企业级系统/文档密集 | 4 | IBM、Notion、Airtable |
| **F5** | `ai-native` | AI 原生产品 | 9 | Claude (Anthropic)、ElevenLabs、Cohere |
| **F6** | `creative-tool` | 创意工具/画布/多彩 | 5 | Figma、Framer、Miro |
| **F7** | `editorial-brand` | 编辑感/品牌叙事 | 2 | Resend、Cursor |
| **F8** | `consumer-warm` | 消费/生活/好友好 | 4 | Airbnb、Spotify、Uber |
| **F9** | `industrial-bold` | 工业/汽车/硬朗力量 | 7 | BMW、Ferrari、Tesla |
| **F10** | `commerce-conversion` | 电商/营销转化 | 2 | Zapier、Intercom |

**覆盖度提示**：本仓库自述为 *"curated collection of DESIGN.md files inspired by **developer focused** websites"*，因此 F1（开发者工具）天然占大头（17 个）。F2/F7/F10 是稀有族，选型时优先保证"族对"，再接受候选少。详见 §6。

---

## 2. 十个风格族详解

### F1 · 深色工程感开发者工具（`devtools-dark`）

**定义**：以深色（或近黑暖灰）为原生介质，用等宽字体、极细半透明描边与克制的单一强调色建立层级，服务于开发者与工程型产品的视觉语汇。

**判别关键词**
- EN：`developer tool` · `dark` · `precise` · `mono` · `terminal` · `api` · `infrastructure` · `engineering`
- ZH：`开发者工具` · `深色` · `精密` · `工程感` · `终端` · `API` · `基础设施` · `B2B SaaS` · `技术文档`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 12 个 / 浅色 5 个
- 圆角基准（px）：4 / 6 / 8 / 10 / 12 / 16 / 24
- 常见字体：Inter · Berkeley Mono · GeistMono · abcDiatype
- 强调色：#faff69 · #0007cd · #7b42bc · #5e6ad2 · #00ed64 · #007aff · #F54E00 · #FF6363 · #f36458 · #c2ef4e · #3ecf8e · #00d992（另有 3 个品牌以黑/白为"强调色"：#000000 · #171717 · #ffffff，即刻意不引入彩色）
- 密度区间：density 3–6

**适用场景**：面向工程师的产品（编辑器/终端/数据库/CI/监控/Agent 框架）、API 平台官网、技术文档站、需要"精密可信"的 B2B 工具界面。

**失败模式**
- 误用边界：面向儿童或大众消费的温暖产品、奢侈品、需要高饱和促销冲击的电商大促页、纯情绪化的品牌叙事页。
- 易滑向 AI 套路的品牌：`composio`、`expo`、`ollama`、`voltagent`（这些品牌的特征组合已被大量生成式站点复用过，落地时**必须**至少还原 2 条 signature）

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `clickhouse` · ClickHouse | 纯黑 + 荧光黄绿 + Inter 900 的暴烈性能感 | dark | 6 | low |
| `composio` · Composio | 沥青黑 + 生物荧光辉光的 AI Agent 工具链 | dark | 6 | medium |
| `expo` · Expo | 冷白画布 + 胶囊几何 + 极紧大标题的单色开发者站 | light | 5 | medium |
| `hashicorp` · HashiCorp | 白/深双模 + 子产品各一色的企业基础设施体系 | light+dark | 6 | low |
| `linear.app` · Linear | 近黑画布 + 510 字重的精密克制深色原生工具 | dark+light | 6 | low |
| `mongodb` · MongoDB | 深青黑 + 价值衬线 + 霓虹绿的开发者品牌叙事 | dark+light | 6 | low |
| `ollama` · Ollama | 纯白零彩、无阴影无动效的极简本地模型工具 | light | 3 | medium |
| `opencode.ai` · OpenCode | 全站等宽 Berkeley Mono + 暖黑底的纯终端气质 | dark | 6 | low |
| `posthog` · PostHog | 鼠尾草暖色 + 手绘刺猬的反企业开发者分析 | light | 5 | low |
| `raycast` · Raycast | 蓝黑底 + inset 高光的 macOS 原生触感启动器 | dark | 5 | low |
| `sanity` · Sanity | 纯中性近黑 + 霓虹标点的精密 CMS 工具 | dark | 6 | low |
| `sentry` · Sentry | 紫黑底 + 青柠绿的顽皮有个性开发者监控 | dark | 5 | low |
| `supabase` · Supabase | 近黑底 + 祖母绿标记、靠描边分层的开源后端平台 | dark | 6 | low |
| `vercel` · Vercel | 投影即描边 + Geist 极端负字距的单色基础设施站 | light+dark | 5 | low |
| `voltagent` · VoltAgent | 碳黑 + 信号绿辉光的 AI Agent 框架 | dark | 6 | medium |
| `warp` · Warp | 暖深色 + Matter 柔和几何、刻意无强调色的终端 | dark | 5 | low |
| `x.ai` · xAI | 把等宽字体当奢侈的超大字号纯暗技术平台 | dark | 5 | low |


### F2 · 高端极简/消费电子（`premium-minimal`）

**定义**：用极大留白、单一强调色与产品图本身承担全部叙事，界面几乎"不存在"——高端硬件与精品工具的克制表达。

**判别关键词**
- EN：`premium` · `minimal` · `whitespace` · `product-as-hero` · `restrained` · `luxury` · `understated`
- ZH：`高端` · `极简` · `留白` · `产品即主角` · `克制` · `精品` · `消费电子` · `轻奢`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 0 个 / 浅色 3 个
- 圆角基准（px）：8 / 12 / 980
- 常见字体：Super Sans VF · SF Pro Display · SF Pro Text · Cal Sans
- 强调色：#0071e3 · #cbb7fb
- 密度区间：density 3–5

**适用场景**：硬件/消费电子发布、单品营销长页、高端工具类产品、需要"贵而不吵"的品牌官网。

**失败模式**
- 误用边界：功能密集的后台、需要并列大量指标的数据看板、强调信息密度的企业系统、多语长文档。
- 易滑向 AI 套路的品牌：`apple`、`cal`（这些品牌的特征组合已被大量生成式站点复用过，落地时**必须**至少还原 2 条 signature）

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `apple` · Apple | 黑白双色节奏、产品摄影即页面的高端极简 | light+dark | 3 | medium |
| `cal` · Cal.com | 纯灰阶无品牌色，靠 Cal Sans 与阴影层级取胜 | light | 5 | medium |
| `superhuman` · Superhuman | 深紫 hero + 奶油色按钮的低调奢华效率工具 | light+dark | 4 | low |


### F3 · 金融科技信任感（`fintech-trust`）

**定义**：白底或深底上的高信任度蓝/紫品牌色，配克制圆角与成体系的语义状态色，让资金与数字显得稳定、可核对。

**判别关键词**
- EN：`fintech` · `trust` · `secure` · `banking` · `payments` · `crypto` · `regulated` · `institutional`
- ZH：`金融` · `信任` · `安全` · `支付` · `银行` · `加密资产` · `合规` · `费率` · `账户`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 0 个 / 浅色 5 个
- 圆角基准（px）：6 / 12 / 56 / 9999
- 常见字体：Inter · sohne-var · CoinbaseDisplay · CoinbaseText
- 强调色：#0052ff · #7132f5 · #494fdf · #533afd · #9fe870
- 密度区间：density 5–5

**适用场景**：支付/银行/券商/加密交易所、需要建立信任的 B2C 金融产品、定价与费率页、账户与对账界面。

**失败模式**
- 误用边界：娱乐化社交产品、儿童教育、追求怪趣的实验性品牌、纯艺术表达页。
- 本族成员目前均为 `ai_slop_risk: low`——但仍需遵守"至少还原 2 条 signature"的下限

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `coinbase` · Coinbase | 纯白 + 招牌蓝、56px 胶囊按钮的加密信任感 | light+dark | 5 | low |
| `kraken` · Kraken | 白底 Kraken 紫 + 冷灰中性阶的专业加密交易感 | light+dark | 5 | low |
| `revolut` · Revolut | 136px 广告牌标题 + 全胶囊、零阴影的金融精品感 | light+dark | 5 | low |
| `stripe` · Stripe | 白色 + 深海军蓝标题 + 蓝调阴影的金融级开发者平台 | light+dark | 5 | low |
| `wise` · Wise | 青柠绿 + 900 字重广告牌标题的清新跨境金融 | light | 5 | low |


### F4 · 企业级系统/文档密集（`enterprise-system`）

**定义**：token/组件库驱动的中性界面，允许高信息密度与长文档，用边框、层级与语义色承担结构而非装饰。

**判别关键词**
- EN：`enterprise` · `design system` · `documentation` · `dense` · `tokenized` · `dashboard` · `b2b` · `admin`
- ZH：`企业级` · `系统化` · `文档` · `信息密集` · `组件库` · `控制台` · `后台` · `B2B 平台`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 0 个 / 浅色 4 个
- 圆角基准（px）：0 / 8 / 16
- 常见字体：IBM Plex Sans · Inter · NotionInter · Haas Groot Disp
- 强调色：#1b61c9 · #0f62fe · #18E299 · #0075de
- 密度区间：density 6–7

**适用场景**：企业控制台、文档站、数据表格、组件库驱动的大型产品、需要长表格与多状态的后台。

**失败模式**
- 误用边界：单页品牌叙事、需要强情绪冲击的营销页、儿童或娱乐产品。
- 本族成员目前均为 `ai_slop_risk: low`——但仍需遵守"至少还原 2 条 signature"的下限

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `airtable` · Airtable | 白底深蓝文字、蓝调投影的克制企业级表格系统 | light | 6 | low |
| `ibm` · IBM | Plex 细字重 + Carbon token 的大型企业系统 | light | 7 | low |
| `mintlify` · Mintlify | 白底紧字距 + Geist Mono 标签的文档工具风 | light | 6 | low |
| `notion` · Notion | 暖中性灰 + 耳语描边的友好文档工作区 | light+dark | 6 | low |


### F5 · AI 原生产品（`ai-native`）

**定义**：以模型能力为叙事核心：渐变/辉光/流体质感、未来感大标题与轻量等宽标签，强调"正在生成"的动势。

**判别关键词**
- EN：`ai` · `llm` · `model` · `generative` · `agent` · `gradient` · `glow` · `futuristic` · `chat`
- ZH：`AI` · `大模型` · `生成式` · `智能体` · `渐变` · `辉光` · `未来感` · `对话` · `推理`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 1 个 / 浅色 8 个
- 圆角基准（px）：4 / 8 / 16 / 20 / 22 / 9999
- 常见字体：Camera Plain Variable · abcNormal · The Future · Anthropic Serif
- 强调色：#c96442 · #1863dc · #1c1c1c · #1456f0 · #fa520f · #ea2804 · #ef2cc1
- 密度区间：density 3–5

**适用场景**：AI 助手/生成式工具、模型 API 平台、AI 基础设施、需要表达"智能正在发生"的产品页。

**失败模式**
- 误用边界：严肃合规金融的对外官网、传统制造业产品目录、儿童产品、需要绝对中性的政府/医疗界面。
- 易滑向 AI 套路的品牌：`claude`、`elevenlabs`、`lovable`、`minimax`、`mistral.ai`、`replicate`、`together.ai`（这些品牌的特征组合已被大量生成式站点复用过，落地时**必须**至少还原 2 条 signature）

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `claude` · Claude (Anthropic) | 羊皮纸底色 + 陶土橘的温暖人文学术 AI 风 | light | 4 | medium |
| `cohere` · Cohere | 白底冷灰 + 22px 圆角的克制企业级 AI 风 | light | 5 | low |
| `elevenlabs` · ElevenLabs | 近白 + 极细字重的空灵 AI 语音品牌 | light | 4 | medium |
| `lovable` · Lovable | 暖羊皮底 + 人文字体的亲和 AI 应用生成器 | light | 4 | high |
| `minimax` · MiniMax | 白底彩色产品卡 + 胶囊按钮的多产品 AI 陈列 | light | 5 | high |
| `mistral.ai` · Mistral AI | 奶油到燃橙的金黄色宇宙、品牌叙事型 AI 实验室 | light | 4 | medium |
| `replicate` · Replicate | 橙红爆裂渐变 + 全胶囊 + 128px 粗字的 AI 推理平台 | light | 4 | medium |
| `runwayml` · Runway | 满幅电影影像 + 隐形界面的 AI 视频工具 | dark | 3 | low |
| `together.ai` · Together AI | 白底粉彩渐变 + 极紧字距的乐观研究型 AI 平台 | light | 4 | high |


### F6 · 创意工具/画布/多彩（`creative-tool`）

**定义**：把颜色当作内容而不是装饰：中性 UI 外壳包住鲜活的画布/内容，圆角友善，强调可玩性、可组合与协作感。

**判别关键词**
- EN：`creative` · `canvas` · `colorful` · `playful` · `design tool` · `collaboration` · `swatch` · `no-code`
- ZH：`创意工具` · `画布` · `多彩` · `可玩` · `设计工具` · `协作` · `色板` · `无代码` · `白板`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 1 个 / 浅色 4 个
- 圆角基准（px）：6 / 8 / 10 / 24 / 50
- 常见字体：Roobert · figmaSans · WF Visual Sans Variable · Space Mono
- 强调色：#078a52 · #0099ff · #5b76fe · #146ef5
- 密度区间：density 4–5

**适用场景**：设计/白板/无代码/内容创作工具、需要表达"自由组合"的产品、面向创意人的营销页。

**失败模式**
- 误用边界：严肃金融交易界面、需要绝对稳定的企业控制台、儿童安全类产品。
- 易滑向 AI 套路的品牌：`framer`（这些品牌的特征组合已被大量生成式站点复用过，落地时**必须**至少还原 2 条 signature）

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `clay` · Clay | 奶油底 + 命名色板（抹茶/紫薯）的手作顽皮感 | light | 4 | low |
| `figma` · Figma | 黑白中性外壳 + 胶囊几何的设计工具画布感 | light+dark | 5 | low |
| `framer` · Framer | 纯黑虚空 + 电光蓝、以动效为卖点的建站工具 | dark | 5 | medium |
| `miro` · Miro | 白画布 + 粉彩成对色板的友好协作白板 | light | 5 | low |
| `webflow` · Webflow | 白底 Webflow 蓝 + 丰富次级色板的建站工具 | light | 5 | low |


### F7 · 编辑感/品牌叙事（`editorial-brand`）

**定义**：以大字号衬线或压缩无衬线 + 摄影与叙事段落构建杂志式节奏，页面像一篇故事而不是一张功能表。

**判别关键词**
- EN：`editorial` · `brand narrative` · `magazine` · `serif` · `storytelling` · `photography` · `manifesto`
- ZH：`编辑感` · `品牌叙事` · `杂志` · `衬线` · `故事性` · `摄影` · `宣言` · `年度报告`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 1 个 / 浅色 1 个
- 圆角基准（px）：10 / 12
- 常见字体：CursorGothic · jjannon · berkeleyMono · Domaine Display
- 强调色：#f54e00 · #ff801f
- 密度区间：density 4–5

**适用场景**：品牌官网/年度报告/发布叙事页、需要讲清"为什么"的产品、文化与内容品牌。

**失败模式**
- 误用边界：高频操作的后台、需要并排比较大量参数的界面、以转化为唯一目标的短落地页。
- 易滑向 AI 套路的品牌：`cursor`（这些品牌的特征组合已被大量生成式站点复用过，落地时**必须**至少还原 2 条 signature）

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `cursor` · Cursor | 奶油纸底 + 衬线正文 + 压缩标题的编辑感编程工具 | light | 5 | medium |
| `resend` · Resend | 纯黑画廊 + Domaine 衬线的戏剧性开发者品牌叙事 | dark | 4 | low |


### F8 · 消费/生活/好友好（`consumer-warm`）

**定义**：暖中性色与圆润几何，配合真实照片与柔和阴影，让产品显得亲切、可信、可日常使用。

**判别关键词**
- EN：`consumer` · `warm` · `friendly` · `lifestyle` · `approachable` · `rounded` · `human` · `cozy`
- ZH：`消费` · `生活` · `温暖` · `友好` · `亲切` · `圆润` · `有人味` · `社区` · `预订`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 1 个 / 浅色 3 个
- 圆角基准（px）：8 / 16 / 999
- 常见字体：Airbnb Cereal VF · Pin Sans · SpotifyMixUITitle · SpotifyMixUI
- 强调色：#ff385c · #e60023 · #1ed760（另有 1 个品牌以黑/白为"强调色"：#000000，即刻意不引入彩色）
- 密度区间：density 5–5

**适用场景**：消费级 App/预订/本地生活/生活方式、面向大众的服务、需要降低使用门槛的工具。

**失败模式**
- 误用边界：硬核工程仪表盘、金融风控后台、高端冷调奢侈品、严肃合规文档。
- 本族成员目前均为 `ai_slop_risk: low`——但仍需遵守"至少还原 2 条 signature"的下限

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `airbnb` · Airbnb | 白底 Rausch 红、摄影优先的温暖消费级空气感 | light | 5 | low |
| `pinterest` · Pinterest | 暖橄榄中性阶 + Pinterest 红的温馨视觉发现 | light | 5 | low |
| `spotify` · Spotify | 近黑沉浸 + 无彩 UI、让封面供色的消费音乐界面 | dark | 5 | low |
| `uber` · Uber | 纯黑白 + 全胶囊 + 温暖插画的都市出行界面 | light | 5 | low |


### F9 · 工业/汽车/硬朗力量（`industrial-bold`）

**定义**：零或极小圆角、全大写宽字距、黑白摄影与单一金属/品牌色，传达机械精度与压迫性的力量感。

**判别关键词**
- EN：`industrial` · `automotive` · `bold` · `sharp` · `uppercase` · `engineering` · `power` · `aerospace`
- ZH：`工业` · `汽车` · `硬朗` · `直角` · `大写` · `工程` · `力量感` · `航天` · `硬件`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 4 个 / 浅色 3 个
- 圆角基准（px）：0 / 2 / 4 / 32
- 常见字体：LamboType · NVIDIA-EMEA · NouvelR · BMWTypeNextLatin Light
- 强调色：#1c69d4 · #DA291C · #FFC000 · #76b900 · #EFDF00 · #3e6ae1
- 密度区间：density 2–6

**适用场景**：汽车/机械/航天/硬件，需要表达性能与权威的发布页、参数与规格展示、产品线目录。

**失败模式**
- 误用边界：母婴/儿童、温柔生活方式、需要轻松幽默的社交产品、亲和力优先的医疗界面。
- 易滑向 AI 套路的品牌：`renault`、`tesla`（这些品牌的特征组合已被大量生成式站点复用过，落地时**必须**至少还原 2 条 signature）

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `bmw` · BMW | 零圆角直角几何 + 展台式明暗分区的高端工业感 | light | 4 | low |
| `ferrari` · Ferrari | 黑白明暗对照 + 极稀疏法拉利红的高端机械叙事 | dark+light | 4 | low |
| `lamborghini` · Lamborghini | 纯黑 + 兰博金、全大写超大字的攻击性超跑语言 | dark | 3 | low |
| `nvidia` · NVIDIA | 纯黑 + 绿色描边信号、1px 锐角的工业算力感 | dark+light | 6 | low |
| `renault` · Renault | 极光渐变 + 零圆角 + 亮黄点缀的电动出行力量感 | light+dark | 4 | medium |
| `spacex` · SpaceX | 纯黑 + DIN 大写 + 满幅摄影的航天权威语言 | dark | 2 | low |
| `tesla` · Tesla | 满视口车辆摄影 + 零装饰 + 单一电光蓝的汽车极简 | light+dark | 3 | medium |


### F10 · 电商/营销转化（`commerce-conversion`）

**定义**：为点击与转化组织信息：强 CTA、清晰价格层级、产品网格与信任标记，视觉整体服务于漏斗效率。

**判别关键词**
- EN：`ecommerce` · `conversion` · `marketing` · `landing page` · `cta` · `pricing` · `growth` · `signup`
- ZH：`电商` · `转化` · `营销` · `落地页` · `CTA` · `定价` · `增长` · `注册` · `活动页`

**典型视觉特征**（由本族成员的实际 token 统计得出）
- 明暗倾向：primary theme 为深色 0 个 / 浅色 2 个
- 圆角基准（px）：4 / 8
- 常见字体：Saans · SaansMono · Degular Display · Inter
- 强调色：#ff5600 · #ff4f00
- 密度区间：density 5–5

**适用场景**：电商/预订/订阅转化页、SaaS 营销落地页、定价与方案对比页、活动与促销页。

**失败模式**
- 误用边界：内部工具、深度技术文档、需要长时间沉浸的编辑器界面、以品牌叙事为主的官网。
- 本族成员目前均为 `ai_slop_risk: low`——但仍需遵守"至少还原 2 条 signature"的下限

**本族品牌分组**

| 品牌 | 一句话 | theme | density | ai_slop_risk |
|---|---|---|---:|---|
| `intercom` · Intercom | 暖白底 + 4px 锐角 + Fin 橙的自信 B2B SaaS | light | 5 | low |
| `zapier` · Zapier | 暖奶油底 + 橙 CTA + 压缩展示字的自动化 SaaS | light | 5 | low |


---

## 3. 意图 → 风格族 路由表

按"用户说了什么"直接查表。**若一条意图命中多个族，取唯一主族，另一个降级为 secondary。**

| 用户可能这么说（中/英） | 主族 | 辅族（可选） | 判断依据 |
|---|---|---|---|
| "做个开发者工具官网" / "devtool landing page" | **F1** | — | 受众是工程师，需要精密可信 |
| "深色、精密、像 Linear 那种" | **F1** | — | "深色+精密"是 F1 的定义核心 |
| "终端 / CLI / API 平台 / 基础设施" | **F1** | F4 | 工具属性强；文档多时借 F4 的密度 |
| "开源项目首页" | **F1** | F9 | 开源读者=开发者；想强调性能时借 F9 |
| "高端、留白、像苹果发布会那样" | **F2** | F10 | 留白+产品图+单一强调色 |
| "卖一个硬件单品，产品图为主" | **F2** | F10 | 产品即主角；但转化结构来自 F10 |
| "低调但贵、不要太吵" | **F2** | F4 | understated luxury |
| "支付/银行/理财，要让人放心" | **F3** | F4 | 信任是第一诉求 |
| "加密交易所，专业但不吓人" | **F3** | F10 | 信任 + 交易转化 |
| "跨境汇款/个人金融" | **F3** | F8 | 金融但要亲和 |
| "企业后台 / 控制台 / 长表格" | **F4** | F1 | 信息密度优先 |
| "文档站 / 知识库 / API reference" | **F4** | F1 | 长文档 + 可检索 |
| "组件库 / 设计规范站" | **F4** | F2 | 系统化是核心 |
| "AI 产品 / AI Agent / 大模型平台" | **F5** | F1 | 叙事核心是模型能力 |
| "要有未来感、渐变、辉光" | **F5** | F6 | "生成感"的视觉语汇 |
| "AI 编程工具 / AI 编辑器" | **F5** | F7 | AI 叙事为主；若要温暖纸感则 F7 升为主族 |
| "设计工具 / 白板 / 画布 / 无代码" | **F6** | F10 | 内容供色、外壳中性 |
| "多彩、可玩、面向设计师" | **F6** | F8 | 可玩性 + 亲和力 |
| "建站工具 / 网站搭建" | **F6** | F10 | 工具属性 + 营销转化 |
| "品牌官网 / 年度报告 / 讲故事" | **F7** | F9 | 叙事优先于功能 |
| "杂志感 / 衬线 / 编辑感" | **F7** | F2 | 排版即品牌 |
| "发布叙事页 / 品牌宣言" | **F7** | F9 | 单页叙事，长滚动 |
| "消费 App / 预订 / 本地生活" | **F8** | F10 | 大众用户 + 交易 |
| "温暖、亲切、别太冷" | **F8** | F2 | 暖中性色 + 圆润几何 |
| "音乐/视频/内容平台" | **F8** | F10 | 内容沉浸 + 订阅转化 |
| "汽车 / 机械 / 航天 / 工业硬件" | **F9** | F7 | 力量与精度 |
| "硬朗、直角、有力量感" | **F9** | F1 | 零圆角 + 大写字距 |
| "高性能 / 算力 / 参数规格展示" | **F9** | F1 | 工程权威 + 技术细节 |
| "电商 / 大促 / 定价页要转化" | **F10** | F8 | 漏斗效率优先 |
| "落地页要注册转化，CTA 要强" | **F10** | F4 | CTA 与信任标记 |
| "通用 B2B SaaS 官网，没什么强风格偏好" | **F1** | F10 | 默认落 F1，转化结构借 F10 |
| "儿童 / 教育 / 医疗严肃界面" | **—** | — | **本索引无匹配族**：58 个品牌均为商业/开发者/消费科技语境，此场景应另行定义，不要硬套 |

---

## 4. 风格族 → 默认设计表盘

三个标量均为 **1–10**。这是"族的起点"，不是"品牌的最终值"：选定品牌后，再按该品牌的 `density / formality / energy` 做微调（偏差建议 ≤2）。

| 族 | variance（版式变化度） | motion（动效强度） | density（信息密度） | 读法 |
|---|---:|---:|---:|---|
| **F1** 深色工程感开发者工具 | 4 | 3 | 6 | 低变化、低动效、中高密度——克制是身份 |
| **F2** 高端极简/消费电子 | 2 | 3 | 3 | 极低变化、低动效、极低密度——留白即产品 |
| **F3** 金融科技信任感 | 3 | 3 | 5 | 低变化、低动效、中密度——稳定压倒个性 |
| **F4** 企业级系统/文档密集 | 2 | 2 | 8 | 极低变化、极低动效、最高密度——结构优先 |
| **F5** AI 原生产品 | 6 | 6 | 4 | 中高变化、高动效、中低密度——生成感要做足 |
| **F6** 创意工具/画布/多彩 | 7 | 6 | 4 | 高变化、高动效、中低密度——可玩性是卖点 |
| **F7** 编辑感/品牌叙事 | 6 | 4 | 3 | 高变化、中动效、低密度——排版承担叙事 |
| **F8** 消费/生活/好友好 | 4 | 4 | 5 | 中变化、中动效、中密度——亲切但不松散 |
| **F9** 工业/汽车/硬朗力量 | 3 | 5 | 4 | 低变化、中高动效、中低密度——力量来自对比 |
| **F10** 电商/营销转化 | 5 | 6 | 6 | 中高变化、高动效、中高密度——每个区块都为转化服务 |

**表盘与品牌标量的关系**：`brand.density` 校准族级 density；`brand.formality` 影响字重/装饰克制程度（越高越少装饰）；`brand.energy` 影响动效与对比强度。三者与表盘冲突时，**以品牌值为准**——品牌是更细的证据。

---

## 5. 品牌选择规则

### 5.1 数量：1 主 + 至多 1 辅

- **必须**选 1 个主参考品牌：它的 palette / fonts / radius / signature 是落地依据。
- **可选** 1 个辅参考品牌：只用来补主品牌缺的那一维（例如 F1 主品牌缺"叙事感"，就借 F7 的排版节奏）。
- **禁止** 选 3 个及以上，或"多品牌拼贴"——那会产出四不像，且无法归因。
- 主/辅必须来自**不同族**，且是**不同品牌**。

### 5.2 同族内怎么筛

按以下顺序逐条过滤，任一条不通过即排除该品牌：

1. **theme 硬约束**：用户明确要深色 → 只保留 `theme` 含 `dark`；明确要浅色 → 只用含 `light`。
2. **best_for 命中**：品牌 `best_for` 至少有 1 项与用户的产品类型/行业重合。
3. **avoid_for 排除**：命中任意 `avoid_for` 即**直接排除**（一票否决，不做加权）。
4. **密度校准**：用 `|brand.density − 目标密度|` 排序，取最小者。
5. **风险复核**：`ai_slop_risk: high` 的品牌必须能落地 ≥2 条 `signature`，否则降级为不选。
6. **可还原性下限**：无法还原 2 条以上 `signature` 的品牌一律不选——选了也只是"大概像"。

### 5.3 signature 是硬验收项

每个品牌的 `signature` 记录了它**不可替换**的识别特征（如 Linear 的 510 字重、Vercel 的 shadow-as-border、Clay 的 rotateZ(-8deg) 悬停）。落地时不还原这些，就等于只是"白底加了个品牌色"，属于典型的 AI slop。

> 经验阈值：**至少 2 条 signature** 落地，才算这个品牌被真正用上。

### 5.4 跨族借用的正确姿势

辅参考只能借**一个维度**，不能借整体：

| 想补的维度 | 建议辅族 | 借什么 |
|---|---|---|
| 叙事/排版节奏 | F7 | 字号阶、行高、段落节奏 |
| 信息密度/表格 | F4 | 表格样式、状态色语义 |
| 转化结构 | F10 | CTA 层级、定价卡结构 |
| 亲和力 | F8 | 圆角、暖中性色 |
| 冲击力 | F9 | 全大写、极紧字距 |
| 未来感 | F5 | 留白与短句节奏、mono 点缀（**不得借渐变/辉光**，见 03 反面清单） |
| 精密感 | F1 | 描边、等宽标签 |

**不要**从辅族借配色方案——两套配色一混，品牌识别立刻消失。

---

## 6. 覆盖度与不确定项

### 6.1 族覆盖（全部 10 族均有品牌）

| 族 | 品牌数 | 覆盖判断 |
|---|---:|---|
| **F1** 深色工程感开发者工具 | 17 | 充足（源仓库本身偏向开发者站点） |
| **F2** 高端极简/消费电子 | 3 | 偏少但够用；Apple 是绝对基准，Superhuman/Cal.com 提供非硬件变体 |
| **F3** 金融科技信任感 | 5 | 充足；覆盖支付/交易所/汇款三类 |
| **F4** 企业级系统/文档密集 | 4 | 够用；IBM 提供最完整的 token 体系范式 |
| **F5** AI 原生产品 | 9 | 充足；覆盖助手/企业/语音/视频/模型平台/Agent |
| **F6** 创意工具/画布/多彩 | 5 | 充足；覆盖设计/建站/白板/GTM 四类 |
| **F7** 编辑感/品牌叙事 | 2 | **稀有（2 个）**；以 Resend 为基准，Cursor 提供"编辑感 + 开发者"的混合变体 |
| **F8** 消费/生活/好友好 | 4 | 够用；覆盖预订/出行/内容/发现四类 |
| **F9** 工业/汽车/硬朗力量 | 7 | 充足；覆盖汽车/航天/算力三类 |
| **F10** 电商/营销转化 | 2 | **稀有（2 个）**；以 Zapier 为基准，Intercom 提供"B2B 锐角"变体 |

**对稀有族的处理约定**：
- **F7（2 个）**：Resend 为标准答案；若用户要"编辑感 + 开发者"，用 Cursor；若两者都不合，允许从 F9 的 Ferrari / SpaceX 借"编辑式摄影"，但族仍记为 F7。
- **F10（2 个）**：Zapier 为标准答案（暖底 + 强 CTA）；Intercom 用于 B2B 锐角场景。F10 更多时候是**辅族**（9 个品牌的 secondary 是 F10），这是预期用法。
- **F2（3 个）**：Apple 占绝对主导；只有当"不能像苹果"时才用 Superhuman（低调奢华）或 Cal.com（纯灰阶）。

### 6.2 已知不确定项（诚实清单）

1. **非官方**：全部 `DESIGN.md` 由公开站点的 CSS/token 逆向整理，非品牌官方设计系统；颜色/字体可能有偏差。
2. **字段为 null 表示"原文未给出"，不是遗漏**：例如 `airbnb.fonts.mono`、`apple.palette.border`、`claude.radius_px` 均为 DESIGN.md 未声明，**未做任何推断填充**。
3. **accent 为 null 是设计事实**：`figma`/`ollama`/`runwayml`/`spacex`/`warp`/`elevenlabs` 的原文明确"无彩色强调色"或"零彩色"，属刻意如此。
4. **radius_px 为单一代表值**：原文常给出多个圆角（如 Apple 5/8/11 + 980px 胶囊），字段取**最具识别性的基准值**（Apple 取 980 胶囊）。完整值见各品牌 DESIGN.md §4。
5. **族归属是人工判断**：依据各 DESIGN.md 的 §1 Visual Theme / Key Characteristics / §2 色板 / §4 组件几何。少数品牌天然跨族（如 Cursor 既是开发者工具也是编辑感设计，Mistral 既是 AI 也是品牌叙事），此时 `secondary_family` 表达"跨族借用"，**不是第二个标签**。
6. **fonts 里可能出现占位/回退名**：如 `NVIDIA-EMEA`、`__hashicorpSans_96f0ca` 是构建产物中的内部名，落地需替换为可获取的近似字体（见品牌 `signature`/`DESIGN.md` §3 的回退栈）。
7. **mistral.ai 的字体为定制体**：原文只标 "Arial 回退"，故 `fonts.display` 与 `fonts.mono` 为 null，`fonts.body` 记为 `Arial`（即实际可用回退）。

---

## 7. 附录：58 品牌 → 族 全量对照

| # | 品牌 | name | 主族 | 辅族 | theme | 密度 | 正式度 | 能量 | 风险 |
|---:|---|---|---|---|---|---:|---:|---:|---|
| 1 | `airbnb` | Airbnb | F8 | F10 | light | 5 | 4 | 6 | low |
| 2 | `airtable` | Airtable | F4 | F10 | light | 6 | 6 | 4 | low |
| 3 | `apple` | Apple | F2 | F10 | light+dark | 3 | 8 | 4 | medium |
| 4 | `bmw` | BMW | F9 | F2 | light | 4 | 8 | 5 | low |
| 5 | `cal` | Cal.com | F2 | F4 | light | 5 | 6 | 3 | medium |
| 6 | `claude` | Claude (Anthropic) | F5 | F8 | light | 4 | 6 | 3 | medium |
| 7 | `clay` | Clay | F6 | F8 | light | 4 | 3 | 8 | low |
| 8 | `clickhouse` | ClickHouse | F1 | F9 | dark | 6 | 4 | 7 | low |
| 9 | `cohere` | Cohere | F5 | F4 | light | 5 | 7 | 3 | low |
| 10 | `coinbase` | Coinbase | F3 | F10 | light+dark | 5 | 7 | 4 | low |
| 11 | `composio` | Composio | F1 | F5 | dark | 6 | 5 | 6 | medium |
| 12 | `cursor` | Cursor | F7 | F1 | light | 5 | 5 | 4 | medium |
| 13 | `elevenlabs` | ElevenLabs | F5 | F2 | light | 4 | 7 | 3 | medium |
| 14 | `expo` | Expo | F1 | F2 | light | 5 | 5 | 4 | medium |
| 15 | `ferrari` | Ferrari | F9 | F7 | dark+light | 4 | 7 | 8 | low |
| 16 | `figma` | Figma | F6 | F2 | light+dark | 5 | 5 | 6 | low |
| 17 | `framer` | Framer | F6 | F5 | dark | 5 | 5 | 7 | medium |
| 18 | `hashicorp` | HashiCorp | F1 | F4 | light+dark | 6 | 6 | 4 | low |
| 19 | `ibm` | IBM | F4 | F1 | light | 7 | 8 | 3 | low |
| 20 | `intercom` | Intercom | F10 | F4 | light | 5 | 6 | 6 | low |
| 21 | `kraken` | Kraken | F3 | F10 | light+dark | 5 | 6 | 5 | low |
| 22 | `lamborghini` | Lamborghini | F9 | F2 | dark | 3 | 7 | 9 | low |
| 23 | `linear.app` | Linear | F1 | F10 | dark+light | 6 | 8 | 3 | low |
| 24 | `lovable` | Lovable | F5 | F8 | light | 4 | 4 | 5 | high |
| 25 | `minimax` | MiniMax | F5 | F10 | light | 5 | 5 | 6 | high |
| 26 | `mintlify` | Mintlify | F4 | F1 | light | 6 | 6 | 4 | low |
| 27 | `miro` | Miro | F6 | F8 | light | 5 | 4 | 6 | low |
| 28 | `mistral.ai` | Mistral AI | F5 | F7 | light | 4 | 6 | 7 | medium |
| 29 | `mongodb` | MongoDB | F1 | F7 | dark+light | 6 | 6 | 5 | low |
| 30 | `notion` | Notion | F4 | F8 | light+dark | 6 | 5 | 4 | low |
| 31 | `nvidia` | NVIDIA | F9 | F1 | dark+light | 6 | 7 | 6 | low |
| 32 | `ollama` | Ollama | F1 | F2 | light | 3 | 5 | 2 | medium |
| 33 | `opencode.ai` | OpenCode | F1 | F9 | dark | 6 | 4 | 3 | low |
| 34 | `pinterest` | Pinterest | F8 | F6 | light | 5 | 4 | 6 | low |
| 35 | `posthog` | PostHog | F1 | F8 | light | 5 | 4 | 6 | low |
| 36 | `raycast` | Raycast | F1 | F2 | dark | 5 | 6 | 5 | low |
| 37 | `renault` | Renault | F9 | F6 | light+dark | 4 | 6 | 8 | medium |
| 38 | `replicate` | Replicate | F5 | F6 | light | 4 | 4 | 8 | medium |
| 39 | `resend` | Resend | F7 | F1 | dark | 4 | 6 | 5 | low |
| 40 | `revolut` | Revolut | F3 | F2 | light+dark | 5 | 7 | 5 | low |
| 41 | `runwayml` | Runway | F5 | F7 | dark | 3 | 6 | 5 | low |
| 42 | `sanity` | Sanity | F1 | F6 | dark | 6 | 5 | 5 | low |
| 43 | `sentry` | Sentry | F1 | F6 | dark | 5 | 4 | 6 | low |
| 44 | `spacex` | SpaceX | F9 | F7 | dark | 2 | 6 | 7 | low |
| 45 | `spotify` | Spotify | F8 | F10 | dark | 5 | 4 | 7 | low |
| 46 | `stripe` | Stripe | F3 | F4 | light+dark | 5 | 7 | 5 | low |
| 47 | `supabase` | Supabase | F1 | F4 | dark | 6 | 5 | 5 | low |
| 48 | `superhuman` | Superhuman | F2 | F4 | light+dark | 4 | 7 | 4 | low |
| 49 | `tesla` | Tesla | F9 | F2 | light+dark | 3 | 7 | 5 | medium |
| 50 | `together.ai` | Together AI | F5 | F6 | light | 4 | 5 | 7 | high |
| 51 | `uber` | Uber | F8 | F2 | light | 5 | 4 | 6 | low |
| 52 | `vercel` | Vercel | F1 | F2 | light+dark | 5 | 7 | 3 | low |
| 53 | `voltagent` | VoltAgent | F1 | F5 | dark | 6 | 5 | 6 | medium |
| 54 | `warp` | Warp | F1 | F8 | dark | 5 | 5 | 4 | low |
| 55 | `webflow` | Webflow | F6 | F10 | light | 5 | 5 | 7 | low |
| 56 | `wise` | Wise | F3 | F8 | light | 5 | 5 | 6 | low |
| 57 | `x.ai` | xAI | F1 | F5 | dark | 5 | 7 | 4 | low |
| 58 | `zapier` | Zapier | F10 | F8 | light | 5 | 4 | 6 | low |

---

## 8. 免责声明

- 本文档与配套的 `brand-index.json`、`brand-specs/` **不是任何品牌的官方设计系统**。所有 `DESIGN.md` 均由 VoltAgent/awesome-design-md 从公开网站提取，整理者亦声明"不保证 100% 准确"。
- 所有品牌名称、商标、字体、配色 **归各自权利人所有**。本规则包仅作**设计风格参考与教育用途**，不得用于复制品牌资产、暗示官方关联，或制作易混淆的界面。
- 落地时的正确做法：把品牌当作**设计语汇的参考样本**（字重策略、留白节奏、描边方式、动效手感），而不是照抄其 logo、插画、文案与专有字体文件。
- 源仓库许可证：**MIT License**。品牌自身资产不在此许可范围内。
- 摘要：DESIGN.md 由公开网站提取，非官方设计系统，仅作风格参考。
