# 验收报告 · DevNotes · 2026-11-07 · freeze v1.7

## 结论：**FAIL**（A11 交互未过；其余通过）

> 本报告是「规则包 + 工具链」的真实演练产物：所有数字来自脚本输出，不臆造。
> 失败项是这次演练**真实抓到的缺陷**——这正是客观验收的价值。

| ID | 项 | 结果 | 证据 |
|---|---|---|---|
| A1 | 截图齐全 | PASS | 36 张（dark 24 + light 12） |
| A2 | 截图非空 | PASS | 最小 18.8 KB，非纯色 |
| A3 | 尺寸正确 | PASS | 1440×900 / 768×1024 / 390×844（DSR=1，控制仓库体积；正式项目建议 DSR=2） |
| A4 | 像素 diff ≤0.3% | PASS | reference 与 screenshots 同一批，0.00% |
| A5 | token 一致性 | PASS | drift total=0（error/warn/info 均 0） |
| A6 | 计算样式 ⊆ token | PASS | `probe-report` computedViolationTotal=0（34 次测量） |
| A7 | 对比度 AA | PASS | contrastFailureTotal=0 |
| A8 | 无横向溢出 | PASS | overflowFail=0（三档） |
| A9 | 无 console error | PASS | consoleErrorTotal=0 |
| A10 | 状态覆盖 | PASS | 8 组合 dark + 4 组合 light，`window.__setState` 全生效 |
| A11 | 交互脚本可执行 | **FAIL** | 9/13 通过，4 条失败（见下） |
| A12 | 冻结未篡改 | PASS | 3/3 sha256 一致 |
| A16 | 无提示词泄漏 | PASS | `check-copy` error 0（可见文案无说明/参考/演示字样） |
| A17 | 无 <12px 小字 | PASS | `check-copy` tiny-text 0（最小 12px） |

## A11 失败详情

| id | 用例 | 现象 | 定位 | 修复建议 |
|---|---|---|---|---|
| I6 | modal 打开 / ESC 关闭 / 焦点回归 | `modalOpen=false`、`focusReturned=false` | `#modal-backdrop` 的 `hidden` 属性与 rAF 时序 | 打开时 `requestAnimationFrame` 后聚焦第一个可聚焦元素；关闭后 `focus()` 回触发按钮 |
| I11 | Tab 后首个可聚焦元素有 2px outline | 首个 Tab 落在 BODY，`outlineStyle:none` | 页面首个可聚焦元素是 skip-link，测试起点未从 body 开始 | 测试前 `document.body.focus()`；或给 skip-link 补可见焦点样式 |
| I12 | 移动端菜单展开/收起 | `navOpen=false` | `.nav-toggle` 点击后 `aria-expanded` 未同步 | 统一用 `aria-expanded` 驱动 `.mobile-nav.is-open` |
| I13 | 主 CTA hover 背景 = `--accent-hover` | 实际 `rgb(94,106,210)`（=`--accent`） | `.btn-primary:hover` 未覆盖背景 | 加 `.btn-primary:hover{background:var(--accent-hover)}` |

> 4 条都是**实现缺陷**，不是测试幻觉；修完应重跑 `interaction` + `capture` 并升 freeze v1.8（走 CR）。

## 截图清单（节选）

| route | state | viewport | theme | 文件 | 结果 |
|---|---|---|---|---|---|
| home | default | 1440x900 | dark | `screenshots/home/default--1440x900--dark.png` | PASS |
| home | default | 390x844 | dark | `screenshots/home/default--390x844--dark.png` | PASS |
| notes | default | 1440x900 | dark | `screenshots/notes/default--1440x900--dark.png` | PASS |
| notes | empty | 1440x900 | dark | `screenshots/notes-empty/default--1440x900--dark.png` | PASS |
| notes | loading | 1440x900 | dark | `screenshots/notes-loading/default--1440x900--dark.png` | PASS |
| notes | error | 1440x900 | dark | `screenshots/notes-error/default--1440x900--dark.png` | PASS |
| settings | form-error | 1440x900 | dark | `screenshots/settings-form-error/default--1440x900--dark.png` | PASS |
| settings | modal | 1440x900 | dark | `screenshots/settings-modal/default--1440x900--dark.png` | PASS |
| home | default | 1440x900 | light | `screenshots-light/home/default--1440x900--light.png` | PASS |

完整清单见 `acceptance/screenshots/manifest.json` 与 `acceptance/capture-manifest-light.json`。

## 主观项（待用户签收）

- [ ] 品牌感/氛围是否符合 `frontend-guidelines.md` §1（冷峻、克制、精密）
- [ ] 文案语气是否像「给工程师的本地工具」
- [ ] 是否还有「说不上来的 AI 味」

## 环境

- 浏览器：本机 Chromium headless（CDP），DSR=1（演练为控制截图体积；正式验收建议 DSR=2）
- 字体：本地 `design/frozen/assets/fonts/Inter-roman-latin*.woff2`
- 动画：截图前注入 `animation:none;transition:none`，并启用 `prefers-reduced-motion`
- 生成时间：2026-11-07T12:03–12:05Z

## 下一步

1. 修 I6 / I11 / I12 / I13（详见上表），走 CR-001。
2. 重跑 `capture` + `interaction` + `probe`，重冻结 v1.8。
3. 主观项交用户签收后，按 `09-handoff.md` 映射到 App / 小程序。
