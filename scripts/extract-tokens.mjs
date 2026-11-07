// 用法:
//   node extract-tokens.mjs <input.html|dir> [--out <dir>] [--name tokens] [--help]
//
// 从 HTML（内联 <style> + style="" 属性）或目录（*.html/*.css，递归）里提取设计 token：
// color / font-family / font-size / font-weight / line-height / letter-spacing / spacing /
// radius / box-shadow / border-width / duration+easing / z-index / breakpoint。
// 输出 tokens.json（DTCG 风格）、tokens.css（:root 变量）、tokens.md（表格）。
// 退出码: 0 成功 / 1 读文件失败 / 2 用法错误

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCli, writeJson, UsageError, CdpError, die, sha256Buf, nowIso,
  walkFiles, findColorLiterals, splitTopLevel,
} from './lib/cdp.mjs';

const VERSION = '1.0.0';
const HELP = `extract-tokens.mjs — 从 HTML/CSS 提取设计 token（零依赖，不需要浏览器）

用法:
  node extract-tokens.mjs <input.html|dir> [选项]

参数:
  <input.html|dir>     单个 HTML 文件，或包含 *.html / *.css 的目录（递归，忽略 node_modules/dist）
  --out <dir>          输出目录（默认 ./tokens）
  --name <base>        输出文件名基名（默认 tokens -> tokens.json/tokens.css/tokens.md）
  --root-font-size <n> rem 换算基准（默认 16）
  -h, --help           显示本帮助

输出:
  <out>/<name>.json    DTCG 风格 token 树 + meta + scale + unmapped
  <out>/<name>.css     :root { --color-bg: ...; --space-1: 4px; ... }
  <out>/<name>.md      Markdown 表格（token / 值 / 角色 / 使用次数）

退出码: 0 成功 / 1 读取或解析失败 / 2 用法错误

说明:
  - 不产生网络请求；<link rel=stylesheet href="本地相对路径"> 会被一并读取。
  - 数值统一换算为 px（rem/em 按 --root-font-size 近似），颜色统一为小写 hex（带 alpha 时 8 位）。
  - 所有输出按固定顺序排序，可重复生成（meta.extractedAt 除外）。
`;

const HTML_EXTS = new Set(['.html', '.htm']);
const CSS_EXTS = new Set(['.css']);

/* ================================================================== */
/* CSS 解析：抽出 (selector, prop, value, media[]) 声明                */
/* ================================================================== */

function computeLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineOfIndex(lineStarts, idx) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid] <= idx) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans + 1;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * 解析 CSS 文本为声明列表。@media 记录到 media 数组；@font-face/@page/@keyframes 内部声明跳过
 * （keyframes 里的声明不是"使用位置"，不参与统计）。
 * @returns {Array<{prop:string,value:string,selector:string,media:string[],line:number,file?:string}>}
 */
export function parseCssDeclarations(cssText, { file = '', lineOffset = 0 } = {}) {
  const text = stripComments(cssText);
  const lineStarts = computeLineStarts(cssText);
  const decls = [];
  const frames = [];
  const mediaStack = [];
  let buf = '';
  let i = 0;

  const flush = (raw, idx) => {
    const s = raw.trim();
    if (!s) return;
    if (s.startsWith('@')) return; // @import / @charset 之类
    const top = frames[frames.length - 1];
    if (!top || top.kind !== 'rule') return;
    if (frames.some((f) => f.skip)) return;
    const colon = s.indexOf(':');
    if (colon <= 0) return;
    const prop = s.slice(0, colon).trim();
    const value = s.slice(colon + 1).trim();
    if (!/^(?:--)?[a-zA-Z][\w-]*$/.test(prop) || !value) return;
    decls.push({
      prop: prop.toLowerCase(),
      value,
      selector: top.selector,
      media: [...mediaStack],
      line: lineOffset + lineOfIndex(lineStarts, idx),
      file,
    });
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      let frame;
      if (prelude.startsWith('@')) {
        const atName = (/^@([\w-]+)/.exec(prelude)?.[1] || '').toLowerCase();
        const isMedia = atName === 'media';
        frame = {
          kind: 'at',
          at: atName,
          skip: ['font-face', 'page', 'keyframes', 'charset', 'property'].includes(atName),
          mediaCond: isMedia ? prelude.replace(/^@media\s*/i, '').trim() : null,
        };
        if (isMedia) mediaStack.push(frame.mediaCond);
      } else {
        frame = { kind: 'rule', selector: prelude || '&' };
      }
      frames.push(frame);
      i += 1;
      continue;
    }
    if (ch === '}') {
      flush(buf, i);
      buf = '';
      const f = frames.pop();
      if (f && f.kind === 'at' && f.mediaCond !== null) mediaStack.pop();
      i += 1;
      continue;
    }
    if (ch === ';') {
      flush(buf, i);
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush(buf, text.length);
  return decls;
}

/** 解析 style="..." 属性内容为声明列表 */
export function parseInlineDeclarations(styleValue, { selector = '', line = 0, file = '' } = {}) {
  const decls = [];
  for (const part of splitTopLevel(styleValue, ';')) {
    const s = part.trim();
    if (!s) continue;
    const colon = s.indexOf(':');
    if (colon <= 0) continue;
    const prop = s.slice(0, colon).trim().toLowerCase();
    const value = s.slice(colon + 1).trim();
    if (!/^(?:--)?[a-zA-Z][\w-]*$/.test(prop) || !value) continue;
    decls.push({ prop, value, selector, media: [], line, file });
  }
  return decls;
}

/* ================================================================== */
/* 值归一化                                                            */
/* ================================================================== */

const GENERIC_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
  'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', 'inherit', 'initial', 'unset', 'revert',
  '-apple-system', 'blinkmacsystemfont',
]);

function normalizeFamily(raw) {
  const display = raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ');
  return { key: display.toLowerCase(), display, generic: GENERIC_FONTS.has(display.toLowerCase()) };
}

function round(n) { return Math.round(n * 100) / 100; }

/** px / rem / em / pt -> px（em 按 rootFontSize 近似） */
function toPx(raw, rootFontSize = 16) {
  const s = String(raw).trim().toLowerCase();
  const m = /^(-?(?:\d+|\d*\.\d+))(px|rem|em|pt)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] || '';
  if (unit === 'px' || unit === '') return n;
  if (unit === 'rem' || unit === 'em') return round(n * rootFontSize);
  if (unit === 'pt') return round((n * 96) / 72);
  return null;
}

function toMs(raw) {
  const s = String(raw).trim().toLowerCase();
  const m = /^(-?(?:\d+|\d*\.\d+))(ms|s)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.round((m[2] || 'ms') === 's' ? n * 1000 : n);
}

const EASING_RE = /^(ease|linear|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\([^)]*\)|steps\([^)]*\)|linear\([^)]*\))$/i;

function normalizeValue(v) {
  return v.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
}

/* ================================================================== */
/* 05 §2 槽位词典：CSS 自定义属性名 -> token 类别                     */
/* ================================================================== */

