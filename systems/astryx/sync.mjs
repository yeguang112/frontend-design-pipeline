#!/usr/bin/env node
/**
 * sync.mjs — 从 npm 同步 Astryx 的 token 快照（Astryx 是 MIT，见 LICENSE）
 *
 * 做什么：
 *   1. npm pack @astryxdesign/core + @astryxdesign/theme-neutral
 *   2. 解包出 dist/astryx.css（基础 token）与 dist/theme.css（neutral 主题覆盖）
 *   3. 只保留设计 token（color/spacing/radius/shadow/duration/ease/font/text…），
 *      生成 tokens/astryx-tokens.css 与 tokens/astryx-tokens.json
 *   4. 更新 manifest.json（版本、sha256、计数、同步时间）
 *   5. 可选：从 core 的 api-report.md 生成 components/astryx-components.json
 *
 * 用法:
 *   node systems/astryx/sync.mjs [--version 0.7.11] [--cache <dir>] [--skip-download]
 *                                [--components <api-report.md>] [--out <dir>]
 *
 * 退出码: 0 成功 / 2 用法或环境错误
 *
 * 依赖：Node 18+；npm；tar（Windows 10+/macOS/Linux 自带）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';

const HELP = `sync.mjs — 同步 Astryx token 快照

用法:
  node systems/astryx/sync.mjs [选项]

选项:
  --version <v>        指定 Astryx npm 版本（默认读 manifest.json）
  --cache <dir>        npm tarball 缓存目录（默认 <repo>/.cache/astryx）
  --skip-download     复用缓存里已有的 tarball，不联网
  --components <file> 用 core 的 api-report.md 刷新组件清单
  --out <dir>         输出目录（默认 systems/astryx）
  -h, --help

退出码: 0 成功 / 2 用法错误或环境缺失`;

function fail(msg) { console.error('✖ ' + msg); process.exit(2); }

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) { console.log(HELP); process.exit(0); }
let version = null, cacheDir = path.resolve(HERE, '../../.cache/astryx'), skipDownload = false, componentsFile = null, outDir = HERE, themeName = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--version') version = args[++i];
  else if (a === '--cache') cacheDir = path.resolve(args[++i]);
  else if (a === '--skip-download') skipDownload = true;
  else if (a === '--components') componentsFile = path.resolve(args[++i]);
  else if (a === '--theme') themeName = args[++i];
  else if (a === '--out') outDir = path.resolve(args[++i]);
  else fail(`未知参数: ${a}`);
}

const manifestPath = path.join(outDir, 'manifest.json');
let manifest = {};
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { /* ignore */ }
}
if (!version) version = manifest.version;
if (!themeName) themeName = manifest.theme || 'neutral';
if (!version) fail('缺少版本：传 --version，或先有 manifest.json');

const CORE = '@astryxdesign/core';
const THEME = `@astryxdesign/theme-${themeName}`;

fs.mkdirSync(cacheDir, { recursive: true });

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', ...opts });
  if (r.error) fail(`${cmd} 执行失败: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} 退出码 ${r.status}`);
}

function npm(argv) {
  run(isWin ? 'npm.cmd' : 'npm', [...argv, '--cache', path.join(cacheDir, 'npm-cache')]);
}

function packTarball(pkg, ver) {
  const name = pkg.replace('@', '').replace('/', '-');
  const expected = path.join(cacheDir, `${name}-${ver}.tgz`);
  if (!skipDownload) {
    console.log(`• npm pack ${pkg}@${ver}`);
    npm(['pack', `${pkg}@${ver}`, '--pack-destination', cacheDir]);
  }
  if (!fs.existsSync(expected)) fail(`找不到 tarball: ${expected}`);
  return expected;
}

function extract(tgz, dest, members) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  run('tar', ['-xzf', tgz, '-C', dest, ...(Array.isArray(members) ? members : [members])]);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/* ---------- token 解析 ---------- */
const TOKEN_PREFIXES = [
  'color', 'spacing', 'size', 'radius', 'shadow', 'duration', 'ease', 'font',
  'text', 'border', 'layout', 'container', 'indicator', 'spinner', 'separator',
  'table', 'tree', 'step', 'focus', 'resize', 'selectable', 'button', 'overlay'
];
const isToken = (name) => TOKEN_PREFIXES.some((p) => name === p || name.startsWith(p + '-'));

