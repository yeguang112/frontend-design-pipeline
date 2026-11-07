// 用法:
//   node detect-drift.mjs <projectDir> --tokens <tokens.json> [--rules rules.json] [--json report.json] [--fail-on error|warn|info] [--help]
//
// 扫描项目源码里的「设计漂移」：硬编码颜色、脱离 scale 的字号/间距/圆角、内联样式、
// AI 味紫色渐变、毛玻璃、超大圆角、emoji 当图标、阴影堆叠、非 token 字体、魔法 z-index。
// 输出 JSON 报告 + 人类可读摘要。退出码 0=无违规（达到 fail-on 级别）/ 1=有违规 / 2=用法错误
//
// rules.json 可覆盖单条规则（enabled / severity / 阈值 / 白名单）:
// {
//   "failOn": "error",
//   "ignore": ["**/*.min.css", "vendor/**"],
//   "rules": {
//     "excessive-radius": { "max": 24, "severity": "warn" },
//     "hardcoded-color": { "allow": ["#ffffff"] },
//     "emoji-icon": { "allow": ["→", "★"] }
//   }
// }

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCli, readJson, writeJson, die, sha256File, nowIso, walkFiles, UsageError, CdpError,
  parseColor, findColorLiterals, inDeclarationValue, splitTopLevel,
} from './lib/cdp.mjs';

const VERSION = '1.0.0';
const HELP = `detect-drift.mjs — 扫描设计漂移（硬编码颜色 / 脱 scale / AI 味样式）

用法:
  node detect-drift.mjs <projectDir> --tokens <tokens.json> [选项]

参数:
  <projectDir>         要扫描的目录（递归；忽略 node_modules/dist/build 等）
  --tokens <file>      必填，extract-tokens.mjs 生成的 tokens.json
  --rules <file>       规则配置 JSON（可选，覆盖阈值/严重级/白名单）
  --json <file>        报告输出路径（默认 ./drift-report.json；传 "-" 不写文件）
  --fail-on <level>    error|warn|info，达到该级别即 exit 1（默认 error）
  --allow <colors>     逗号分隔的额外允许颜色（如 "#ffffff,#000000"）
  --max-radius <n>     圆角上限覆盖（默认 24）
  --list-rules         打印规则清单（03-negative-list.md 的 40 条：script 12 / manual 28），并校验集合一致
  --rules-manifest <f> 指定规则清单（默认 scripts/rules.manifest.json）
  -h, --help           显示本帮助

扫描文件类型: .html .htm .css .scss .tsx .jsx .vue .wxss .wxml
默认忽略: node_modules/dist/build 等目录、design/frozen/**（冻结稿是权威源）、_part*、*.tmp

规则真源: scripts/rules.manifest.json（由 references/03-negative-list.md 的 40 条生成）。
  severity 以 manifest 为准（P0→error / P1→warn / P2→info）；规则集合必须与脚本实现一致。
  本脚本自动检 12 条，其余 28 条标 manual（见 --list-rules），需人工按判定步骤核对。

内置规则（severity 来自 rules.manifest.json，括号内为 03 的级别）:
  hardcoded-color      颜色不在 tokens.json 的 color 集合里              (error, NEVER-I5)
  ai-purple-gradient   linear/radial-gradient 里出现 hue 250–300° 高饱和  (error, NEVER-A1)
  glassmorphism        backdrop-filter 或 filter: blur(...)               (error, NEVER-B1)
  raw-font-family      font-family 出现非 token 字体 / 文件内 >2 家族     (error, NEVER-D1)
  off-scale-font-size  font-size 不在字号阶梯上                           (warn,  NEVER-D4)
  off-scale-spacing    margin/padding/gap 不在间距刻度上                  (error, NEVER-E3)
  off-scale-radius     border-radius 不在圆角刻度上                       (error, NEVER-C2)
  inline-style         style="..." 内联样式                              (warn,  NEVER-J2)
  excessive-radius     border-radius > 24px                              (error, NEVER-C1)
  emoji-icon           用 emoji 当图标                                    (error, NEVER-F1)
  shadow-stack         单条 box-shadow 超过 2 层                          (warn,  NEVER-B2)
  magic-zindex         z-index 不来自 token                               (warn,  NEVER-J3)

扫描范围: 颜色/裸值/字体规则只扫 CSS 区（<style>、.css、组件样式对象），<script> 内容整体跳过；
          @font-face 内的 font-family 免疫；transparent / currentColor / 全透明色放行。

退出码: 0 通过 / 1 有违规 / 2 用法错误
`;

const SCAN_EXTS = new Set(['.html', '.htm', '.css', '.scss', '.tsx', '.jsx', '.vue', '.wxss', '.wxml']);
const SEVERITY_RANK = { error: 3, warn: 2, info: 1 };
const SEVERITY_LABEL = { error: 'error', warn: 'warn ', info: 'info ' };

const MARKUP_EXTS = new Set(['.html', '.htm', '.vue', '.wxml']);
const CSS_EXTS = new Set(['.css', '.scss', '.sass', '.less', '.styl', '.wxss']);
const CODE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs']);

/** 只扫 CSS 区（<style> / .css / 组件样式对象）的规则 */
const RULES_CSS_ONLY = new Set([
  'hardcoded-color', 'ai-purple-gradient', 'glassmorphism', 'off-scale-font-size',
  'off-scale-spacing', 'off-scale-radius', 'excessive-radius', 'shadow-stack',
  'raw-font-family', 'magic-zindex',
]);
/** 扫 markup 区（不含 <script>）的规则 */
const RULES_MARKUP_ONLY = new Set(['inline-style', 'emoji-icon']);

