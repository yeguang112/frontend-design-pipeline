# 01b · 十个风格族详解（按需加载）

> 本文件只在 P1「已选定候选族」后加载，避免一次读入 10 个族的全部细节。
> 路由入口见 `01-brand-taxonomy.md` §1/§3；逐品牌数据见 `data/brand-index.json`。
## 十个风格族详解
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