function parseDecls(css) {
  const out = new Map();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(css))) {
    const name = m[1];
    if (name.startsWith('x-') || name.startsWith('_')) continue;
    if (!isToken(name)) continue;
    out.set(name, m[2].trim().replace(/\s+/g, ' '));
  }
  return out;
}

function categoryOf(name) {
  const p = name.split('-')[0];
  const map = {
    color: 'color', spacing: 'spacing', size: 'size', radius: 'radius', shadow: 'shadow',
    duration: 'duration', ease: 'easing', font: 'font', text: 'typography',
    border: 'border', layout: 'layout', container: 'layout', indicator: 'component',
    spinner: 'component', separator: 'component', table: 'component', tree: 'component',
    step: 'component', focus: 'component', resize: 'component', selectable: 'component',
    button: 'component', overlay: 'color'
  };
  return map[p] || 'other';
}

const TYPE = {
  color: 'color', spacing: 'dimension', size: 'dimension', radius: 'dimension',
  shadow: 'shadow', duration: 'duration', easing: 'string', font: 'fontFamily',
  typography: 'typography', border: 'dimension', layout: 'dimension',
  component: 'dimension', other: 'string'
};

/* ---------- 主流程 ---------- */
console.log(`\nAstryx 同步 v${version}\n  core : ${CORE}\n  theme: ${THEME} (neutral)\n  cache: ${cacheDir}\n`);

const coreTgz = packTarball(CORE, version);
const themeTgz = packTarball(THEME, version);

const coreExtract = path.join(cacheDir, 'extract-core');
const themeExtract = path.join(cacheDir, 'extract-theme');
extract(coreTgz, coreExtract, ['package/dist/astryx.css', 'package/package.json']);
extract(themeTgz, themeExtract, ['package/dist/theme.css', 'package/package.json']);

const baseCssPath = path.join(coreExtract, 'package/dist/astryx.css');
const themeCssPath = path.join(themeExtract, 'package/dist/theme.css');
const baseCss = fs.readFileSync(baseCssPath, 'utf8');
const themeCss = fs.readFileSync(themeCssPath, 'utf8');
const base = parseDecls(baseCss);
const theme = parseDecls(themeCss);
if (!base.size) fail('解析不到 Astryx token，检查 dist/astryx.css 是否变化');
if (!theme.size) fail('解析不到 neutral 主题 token，检查 dist/theme.css 是否变化');

const corePkg = JSON.parse(fs.readFileSync(path.join(coreExtract, 'package/package.json'), 'utf8'));
const themePkg = JSON.parse(fs.readFileSync(path.join(themeExtract, 'package/package.json'), 'utf8'));

/* 输出 tokens.css：基础 + 主题覆盖（保持原 cascade 语义） */
const header = `/*! Astryx token snapshot — MIT License, Copyright (c) 2026 Meta Platforms, Inc.
 *  Source : meta/astryx (${CORE}@${corePkg.version}, ${THEME}@${themePkg.version})
 *  Generated: systems/astryx/sync.mjs — do not edit by hand.
 *  Note: values may use light-dark(...) / rem / var(); resolve in a modern browser.
 */
`;
const block = (selector, map) => {
  const lines = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  --${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
};
const tokensCss = header + '\n' + block(':root', base) + '\n' + block(`[data-astryx-theme="${themeName}"]`, theme);

const tokensDir = path.join(outDir, 'tokens');
fs.mkdirSync(tokensDir, { recursive: true });
const tokensCssPath = path.join(tokensDir, 'astryx-tokens.css');
fs.writeFileSync(tokensCssPath, tokensCss);

/* 输出 tokens.json（本项目 schema：按类别分组） */
const grouped = {};
for (const [name, value] of [...base.entries(), ...theme.entries()]) {
  const cat = categoryOf(name);
  grouped[cat] ||= {};
  const src = theme.has(name) ? 'theme' : 'base';
  grouped[cat][name] = { $value: value, $type: TYPE[cat], source: src };
}
const json = {
  $description: 'Astryx design tokens snapshot (meta/astryx, MIT). Generated by systems/astryx/sync.mjs.',
  meta: {
    system: 'astryx',
    version: corePkg.version,
    theme: themeName,
    themeVersion: themePkg.version,
    syncedAt: new Date().toISOString(),
    source: {
      repo: 'https://github.com/meta/astryx',
      core: `${CORE}@${corePkg.version}`,
      theme: `${THEME}@${themePkg.version}`
    },
    counts: {
      baseTokens: base.size,
      themeTokens: theme.size,
      total: base.size + [...theme.keys()].filter((k) => !base.has(k)).length,
      byCategory: Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, Object.keys(v).length]))
    },
    notes: [
      'tokens.css 中 :root 为基础 token，[data-astryx-theme="neutral"] 为主题覆盖。',
      'light-dark(...) 需浏览器支持；旧浏览器请用主题编译产物。',
      '值里的 var(...) 保持原样，未展开。'
    ]
  },
  ...grouped
};
const tokensJsonPath = path.join(tokensDir, 'astryx-tokens.json');
fs.writeFileSync(tokensJsonPath, JSON.stringify(json, null, 2));

