# 组件验证文档 · <项目名>

> 每个组件 × 每个状态 × 每档视口 的实际渲染验证记录。
> 与 `components.md`（契约）配套：契约规定「应该长什么样」，本文档证明「确实长这样」。

## 汇总

| 组件 | 契约版本 | 状态覆盖 | 截图 | 结论 |
|---|---|---|---|---|
| button | v1 | 6/6 | 3 | PASS |
| input | v1 | 5/5 | 3 | PASS |
| card | v1 | 2/2 | 2 | PASS |
| tabs | v1 | 5/5 | 3 | **FAIL**（无 focus 态） |
| modal | v1 | 4/4 | 2 | PASS |

## 验证项（每个组件都查）

| # | 项 | 判定 |
|---|---|---|
| C1 | 尺寸 = 契约（高度/内边距/图标） | 计算样式与契约一致 |
| C2 | 颜色全部来自 token | 无裸值；drift=0 |
| C3 | 圆角 = 契约 | 计算样式一致 |
| C4 | 字体 token 正确（家族/字号/字重/行高） | 计算样式一致 |
| C5 | 状态齐全（default/hover/focus/active/disabled/loading） | 缺项 0 |
| C6 | 键盘可达 + 可见焦点 | Tab 走查截图 |
| C7 | 对比度 AA | ≥4.5:1（大字 ≥3:1） |
| C8 | 跨端映射存在且视觉一致 | handoff 记录 + 端上截图 |
| C9 | 无禁止用法 | 对照契约「禁止」段 |
| C10 | loading 不引起布局跳动 | 前后宽度一致 |

## 明细

### button · v1
- 契约：高度 sm32 / md40 / lg48，radius 10，padding 12/16/20
- 截图：`acceptance/reference/button--default--desktop.png` 等
- 结果：

| # | 项 | 结果 | 证据/备注 |
|---|---|---|---|
| C1 | 尺寸 | PASS | 40×110 |
| C2 | 颜色 | PASS | `--accent` / `--accent-on` |
| C5 | 状态 | PASS | 6/6 |
| C6 | 焦点 | PASS | 2px 轮廓 |
| C7 | 对比度 | PASS | 5.1:1 |
| C10 | loading | PASS | 宽度锁定 |

### tabs · v1
- 结果：**FAIL**
- 失败项：C5（缺 focus 态）、C6（键盘左右键不切换）
- 修复：补 `:focus-visible` + `keydown` 左右键；重出 3 态截图
- 修复后：PASS（见 `change-log.md` 2026-11-07）

## 签收

- 组件契约签收：用户（日期）
- 组件验证通过：AI 出报告 + 用户抽看 2 个组件
- 未通过组件不得进入业务页面使用
