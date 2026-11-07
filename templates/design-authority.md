# Design Authority · <项目名>

> 本文件回答一个问题：**当多处信息冲突时，以谁为准？**
> 任何涉及 UI 的会话/任务开始，先读本文件，再按读取顺序加载。

## 1. 权威源

| 层 | 文件 | 版本 | 状态 |
|---|---|---|---|
| 规则 | `design/frontend-guidelines.md` | v1.0 | signed |
| 数值 | `design/tokens/tokens.css` / `tokens.json` | v1 | frozen |
| 组件 | `design/components.md` | v1 | active |
| 视觉 | `design/frozen/index.html` + `freeze-manifest.json` | v1.0 | frozen |

- 冻结时间：YYYY-MM-DD
- 冻结哈希：见 `freeze-manifest.json`
- 批准：用户（原话记录于 `decision-log.md`）

## 2. 读取顺序

1. 本文件（3 条不可协商项）
2. `frontend-guidelines.md` §4 正面清单 + §5 反面清单
3. `tokens/tokens.css`（可用值）
4. `components.md`（可用组件）
5. `frozen/index.html`（视觉真相，仅在需要确认具体做法时打开）
6. `decision-log.md` 最近 3 条

## 3. 冲突裁决

> 唯一权威表在 `references/02-guidelines-spec.md` §7；此处只复述结论，不要另立一套。

```
用户当次明确指令 > 冻结 HTML（视觉） > tokens（数值） > guidelines（文字） > 品牌参考
```

- 代码值与 tokens 不一致 → 改代码，不改 tokens。
- 规则文字与冻结稿不一致 → 改规则文字，不影响冻结稿。
- 品牌参考与 guidelines 冲突 → 以 guidelines 为准。
- 发现 2/3 层冲突 → 必须改其中一方并升版本，禁止并存。

## 4. 不可协商（Guardrails）

- 一个强调色，只用于主 CTA 与选中态，一屏 ≤2 处。
- 不使用渐变（品牌规范明确指定的平面色除外）。
- 不使用玻璃/模糊材质。
- 圆角只允许 6 / 10 / 14 / 999 四档。
- 组件只来自 `components.md`，禁止自造。
- 动效只有 200ms 进入 / 140ms 退出 / `--ease-standard`。

## 5. 设计指纹（漂移比对用）

```json
{
  "accent": "#2563eb",
  "bg": "#ffffff",
  "fg": "#111113",
  "fontDisplay": "Geist",
  "fontBody": "Geist",
  "radiusCard": "14px",
  "buttonHeightMd": "40px",
  "dials": { "variance": 5, "motion": 3, "density": 6 },
  "signature": ["单强调色", "实底卡片", "负字距标题", "无渐变"]
}
```

> 指纹变化 = 方向变化，必须走 CR 并说明原因。

## 6. 冻结后修改

- `design/frozen/**` 只读。
- 任何视觉修改走 `change-request/CR-<n>.md` → 用户批准 → 改 `prototype/` → 重冻结 → 升版本。
- 允许的派生：tokens 提取、组件实现、跨端适配——不得改变视觉结果。
