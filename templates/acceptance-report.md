# 验收报告 · <项目> · <YYYY-MM-DD> · <版本/commit>

## 结论：PASS / FAIL

| ID | 项 | 结果 | 证据 |
|---|---|---|---|
| A1 | 截图齐全 | PASS | 42/42 |
| A2 | 截图非空 | PASS | 最小 18KB |
| A3 | 尺寸正确 | PASS | 与配置一致 |
| A4 | 像素 diff ≤0.3% | PASS | 最大 0.12% |
| A5 | token 一致性 | PASS | drift error 0 |
| A6 | 计算样式 ⊆ token | PASS | 违规 0 |
| A7 | 对比度 AA | PASS | 最小 4.8:1 |
| A8 | 无横向溢出 | PASS | 三档 OK |
| A9 | 无 console error | PASS | 0 |
| A10 | 状态覆盖 | PASS | 缺项 0 |
| A11 | 交互脚本 | PASS | 8/8 |
| A12 | 冻结未篡改 | PASS | sha256 一致 |
| A16 | 无提示词泄漏 | PASS | `check-copy` error 0 |
| A17 | 无 <12px 小字 | PASS | `check-copy` tiny-text 0 |

> 跨端验收时追加 A13 安全区 / A14 触控热区 ≥44×44 / A15 系统字号 1.3× 不破版（见 `09-handoff.md`）。

## 失败详情

### <ID> · <文件>
- 现象：
- 定位（区域/选择器）：
- 原因：
- 修复：
- 复验：<命令 + 结果>

## 截图清单

| route | state | viewport | theme | 文件 | 结果 |
|---|---|---|---|---|---|
| home | default | 1440x900 | light | `screenshots/home--default--1440x900--light.png` | PASS |
| … | | | | | |

## 主观项（待用户签收）

- [ ] 品牌感/氛围符合 `frontend-guidelines.md` §1
- [ ] 文案语气合适
- [ ] 无「说不上来的 AI 味」

## 备注

- 环境：<浏览器/版本/DSR/字体>
- 已知差异（可接受）：<…>
- 下一步：<…>
