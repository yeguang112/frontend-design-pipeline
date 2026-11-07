# 09 · 跨端交付：HTML 原型 → App / 小程序

> 冻结 HTML 的第二个用途：**当 App / 小程序的原型参考**。
> 规则一句话：**视觉结果不变，只换单位与交互习惯。**

---

## 1. 交付物

```
design/handoff/
├── screen-map.md            # HTML 路由 → App 页面 / 小程序页面 映射
├── component-map.md         # Web 组件 → RN / 小程序 / Flutter 组件映射
├── platform-overrides.md    # 平台差异（安全区、导航栏、手势、字号缩放）
└── prototype-link.md        # 冻结 HTML 的本地访问方式（给设计与开发对照）
```

冻结 HTML 本身就是「可点击原型」：不要在 App 里重新设计一遍，只做映射。

---

## 2. screen-map.md 格式

| HTML route | App 页面 | 小程序页面 | 导航关系 | 备注 |
|---|---|---|---|---|
| `#/home` | HomeScreen | `pages/home/index` | tab 1 | 首屏 |
| `#/notes` | NotesListScreen | `pages/notes/index` | tab 2 | 列表 + 空态 |
| `#/settings` | SettingsScreen | `pages/settings/index` | 我的 → 设置 | 表单 |

必须标注：
- 哪些屏是 tab、哪些是栈内页、哪些是模态。
- 哪些状态要单独做页面（空态/错误态通常内嵌，不做独立页）。

---

## 3. 单位换算（唯一允许的差异）

| 设计值 | Web | iOS | Android | RN | 小程序 |
|---|---|---|---|---|---|
| 16px | 16px | 16pt | 16dp | 16 | 16px（字号）/ 32rpx（间距，750 设计宽） |
| 1px 边框 | 1px | 1pt | 1dp | 1 | 1rpx |
| 圆角 14px | 14px | 14 | 14 | 14 | 28rpx |

规则：
1. **字号不用 rpx**（会随屏宽缩放）；间距/尺寸可用 rpx。
2. 设计基准宽按 375 逻辑宽（750rpx）换算：`rpx = px × 2`。
3. 平台安全区、状态栏、导航栏高度单独加，不参与 token。
4. 图表/画布类组件按容器宽度自适应，不写死 px。

---

## 4. 交互习惯差异（必须适配，但不改视觉）

| Web | App | 小程序 |
|---|---|---|
| hover 反馈 | 无 hover，用 pressed 态 | `hover-class` 0.1s 背景变化 |
| 右键菜单 | 长按 / 更多按钮 | 长按 / 更多按钮 |
| 浏览器返回 | 系统返回手势 | 左上角返回 / 手势 |
| 焦点环 | 键盘焦点可见 | 一般无键盘，保留可访问性焦点 |
| 滚动 | 页面滚动 | 页面滚动 + 下拉刷新 |
| 弹窗 | 居中 modal | 底部 action sheet 优先 |
| Toast | 右上/顶部 | 居中 toast |

**视觉 token 不变**；只改交互反馈方式与弹层形态，并在 `platform-overrides.md` 记录。

---

## 5. 组件映射

| 契约组件 | Web | RN | 小程序 | Flutter |
|---|---|---|---|---|
| button | `<button>` | `<Pressable>` | `<button>`（重置默认样式） | `FilledButton` |
| input | `<input>` | `<TextInput>` | `<input>` / `<textarea>` | `TextField` |
| card | `<div>` | `<View>` | `<view>` | `Container` |
| tabs | `role=tablist` | 自建 / 库 | `<swiper>` + 自定义 tab | `TabBar` |
| modal | `<dialog>` | `<Modal>` | 自建遮罩层 | `showDialog` |
| toast | 自建 | `ToastAndroid`/自建 | `wx.showToast` | `SnackBar` |

要求：每个契约组件在实现端只有一个对应实现，**参数来自 token**，不允许在实现端改尺寸/颜色。

---

## 6. 落地验收

跨端验收与 Web 同标准，但截图矩阵换成设备尺寸：

| 端 | 视口 | 说明 |
|---|---|---|
| iOS | 390×844、430×932 | 刘海/灵动岛安全区 |
| Android | 412×915 | 状态栏 |
| 小程序 | 375×812、414×896 | 微信导航栏 |

检查项同 `08-acceptance.md` 的 A1–A12，另加：
- **A13 安全区**：内容不被刘海/Home 指示条遮挡。
- **A14 触控热区**：所有可点击元素 ≥44×44。
- **A15 字号缩放**：系统字体放大到 1.3× 不破版（或明确禁用缩放并说明）。

---

## 7. 反模式

- ❌ 在 App 里重新设计一套（视觉走样）。
- ❌ 直接把 Web 的 px 当 rpx 用（尺寸减半/翻倍）。
- ❌ 小程序里用 hover 效果（不生效）。
- ❌ 为了适配改 token 值（应在适配层换算）。
- ❌ 冻结 HTML 被修改成「App 版」——应派生新的 handoff 目录，冻结稿不动。