/* 组件清单（可选） */
let componentCount = manifest.capabilities?.components || 0;
let componentsJsonPath = path.join(outDir, 'components', 'astryx-components.json');
if (componentsFile) {
  const text = fs.readFileSync(componentsFile, 'utf8');
  const comps = [...text.matchAll(/^component ([A-Za-z0-9]+)\(props: ([A-Za-z0-9]+)\)/gm)]
    .map((m) => ({ name: m[1], propsType: m[2] }));
  if (!comps.length) fail(`没从 ${componentsFile} 解析到组件；确认是 core 的 api-report.md`);
  componentCount = comps.length;
  const compsOut = {
    $description: 'Astryx component inventory (meta/astryx core api-report). MIT.',
    meta: { system: 'astryx', version: corePkg.version, count: comps.length, source: 'packages/core/api-report.md' },
    components: comps
  };
  fs.mkdirSync(path.dirname(componentsJsonPath), { recursive: true });
  fs.writeFileSync(componentsJsonPath, JSON.stringify(compsOut, null, 2));
}

/* manifest */
const rel = (p) => path.relative(outDir, p).split(path.sep).join('/');
const files = {};
for (const f of [tokensCssPath, tokensJsonPath, componentsJsonPath]) {
  if (!fs.existsSync(f)) continue;
  files[rel(f)] = { sha256: sha256(f), bytes: fs.statSync(f).size };
}
const nextManifest = {
  schema: 'design-pipeline/system/v1',
  id: 'astryx',
  name: 'Astryx by Meta',
  kind: 'official-implementation-system',
  description: 'Meta 内部使用 8 年的开源设计系统：150+ 可访问组件、品牌级主题、暗色模式、CLI，React 19 + StyleX，token 为 CSS 自定义属性。',
  homepage: 'https://astryx.atmeta.com/',
  repo: 'https://github.com/meta/astryx',
  license: 'MIT',
  licenseFile: 'LICENSE',
  npm: { core: `${CORE}@${corePkg.version}`, theme: `${THEME}@${themePkg.version}` },
  version: corePkg.version,
  syncedAt: new Date().toISOString(),
  theme: themeName,
  themes: ['neutral', 'stone', 'gothic', 'matcha', 'butter', 'y2k', 'chocolate', 'probe'],
  capabilities: {
    components: componentCount,
    cssVariables: new Set([...base.keys(), ...theme.keys()]).size,
    frameworks: ['React 19+', 'StyleX'],
    vanillaCss: true,
    darkMode: true,
    theming: 'token-level'
  },
  whenToUse: [
    '生产级 Web 应用 / 后台 / 控制台，需要 150+ 可访问组件',
    '团队使用 React 19+，希望组件行为与可访问性由系统负责',
    '需要多品牌/多主题切换（token 级），不想 fork 组件',
    'AI agent 需要一份稳定、可读的组件与 token 契约来生成代码'
  ],
  notFor: [
    '纯营销落地页且想要强品牌叙事（先用 brand-specs 风格参考）',
    '需要非 React 组件实现（如小程序原生），只可借用 token 契约',
    '要求完全自定义视觉、不接受组件内置行为约束'
  ],
  sync: 'node systems/astryx/sync.mjs',
  files
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(nextManifest, null, 2));

console.log(`✔ tokens: ${rel(tokensCssPath)} (${base.size} base + ${theme.size} theme)`);
console.log(`✔ tokens.json: ${rel(tokensJsonPath)}`);
if (componentsFile) console.log(`✔ components: ${rel(componentsJsonPath)} (${componentCount})`);
console.log(`✔ manifest: manifest.json`);
