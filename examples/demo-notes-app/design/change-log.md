# Change Log · DevNotes

> 演练期间的 UI 改动记录。八项矩阵 = 布局 / token / 字体 / 交互 / 图标 / 内容 / 无障碍 / 性能。

## 2026-11-07 11:20 · 全局（v0.9 → v1.0）
- 改动：按用户反馈去掉 hero 的紫色渐变 + 玻璃卡片，改为近黑实底 + 半透明描边
- 影响面：token 有（新增 `--border-subtle`、删除 2 个渐变 token）；组件 card 变体调整（CR-000）
- 类型：值变更(CR)
- 矩阵：布局✅ token✅ 字体✅ 交互✅ 图标✅ 内容✅ a11y✅ 性能✅
- 验证：drift 的 `ai-purple-gradient`=0、`glassmorphism`=0；重冻结 v1.0
- 备注：这是 decision-log v0.2→v0.3 的落地

## 2026-11-07 11:40 · 笔记列表
- 改动：补 empty / loading / error 三态（原先只有默认列表）
- 影响面：无 token 变更；新增 `state-block` 与 `skeleton` 两个组件
- 类型：组件变更(CR)
- 矩阵：布局✅ token✅ 字体✅ 交互✅ 图标✅ 内容✅ a11y✅ 性能✅
- 验证：`window.__setState` 三态截图；A10 状态覆盖 PASS
- 备注：空态提供「新建笔记」动作，错误态提供 Retry

## 2026-11-07 12:03 · 设置页
- 改动：补表单错误态 + 删除确认 modal + 保存 loading/saved 状态
- 影响面：无 token 变更；`modal` / `input` 补 error 态
- 类型：样式微调
- 矩阵：布局✅ token✅ 字体✅ 交互⚠️（I6 modal 焦点回归失败）图标✅ 内容✅ a11y⚠️（I11 焦点环）性能✅
- 验证：`probe-report` computedViolation=0、contrast=0、console=0；`interaction-report` 9/13
- 备注：4 条交互失败已记入 `acceptance/acceptance-report.md`，待 CR-001 修复

## 2026-11-07 12:05 · 冻结 v1.7
- 改动：冻结静态稿（3 文件 sha256）
- 影响面：无视觉变更
- 类型：冻结
- 验证：`verify-freeze` PASS 3/3；`capture-acceptance` 36 张
- 备注：冻结后任何视觉修改走 CR
