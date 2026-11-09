# 10 · 官方实现系统（Official Design Systems）

> P1 里的第二个岔路：**用谁的组件与行为**。
> `brand-specs/`（58 个品牌）回答「长得像谁」；`systems/`（官方系统）回答「用什么建」。
> 机器可读索引：`data/systems-index.json`。

---

## 1. 两种基座

| | 风格参考（brand-specs） | 官方实现系统（systems） |
|---|---|---|
| 本质 | 从公开网站提取的视觉语言 | 生产级组件库 + 行为 + 主题机制 |
| 提供 | 配色/字体/间距/组件外观描述 | 组件、可访问性、状态、主题 token、CLI |
| 适合 | 营销页、品牌站、概念稿 | 应用、后台、控制台、工具型产品 |
| 改造方式 | 抄语言、换成自己的内容 | 换主题 / 改 token，不 fork 组件 |
| 风险 | 近似值有偏差 | 版本升级、框架绑定、Beta |

**可以叠加**：应用内页用官方系统，营销页用品牌参考；共享同一份 `frontend-guidelines.md`。

## 2. P1 的选择顺序

```text
1. 产物是应用/后台/工具，且团队用 React？        → 官方系统（Astryx）
2. 产物是营销/品牌/内容页？                       → 风格参考（brand-specs 的族 + 品牌）
3. 两者都有？                                     → 分表面处理，同一套 token 命名
4. 非 React 应用？                                → 只借官方系统的 token（不借组件）
```

写进 Design Read：

```text
实现基座：Astryx v0.7.11 + neutral（或 品牌参考 F1 + Linear）
```

## 3. Astryx by Meta（已收录）

| 项 | 值 |
|---|---|
| 来源 | [meta/astryx](https://github.com/meta/astryx)，2026-06 开源 |
| 许可 | MIT（保留版权头与 `systems/astryx/LICENSE`） |
| 成熟度 | Meta 内部 8 年、13,000+ 应用；开源为 **Beta 0.7.x** |
| 技术 | React 19+ / StyleX；消费侧可用普通 CSS/Tailwind |
| 规模 | 204 个组件导出；491 个 CSS 变量声明（314 唯一 token） |
| 主题 | 8 个主题包（neutral/stone/gothic/matcha/butter/y2k/chocolate/probe），token 级切换 |
| 入口 | [`systems/astryx/DESIGN.md`](../systems/astryx/DESIGN.md) · [`ADAPTER.md`](../systems/astryx/ADAPTER.md) · [`manifest.json`](../systems/astryx/manifest.json) |

**它为什么值得收**：

1. **默认就反 AI 味**：neutral 主题的强调色是近黑 `#111`，不是紫蓝渐变；有 8 年生产环境打磨的组件状态。
2. **token 即契约**：所有视觉值都是 CSS 自定义属性，和本流程「tokens 是数值真相」天然一致。
3. **agent 友好**：官方自带 `AGENTS.md`、组件 `api-report`、CLI 文档，组件清单可直接喂给 agent。
4. **主题在 token 层**：品牌化不需要 fork 组件，符合本流程「组件先定死、只引用」。

**它不适合**：纯营销站、需要完全自定义视觉的产品、非 React 且要求组件级复用。

## 4. 接入步骤（简版，详见 ADAPTER）

```text
1. 读 systems/astryx/DESIGN.md + manifest.json（版本/许可/能力）
2. 在 guidelines 里写死：基座 Astryx <version> + <theme>；组件只从 components.json 选
3. P3：HTML 引入 systems/astryx/tokens/astryx-tokens.css，用 token 组合页面
4. P4：冻结（不变）
5. P5：项目 tokens = Astryx token 别名层；组件契约映射到 Astryx 组件名
6. P7：drift 检查「业务代码不得引入 Astryx 之外的新色板」
7. P8：A1–A17 不变
```

## 5. 主题与品牌

- **换主题**：`node systems/astryx/sync.mjs --theme stone`（重新生成快照），或项目里直接 import 对应 npm 主题包。
- **改 token**：项目层覆盖语义 token（`[data-astryx-theme]` 作用域），不动组件源码。
- **禁止**：fork 组件后大面积覆盖；自建第二套 token 与 Astryx 并行；把主题色当品牌色乱用。

## 6. 同步、升级与回滚

```bash
node systems/astryx/sync.mjs                 # 联网同步最新
node systems/astryx/sync.mjs --version X.Y.Z # 锁版本
node systems/astryx/sync.mjs --skip-download # 用缓存离线重生成
```

- 升级 = 先看 tokens diff（`git diff systems/astryx/`），有破坏性变更走 CR 并重冻结。
- 回滚 = `git checkout <tag> -- systems/astryx` + 重跑冻结校验。
- Beta 期锁版本；升级前读上游 CHANGELOG。

## 7. 与反面清单的关系

Astryx 覆盖了大部分组件级反面项（状态、焦点、对比度、暗色），但**不豁免**本项目的反面清单：

- 仍然禁止：在 Astryx 之上加紫色渐变/玻璃/大圆角卡片等「AI 味」覆盖。
- 仍然要求：一屏一个焦点、token-only、无 emoji 图标、无假数据、无提示词泄漏。
- Astryx 的 `neutral` 主题本身很克制，但**主题选择**也要过 P2：用 `butter`/`y2k` 并不等于适合所有产品。

## 8. 后续可收录的官方系统（候选）

| 系统 | 许可 | 适用 |
|---|---|---|
| Radix Themes | MIT | React，快速应用底座 |
| Fluent UI | MIT | 微软生态 / 企业应用 |
| IBM Carbon | Apache-2.0 | 数据密集型企业应用 |
| Shopify Polaris | MIT | 电商后台 |
| GOV.UK Frontend | MIT | 公共服务 / 无障碍优先 |

收录标准：**官方 token 可机器读取 + 许可证允许再分发 + 有稳定组件清单**。新增时按 `systems/README.md` 的包结构落地，并在 `data/systems-index.json` 登记。

## 9. 许可与免责

- Astryx 为 MIT；快照保留版权头与 `LICENSE`。品牌、商标、官方文档归 Meta。
- 本仓库只做 token 快照与摘要，**不是官方文档**；以官方站点与仓库为准。
- 不得暗示 Meta 背书；不得把 Astryx 组件截图当营销素材。
