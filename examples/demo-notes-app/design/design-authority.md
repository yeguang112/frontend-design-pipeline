# Design Authority · DevNotes

> 本文件回答：**多处信息冲突时以谁为准**。任何涉及 UI 的会话先读本文件。

## 1. 权威源

| 层 | 文件 | 版本 | 状态 |
|---|---|---|---|
| 规则 | `design/frontend-guidelines.md` | v1.0 | signed |
| 数值 | `design/tokens/tokens.css` / `tokens.json` | v1 | frozen |
| 组件 | `design/components.md` | v1 | active |
| 视觉 | `design/frozen/index.html` + `freeze-manifest.json` | v1.7 | frozen |

- 冻结时间：2026-11-07T12:05Z
- 冻结哈希：见 `freeze-manifest.json`（3 文件 PASS）
- 批准：演练自演（见 `decision-log.md`）

## 2. 读取顺序

1. 本文件（不可协商项）
2. `frontend-guidelines.md` §4 正面清单 + §5 反面清单
3. `tokens/tokens.css`（可用值）
4. `components.md`（可用组件）
5. `frozen/index.html`（视觉真相，仅在确认具体做法时打开）
6. `decision-log.md` 最近 3 条

## 3. 冲突裁决

> 唯一权威表在 `references/02-guidelines-spec.md` §7；此处只复述结论。

```
用户当次明确指令 > 冻结 HTML（视觉） > tokens（数值） > guidelines（文字） > 品牌参考
```

- 代码值与 tokens 不一致 → 改代码，不改 tokens。
- 规则文字与冻结稿不一致 → 改规则文字，不影响冻结稿。
- 发现 2/3 层冲突 → 必须改一方并升版本，禁止并存。

## 4. 不可协商（Guardrails）

- 一个强调色（靛紫 `--accent`），只用于主 CTA 与选中态，一屏 ≤2 处；**只作平面，不做渐变**。
- 不使用渐变、发光、玻璃/模糊材质。
- 圆角只允许 `--radius-xs/sm/md/lg/full`，不出现 16px 以上非体系值。
- 组件只来自 `components.md`，禁止自造。
- 动效只有 `--dur-enter` 200ms / `--dur-exit` 140ms / `--ease-standard`；有 reduced-motion 分支。
- 深色为原生主题，浅色是配套主题（两套 token，不另做设计）。

## 5. 设计指纹

```json
{
  "accent": "#5e6ad2",
  "bg": "#08090a",
  "fg": "#f7f8f8",
  "fontDisplay": "InterVar",
  "fontBody": "InterVar",
  "radiusCard": "12px",
  "buttonHeightMd": "36px",
  "dials": { "variance": 6, "motion": 3, "density": 6 },
  "signature": ["近黑画布", "半透明描边", "单一靛紫平面强调", "负字距大标题", "mono 元信息"]
}
```

指纹变化 = 方向变化，必须走 CR 并说明原因。

## 6. 冻结后修改

- `design/frozen/**` 只读。
- 视觉修改走 `design/change-request/CR-<n>.md` → 批准 → 改 `prototype/` → 重冻结 → 升版本。
- 允许的派生：tokens 提取、组件实现、跨端适配——不得改变视觉结果。