const SLOT_PREFIXES = [
  ['font-size-', 'fontSize'], ['font-weight-', 'fontWeight'], ['font-family-', 'fontFamily'],
  ['space-', 'spacing'], ['text-', 'fontSize'], ['leading-', 'lineHeight'],
  ['tracking-', 'letterSpacing'], ['weight-', 'fontWeight'], ['font-', 'fontFamily'],
  ['radius-', 'radius'], ['shadow-', 'shadow'], ['elevation-', 'shadow'],
  ['dur-', 'duration'], ['duration-', 'duration'], ['ease-', 'easing'], ['easing-', 'easing'],
  ['z-', 'zIndex'], ['layer-', 'zIndex'], ['bp-', 'breakpoint'], ['breakpoint-', 'breakpoint'],
  ['border-width-', 'borderWidth'],
];

const COLOR_SLOT_NAMES = new Set([
  'bg', 'surface', 'surface-2', 'surface-3', 'overlay', 'fg', 'fg-2', 'muted', 'meta',
  'border', 'border-subtle', 'border-strong', 'accent', 'accent-hover', 'accent-active',
  'accent-on', 'link', 'success', 'warn', 'warning', 'danger', 'error', 'info',
  'white', 'black', 'ink', 'snow',
]);

function hasColorLiteral(value) {
  return /#(?:[0-9a-f]{3,8})\b|(?:rgba?|hsla?)\(/i.test(String(value));
}

/**
 * 按 05 §2 槽位词典判断一个自定义属性属于哪个 token 类别；判断不出返回 null。
 * 名字优先（`--space-4`），其次看值本身（`--ink-0: #08090a`）。
 */
export function slotCategory(name, value) {
  const n = String(name).toLowerCase();
  for (const [prefix, cat] of SLOT_PREFIXES) if (n.startsWith(prefix)) return cat;
  if (COLOR_SLOT_NAMES.has(n) || n.startsWith('color-') || n.startsWith('semantic-') || n.startsWith('status-')) {
    return hasColorLiteral(value) ? 'color' : null;
  }
  if (hasColorLiteral(value)) return 'color';
  return null;
}

/* ================================================================== */
/* 收集器                                                              */
/* ================================================================== */

const CATEGORY_ORDER = [
  'color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'spacing', 'radius', 'shadow', 'borderWidth', 'duration', 'easing', 'zIndex', 'breakpoint',
];

class Collector {
  constructor(rootFontSize = 16) {
    this.rootFontSize = rootFontSize;
    this.buckets = new Map();
    this.sources = [];
    this.declCount = 0;
    this.skipped = 0;
    this.skippedVar = 0;       // 值含 var(--x) 而跳过的声明数（P0-2）
    this.varRefs = 0;          // 输入里 var(-- 引用总数（退化检测用）
    this.warnings = [];
    this.warningCount = 0;
    this.unclassified = [];    // 不在 05 §2 槽位词典里的自定义属性
    this.fontStacks = new Map();
    this.breakpoints = new Map();
    for (const c of CATEGORY_ORDER) this.buckets.set(c, new Map());
  }

  /** 记录告警（按 kind 去重、总量限 60 条，其余只计数） */
  warn(message, kind = 'misc') {
    this.warningCount += 1;
    const sameKind = this.warnings.filter((w) => w.kind === kind);
    if (sameKind.length >= 12 || this.warnings.length >= 60) return;
    this.warnings.push({ kind, message });
  }

  bump(cat, key, { value, type, use = null, extra = null, name = null }) {
    const map = this.buckets.get(cat);
    let rec = map.get(key);
    if (!rec) { rec = { key, value, type, count: 0, uses: [], extra: extra || null, name: name || null }; map.set(key, rec); }
    if (name && !rec.name) rec.name = name;
    rec.count += 1;
    if (use && rec.uses.length < 40) rec.uses.push(use);
    return rec;
  }

  ingestColors(value, decl, { name = null } = {}) {
    const found = findColorLiterals(value);
    for (const f of found) {
      const useName = name && found.length === 1 ? name : null;
      this.bump('color', useName ? `color:${useName}` : f.color.hex, {
        value: f.color.hex,
        type: 'color',
        name: useName,
        use: {
          prop: decl.prop, selector: decl.selector, media: decl.media,
          alpha: f.color.a, lum: relativeLuminance(f.color), raw: f.raw,
        },
        extra: { rgb: [f.color.r, f.color.g, f.color.b], hsl: [f.color.h, f.color.s, f.color.l] },
      });
    }
    return found.length;
  }

  addSource(file, buffer, kind) {
    this.sources.push({ file, sha256: sha256Buf(buffer), bytes: buffer.length, kind });
  }
}

const LUM_CACHE = new Map();
function relativeLuminance(color) {
  if (LUM_CACHE.has(color.hex)) return LUM_CACHE.get(color.hex);
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = 0.2126 * f(color.r) + 0.7152 * f(color.g) + 0.0722 * f(color.b);
  LUM_CACHE.set(color.hex, lum);
  return lum;
}

/* ================================================================== */
/* 声明 -> 分类                                                        */
/* ================================================================== */