/** 默认忽略：冻结稿是权威源不是待修代码；_part* 是拼装中间产物 */
export function defaultIgnored(rel) {
  const p = rel.split(path.sep).join('/');
  if (/(^|\/)design\/frozen\//.test(p)) return true;
  const base = p.split('/').pop() || '';
  if (/^_part/i.test(base)) return true;
  if (/\.(tmp|bak|orig|swp|swo)$/i.test(base)) return true;
  if (/^~(.*)\.(html?|css|js)$/i.test(base)) return true;
  return false;
}

/** token 定义文件：唯一允许出现裸值的地方 */
export function isTokenDefinitionFile(rel) {
  const p = rel.split(path.sep).join('/');
  if (/(^|\/)design\/tokens\//.test(p)) return true;
  const base = p.split('/').pop() || '';
  if (/^tokens(\.[\w-]+)?\.(css|scss)$/i.test(base)) return true;
  if (/\.tokens\.(css|scss)$/i.test(base)) return true;
  return false;
}

/** 只有 token 定义文件 / :root 型 token 层里的裸值才算合法 */
const TOKEN_DEF_EXEMPT = new Set([
  'hardcoded-color', 'off-scale-font-size', 'off-scale-spacing', 'off-scale-radius',
  'raw-font-family', 'magic-zindex',
]);

const TOKEN_SELECTOR_RE = /^\s*(?:[^,{}]*,\s*)*(?::root|html|body|\[data-[\w-]+(?:=[^\]]*)?\]|\.dark|\.light|\.theme-[\w-]+)\s*$/i;

// severity 真源是 rules.manifest.json（由 03-negative-list.md 生成）；
// 这里的内置值只是 manifest 缺失时的回退，且与 03 的 P0/P1/P2 对齐。
const DEFAULT_RULES = {
  'hardcoded-color': { enabled: true, severity: 'error', allow: [] },          // NEVER-I5 [P0]
  'ai-purple-gradient': { enabled: true, severity: 'error', hueMin: 250, hueMax: 300, satMin: 0.6 }, // NEVER-A1 [P0]
  glassmorphism: { enabled: true, severity: 'error' },                          // NEVER-B1 [P0]
  'raw-font-family': { enabled: true, severity: 'error', maxFamilies: 2 },      // NEVER-D1 [P0]
  'off-scale-font-size': { enabled: true, severity: 'warn', tolerance: 0.5 },   // NEVER-D4 [P1]
  'off-scale-spacing': { enabled: true, severity: 'error', tolerance: 0.5 },    // NEVER-E3 [P0]
  'off-scale-radius': { enabled: true, severity: 'error', tolerance: 0.5 },     // NEVER-C2 [P0]
  'inline-style': { enabled: true, severity: 'warn' },                          // NEVER-J2 [P1]
  'excessive-radius': { enabled: true, severity: 'error', max: 24 },            // NEVER-C1 [P0]
  'emoji-icon': { enabled: true, severity: 'error', allow: ['→', '←', '↑', '↓', '·', '—', '…', '×', '÷', '°', '±', '≤', '≥', '≠'] }, // NEVER-F1 [P0]
  'shadow-stack': { enabled: true, severity: 'warn', maxLayers: 2 },            // NEVER-B2 [P1]
  'magic-zindex': { enabled: true, severity: 'warn' },                          // NEVER-J3 [P1]
};

const HOW_TO_FIX = {
  'hardcoded-color': '改用 var(--color-<role>)；确需新颜色时先跑 extract-tokens 生成 token 再引用。',
  'ai-purple-gradient': '去掉紫色渐变，用品牌 accent token 的纯色或中性阴影；紫色渐变是最典型的 AI 生成味。',
  glassmorphism: '去掉 backdrop-filter/blur；需要层次用 border + 阴影 + 表面色，毛玻璃在暗色底上会糊掉对比度。',
  'raw-font-family': '改用 var(--font-<family>) 或 tokens.css 里的字体 token；新增字体先加进 token。',
  'off-scale-font-size': '改用 --font-size-<step>；确实需要新字号时先扩展 scale，不要在页面里写孤立值。',
  'off-scale-spacing': '改用 --space-<step>（4/8/12/16/24/32/48…）；不要写 13px、18px 这类脱离刻度的间距。',
  'off-scale-radius': '改用 --radius-<step>；圆角只应来自圆角刻度。',
  'inline-style': '把样式移进 class / CSS 文件，用 token 变量；内联样式无法被 token 校验和主题覆盖。',
  'excessive-radius': '圆角控制在 24px 以内（卡片 8–16px）；超大圆角会让界面显得玩具化。',
  'emoji-icon': '用 SVG / icon font 替代 emoji（emoji 在不同系统渲染不一致，且无法着色）。',
  'shadow-stack': '阴影最多 2 层（接触阴影 + 环境阴影）；多段阴影让界面发脏。',
  'magic-zindex': '改用 --z-<value> token，并在层级表里统一管理，避免 9999 这类魔法值。',
};

const GENERIC_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
  'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'inherit', 'initial',
  'unset', 'revert', '-apple-system', 'blinkmacsystemfont',
]);

/* ------------------------------------------------------------------ */
/* 声明扫描（一行内所有 prop: value）                                  */
/* ------------------------------------------------------------------ */

const DECL_RE = /(-{0,2}[a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*([^;{}]*)/g;

function normalizeProp(prop) {
  return prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/_/g, '-');
}

/** 从一行里取出所有 decl（含 offset / column），跳过 URL、伪类选择器等误判 */
function findDeclarations(line) {
  const out = [];
  DECL_RE.lastIndex = 0;
  let m;
  while ((m = DECL_RE.exec(line)) !== null) {
    const prop = m[1];
    let value = m[2];
    // https://... / file://... 之类误判
    if (/^(https?|wss?|file|mailto|data|chrome)$/i.test(prop) && value.trim().startsWith('//')) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    value = trimmed.replace(/[}\s]+$/, '');
    out.push({
      prop,
      propNorm: normalizeProp(prop),
      value,
      index: m.index,
      column: m.index + 1,
    });
  }
  return out;
}

const SPACING_PROPS = new Set([
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'inset',
]);

const RADIUS_PROPS = new Set([
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
]);

/** 解析 "12px" / "1.5rem" / 12 -> px 数值；无法解析返回 null */
function dimToPx(raw, rootFontSize = 16) {
  const s = String(raw).trim().toLowerCase();
  const m = /^(-?(?:\d+|\d*\.\d+))(px|rem|em|pt)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] || 'px';
  if (unit === 'px') return n;
  if (unit === 'rem' || unit === 'em') return n * rootFontSize;
  if (unit === 'pt') return (n * 96) / 72;
  return null;
}

