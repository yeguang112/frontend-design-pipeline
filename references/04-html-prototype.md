# 04 · HTML 静态稿：打磨、冻结与变更请求

> 为什么先 HTML：无构建、可直接截图、可 diff、可跨端当视觉参照、可被任何 agent 读取。
> 这一阶段的产物会从「可改的工作稿」变成「只读的设计权威源」——**冻结是整条链路的分水岭**。

---

## 1. 工作区与冻结区

| 区域 | 路径 | 状态 | 谁可改 |
|---|---|---|---|
| 工作区 | `prototype/` | 可改、可删 | AI + 用户 |
| 冻结区 | `design/frozen/` | **只读** | 只有变更请求（CR）流程 |

冻结 = 复制工作区 + 生成 `freeze-manifest.json`（sha256 + bytes）+ 写 `design-authority.md` 声明。
**冻结后任何修改都必须走 CR；直接改冻结文件视为事故。**

---

## 2. 静态稿规范（P3 验收标准）

### 2.1 文件结构

```
prototype/
├── index.html          # 单文件多屏（hash 路由），内联 <style>，无外部依赖
├── assets/             # 本地图片/字体/图标（不许外链）
└── screens/*.html      # 可选：屏数很多时拆分，共享 tokens.css
```

- **默认单文件**：`index.html` 内联 CSS + 少量 JS（路由/状态切换）。好处：冻结后单文件自包含、截图稳定、跨端参考方便。
- 屏数 > 8 或需要并行开发时，才拆 `screens/` + 共享 `tokens.css`。
- **禁止**：CDN 引用、外部字体链接、构建步骤、框架运行时。

### 2.2 必须实现的内容

| 维度 | 要求 |
|---|---|
| 屏/路由 | guidelines §6 列出的每一屏都要有；`#/route` 可直达 |
| 状态 | 每个交互组件：default / hover / focus-visible / active / disabled / loading；数据区：loading / empty / error |
| 主题 | 若声明双主题，两套都要实现且可切换（`data-theme`） |
| 响应式 | 至少 1440 / 768 / 390 三档；无横向溢出 |
| 内容 | 真实文案（不可 lorem）；图片本地化；占位必须标 `data-placeholder` |
| 动效 | 有 reduced-motion 分支；时长/曲线来自 token |
| 可访问性 | 语义标签、可见焦点、AA 对比度、alt |

### 2.3 文案分层（三层，不要混）

| 层 | 写什么 | 放哪 | 示例 |
|---|---|---|---|
| **用户可见文案** | 产品要传达给用户的内容 | 页面文本 / `alt` / `placeholder` | 「本地文件，不上传」 |
| **占位标注** | 明确告诉用户这是示例 | 页面内，必须带「（示例数据）」 | 「本周 12 次（示例数据）」 |
| **工程注释** | 用户的修改要求、AI 的执行说明、设计理由、参考来源、TODO | **HTML 注释 / `data-*` / change-log** | `<!-- design: 用户要求「冷一点」→ 降低强调色使用；VARIANCE=6 -->` |

硬规则：
1. **任何来自提示词/对话的说明，不得出现在页面上。** 包括 `alt`、`title`、`placeholder`、`aria-label`。
2. 注释统一前缀：`<!-- design: … -->`（设计决策）、`<!-- copy: … -->`（文案待办）、`<!-- todo: … -->`（工程待办）。
3. 需要让机器读的说明用隐藏属性：`data-design-note="…"`（不渲染）。
4. 交付前跑 `node scripts/check-copy.mjs <prototype/>`，error 必须为 0。

**反例**（一眼 AI）：
```html
<p class="hint">说明：这里采用非对称分栏，参考自 Linear。</p>
<p>备注：示例数据，仅供参考。</p>
<!-- 正确写法 -->
<!-- design: 非对称分栏（VARIANCE=6）；参考 Linear 的紧凑排版，不复制其文案 -->
<p>本周 12 次（示例数据）</p>
```

### 2.4 代码规范

- 所有视觉值来自 `:root` 的 CSS 变量；工作区阶段可以先内联变量，**冻结前必须与 tokens 对齐**。
- 一个页面一个 `data-od-id`（给区块命名，便于截图与评论定位）。
- 状态用 class 切换（`.is-open` / `[data-state]`），不要靠 JS 内联样式。
- 注释标注「参考品牌 + keep 的维度」，便于追溯。

#### 两条合法路径（避免「先冻结还是先 token」的循环）

| 路径 | 顺序 | 适用 | 代价 |
|---|---|---|---|
| **A · 直写 token** | 先建 `tokens.css`（从模板改）→ 用变量写 HTML → 冻结 | 有明确品牌规范/团队已有 token | 前期要决策，返工少 |
| **B · 冻结后再提取** | 先写 HTML（内联值）→ 冻结 v1.0 → 提取 tokens → 人工审校 → 回填变量 → 重冻结 v1.1 | 视觉探索阶段、需求未定 | 要冻结两次 |

