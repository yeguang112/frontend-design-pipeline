# systems/ · 官方实现系统（Official Implementation Systems）

> `brand-specs/` 是**风格参考**（像谁）；`systems/` 是**实现基座**（用什么建）。
> 两者互补：风格参考决定方向，实现系统决定组件、行为、可访问性与主题机制。

## 目录

| id | 名称 | 版本 | 许可 | 类型 | 入口 |
|---|---|---|---|---|---|
| `astryx` | Astryx by Meta | 0.7.11 (Beta) | MIT | React 19 + StyleX，204 组件，token 级主题 | [`astryx/manifest.json`](astryx/manifest.json) |

## 一个 system 包必须有什么

```
systems/<id>/
├── manifest.json     # 来源 / 版本 / 许可 / 哈希 / 能力 / 适用与不适用
├── DESIGN.md         # 9 节设计语言摘要（人工维护，标注来源与版本）
├── ADAPTER.md        # 接入本流程的步骤与约束
├── LICENSE           # 上游许可证全文（MIT/Apache-2.0…）
├── tokens/           # token 快照（css + json），由 sync.mjs 生成
├── components/       # 组件清单（名称 + props 类型），由 sync.mjs 生成
└── sync.mjs          # 可再生：拉取上游 → 重新生成 tokens/manifest
```

## 新增一个 system

1. 确认许可证允许再分发（MIT / Apache-2.0 / BSD；GPL 需谨慎）。
2. 在 `schemas/system.manifest.json` 的约束下写 `manifest.json`（source、version、license、files、whenToUse、notFor）。
3. 优先用上游官方 token 构建产物（CSS variables / design tokens JSON），不要手抄文档里的值。
4. 写 `DESIGN.md` + `ADAPTER.md`，在 `references/10-official-systems.md` 与 `data/systems-index.json` 登记。
5. 加 sync 脚本与 CI 校验（manifest 合法、tokens 非空、哈希匹配）。

## 边界

- 不复制上游组件源码；只快照 token 与组件清单（除非许可证与体积都允许）。
- 不声称快照是官方文档；版本、来源、许可必须可追溯。
- 品牌商标归各自所有者，不得暗示背书。