/** 从值里抽出所有长度数值（跳过 auto/var()/百分比等） */
function numericTokens(value) {
  const out = [];
  for (const part of value.split(/\s+/)) {
    if (!part) continue;
    if (/^(auto|inherit|initial|unset|revert|none|var\(|calc\(|-webkit-)/i.test(part)) continue;
    if (part.startsWith('var(') || part.includes('var(')) continue;
    if (/%$/.test(part)) continue;
    const px = dimToPx(part);
    if (px !== null) out.push({ raw: part, px, column: 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Token 索引                                                         */
/* ------------------------------------------------------------------ */

function tokenNumericSet(group) {
  const set = new Set();
  if (!group) return set;
  for (const entry of Object.values(group)) {
    const v = entry?.$value;
    const px = typeof v === 'number' ? v : dimToPx(String(v));
    if (px !== null && Number.isFinite(px)) set.add(Number(px.toFixed(2)));
  }
  return set;
}

function buildTokenIndex(tokensJson) {
  const colors = new Set();
  const colorGroup = tokensJson.color || {};
  for (const entry of Object.values(colorGroup)) {
    const c = parseColor(String(entry?.$value || ''));
    if (c) colors.add(c.hex);
  }
  // meta.roles 里记录的角色 -> hex 也纳入（容错）
  for (const hex of Object.keys(tokensJson.meta?.roles || {})) {
    const c = parseColor(hex);
    if (c) colors.add(c.hex);
  }
  const fontFamilies = new Set();
  for (const entry of Object.values(tokensJson.fontFamily || {})) {
    // token 值可能是「字体栈」（--font-body: "Inter", system-ui）→ 逐族拆分
    for (const part of splitTopLevel(String(entry?.$value || ''), ',')) {
      const v = part.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (v && !v.startsWith('var(')) fontFamilies.add(v);
    }
  }
  return {
    colors,
    fontSize: tokenNumericSet(tokensJson.fontSize),
    spacing: tokenNumericSet(tokensJson.spacing),
    radius: tokenNumericSet(tokensJson.radius),
    zIndex: new Set(Object.values(tokensJson.zIndex || {}).map((e) => Number(e?.$value)).filter(Number.isFinite)),
    fontFamilies,
  };
}

const inSet = (set, n, tolerance = 0.5) => {
  const target = Number(n.toFixed(2));
  if (set.has(target)) return true;
  for (const v of set) if (Math.abs(v - target) <= tolerance) return true;
  return false;
};

/* ------------------------------------------------------------------ */
/* Emoji 检测                                                         */
/* ------------------------------------------------------------------ */

const EMOJI_RANGES = [
  [0x1f000, 0x1f02f], [0x1f0a0, 0x1f0ff], [0x1f100, 0x1f1ad], [0x1f1e6, 0x1f1ff],
  [0x1f200, 0x1f2ff], [0x1f300, 0x1f5ff], [0x1f600, 0x1f64f], [0x1f650, 0x1f67f],
  [0x1f680, 0x1f6ff], [0x1f700, 0x1f77f], [0x1f780, 0x1f7ff], [0x1f800, 0x1f8ff],
  [0x1f900, 0x1f9ff], [0x1fa00, 0x1faff], [0x2600, 0x27bf], [0x2b05, 0x2b07],
  [0x2b1b, 0x2b1c], [0x2b50, 0x2b55], [0x3030], [0x303d], [0x3297], [0x3299],
];

function findEmoji(text) {
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d) continue;
    for (const [lo, hi] of EMOJI_RANGES) {
      if (cp >= lo && cp <= hi) { out.push(ch); break; }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 规则实现：每个返回 {rule, index/column, message, detail}            */
/* ------------------------------------------------------------------ */

function ruleHardcodedColor(ctx) {
  const { line, tokens, cfg } = ctx;
  const out = [];
  const allow = new Set((cfg.allow || []).map((c) => parseColor(String(c))?.hex).filter(Boolean));
  for (const found of findColorLiterals(line)) {
    if (!inDeclarationValue(line, found.index, found.end)) continue;
    // 全透明不是设计色：transparent / rgba(0,0,0,0) / #0000 一律放行（P0-4）
    if (found.color.a === 0) continue;
    if (tokens.colors.has(found.color.hex)) continue;
    if (allow.has(found.color.hex)) continue;
    // 颜色出现在 url(...) 里不算样式声明
    const before = line.slice(0, found.index);
    if (/url\(\s*[^)]*$/.test(before)) continue;
    out.push({
      rule: 'hardcoded-color',
      column: found.index + 1,
      message: `硬编码颜色 ${found.raw}（${found.color.hex}）不在 tokens.json 的 color 集合里`,
      detail: { color: found.color.hex, raw: found.raw },
    });
  }
  return out;
}

function ruleAiPurpleGradient(ctx) {
  const { line, cfg } = ctx;
  if (!/gradient\(/i.test(line)) return [];
  const out = [];
  const seen = new Set();
  for (const found of findColorLiterals(line)) {
    const c = found.color;
    if (c.h < cfg.hueMin || c.h > cfg.hueMax) continue;
    if (c.s < cfg.satMin) continue;
    if (seen.has(c.hex)) continue;
    seen.add(c.hex);
    out.push({
      rule: 'ai-purple-gradient',
      column: found.index + 1,
      message: `渐变里出现高饱和紫色 ${found.raw}（hue ${c.h}°, sat ${(c.s * 100).toFixed(0)}%）—— 典型 AI 味`,
      detail: { color: c.hex, hue: c.h, saturation: c.s },
    });
  }
  return out;
}

function ruleGlassmorphism(ctx) {
  const { declarations, cfg } = ctx;
  if (!cfg.enabled) return [];
  const out = [];
  for (const d of declarations) {
    if (d.propNorm === 'backdrop-filter' || d.propNorm === '-webkit-backdrop-filter') {
      out.push({
        rule: 'glassmorphism',
        column: d.column,
        message: `使用 backdrop-filter: ${d.value}（毛玻璃）`,
        detail: { prop: d.propNorm, value: d.value },
      });
    } else if (d.propNorm === 'filter' && /blur\(/i.test(d.value)) {
      out.push({
        rule: 'glassmorphism',
        column: d.column,
        message: `使用 filter: ${d.value}（模糊/毛玻璃效果）`,
        detail: { prop: d.propNorm, value: d.value },
      });
    }
  }
  return out;
}

function ruleRawFontFamily(ctx) {
  const { declarations, tokens, cfg, fileState } = ctx;
  if (tokens.fontFamilies.size === 0) return [];
  const maxFamilies = Number.isFinite(cfg.maxFamilies) ? cfg.maxFamilies : 2;
  const out = [];
  for (const d of declarations) {
    if (d.propNorm !== 'font-family') continue;
    // var(--font-x) 是 token 引用，天然合法；只有字面量字体名才需要校验
    const families = splitTopLevel(d.value, ',')
      .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
      .filter((f) => f && !f.startsWith('var(') && !f.startsWith('env('));
    if (families.length === 0) continue;
    const literals = families.filter((f) => !GENERIC_FONTS.has(f));
    for (const f of literals) fileState?.fontFamilies?.add(f);
    const bad = literals.filter((f) => !tokens.fontFamilies.has(f));
    if (bad.length > 0) {
      out.push({
        rule: 'raw-font-family',
        column: d.column,
        message: `字体 ${bad.map((b) => `"${b}"`).join(', ')} 不在 token 集合里（token: ${[...tokens.fontFamilies].slice(0, 5).join(', ')}…）`,
        detail: { families: bad, value: d.value, kind: 'raw-font-family' },
      });
    }
  }
  // NEVER-D1：一个文件 > 2 个字体家族（同一文件只报一次）
  const distinct = fileState?.fontFamilies;
  if (distinct && distinct.size > maxFamilies && !fileState.fontFamilyCountReported) {
    fileState.fontFamilyCountReported = true;
    out.push({
      rule: 'raw-font-family',
      column: 1,
      message: `文件内出现 ${distinct.size} 个字体家族（上限 ${maxFamilies}）：${[...distinct].sort().join(', ')}`,
      detail: { families: [...distinct].sort(), kind: 'font-family-count' },
    });
  }
  return out;
}

function ruleOffScaleFontSize(ctx) {
  const { declarations, tokens, cfg } = ctx;
  if (tokens.fontSize.size === 0) return [];
  const out = [];
  for (const d of declarations) {
    if (d.propNorm !== 'font-size') continue;
    const px = dimToPx(d.value);
    if (px === null) continue;
    if (inSet(tokens.fontSize, px, cfg.tolerance)) continue;
    out.push({
      rule: 'off-scale-font-size',
      column: d.column,
      message: `font-size: ${d.value} 不在字号阶梯上（${[...tokens.fontSize].sort((a, b) => a - b).join(', ')}）`,
      detail: { value: px, scale: [...tokens.fontSize].sort((a, b) => a - b) },
    });
  }
  return out;
}

function ruleOffScaleSpacing(ctx) {
  const { declarations, tokens, cfg } = ctx;
  if (tokens.spacing.size === 0) return [];
  const out = [];
  for (const d of declarations) {
    if (!SPACING_PROPS.has(d.propNorm)) continue;
    const bad = numericTokens(d.value).filter((t) => t.px !== 0 && !inSet(tokens.spacing, t.px, cfg.tolerance));
    if (bad.length === 0) continue;
    out.push({
      rule: 'off-scale-spacing',
      column: d.column,
      message: `${d.propNorm}: ${bad.map((b) => b.raw).join(' ')} 不在间距刻度上（${[...tokens.spacing].sort((a, b) => a - b).join(', ')}）`,
      detail: { prop: d.propNorm, values: bad.map((b) => b.px) },
    });
  }
  return out;
}

function ruleOffScaleRadius(ctx) {
  const { declarations, tokens, cfg } = ctx;
  if (tokens.radius.size === 0) return [];
  const out = [];
  for (const d of declarations) {
    if (!RADIUS_PROPS.has(d.propNorm)) continue;
    const bad = numericTokens(d.value).filter((t) => t.px !== 0 && !inSet(tokens.radius, t.px, cfg.tolerance));
    if (bad.length === 0) continue;
    out.push({
      rule: 'off-scale-radius',
      column: d.column,
      message: `${d.propNorm}: ${bad.map((b) => b.raw).join(' ')} 不在圆角刻度上（${[...tokens.radius].sort((a, b) => a - b).join(', ')}）`,
      detail: { prop: d.propNorm, values: bad.map((b) => b.px) },
    });
  }
  return out;
}

function ruleInlineStyle(ctx) {
  const { line } = ctx;
  const out = [];
  const re = /(^|[^-\w])style\s*=\s*(["'])/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push({
      rule: 'inline-style',
      column: m.index + m[0].indexOf('style') + 1,
      message: '使用内联 style 属性',
      detail: { snippet: line.slice(m.index, m.index + 80).trim() },
    });
  }
  return out;
}

function ruleExcessiveRadius(ctx) {
  const { declarations, cfg } = ctx;
  const out = [];
  for (const d of declarations) {
    if (!RADIUS_PROPS.has(d.propNorm)) continue;
    const over = numericTokens(d.value).filter((t) => t.px > cfg.max);
    if (over.length === 0) continue;
    out.push({
      rule: 'excessive-radius',
      column: d.column,
      message: `border-radius 过大: ${over.map((o) => o.raw).join(' ')} > ${cfg.max}px`,
      detail: { values: over.map((o) => o.px), max: cfg.max },
    });
  }
  return out;
}

function ruleEmojiIcon(ctx) {
  const { line, cfg } = ctx;
  const allow = new Set(cfg.allow || []);
  const emojis = findEmoji(line).filter((e) => !allow.has(e));
  if (emojis.length === 0) return [];
  return [{
    rule: 'emoji-icon',
    column: line.indexOf(emojis[0]) + 1,
    message: `用 emoji 当图标: ${[...new Set(emojis)].join(' ')}`,
    detail: { emojis: [...new Set(emojis)] },
  }];
}

function ruleShadowStack(ctx) {
  const { declarations, cfg } = ctx;
  const out = [];
  for (const d of declarations) {
    if (d.propNorm !== 'box-shadow' && d.propNorm !== 'text-shadow') continue;
    if (/^(none|inherit|initial|unset)$/i.test(d.value.trim())) continue;
    const layers = splitTopLevel(d.value, ',').map((s) => s.trim()).filter(Boolean);
    if (layers.length <= cfg.maxLayers) continue;
    out.push({
      rule: 'shadow-stack',
      column: d.column,
      message: `${d.propNorm} 有 ${layers.length} 层阴影（上限 ${cfg.maxLayers}）`,
      detail: { layers: layers.length, maxLayers: cfg.maxLayers },
    });
  }
  return out;
}

function ruleMagicZIndex(ctx) {
  const { declarations, tokens } = ctx;
  if (tokens.zIndex.size === 0) return [];
  const out = [];
  for (const d of declarations) {
    if (d.propNorm !== 'z-index') continue;
    if (!/^-?\d+$/.test(d.value.trim())) continue;
    const n = Number(d.value.trim());
    if (tokens.zIndex.has(n)) continue;
    out.push({
      rule: 'magic-zindex',
      column: d.column,
      message: `z-index: ${n} 不来自 token（${[...tokens.zIndex].sort((a, b) => a - b).join(', ')}）`,
      detail: { value: n },
    });
  }
  return out;
}

const RULE_IMPLS = {
  'hardcoded-color': ruleHardcodedColor,
  'ai-purple-gradient': ruleAiPurpleGradient,
  glassmorphism: ruleGlassmorphism,
  'raw-font-family': ruleRawFontFamily,
  'off-scale-font-size': ruleOffScaleFontSize,
  'off-scale-spacing': ruleOffScaleSpacing,
  'off-scale-radius': ruleOffScaleRadius,
  'inline-style': ruleInlineStyle,
  'excessive-radius': ruleExcessiveRadius,
  'emoji-icon': ruleEmojiIcon,
  'shadow-stack': ruleShadowStack,
  'magic-zindex': ruleMagicZIndex,
};

/* ------------------------------------------------------------------ */
/* 扫描区域：区分 <style> / markup / <script>，并定位 @font-face 块     */
/* ------------------------------------------------------------------ */

function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineAtOffset(lineStarts, idx) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid] <= idx) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans + 1;
}

function maskRanges(text, ranges) {
  if (!ranges.length) return text;
  const out = text.split('');
  for (const [start, end] of ranges) {
    for (let i = start; i < end && i < out.length; i++) if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
  }
  return out.join('');
}

/** 把文件切成逐行扫描信息：原始行 / 屏蔽后行 / 是否 CSS 区 / 是否在 @font-face 内 */
export function buildScanView(filePath, text) {
  const ext = path.extname(filePath).toLowerCase();
  const isMarkup = MARKUP_EXTS.has(ext);
  const isCss = CSS_EXTS.has(ext);
  const isCode = CODE_EXTS.has(ext);
  const lineStarts = lineStartsOf(text);
  const rawLines = text.split(/\r?\n/);
  const totalLines = rawLines.length;

  const scriptLines = new Set();
  const styleLines = new Set();
  let masked = text;

  if (isMarkup) {
    const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
    const ranges = [];
    let m;
    while ((m = scriptRe.exec(text)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
      const from = lineAtOffset(lineStarts, m.index);
      const to = lineAtOffset(lineStarts, Math.max(m.index, m.index + m[0].length - 1));
      for (let ln = from; ln <= to; ln++) scriptLines.add(ln);
    }
    if (ranges.length) masked = maskRanges(text, ranges);

    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    while ((m = styleRe.exec(text)) !== null) {
      const from = lineAtOffset(lineStarts, m.index);
      const to = lineAtOffset(lineStarts, Math.max(m.index, m.index + m[0].length - 1));
      for (let ln = from; ln <= to; ln++) styleLines.add(ln);
    }
  }

  // @font-face 块（在已屏蔽 script 的文本上算，行号仍对原始文件有效）
  const fontFaceLines = new Set();
  const ffRe = /@font-face\s*\{/gi;
  let fm;
  while ((fm = ffRe.exec(masked)) !== null) {
    let depth = 1;
    let j = fm.index + fm[0].length;
    while (j < masked.length && depth > 0) {
      const c = masked[j];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      j += 1;
    }
    const from = lineAtOffset(lineStarts, fm.index);
    const to = lineAtOffset(lineStarts, Math.max(fm.index, j - 1));
    for (let ln = from; ln <= to; ln++) fontFaceLines.add(ln);
  }

  // 「token 层」块：:root / [data-theme] / html 且块内至少有一个 --* 定义。
  // 注意：块里可能混有 color-scheme 之类的声明，所以豁免粒度放到「声明」层（只有 --* 的行才豁免）。
  const tokenLayerLines = new Set();
  {
    const re = /([^{};]+)\{/g;
    let m;
    while ((m = re.exec(masked)) !== null) {
      // 去掉注释，并只取 prelude 尾部的选择器（HTML 前缀 / <style> 标签会混进来）
      const cleanPrelude = m[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
      if (cleanPrelude.trim().startsWith('@')) continue;
      const boundary = Math.max(cleanPrelude.lastIndexOf('}'), cleanPrelude.lastIndexOf(';'), cleanPrelude.lastIndexOf('>'));
      const selector = (boundary >= 0 ? cleanPrelude.slice(boundary + 1) : cleanPrelude).trim();
      if (!selector) continue;
      const lastPart = selector.split(',').pop().trim();
      if (!TOKEN_SELECTOR_RE.test(lastPart) && !TOKEN_SELECTOR_RE.test(selector)) continue;
      let depth = 1;
      let j = m.index + m[0].length;
      while (j < masked.length && depth > 0) {
        if (masked[j] === '{') depth += 1;
        else if (masked[j] === '}') depth -= 1;
        j += 1;
      }
      const body = masked.slice(m.index + m[0].length, j - 1).replace(/\/\*[\s\S]*?\*\//g, ' ');
      if (!/--[\w-]+\s*:/.test(body)) continue;
      const from = lineAtOffset(lineStarts, m.index);
      const to = lineAtOffset(lineStarts, Math.max(m.index, j - 1));
      for (let ln = from; ln <= to; ln++) tokenLayerLines.add(ln);
    }
  }

  const scannedLines = masked.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < totalLines; i++) {
    const no = i + 1;
    const raw = rawLines[i] ?? '';
    const inScript = scriptLines.has(no);
    // CSS 区：.css 类整个文件；代码文件按样式对象处理；markup 只认 <style> 行与带 style= 的行
    const cssScope = isCss || isCode || styleLines.has(no) || (!inScript && /\bstyle\s*=/.test(raw));
    lines.push({
      raw,
      scan: scannedLines[i] ?? '',
      cssScope,
      markupScope: !inScript,
      inFontFace: fontFaceLines.has(no),
      inTokenLayer: tokenLayerLines.has(no),
    });
  }
  return { ext, isMarkup, isCss, isCode, tokenLayerLines, lines };
}

/* ------------------------------------------------------------------ */
/* ignore glob                                                        */
/* ------------------------------------------------------------------ */

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withGlobs = escaped.replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?').replace(/\u0001/g, '.*');
  return new RegExp(`^${withGlobs}$`);
}

/* ------------------------------------------------------------------ */
/* 规则真源：rules.manifest.json（由 03-negative-list.md 生成）         */
/* ------------------------------------------------------------------ */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RULES_MANIFEST_DEFAULT = path.join(SCRIPT_DIR, 'rules.manifest.json');

/** 读取 rules.manifest.json；缺失/非法返回 null（回退内置 severity） */
export async function loadRulesManifest(manifestPath = null) {
  const p = manifestPath ? path.resolve(manifestPath) : RULES_MANIFEST_DEFAULT;
  const json = await readJson(p).catch(() => null);
  if (!json || !Array.isArray(json.rules) || json.rules.length === 0) return null;
  return { ...json, path: p };
}

/** manifest 里由脚本实现的规则 id 集合（implementation = "script:<rule-id>"） */
export function scriptRuleIds(manifest) {
  const ids = new Set();
  for (const r of manifest?.rules || []) {
    const m = /^script:([\w-]+)$/.exec(String(r.implementation || ''));
    if (m) ids.add(m[1]);
  }
  return ids;
}

/** --list-rules 的表格（40 行） */
export function listRulesTable(manifest) {
  const rows = (manifest?.rules || []).map((r) => ({
    id: r.id,
    docId: r.docId || '-',
    severity: r.severity,
    implementation: r.implementation,
    check: r.check || '',
    docRef: r.docRef || '',
  }));
  const scriptCount = rows.filter((r) => String(r.implementation).startsWith('script:')).length;
  const lines = [];
  lines.push(`规则清单（真源: references/03-negative-list.md · ${path.basename(manifest.path)}）`);
  lines.push(`共 ${rows.length} 条：script 自动检 ${scriptCount} 条 / manual 人工 ${rows.length - scriptCount} 条`);
  lines.push('');
  lines.push(`${'#'.padStart(3)}  ${'规则 id'.padEnd(22)} ${'严重度'.padEnd(6)} ${'实现'.padEnd(30)} ${'文档'.padEnd(11)} 判定方法`);
  lines.push('-'.repeat(140));
  rows.forEach((r, i) => {
    lines.push(`${String(i + 1).padStart(3)}  ${r.id.padEnd(22)} ${r.severity.padEnd(6)} ${r.implementation.padEnd(30)} ${r.docId.padEnd(11)} ${r.check}`);
  });
  return { rows, scriptCount, manualCount: rows.length - scriptCount, text: lines.join('\n') };
}

/* ------------------------------------------------------------------ */
/* 主流程                                                             */
/* ------------------------------------------------------------------ */

async function loadRules(rulesPath, cli) {
  const rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  let ignore = [];
  let failOn = 'error';
  let manifest = null;
  const manifestWarnings = [];
  manifest = await loadRulesManifest(cli.rulesManifest || null);
  if (manifest) {
    // manifest 是 severity 真源：只覆盖已实现的 script:<id> 规则
    for (const r of manifest.rules) {
      const m = /^script:([\w-]+)$/.exec(String(r.implementation || ''));
      if (!m || !rules[m[1]]) continue;
      if (SEVERITY_RANK[r.severity]) rules[m[1]].severity = r.severity;
    }
    const scriptIds = scriptRuleIds(manifest);
    const missing = [...scriptIds].filter((id) => !rules[id]);
    const notInManifest = Object.keys(rules).filter((id) => !scriptIds.has(id));
    if (missing.length) manifestWarnings.push(`manifest 声明的规则脚本未实现: ${missing.join(', ')}`);
    if (notInManifest.length) manifestWarnings.push(`脚本有但 manifest 未声明: ${notInManifest.join(', ')}`);
  } else if (cli.rulesManifest) {
    throw new CdpError(`读取规则清单失败: ${cli.rulesManifest}`, '确认是 scripts/rules.manifest.json 的格式。');
  } else {
    manifestWarnings.push(`未找到 ${path.basename(RULES_MANIFEST_DEFAULT)}，severity 回退内置值`);
  }
  if (rulesPath) {
    const raw = await readJson(rulesPath).catch((err) => {
      throw new CdpError(`读取 rules 失败: ${rulesPath}: ${err.message}`, '确认是合法 JSON，且路径存在。');
    });
    if (raw.failOn) {
      if (!SEVERITY_RANK[raw.failOn]) throw new UsageError(`rules.failOn 只能是 error/warn/info，收到 "${raw.failOn}"`);
      failOn = raw.failOn;
    }
    if (Array.isArray(raw.ignore)) ignore = raw.ignore;
    for (const [id, override] of Object.entries(raw.rules || {})) {
      if (!rules[id]) throw new UsageError(`rules.json 里有未知规则 "${id}"`, `可用规则: ${Object.keys(DEFAULT_RULES).join(', ')}`);
      rules[id] = { ...rules[id], ...override };
      if (override.severity && !SEVERITY_RANK[override.severity]) {
        throw new UsageError(`规则 ${id} 的 severity 只能是 error/warn/info`);
      }
    }
  }
  if (cli.failOn) {
    if (!SEVERITY_RANK[cli.failOn]) throw new UsageError(`--fail-on 只能是 error/warn/info，收到 "${cli.failOn}"`);
    failOn = cli.failOn;
  }
  if (cli.maxRadius !== undefined) rules['excessive-radius'].max = cli.maxRadius;
  if (cli.allow) {
    const extra = cli.allow.split(',').map((s) => s.trim()).filter(Boolean);
    rules['hardcoded-color'].allow = [...(rules['hardcoded-color'].allow || []), ...extra];
  }
  return { rules, ignore, failOn, manifest, manifestWarnings };
}

/** 去掉行内注释（/* ... *\/ 与 // ...），尽量保留列号 */
function stripLineComment(line) {
  let out = line.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  const slash = out.indexOf('//');
  if (slash !== -1 && !/https?:\/\//i.test(out.slice(Math.max(0, slash - 8), slash + 3))) {
    // 只在 "//" 前面不是字符串里冒号的情况下当作注释
    const head = out.slice(0, slash);
    const quotes = (head.match(/["'`]/g) || []).length;
    if (quotes % 2 === 0) out = head + ' '.repeat(out.length - head.length);
  }
  return out;
}

/**
 * 扫描一个项目目录（供 CLI 与 accept-verify 复用）。
 * @returns {{violations:Array, scanned:{files:number,skippedByIgnore:number,bytes:number}, tokenIndex:object}}
 */
export async function scanProject({ projectDir, tokensJson, rules, ignore = [] }) {
  const tokenIndex = buildTokenIndex(tokensJson);
  const ignoreRes = ignore.map(globToRegExp);
  const files = await walkFiles(projectDir, { exts: SCAN_EXTS });
  const violations = [];
  let scannedBytes = 0;
  let skippedByIgnore = 0;
  let scannedFiles = 0;

  for (const f of files) {
    if (defaultIgnored(f.rel) || ignoreRes.some((re) => re.test(f.rel))) { skippedByIgnore += 1; continue; }
    const buf = await fsp.readFile(f.abs).catch(() => null);
    if (!buf) continue;
    scannedFiles += 1;
    scannedBytes += buf.length;
    const text = buf.toString('utf8');
    const view = buildScanView(f.abs, text);
    const tokenFile = isTokenDefinitionFile(f.rel);
    const fileState = { fontFamilies: new Set(), fontFamilyCountReported: false };
    for (let i = 0; i < view.lines.length; i++) {
      const info = view.lines[i];
      const rawLine = info.raw;
      if (!rawLine.trim()) continue;
      const line = stripLineComment(info.scan);
      if (!line.trim()) continue;
      const declarations = findDeclarations(line);
      const base = {
        file: f.rel, line: i + 1, lineText: rawLine,
        cssScope: info.cssScope, markupScope: info.markupScope, inFontFace: info.inFontFace,
        fileState,
      };
      for (const [id, impl] of Object.entries(RULE_IMPLS)) {
        const cfg = rules[id];
        if (!cfg || cfg.enabled === false) continue;
        // 作用域（P0-4）：颜色/裸值只在 CSS 区；<script> 内不扫任何样式规则
        if (RULES_CSS_ONLY.has(id) && !info.cssScope) continue;
        if (RULES_MARKUP_ONLY.has(id) && !info.markupScope) continue;
        if (id === 'raw-font-family' && info.inFontFace) continue;
        // token 定义文件 / token 层块里的裸值合法（tokens.css 就是唯一允许写裸值的地方）
        const customOnlyLine = declarations.length > 0 && declarations.every((d) => d.prop.startsWith('--'));
        if (TOKEN_DEF_EXEMPT.has(id) && (tokenFile || (info.inTokenLayer && customOnlyLine))) continue;
        const found = impl({ ...base, line, rawLine, declarations, tokens: tokenIndex, cfg });
        for (const v of found) {
          const snippet = rawLine.trim().slice(0, 160);
          violations.push({
            rule: id,
            severity: cfg.severity,
            file: f.rel,
            line: i + 1,
            column: v.column ? Math.min(v.column, rawLine.length + 1) : 1,
            snippet: snippet.length < rawLine.trim().length ? `${snippet}…` : snippet,
            message: v.message,
            howToFix: HOW_TO_FIX[id] || '',
            detail: v.detail || null,
          });
        }
      }
    }
  }
  return { violations, scanned: { files: scannedFiles, skippedByIgnore, bytes: scannedBytes }, tokenIndex, files };
}

async function main() {
  const { help, opts, positionals } = parseCli(process.argv.slice(2), {
    options: {
      '--tokens': { key: 'tokens', type: 'string' },
      '--rules': { key: 'rules', type: 'string' },
      '--json': { key: 'json', type: 'string', default: 'drift-report.json' },
      '--fail-on': { key: 'failOn', type: 'string' },
      '--allow': { key: 'allow', type: 'string' },
      '--max-radius': { key: 'maxRadius', type: 'number' },
      '--list-rules': { key: 'listRules', type: 'boolean', default: false },
      '--rules-manifest': { key: 'rulesManifest', type: 'string' },
    },
    minPositional: 0,
    maxPositional: 1,
  });
  if (help) { console.log(HELP); return 0; }

  // --list-rules：打印规则真源（40 行），并校验 manifest ↔ 脚本实现一致
  if (opts.listRules) {
    const manifest = await loadRulesManifest(opts.rulesManifest || null);
    if (!manifest) {
      throw new CdpError('缺少 scripts/rules.manifest.json', '该文件是 03-negative-list.md 的规则真源；请从包内恢复，或用 --rules-manifest 指定。');
    }
    const { rows, scriptCount, manualCount, text } = listRulesTable(manifest);
    console.log(text);
    const scriptIds = scriptRuleIds(manifest);
    const implIds = new Set(Object.keys(RULE_IMPLS));
    const missing = [...scriptIds].filter((id) => !implIds.has(id));
    const extra = [...implIds].filter((id) => !scriptIds.has(id));
    console.log('');
    console.log(`manifest ↔ 脚本: script 声明 ${scriptCount} 条, 脚本实现 ${implIds.size} 条, manual ${manualCount} 条`);
    if (missing.length || extra.length) {
      if (missing.length) console.log(`  ✖ manifest 声明但脚本未实现: ${missing.join(', ')}`);
      if (extra.length) console.log(`  ✖ 脚本实现但 manifest 未声明: ${extra.join(', ')}`);
      console.log('  → 规则集合不一致，必须同步（CI 会因此失败）');
      return 1;
    }
    console.log('  ✔ 规则集合一致');
    return 0;
  }

  if (!opts.tokens) throw new UsageError('缺少 --tokens <tokens.json>', '先跑: node extract-tokens.mjs <input> --out <dir>');
  if (!positionals[0]) throw new UsageError('缺少 <projectDir>', '用法: node detect-drift.mjs <projectDir> --tokens <tokens.json>');

  const projectDir = path.resolve(positionals[0]);
  const stat = await fsp.stat(projectDir).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new CdpError(`项目目录不存在: ${projectDir}`, '传一个目录路径（不是文件）。');

  const tokensPath = path.resolve(opts.tokens);
  const tokensJson = await readJson(tokensPath).catch((err) => {
    throw new CdpError(`读取 tokens.json 失败: ${tokensPath}: ${err.message}`, '确认它是 extract-tokens.mjs 的输出。');
  });
  const tokenIndex = buildTokenIndex(tokensJson);
  if (tokenIndex.colors.size === 0) {
    throw new CdpError(`${tokensPath} 里没有 color token`, '先跑 extract-tokens.mjs 生成 tokens.json，或检查文件是否选错。');
  }

  const { rules, ignore, failOn, manifest, manifestWarnings } = await loadRules(opts.rules ? path.resolve(opts.rules) : null, opts);
  const { violations, scanned } = await scanProject({ projectDir, tokensJson, rules, ignore });

  // 去重（同一文件同一行同一规则同一个 column 只留一条）
  const seen = new Set();
  const unique = [];
  for (const v of violations) {
    const key = `${v.rule}|${v.file}|${v.line}|${v.column}|${v.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
  }
  unique.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
    || a.line - b.line || a.column - b.column || (a.rule < b.rule ? -1 : 1));

  const byRule = new Map();
  const bySeverity = { error: 0, warn: 0, info: 0 };
  for (const v of unique) {
    bySeverity[v.severity] += 1;
    if (!byRule.has(v.rule)) byRule.set(v.rule, { rule: v.rule, severity: v.severity, count: 0 });
    byRule.get(v.rule).count += 1;
  }
  const byRuleList = [...byRule.values()].sort((a, b) => b.count - a.count || (a.rule < b.rule ? -1 : 1));

  const scriptIds = manifest ? scriptRuleIds(manifest) : null;
  const report = {
    tool: `detect-drift.mjs@${VERSION}`,
    generatedAt: nowIso(),
    projectDir,
    rulesManifest: manifest
      ? {
        file: manifest.path,
        version: manifest.version ?? 1,
        total: manifest.rules.length,
        script: scriptIds.size,
        manual: manifest.rules.length - scriptIds.size,
      }
      : null,
    tokens: {
      file: tokensPath,
      sha256: await sha256File(tokensPath),
      counts: {
        colors: tokenIndex.colors.size,
        fontSize: tokenIndex.fontSize.size,
        spacing: tokenIndex.spacing.size,
        radius: tokenIndex.radius.size,
        fontFamilies: tokenIndex.fontFamilies.size,
        zIndex: tokenIndex.zIndex.size,
      },
    },
    config: { failOn, rules, ignore, warnings: manifestWarnings },
    scanned,
    summary: { total: unique.length, bySeverity, byRule: byRuleList },
    violations: unique,
  };

  let jsonPath = null;
  if (opts.json !== '-') {
    jsonPath = await writeJson(path.resolve(opts.json), report);
  }

  /* 人类可读摘要 */
  const failed = unique.filter((v) => SEVERITY_RANK[v.severity] >= SEVERITY_RANK[failOn]);
  console.log(`\n${failed.length ? '✖' : '✔'} 设计漂移扫描: ${scanned.files} 个文件, ${unique.length} 个违规` +
    `（error ${bySeverity.error} / warn ${bySeverity.warn} / info ${bySeverity.info}）`);
  if (byRuleList.length) {
    console.log('\n按规则（TOP）:');
    for (const r of byRuleList.slice(0, 12)) {
      const bar = '█'.repeat(Math.min(20, Math.max(1, Math.round((r.count / Math.max(1, byRuleList[0].count)) * 20))));
      console.log(`  ${SEVERITY_LABEL[r.severity]} ${r.rule.padEnd(20)} ${String(r.count).padStart(4)}  ${bar}`);
    }
  }
  const examples = unique.slice(0, 10);
  if (examples.length) {
    console.log('\n示例（前 10 条）:');
    for (const v of examples) {
      console.log(`  ${SEVERITY_LABEL[v.severity]} ${v.file}:${v.line}:${v.column}  ${v.rule}`);
      console.log(`         ${v.message}`);
      console.log(`         ${v.snippet}`);
    }
  }
  if (jsonPath) console.log(`\nJSON 报告: ${jsonPath}`);
  console.log(`\n判定: fail-on=${failOn} -> ${failed.length ? `FAIL（${failed.length} 条达到该级别）` : 'PASS'}`);
  return failed.length ? 1 : 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }).catch((err) => die(err));
}

export { findDeclarations, buildTokenIndex, DEFAULT_RULES, RULE_IMPLS, globToRegExp, findEmoji };