const SPACING_PROPS = new Set(['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'inset', 'top', 'right', 'bottom', 'left']);
const RADIUS_PROPS = new Set(['border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius']);
const BORDER_WIDTH_PROPS = new Set(['border-width', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width']);
const BORDER_WIDTH_KEYWORDS = { thin: 1, medium: 3, thick: 5 };
const BORDER_SHORTHANDS = new Set(['border', 'border-top', 'border-right', 'border-bottom', 'border-left']);

const COLOR_PROPS = new Set(['color', 'background-color', 'border-color', 'border-top-color',
  'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'fill',
  'stroke', 'caret-color', 'text-decoration-color', 'column-rule-color', 'accent-color',
  'background', 'background-image', 'border', 'border-top', 'border-right', 'border-bottom',
  'border-left', 'outline', 'box-shadow', 'text-shadow', 'text-emphasis-color']);

export function ingestDeclaration(decl, col) {
  col.declCount += 1;
  const { prop, value } = decl;
  const v = normalizeValue(value);

  // 0) var(--x) 引用：一律跳过，不生成 token、不参与聚类（P0-2，避免自引用与垃圾 token）
  if (/\bvar\s*\(/i.test(value)) {
    col.skippedVar += 1;
    col.warn(`跳过含 var() 的声明: ${prop}: ${v.slice(0, 100)}`, 'var-skip');
    return;
  }

  // 0.5) CSS 自定义属性：按 05 §2 槽位词典归类，token 名沿用作者命名
  if (prop.startsWith('--')) {
    ingestCustomProp(prop.slice(2), v, decl, col);
    return;
  }

  // 1) 颜色：含颜色字面量的属性都收（兼容 border: 1px solid #ccc 这类简写）
  if (COLOR_PROPS.has(prop) || prop.startsWith('--') || /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(v)) {
    col.ingestColors(value, decl);
  }

  // 2) 字体
  if (prop === 'font-family') {
    const families = splitTopLevel(value, ',').map(normalizeFamily).filter((f) => f.key);
    col.fontStacks.set(families.map((f) => f.key).join(', '), (col.fontStacks.get(families.map((f) => f.key).join(', ')) || 0) + 1);
    for (const fam of families) {
      col.bump('fontFamily', fam.key, {
        value: fam.display, type: 'fontFamily',
        use: { prop, selector: decl.selector, generic: fam.generic },
      });
    }
  }
  if (prop === 'font') {
    // 简写：抓 "<size>[/<line-height>] <family stack>"
    const m = /(?:^|\s)(\d*\.?\d+(?:px|rem|em|pt))(?:\s*\/\s*([\d.]+(?:px|rem|em|%)))?\s+(.+)$/i.exec(value.trim());
    if (m) {
      const size = toPx(m[1], col.rootFontSize);
      if (size !== null) col.bump('fontSize', String(size), { value: size, type: 'fontSize', use: { prop, selector: decl.selector } });
      if (m[2]) {
        const lh = /%$/.test(m[2]) ? round(Number(m[2]) / 100) : (toPx(m[2], col.rootFontSize) ?? Number(m[2]));
        if (Number.isFinite(lh)) col.bump('lineHeight', String(lh), { value: lh, type: 'number', use: { prop, selector: decl.selector } });
      }
      for (const fam of splitTopLevel(m[3], ',').map(normalizeFamily).filter((f) => f.key)) {
        col.bump('fontFamily', fam.key, { value: fam.display, type: 'fontFamily', use: { prop, selector: decl.selector, generic: fam.generic } });
      }
    }
  }

  // 3) 字号 / 字重 / 行高 / 字距
  if (prop === 'font-size') {
    const px = toPx(value, col.rootFontSize);
    if (px !== null) col.bump('fontSize', String(px), { value: px, type: 'fontSize', use: { prop, selector: decl.selector } });
    else col.skipped += 1;
  }
  if (prop === 'font-weight') {
    const kw = { normal: 400, bold: 700, bolder: 700, lighter: 300 }[v.toLowerCase()];
    const n = kw ?? (/^\d+$/.test(v) ? Number(v) : null);
    if (n !== null) col.bump('fontWeight', String(n), { value: n, type: 'fontWeight', use: { prop, selector: decl.selector } });
  }
  if (prop === 'line-height') {
    if (/^\d*\.?\d+$/.test(v)) col.bump('lineHeight', String(round(Number(v))), { value: round(Number(v)), type: 'number', use: { prop, selector: decl.selector } });
    else {
      const px = toPx(v, col.rootFontSize);
      if (px !== null) col.bump('lineHeight', String(px), { value: px, type: 'number', use: { prop, selector: decl.selector, unit: 'px' } });
    }
  }
  if (prop === 'letter-spacing') {
    if (/^normal$/i.test(v)) col.bump('letterSpacing', 'normal', { value: 'normal', type: 'dimension', use: { prop, selector: decl.selector } });
    else {
      const px = toPx(v, col.rootFontSize);
      if (px !== null) col.bump('letterSpacing', String(px), { value: px, type: 'dimension', use: { prop, selector: decl.selector } });
    }
  }

  // 4) 间距（margin/padding/gap 简写按空白切分）
  if (SPACING_PROPS.has(prop)) {
    for (const part of v.split(/\s+/)) {
      if (/^(auto|inherit|initial|unset|revert|-webkit-fill-available|fit-content|max-content|min-content)$/i.test(part)) continue;
      const px = toPx(part, col.rootFontSize);
      if (px === null) continue;
      col.bump('spacing', String(px), { value: px, type: 'dimension', use: { prop, selector: decl.selector } });
    }
  }

  // 5) 圆角（4 值 / 椭圆 "/" 写法）
  if (RADIUS_PROPS.has(prop)) {
    for (const part of v.split(/\s+|\//)) {
      if (!part) continue;
      if (/^50%$/.test(part)) { col.bump('radius', 'percent-50', { value: '50%', type: 'dimension', use: { prop, selector: decl.selector } }); continue; }
      if (/^(inherit|initial|unset)$/i.test(part)) continue;
      const px = toPx(part, col.rootFontSize);
      if (px !== null) col.bump('radius', String(px), { value: px, type: 'dimension', use: { prop, selector: decl.selector } });
    }
  }

  // 6) 边框宽度
  if (BORDER_WIDTH_PROPS.has(prop)) {
    const kw = BORDER_WIDTH_KEYWORDS[v.toLowerCase()];
    const px = kw ?? toPx(v, col.rootFontSize);
    if (px !== null) col.bump('borderWidth', String(px), { value: px, type: 'dimension', use: { prop, selector: decl.selector } });
  }
  if (BORDER_SHORTHANDS.has(prop)) {
    for (const p of v.split(/\s+/)) {
      const kw = BORDER_WIDTH_KEYWORDS[p.toLowerCase()];
      const px = kw ?? toPx(p, col.rootFontSize);
      if (px !== null) { col.bump('borderWidth', String(px), { value: px, type: 'dimension', use: { prop, selector: decl.selector } }); break; }
    }
  }

  // 7) 阴影（整串作为 token）
  if (prop === 'box-shadow' || prop === 'text-shadow') {
    const layers = splitTopLevel(value, ',').map((s) => normalizeValue(s)).filter(Boolean);
    if (!layers.length) return;
    if (/^(none|inherit|initial|unset)$/i.test(layers[0])) return;
    const norm = layers.join(', ');
    col.bump('shadow', norm, {
      value: norm, type: 'shadow',
      use: { prop, selector: decl.selector, layers: layers.length },
      extra: { layers: layers.length },
    });
  }

  // 8) 动效时长 / 缓动（长写 + transition/animation 简写）
  if (prop === 'transition-duration' || prop === 'animation-duration') {
    for (const part of splitTopLevel(value, ',')) {
      const ms = toMs(part);
      if (ms !== null) col.bump('duration', String(ms), { value: ms, type: 'duration', use: { prop, selector: decl.selector } });
    }
  }
  if (prop === 'transition-timing-function' || prop === 'animation-timing-function') {
    for (const part of splitTopLevel(value, ',')) {
      const e = part.trim().toLowerCase();
      if (EASING_RE.test(e)) col.bump('easing', normalizeValue(e), { value: normalizeValue(e), type: 'easing', use: { prop, selector: decl.selector } });
    }
  }
  if (prop === 'transition' || prop === 'animation') {
    // 简写里函数参数可能自带空格（cubic-bezier(0.4, 0, 0.2, 1)），不能简单按空白切词
    const durRe = /(^|[\s,(])(\d*\.?\d+)(ms|s)\b/gi;
    let dm;
    while ((dm = durRe.exec(value)) !== null) {
      const ms = toMs(dm[2] + dm[3]);
      if (ms !== null) col.bump('duration', String(ms), { value: ms, type: 'duration', use: { prop, selector: decl.selector } });
    }
    const easeRe = /(cubic-bezier\([^)]*\)|steps\([^)]*\)|linear\([^)]*\)|\b(ease-in-out|ease-in|ease-out|ease|linear|step-start|step-end)\b)/gi;
    let em;
    while ((em = easeRe.exec(value)) !== null) {
      const e = normalizeValue(em[1].toLowerCase());
      col.bump('easing', e, { value: e, type: 'easing', use: { prop, selector: decl.selector } });
    }
  }

  // 9) z-index
  if (prop === 'z-index' && /^-?\d+$/.test(v)) {
    col.bump('zIndex', v, { value: Number(v), type: 'number', use: { prop, selector: decl.selector } });
  }

  // 10) 断点（从 @media 条件里抓宽度）
  if (decl.media && decl.media.length) {
    for (const cond of decl.media) {
      if (!cond) continue;
      const re = /\((min|max)-width\s*:\s*([\d.]+)(px|rem|em)\)/gi;
      let m;
      while ((m = re.exec(cond)) !== null) {
        const px = toPx(m[2] + m[3], col.rootFontSize);
        if (px === null) continue;
        col.bump('breakpoint', String(px), { value: px, type: 'dimension', use: { prop: 'media', selector: decl.selector, kind: m[1].toLowerCase() } });
        if (!col.breakpoints.has(px)) col.breakpoints.set(px, new Set());
        col.breakpoints.get(px).add(m[1].toLowerCase());
      }
    }
  }
}

/* ================================================================== */
/* 自定义属性 → token（按 05 §2 槽位词典）                             */
/* ================================================================== */

const FONT_WEIGHT_KEYWORDS = { normal: 400, bold: 700, bolder: 700, lighter: 300 };

/**
 * 处理一个 `--name: value` 声明。
 * · 槽位词典命中 → 生成「具名 token」（键名沿用作者命名，如 --space-4 → space-4）
 * · 词典命中但值不合法 → meta.unclassified（不猜、不污染 scale）
 * · 词典不命中 → meta.unclassified
 */
export function ingestCustomProp(name, value, decl, col) {
  const cat = slotCategory(name, value);
  const use = { prop: `--${name}`, selector: decl.selector };
  if (!cat) {
    if (col.unclassified.length < 80) col.unclassified.push({ name: `--${name}`, value: value.slice(0, 120), line: decl.line });
    return;
  }
  const numericCat = ['spacing', 'fontSize', 'radius', 'borderWidth', 'letterSpacing', 'breakpoint'].includes(cat);
  if (numericCat) {
    const px = toPx(value, col.rootFontSize);
    if (px === null) {
      if (col.unclassified.length < 80) col.unclassified.push({ name: `--${name}`, value: value.slice(0, 120), line: decl.line });
      col.warn(`--${name} 的值不是可识别的尺寸（${value.slice(0, 60)}），未归类`, 'unclassified-value');
      return;
    }
    if (cat === 'radius' && /^50%$/.test(value)) {
      col.bump('radius', `radius:${name}`, { value: '50%', type: 'dimension', use, name });
      return;
    }
    col.bump(cat, `${cat}:${name}`, { value: px, type: 'dimension', use, name });
    return;
  }
  switch (cat) {
    case 'color':
      col.ingestColors(value, decl, { name });
      return;
    case 'fontFamily': {
      const families = splitTopLevel(value, ',').map(normalizeFamily).filter((f) => f.key && !f.key.startsWith('var('));
      if (!families.length) return;
      const stackKey = families.map((f) => f.key).join(', ');
      col.fontStacks.set(stackKey, (col.fontStacks.get(stackKey) || 0) + 1);
      col.bump('fontFamily', `fontFamily:${name}`, {
        value: families.map((f) => f.display).join(', '),
        type: 'fontFamily', use, name,
      });
      return;
    }
    case 'lineHeight': {
      if (/^\d*\.?\d+$/.test(value)) col.bump('lineHeight', `lineHeight:${name}`, { value: round(Number(value)), type: 'number', use, name });
      else {
        const px = toPx(value, col.rootFontSize);
        if (px !== null) col.bump('lineHeight', `lineHeight:${name}`, { value: px, type: 'number', use: { ...use, unit: 'px' }, name });
        else col.warn(`--${name} 的行高值无法解析: ${value.slice(0, 60)}`, 'unclassified-value');
      }
      return;
    }
    case 'fontWeight': {
      const kw = FONT_WEIGHT_KEYWORDS[value.toLowerCase()];
      const n = kw ?? (/^\d+$/.test(value) ? Number(value) : null);
      if (n !== null) col.bump('fontWeight', `fontWeight:${name}`, { value: n, type: 'fontWeight', use, name });
      return;
    }
    case 'shadow': {
      if (/^(none|inherit|initial|unset)$/i.test(value)) return; // none 不是 token
      const layers = splitTopLevel(value, ',').map((s) => normalizeValue(s)).filter(Boolean);
      if (!layers.length) return;
      col.bump('shadow', `shadow:${name}`, {
        value: layers.join(', '), type: 'shadow',
        use: { ...use, layers: layers.length }, extra: { layers: layers.length }, name,
      });
      return;
    }
    case 'duration': {
      const ms = toMs(value);
      if (ms !== null) col.bump('duration', `duration:${name}`, { value: ms, type: 'duration', use, name });
      return;
    }
    case 'easing': {
      const e = normalizeValue(value.toLowerCase());
      if (EASING_RE.test(e)) col.bump('easing', `easing:${name}`, { value: e, type: 'easing', use, name });
      return;
    }
    case 'zIndex': {
      if (/^-?\d+$/.test(value)) col.bump('zIndex', `zIndex:${name}`, { value: Number(value), type: 'number', use, name });
      return;
    }
    default:
      if (col.unclassified.length < 80) col.unclassified.push({ name: `--${name}`, value: value.slice(0, 120), line: decl.line });
  }
}

/* ================================================================== */
/* Scale 聚类                                                          */
/* ================================================================== */

const SCALE_SPEC = {
  fontSize: { tolerance: 0.06, minAbs: 0.5, unit: 'px', label: '字号阶梯' },
  spacing: { tolerance: 0.06, minAbs: 0.5, unit: 'px', label: '间距刻度' },
  radius: { tolerance: 0.08, minAbs: 0.5, unit: 'px', label: '圆角刻度' },
  lineHeight: { tolerance: 0.04, minAbs: 0.02, unit: '', label: '行高' },
  letterSpacing: { tolerance: 0.2, minAbs: 0.2, unit: 'px', label: '字距' },
  duration: { tolerance: 0.15, minAbs: 20, unit: 'ms', label: '动效时长' },
  borderWidth: { tolerance: 0.1, minAbs: 0.5, unit: 'px', label: '边框宽度' },
};

/**
 * 把数值聚类成 scale：相邻值足够接近时合并，代表值取「使用次数最多，其次最小值」。
 * @returns {{steps:Array<{value:number,count:number}>, unmapped:Array<{value:number,count:number,representative:number}>}}
 */
export function buildScale(entries, spec) {
  const { tolerance, minAbs } = spec;
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const clusters = [];
  for (const e of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const lastVal = last[last.length - 1].value;
      const diff = e.value - lastVal;
      const limit = Math.max(minAbs, tolerance * Math.max(Math.abs(e.value), Math.abs(lastVal)));
      if (diff <= limit) { last.push(e); continue; }
    }
    clusters.push([e]);
  }
  const steps = [];
  const unmapped = [];
  for (const cl of clusters) {
    // 代表值：使用次数最多；并列时优先「有作者命名」（--space-4）的那条，再取较小值
    const maxCount = Math.max(...cl.map((e) => e.count));
    const cands = cl.filter((e) => e.count === maxCount);
    const rep = cands.find((e) => e.name) || cands.reduce((a, b) => (a.value <= b.value ? a : b));
    steps.push({ value: rep.value, count: rep.count, entry: rep });
    for (const e of cl) if (e.value !== rep.value) unmapped.push({ value: e.value, count: e.count, representative: rep.value });
  }
  steps.sort((a, b) => a.value - b.value);
  unmapped.sort((a, b) => a.value - b.value);
  return { steps, unmapped };
}

/* ================================================================== */
/* 语义角色推断                                                        */
/* ================================================================== */

const ROLE_RULES = [
  // 最高优先：CSS 自定义属性的槽位名本身就是语义（--bg / --fg / --accent …）
  { role: 'bg', score: 9, test: (u) => /^--bg(-|$)/.test(u.prop) },
  { role: 'surface', score: 8, test: (u) => /^--surface/.test(u.prop) },
  { role: 'overlay', score: 8, test: (u) => /^--overlay/.test(u.prop) },
  { role: 'text', score: 8, test: (u) => /^--(fg|text)(-|$)/.test(u.prop) },
  { role: 'muted', score: 8, test: (u) => /^--(muted|meta)(-|$)/.test(u.prop) },
  { role: 'border', score: 8, test: (u) => /^--border/.test(u.prop) },
  { role: 'accent', score: 8, test: (u) => /^--accent/.test(u.prop) },
  { role: 'danger', score: 9, test: (u) => /^--(danger|error)/.test(u.prop) },
  { role: 'success', score: 9, test: (u) => /^--success/.test(u.prop) },
  { role: 'warning', score: 9, test: (u) => /^--(warn|warning)/.test(u.prop) },
  { role: 'info', score: 9, test: (u) => /^--info/.test(u.prop) },
  // 通用启发式
  { role: 'bg', score: 6, test: (u) => /(^|[\s,>])?(html|body)([\s,{:]|$)/.test(u.selector) && /background/.test(u.prop) },
  { role: 'bg', score: 5, test: (u) => u.prop === 'background-color' && /:root|html|body/.test(u.selector) },
  { role: 'surface', score: 3, test: (u) => /background/.test(u.prop) && /(card|panel|surface|sheet|modal|dialog|dropdown|popover|header|nav|sidebar|toolbar|input|table|menu|footer)/.test(u.selector) },
  { role: 'accent', score: 4, test: (u) => /background/.test(u.prop) && /(btn|button|\[type=["']?(submit|button)|\.primary|\.cta|\.accent)/.test(u.selector) },
  { role: 'accent', score: 3, test: (u) => u.prop === 'color' && /(^|[\s,>])a([\s,{:]|$)|\.(link|btn|button|primary)/.test(u.selector) },
  { role: 'text', score: 4, test: (u) => u.prop === 'color' && u.lum > 0.55 && !/muted|secondary|subtle|tertiary|hint|caption|placeholder|disabled/.test(u.selector) },
  { role: 'muted', score: 4, test: (u) => u.prop === 'color' && /muted|secondary|subtle|tertiary|hint|caption|placeholder|disabled/.test(u.selector) },
  { role: 'border', score: 4, test: (u) => /^(border|outline|column-rule)(-|$)/.test(u.prop) || /border-color|outline-color/.test(u.prop) },
  { role: 'danger', score: 6, test: (u) => /danger|error|invalid|destructive|delete/.test(u.selector) },
  { role: 'success', score: 6, test: (u) => /success|valid|positive|confirm/.test(u.selector) },
  { role: 'warning', score: 6, test: (u) => /warning|warn|caution/.test(u.selector) },
  { role: 'info', score: 6, test: (u) => /info|notice/.test(u.selector) },
  { role: 'shadow', score: 4, test: (u) => /shadow/.test(u.prop) },
  { role: 'overlay', score: 2, test: (u) => /background/.test(u.prop) && u.alpha < 1 },
  { role: 'border', score: 2, test: (u) => /divider|separator|(^|\s)hr(\s|,|{)/.test(u.selector) },
];

function inferRoles(colorRecords) {
  const scored = [];
  for (const rec of colorRecords) {
    const scores = new Map();
    for (const rule of ROLE_RULES) {
      let hits = 0;
      for (const u of rec.uses) if (rule.test(u)) hits += 1;
      if (hits > 0) scores.set(rule.role, (scores.get(rule.role) || 0) + rule.score * Math.min(hits, 3));
    }
    let best = null;
    for (const [role, score] of scores) {
      if (!best || score > best.score) best = { role, score };
    }
    scored.push({ rec, role: best && best.score > 0 ? best.role : null, score: best?.score || 0 });
  }
  // 同名角色按使用次数排序，第一个保留原名，其余加 -2/-3
  const byRole = new Map();
  for (const item of scored) {
    if (!item.role) continue;
    if (!byRole.has(item.role)) byRole.set(item.role, []);
    byRole.get(item.role).push(item);
  }
  const assigned = new Map();
  for (const [role, items] of byRole) {
    items.sort((a, b) => b.rec.count - a.rec.count || (a.rec.value < b.rec.value ? -1 : 1));
    items.forEach((item, idx) => assigned.set(item.rec.key, idx === 0 ? role : `${role}-${idx + 1}`));
  }
  return { scored, assigned };
}

/* ================================================================== */
/* 命名 + 输出                                                         */
/* ================================================================== */

function slug(text) {
  return String(text).trim().toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';
}

function tokenName(cat, key) {
  switch (cat) {
    case 'color': return `color-${key}`;
    case 'fontFamily': return `font-${key}`;
    case 'fontSize': return `font-size-${key}`;
    case 'fontWeight': return `font-weight-${key}`;
    case 'lineHeight': return `line-height-${key}`;
    case 'letterSpacing': return `letter-spacing-${key}`;
    case 'spacing': return `space-${key}`;
    case 'radius': return key === 'percent-50' ? 'radius-full' : `radius-${key}`;
    case 'shadow': return `shadow-${key}`;
    case 'borderWidth': return `border-width-${key}`;
    case 'duration': return `duration-${key}`;
    case 'easing': return `easing-${key}`;
    case 'zIndex': return `z-${key}`;
    case 'breakpoint': return `bp-${key}`;
    default: return `${cat}-${key}`;
  }
}

function cssValueFor(cat, rec) {
  const v = rec.value;
  switch (cat) {
    case 'fontSize': case 'spacing': case 'radius': case 'borderWidth': case 'breakpoint': case 'letterSpacing':
      return typeof v === 'number' ? `${v}px` : String(v);
    case 'lineHeight': return String(v);
    case 'duration': return `${v}ms`;
    default: return String(v);
  }
}

function buildTokenTree(col) {
  const tree = {};
  const decls = [];
  const groups = {};
  for (const cat of CATEGORY_ORDER) groups[cat] = {};

  /* ---------------- color：按值合并（同名/同色只留一个） ---------------- */
  const colorByHex = new Map();
  for (const rec of col.buckets.get('color').values()) {
    const hex = rec.value;
    const prev = colorByHex.get(hex);
    if (!prev) {
      colorByHex.set(hex, { key: hex, value: hex, count: rec.count, uses: [...rec.uses], extra: rec.extra, name: rec.name || null });
    } else {
      prev.count += rec.count;
      for (const u of rec.uses) if (prev.uses.length < 40) prev.uses.push(u);
      if (!prev.name && rec.name) prev.name = rec.name;
      if (!prev.extra && rec.extra) prev.extra = rec.extra;
    }
  }
  const colorRecs = [...colorByHex.values()].sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
  const roleInfo = inferRoles(colorRecs);
  const roleByKey = roleInfo.assigned;

  const colorNames = new Map();
  let paletteIdx = 0;
  for (const rec of colorRecs) {
    const role = roleByKey.get(rec.key);
    // 作者命名优先（--ink-0 / --accent-hover），无命名时才用 role / palette-N
    colorNames.set(rec.key, rec.name ? slug(rec.name) : (role || `palette-${++paletteIdx}`));
  }
  for (const rec of colorRecs) {
    const name = colorNames.get(rec.key);
    const role = roleByKey.get(rec.key) || null;
    groups.color[name] = {
      $value: rec.value,
      $type: 'color',
      role,
      $extensions: {
        'design-pipeline': {
          count: rec.count,
          props: [...new Set(rec.uses.map((u) => u.prop))].sort(),
          selectors: [...new Set(rec.uses.map((u) => u.selector))].slice(0, 8).sort(),
          ...(rec.name ? { sourceVar: rec.name } : {}),
          ...(rec.extra?.rgb ? { rgb: rec.extra.rgb } : {}),
        },
      },
    };
    decls.push({
      cat: 'color', name,
      cssVar: rec.name ? `--${slug(rec.name)}` : `--color-${name}`,
      value: rec.value, count: rec.count, role,
    });
  }

  const scaleOut = {};
  const unmappedOut = {};

  for (const cat of CATEGORY_ORDER) {
    if (cat === 'color') continue;
    const recs = [...col.buckets.get(cat).values()];
    if (recs.length === 0) continue;
    const numeric = ['fontSize', 'spacing', 'radius', 'lineHeight', 'letterSpacing', 'duration', 'borderWidth'].includes(cat);

    if (numeric && SCALE_SPEC[cat]) {
      const spec = SCALE_SPEC[cat];
      const numericRecs = recs.filter((r) => Number.isFinite(Number(r.value)));
      const passthrough = recs.filter((r) => !Number.isFinite(Number(r.value)));
      const { steps, unmapped } = buildScale(
        numericRecs.map((r) => ({ value: Number(r.value), count: r.count, name: r.name })),
        spec,
      );
      const byValue = new Map(numericRecs.map((r) => [Number(r.value), r]));
      let ordinal = 0;
      scaleOut[cat] = [];
      for (const s of steps) {
        const named = s.entry?.name || null;
        const key = named || (s.value === 0 ? '0' : String(++ordinal));
        const rec = (named && byValue.get(s.value)) || byValue.get(s.value) || { value: s.value, count: s.count };
        const cssVal = cssValueFor(cat, rec);
        groups[cat][key] = {
          $value: cssVal,
          $type: cat === 'lineHeight' ? 'number' : 'dimension',
          $extensions: { 'design-pipeline': { count: rec.count, step: s.value === 0 ? 0 : (named ? s.value : ordinal) } },
        };
        decls.push({ cat, name: key, cssVar: named ? `--${key}` : `--${tokenName(cat, key)}`, value: cssVal, count: rec.count, role: null, sourceVar: named ? `--${key}` : null });
        scaleOut[cat].push({ step: key, value: cssVal, px: s.value, count: rec.count, ...(named ? { name: `--${key}` } : {}) });
      }
      // 50% 之类非数值圆角：直接作为具名 token 透传
      for (const rec of passthrough) {
        const key = rec.name || slug(String(rec.value));
        groups[cat][key] = {
          $value: String(rec.value), $type: 'dimension',
          $extensions: { 'design-pipeline': { count: rec.count } },
        };
        decls.push({ cat, name: key, cssVar: rec.name ? `--${key}` : `--${tokenName(cat, key)}`, value: String(rec.value), count: rec.count, role: null });
      }
      unmappedOut[cat] = unmapped.map((u) => ({ ...u, unit: spec.unit }));
    } else {
      const sorted = recs.sort((a, b) => {
        if (cat === 'fontWeight' || cat === 'zIndex') return Number(a.value) - Number(b.value);
        if (cat === 'shadow') return b.count - a.count || (String(a.value) < String(b.value) ? -1 : 1);
        return String(a.value) < String(b.value) ? -1 : 1;
      });
      let bezierIdx = 0;
      for (const rec of sorted) {
        let key;
        if (rec.name) key = slug(rec.name);
        else if (cat === 'fontFamily') key = slug(rec.value);
        else if (cat === 'easing') key = /^[a-z-]+$/i.test(rec.value) ? slug(rec.value) : `cubic-bezier-${++bezierIdx}`;
        else if (cat === 'shadow') key = String(sorted.indexOf(rec) + 1);
        else key = String(rec.key);
        const $type = cat === 'fontFamily' ? 'fontFamily' : cat === 'shadow' ? 'shadow' : cat === 'easing' ? 'string' : 'number';
        groups[cat][key] = {
          $value: rec.value,
          $type,
          $extensions: { 'design-pipeline': { count: rec.count, ...(rec.extra?.layers ? { layers: rec.extra.layers } : {}), ...(rec.name ? { sourceVar: `--${rec.name}` } : {}) } },
        };
        decls.push({
          cat, name: key,
          cssVar: rec.name ? `--${slug(rec.name)}` : `--${tokenName(cat, key)}`,
          value: String(rec.value), count: rec.count, role: null,
        });
      }
    }
  }

  for (const cat of CATEGORY_ORDER) {
    if (Object.keys(groups[cat]).length === 0) delete groups[cat];
    else tree[cat] = groups[cat];
  }
  return { tree, decls, scaleOut, unmappedOut, roleByKey, colors: colorRecs };
}

function renderCss(decls) {
  const lines = ['/* generated by extract-tokens.mjs — 不要手改；重新生成即可 */', ':root {'];
  let lastCat = null;
  for (const d of decls) {
    if (d.cat !== lastCat) {
      if (lastCat) lines.push('');
      lines.push(`  /* ${d.cat} */`);
      lastCat = d.cat;
    }
    lines.push(`  ${d.cssVar}: ${d.value};`);
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

const CATEGORY_TITLES = {
  color: 'Color 颜色', fontFamily: 'Font Family 字体', fontSize: 'Font Size 字号',
  fontWeight: 'Font Weight 字重', lineHeight: 'Line Height 行高', letterSpacing: 'Letter Spacing 字距',
  spacing: 'Spacing 间距', radius: 'Radius 圆角', shadow: 'Shadow 阴影',
  borderWidth: 'Border Width 边框', duration: 'Duration 时长', easing: 'Easing 缓动',
  zIndex: 'Z-Index 层级', breakpoint: 'Breakpoint 断点',
};

function renderMd({ tree, decls, scaleOut, unmappedOut, meta }) {
  const out = [];
  out.push('# Design Tokens');
  out.push('');
  out.push(`> 由 \`extract-tokens.mjs\` 生成，${meta.sources.length} 个源文件，${decls.length} 个 token。不要手改。`);
  out.push('');
  out.push(`- 提取时间: ${meta.extractedAt}`);
  out.push(`- 输入 hash: \`${meta.inputHash.slice(0, 16)}…\``);
  out.push(`- 源文件: ${meta.sources.map((s) => `\`${s.file}\``).join(', ')}`);
  out.push('');
  out.push('> 命名约定：`--space-<step>` / `--font-size-<step>` 里的 step 是 **scale 序号**（从小到大 1..N，0 单独保留给 0 值），');
  out.push('> 不是 px 数值；具体 px 见「值」列与 Scale 小节。');
  out.push('');

  for (const cat of CATEGORY_ORDER) {
    if (!tree[cat]) continue;
    out.push(`## ${CATEGORY_TITLES[cat] || cat}`);
    out.push('');
    out.push('| token | 值 | 角色 | 使用次数 |');
    out.push('| --- | --- | --- | --- |');
    for (const key of Object.keys(tree[cat])) {
      const t = tree[cat][key];
      const d = decls.find((x) => x.cat === cat && x.name === key);
      const cssVar = d?.cssVar || `--${tokenName(cat, key)}`;
      out.push(`| \`${cssVar}\` | \`${t.$value}\` | ${t.role || '—'} | ${d?.count ?? 0} |`);
    }
    out.push('');
  }

  const scaleCats = Object.keys(scaleOut).filter((c) => scaleOut[c].length);
  if (scaleCats.length) {
    out.push('## Scale（聚类后的数值阶梯）');
    out.push('');
    for (const cat of scaleCats) {
      out.push(`**${CATEGORY_TITLES[cat] || cat}**：${scaleOut[cat].map((s) => `${s.value}${s.step !== '0' ? ` (step ${s.step})` : ''}`).join(' · ')}`);
      out.push('');
    }
  }

  const unmappedCats = Object.keys(unmappedOut).filter((c) => unmappedOut[c].length);
  if (unmappedCats.length) {
    out.push('## Unmapped（未落在 scale 上的值）');
    out.push('');
    out.push('这些值被聚类到邻近 token，但自身不是代表值 —— 通常是四舍五入 / 手写误差，建议统一。');
    out.push('');
    for (const cat of unmappedCats) {
      out.push(`- **${cat}**: ${unmappedOut[cat].map((u) => `${u.value}${u.unit} → ${u.representative}${u.unit} (${u.count}次)`).join(', ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}

/* ================================================================== */
/* 读取输入                                                            */
/* ================================================================== */

async function collectInputs(inputPath) {
  const abs = path.resolve(inputPath);
  const stat = await fsp.stat(abs).catch(() => null);
  if (!stat) throw new CdpError(`输入不存在: ${abs}`, '传一个 HTML 文件或包含 *.html/*.css 的目录。');
  if (stat.isFile()) {
    const ext = path.extname(abs).toLowerCase();
    if (!HTML_EXTS.has(ext) && !CSS_EXTS.has(ext)) {
      throw new UsageError(`不支持的输入类型 ${ext}，只接受 ${[...HTML_EXTS, ...CSS_EXTS].join('/')}`);
    }
    return { root: path.dirname(abs), files: [{ abs, rel: path.basename(abs), size: stat.size }], single: true };
  }
  const files = await walkFiles(abs, { exts: new Set([...HTML_EXTS, ...CSS_EXTS]) });
  if (files.length === 0) throw new CdpError(`${abs} 下没有 .html/.css 文件`, '确认目录是否正确，或先放入 HTML 原型。');
  return { root: abs, files, single: false };
}

function elementDescriptorAt(html, index) {
  let open = html.lastIndexOf('<', index);
  for (let guard = 0; guard < 6 && open !== -1; guard += 1) {
    const snippet = html.slice(open, index);
    const tag = /^<([a-zA-Z][\w-]*)/.exec(snippet)?.[1];
    if (tag) {
      const id = /\bid\s*=\s*["']([^"']+)["']/.exec(snippet)?.[1];
      const classes = [...snippet.matchAll(/\bclass\s*=\s*["']([^"']*)["']/g)]
        .flatMap((x) => x[1].split(/\s+/)).filter(Boolean);
      return {
        tag: tag.toLowerCase(), id, classes,
        selector: `${tag.toLowerCase()}${id ? `#${id}` : ''}${classes.map((c) => `.${c}`).join('')}`,
      };
    }
    open = html.lastIndexOf('<', open - 1);
  }
  return null;
}

/** 从一个 HTML 文件里抽出 <style> 块、style="" 属性，并返回本地 link 的 CSS 路径 */
async function collectFromHtml(htmlPath, col) {
  const html = await fsp.readFile(htmlPath, 'utf8');
  col.addSource(htmlPath, Buffer.from(html, 'utf8'), 'html');
  col.varRefs += (html.match(/var\(\s*--/g) || []).length;
  const lineStarts = computeLineStarts(html);

  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(html)) !== null) {
    const blockStart = m.index + m[0].indexOf('>') + 1;
    const lineOffset = lineOfIndex(lineStarts, blockStart) - 1;
    for (const d of parseCssDeclarations(m[1], { file: htmlPath, lineOffset })) ingestDeclaration(d, col);
  }

  const attrRe = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi;
  while ((m = attrRe.exec(html)) !== null) {
    const desc = elementDescriptorAt(html, m.index);
    const line = lineOfIndex(lineStarts, m.index);
    for (const d of parseInlineDeclarations(m[2], { selector: desc ? desc.selector : 'inline', line, file: htmlPath })) {
      ingestDeclaration(d, col);
    }
  }

  const linkRe = /<link\b[^>]*>/gi;
  const links = [];
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    if (!/rel\s*=\s*(["'])?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = /\bhref\s*=\s*(["'])([^"']+)\1/i.exec(tag)?.[2];
    if (!href || /^(https?:)?\/\//i.test(href) || href.startsWith('data:')) continue;
    links.push(decodeURIComponent(href.split(/[?#]/)[0]));
  }
  return links;
}

/* ================================================================== */
/* 主流程                                                             */
/* ================================================================== */

async function main() {
  const { help, opts, positionals } = parseCli(process.argv.slice(2), {
    options: {
      '--out': { key: 'out', type: 'string', default: 'tokens' },
      '--name': { key: 'name', type: 'string', default: 'tokens' },
      '--root-font-size': { key: 'rootFontSize', type: 'number', default: 16 },
    },
    minPositional: 1,
    maxPositional: 1,
  });
  if (help) { console.log(HELP); return 0; }

  const { root, files } = await collectInputs(positionals[0]);
  const col = new Collector(opts.rootFontSize);
  const seen = new Set(files.map((f) => f.abs));

  for (const f of files) {
    const ext = path.extname(f.abs).toLowerCase();
    if (HTML_EXTS.has(ext)) {
      for (const href of await collectFromHtml(f.abs, col)) {
        const resolved = path.resolve(path.dirname(f.abs), href);
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        const buf = await fsp.readFile(resolved).catch(() => null);
        if (!buf) { col.warnings.push(`link 指向的 CSS 不存在: ${href} (来自 ${f.rel})`); continue; }
        col.addSource(resolved, buf, 'css-linked');
        const cssText = buf.toString('utf8');
        col.varRefs += (cssText.match(/var\(\s*--/g) || []).length;
        for (const d of parseCssDeclarations(cssText, { file: path.relative(process.cwd(), resolved) })) ingestDeclaration(d, col);
      }
    } else {
      const buf = await fsp.readFile(f.abs);
      col.addSource(f.abs, buf, 'css');
      const cssText = buf.toString('utf8');
      col.varRefs += (cssText.match(/var\(\s*--/g) || []).length;
      for (const d of parseCssDeclarations(cssText, { file: f.rel })) ingestDeclaration(d, col);
    }
  }

  const { tree, decls, scaleOut, unmappedOut, roleByKey, colors } = buildTokenTree(col);
  const inputHash = sha256Buf(Buffer.from(col.sources.map((s) => `${s.file}:${s.sha256}`).sort().join('\n'), 'utf8'));

  // 退化检测（P0-2）：输入大量 var(--x) 引用，却没能提出 fontSize/spacing/radius —— P5 Gate 必须红
  const catCount = (cat) => (tree[cat] ? Object.keys(tree[cat]).length : 0);
  const missingCore = ['fontSize', 'spacing', 'radius'].filter((c) => catCount(c) === 0);
  const degenerate = col.varRefs >= 5 && missingCore.length > 0;
  if (degenerate) {
    col.warn(
      `输入有 ${col.varRefs} 处 var(--x) 引用，但 ${missingCore.join('/')} 提取为空：` +
      '要么是 token-first 原型（应能按 --* 槽位提出来，检查命名是否符合 05 §2），' +
      '要么需要改用 CSS 变量解析/先补字面值；该 token 集不可用于下游。',
      'degenerate',
    );
  }

  const meta = {
    generator: `extract-tokens.mjs@${VERSION}`,
    extractedAt: nowIso(),
    root,
    inputHash,
    sources: col.sources.map((s) => ({
      file: (path.relative(root, s.file) || path.basename(s.file)).split(path.sep).join('/'),
      sha256: s.sha256,
      bytes: s.bytes,
      kind: s.kind,
    })).sort((a, b) => (a.file < b.file ? -1 : 1)),
    assumptions: { rootFontSize: opts.rootFontSize, emApprox: true, note: 'em 按 rootFontSize 近似换算为 px' },
    counts: {
      declarations: col.declCount,
      tokens: decls.length,
      colors: colors.length,
      skipped: col.skipped,
      skippedVar: col.skippedVar,
      varRefs: col.varRefs,
      unclassified: col.unclassified.length,
      warnings: col.warningCount,
      degenerate,
    },
    warnings: col.warnings,
    unclassified: col.unclassified.slice(0, 40),
    fontStacks: [...col.fontStacks.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 20).map(([stack, count]) => ({ stack, count })),
    breakpoints: [...col.breakpoints.entries()].sort((a, b) => a[0] - b[0]).map(([px, kinds]) => ({ px, kinds: [...kinds].sort() })),
    roles: Object.fromEntries([...roleByKey.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
  };

  const tokensJson = {
    $description: 'Extracted design tokens (W3C DTCG 风格子集：$value/$type + role + $extensions)',
    meta,
    ...tree,
    scale: scaleOut,
    unmapped: unmappedOut,
  };

  const outDir = path.resolve(opts.out);
  await fsp.mkdir(outDir, { recursive: true });
  const base = opts.name.replace(/\.(json|css|md)$/i, '');
  const jsonPath = await writeJson(path.join(outDir, `${base}.json`), tokensJson);
  const cssPath = path.join(outDir, `${base}.css`);
  await fsp.writeFile(cssPath, renderCss(decls), 'utf8');
  const mdPath = path.join(outDir, `${base}.md`);
  await fsp.writeFile(mdPath, renderMd({ tree, decls, scaleOut, unmappedOut, meta }) + '\n', 'utf8');

  console.log(`\n${degenerate ? '✖' : '✔'} 设计 token 提取完成 (${col.declCount} 条声明, ${col.sources.length} 个源文件)`);
  for (const w of col.warnings) console.log(`  ⚠ ${w.message || w}`);
  const byCat = decls.reduce((acc, d) => { acc[d.cat] = (acc[d.cat] || 0) + 1; return acc; }, {});
  console.log('\n分类统计:');
  for (const cat of CATEGORY_ORDER) if (byCat[cat]) console.log(`  ${cat.padEnd(14)} ${String(byCat[cat]).padStart(3)} 个 token`);
  console.log(`\nvar(--x) 引用 ${col.varRefs} 处；含 var() 跳过 ${col.skippedVar} 条声明；未归类自定义属性 ${col.unclassified.length} 个`);
  if (colors.length) {
    console.log('\n高频颜色（前 8）:');
    for (const rec of colors.slice(0, 8)) {
      console.log(`  ${rec.value}  ×${String(rec.count).padStart(2)}  name=${rec.name ? `--${rec.name}` : '—'}  role=${roleByKey.get(rec.key) || '—'}`);
    }
  }
  if (scaleOut.spacing) console.log(`\nspacing scale: ${scaleOut.spacing.map((s) => s.value).join(' / ')}`);
  if (scaleOut.fontSize) console.log(`font-size scale: ${scaleOut.fontSize.map((s) => s.value).join(' / ')}`);
  if (scaleOut.radius) console.log(`radius scale: ${scaleOut.radius.map((s) => s.value).join(' / ')}`);
  const unmappedCount = Object.values(unmappedOut).reduce((n, arr) => n + arr.length, 0);
  console.log(`\n未落在 scale 上的值: ${unmappedCount} 个${unmappedCount ? '（见 tokens.md 的 Unmapped）' : ''}`);
  console.log(`\n输出:\n  ${jsonPath}\n  ${cssPath}\n  ${mdPath}`);
  if (degenerate) {
    console.error(
      `\n✖ 提取退化（meta.counts.degenerate=true）：缺失 ${missingCore.join(' / ')}。\n` +
      `  原因：输入是 var(--x) 风格，但对应槽位没被识别（05 §2 词典：--space-* / --text-* / --radius-* …）。\n` +
      `  该 token 集不可用于 P5 下游：修好命名后重跑，或先给字面值再提取。`,
    );
    return 1;
  }
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }).catch((err) => die(err));
}