两条都合法，但**同一次交付不能混用**：走 B 时，v1.0 的 manifest 要标注 `tokens_backfilled: false`，v1.1 才作为最终权威。

---

## 3. 打磨循环（≤3 轮，之后必须问用户）

```text
生成 v1 静态稿
  → 截图（桌面 1440 / 移动 390）
  → 自检：正面清单逐条 + 反面清单 P0 逐条
  → 修
  → 再截图对比
  → 3 轮后仍有主观不确定 → 停下来问用户，禁止继续盲改
```

自检清单（每轮都跑）：
1. 正面清单 MUST-* 全过？（逐条勾）
2. 反面清单 P0 全过？`detect-drift.mjs` error = 0？
3. 三档视口无溢出、无破版？
4. 状态可切换且截图得到？
5. 对比度 AA？
6. reduced-motion 生效？

> 打磨的目标不是「更好看」，而是「更贴合 guidelines + 更少事故」。主观审美留给用户。

---

## 4. 冻结协议（P4）

### 4.1 前置

- [ ] 用户明确签收静态稿（「就这版 / 冻结 / 可以了」）
- [ ] guidelines 已 v1.0 signed
- [ ] `detect-drift.mjs` error = 0
- [ ] 三档视口 + 全状态截图已存 `acceptance/reference/`

### 4.2 执行（脚本或手工）

```bash
# 1) 复制工作区
robocopy prototype design\frozen /E

# 2) 生成哈希清单（scripts/verify-freeze.mjs --write）
node scripts/verify-freeze.mjs --write design/frozen --out design/frozen/freeze-manifest.json

# 3) 校验
node scripts/verify-freeze.mjs design/frozen/freeze-manifest.json --base design/frozen
# 期望 exit 0，输出 PASS
```

`freeze-manifest.json` 格式：

```json
{
  "version": 1,
  "frozen_at": "2026-11-07T12:00:00+08:00",
  "approved_by": "user",
  "guidelines_version": "1.0",
  "files": {
    "index.html": {"sha256": "…", "bytes": 48213},
    "assets/hero.webp": {"sha256": "…", "bytes": 120345}
  }
}
```

### 4.3 声明 `design-authority.md`

冻结后立即写，内容：

```md
# Design Authority
- 权威源：design/frozen/（v1.0，2026-11-07 冻结，sha256 见 freeze-manifest.json）
- 读取顺序：frontend-guidelines.md → tokens/tokens.css → components.md → frozen/index.html（视觉真相）
- 冲突裁决：冻结 HTML > tokens > guidelines 文字 > 品牌参考
- 冻结后修改：必须提交 change-request.md，用户批准后重冻结并升版本
- 允许的派生：tokens / 组件实现 / 跨端适配，不得改变视觉结果
```

### 4.4 冻结后的三条禁令

1. 不许直接编辑 `design/frozen/**`。
2. 不许在实现里「顺手优化」视觉（那等于绕过冻结）。
3. 不许用「最新版设计稿」替代冻结稿——视觉问题回 CR，不回记忆。

---

## 5. 变更请求（CR）流程

任何冻结后的视觉修改：

```text
1. 写 design/change-request/CR-<n>.md
   - 现状（引用冻结文件 + 行/区块）
   - 要改成什么（截图/描述）
   - 影响面：token？组件？布局？文案？跨端？
   - 风险与回滚
2. 用户批准（口头即可，但记录原文）
3. 改 prototype/（不是 frozen/）
4. 重新走 P3 自检 + 截图
5. 重新冻结（版本 v1.1），更新 manifest 与 design-authority
6. 同步 tokens / components（若影响）
```

**什么走 CR、什么不走**：

| 改动 | 走 CR？ | 说明 |
|---|---|---|
| 颜色/字号/圆角/间距的**值** | ✅ | 影响 token，必须 |
| 新增组件 | ✅ | 先补 components.md |
| 布局结构调整 | ✅ | 影响视觉真相 |
| 文案 | ❌（记录即可） | 不改变视觉规则时 |
| 纯 bug 修复（对齐错、溢出） | ❌（记录） | 修完截图，不改规则 |
| 跨端实现细节 | ❌ | 只要视觉结果一致 |

---

## 6. 常见事故

| 事故 | 后果 | 预防 |
|---|---|---|
| 冻结前没跑 drift | 把违规带进权威源 | 冻结门禁 = drift 0 error |
| 冻结后直接改 HTML | 所有截图验收失效 | 只读 + CR |
| 工作区与 tokens 不一致 | 提取出的 token 是错的 | 冻结前用 tokens 替换内联值，再冻结 |
| 单文件太大无法维护 | 后续改动易破版 | > 8 屏拆分 + 共享 tokens.css |
| 截图依赖动画中间态 | 验收不稳定 | 截图前冻结动画（见 08） |
