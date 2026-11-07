# CR-<n> · <一句话标题>

- 日期：YYYY-MM-DD
- 提出：AI / 用户
- 状态：proposed / approved / rejected / applied
- 关联版本：guidelines v<x> → v<y>；frozen v<a> → v<b>

## 1. 现状

- 涉及文件：`design/frozen/index.html`（区块 `<data-od-id>` / 行号）
- 现状截图：`acceptance/reference/<…>.png`
- 问题描述：<客观描述，不用「不好看」>

## 2. 期望改动

- 改什么：<颜色/字号/间距/组件/布局/文案>
- 改成什么：<具体值或截图；若引用 token，写 token 名>
- 参考：<品牌规范 / 用户截图 / 链接>

## 3. 影响面

| 维度 | 是否影响 | 说明 |
|---|---|---|
| token | 是/否 | 新增/修改/删除：… |
| 组件契约 | 是/否 | 哪个组件、哪个变体 |
| 布局 | 是/否 | 哪些屏 |
| 跨端 | 是/否 | web / app / mini-program 同步 |
| 文案 | 是/否 | … |

## 4. 风险与回滚

- 风险：<例如「主 CTA 对比度下降」>
- 回滚：<恢复 frozen 版本 + 重新冻结>

## 5. 批准

- 用户原话：「…」
- 批准时间：
- 执行人：AI
- 复验方式：<drift + 截图 diff + 矩阵>

## 6. 执行记录

- [ ] 改 `prototype/`
- [ ] 跑 P3 自检 + 截图
- [ ] 重冻结（manifest 更新）
- [ ] 更新 `design-authority.md` 版本
- [ ] 同步 tokens / components
- [ ] 写 `change-log.md`
