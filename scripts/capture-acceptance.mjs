// 用法:
//   node capture-acceptance.mjs --config accept.config.json [--browser chrome|edge|<exe>] [--cdp-url <url>] [--dry-run] [--help]
//
// 逐「route × state × viewport × theme」截图做验收留档，输出 PNG + manifest.json（含 sha256/尺寸/耗时/失败原因）。
// 退出码: 0 全部成功 / 1 有失败组合 / 2 用法或配置错误
//
// config 示例见 __fixtures__/accept.config.json，字段:
//   baseUrl       必填。file:// 绝对 URL、http(s) URL，或相对 config 的本地路径（自动转 file://）
//   out           输出目录（相对 config 文件所在目录，默认 acceptance）
//   viewport      单个 {width,height,deviceScaleFactor}；或用 viewports: [...] 多视口
//   themes        ["light","dark"]；默认 ["light"]
//   routes        [{id, path}]；path 拼在 baseUrl 后（如 "#/home"）
//   states        [{id, actions:[...]}]；actions 支持 click/fill/eval/wait/scroll/hover/none
//   freezeAnimations  true 时注入 CSS 并把 prefers-reduced-motion 设为 reduce
//   waitMs        截图前静置时间（默认 300）
//   fullPage      true=整页截图（默认 true），false=仅视口
//
// 输出: <out>/<route>/<state>--<w>x<h>--<theme>.png + <out>/manifest.json

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseCli, readJson, writeJson, die, sha256Buf, nowIso, humanBytes, UsageError, CdpError,
  launchBrowser, attachBrowser, resolveCdpUrl, pngSize,
} from './lib/cdp.mjs';

const VERSION = '1.0.0';
const HELP = `capture-acceptance.mjs — 逐状态截图验收（route × state × viewport × theme）

用法:
  node capture-acceptance.mjs --config <accept.config.json> [选项]

选项:
  --config <file>   必填，验收配置 JSON
  --browser <x>     chrome | edge | exe 绝对路径（默认自动探测）
  --cdp-url <url>   附着到已运行的 Chromium（http://127.0.0.1:9222 或 ws://…）
  --dry-run         不启动浏览器，只打印并校验截图矩阵（用于 CI 预检 / 无浏览器环境）
  --json <file>     额外把「本次运行摘要」写到指定路径
  -h, --help        显示本帮助

输出:
  <out>/<route>/<state>--<w>x<h>--<theme>.png     每张截图
  <out>/manifest.json                            每张图的 sha256 / 尺寸 / 耗时 / 失败原因

退出码: 0 全部成功 / 1 至少一个组合失败 / 2 用法或配置错误

已知限制:
  - CDP 后端只支持 Chromium（Chrome/Edge）；Firefox/Safari 不支持。
  - file:// 截图会受本机字体与 DPI 影响，跨机器像素级对比前请先统一字体环境。
`;

const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

/* ------------------------------------------------------------------ */
/* 配置                                                               */
/* ------------------------------------------------------------------ */

function normalizeColorScheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

function resolveBaseUrl(baseUrl, configDir) {
  if (/^https?:\/\//i.test(baseUrl)) return baseUrl.replace(/\/+$/, '');
  if (baseUrl.startsWith('file://')) return baseUrl;
  // 相对/绝对本地路径 -> file:// URL
  const abs = path.isAbsolute(baseUrl) ? baseUrl : path.resolve(configDir, baseUrl);
  return pathToFileURL(abs).href;
}

const ACTIONS = ['click', 'fill', 'eval', 'wait', 'scroll', 'hover', 'none', 'screenshot-only'];

/** 校验 + 归一化一个 state（顶层 states 与 routes[].states 共用） */
function normalizeState(s, where) {
  if (!s || !s.id) throw new UsageError(`${where} 缺少 id`, `收到: ${JSON.stringify(s)}`);
  if (s.actions && !Array.isArray(s.actions)) throw new UsageError(`${where} (state "${s.id}") 的 actions 必须是数组`);
  for (const [i, a] of (s.actions || []).entries()) {
    if (!a || !ACTIONS.includes(a.type)) {
      throw new UsageError(`${where} (state "${s.id}") 第 ${i + 1} 个 action 类型 "${a?.type}" 不支持`, `可用: ${ACTIONS.join(', ')}`);
    }
    if ((a.type === 'click' || a.type === 'fill' || a.type === 'hover') && !a.selector) {
      throw new UsageError(`${where} (state "${s.id}" 第 ${i + 1} 个 action (${a.type}) 需要 selector`);
    }
    if (a.type === 'eval' && typeof a.script !== 'string') {
      throw new UsageError(`${where} (state "${s.id}" 第 ${i + 1} 个 action (eval) 需要 script 字符串`);
    }
  }
  return { id: String(s.id), actions: s.actions || [] };
}

async function loadConfig(configPath) {
  const abs = path.resolve(configPath);
  const configDir = path.dirname(abs);
  let raw;
  try {
    raw = await readJson(abs);
  } catch (err) {
    throw new CdpError(`读取配置失败: ${abs}: ${err.message}`, '确认是合法 JSON（注意不要在 JSON 里写注释）。');
  }
  if (raw.baseUrl === undefined) throw new UsageError('config 缺少必填字段 "baseUrl"', '参考 templates/accept.config.json 的写法。');
  if (!Array.isArray(raw.routes) || raw.routes.length === 0) throw new UsageError('config.routes 必须是非空数组');
  for (const r of raw.routes) if (!r.id) throw new UsageError('每个 route 需要 id', `收到: ${JSON.stringify(r)}`);

  // P0-1 兼容：顶层 states（新模板）或 routes[].states（旧模板，每个 route 用自己的）
  const topStates = Array.isArray(raw.states) && raw.states.length ? raw.states.map((s, i) => normalizeState(s, `states[${i}]`)) : null;
  const perRouteStates = raw.routes.some((r) => Array.isArray(r.states) && r.states.length);
  if (!topStates && !perRouteStates) {
    throw new UsageError(
      'config 缺少 states：顶层 states 或 routes[].states 至少要有一个',
      '新模板用顶层 "states": [{id, actions}]；旧模板用 "routes": [{id, states: [...]}]（脚本两种都支持）。',
    );
  }
  const configDirAbs = configDir;
  const viewports = Array.isArray(raw.viewports) && raw.viewports.length
    ? raw.viewports
    : [raw.viewport || { width: 1440, height: 900, deviceScaleFactor: 1 }];
  const themes = Array.isArray(raw.themes) && raw.themes.length ? raw.themes : ['light'];
  const outDir = path.isAbsolute(raw.out || 'acceptance') ? (raw.out || 'acceptance') : path.resolve(configDirAbs, raw.out || 'acceptance');
  const config = {
    file: abs,
    baseUrl: resolveBaseUrl(raw.baseUrl, configDirAbs),
    out: outDir,
    viewports: viewports.map((v, i) => {
      if (!v.width || !v.height) throw new UsageError(`viewport[${i}] 需要 width/height`);
      return {
        width: Number(v.width), height: Number(v.height),
        deviceScaleFactor: Number(v.deviceScaleFactor || 1),
        label: v.label || `${Number(v.width)}x${Number(v.height)}`,
      };
    }),
    themes,
    routes: raw.routes.map((r) => ({
      id: String(r.id),
      path: r.path ?? '',
      url: r.url || null,
      states: (Array.isArray(r.states) && r.states.length
        ? r.states.map((s, i) => normalizeState(s, `routes[${r.id}].states[${i}]`))
        : topStates || []),
    })),
    states: (topStates || []).map((s) => ({ id: s.id, actions: s.actions })),
    statesMode: topStates ? 'top-level' : 'per-route',
    freezeAnimations: raw.freezeAnimations !== false,
    waitForFonts: raw.waitForFonts === true,
    waitMs: Number.isFinite(raw.waitMs) ? Number(raw.waitMs) : 300,
    fullPage: raw.fullPage !== false,
    format: raw.format === 'jpeg' || raw.format === 'jpg' ? 'jpeg' : 'png',
    timeoutMs: Number(raw.timeoutMs || 30000),
    retries: Number(raw.retries || 0),
    themeStrategy: raw.themeStrategy || 'both',
    settleAfterActions: Number(raw.settleAfterActions || 0),
    thresholds: {
      pixelDiffRatio: Number(raw.thresholds?.pixelDiffRatio ?? 0.003),
      minScreenshotBytes: Number(raw.thresholds?.minScreenshotBytes ?? 5120),
      minPixelStdDev: Number(raw.thresholds?.minPixelStdDev ?? 1.0),
    },
  };
  if (config.routes.some((r) => r.states.length === 0)) {
    throw new UsageError('存在没有 states 的 route', `每个 route 要么自己有 states，要么顶层 states 非空。`);
  }
  return config;
}

function routeUrl(config, route) {
  if (route.url) return route.url;
  const base = config.baseUrl;
  const p = route.path || '';
  if (!p) return base;
  if (p.startsWith('#') || p.startsWith('?')) return base + p;
  return base.replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '');
}

/** 生成截图矩阵（顺序确定：route -> state -> viewport -> theme） */
function buildMatrix(config) {
  const items = [];
  for (const route of config.routes) {
    for (const state of route.states) {
      for (const vp of config.viewports) {
        for (const theme of config.themes) {
          items.push({
            route: route.id,
            state: state.id,
            theme,
            viewport: { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor },
            url: routeUrl(config, route),
            file: [route.id, `${state.id}--${vp.width}x${vp.height}--${theme}.${config.format === 'jpeg' ? 'jpg' : 'png'}`].join('/'),
            actions: state.actions,
          });
        }
      }
    }
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* 页面操作                                                           */
/* ------------------------------------------------------------------ */

async function applyTheme(page, theme, strategy) {
  const script = `(() => {
    const t = ${JSON.stringify(theme)};
    const root = document.documentElement;
    const s = ${JSON.stringify(strategy)};
    if (s === 'dataset' || s === 'both') { root.dataset.theme = t; root.setAttribute('data-theme', t); }
    if (s === 'class' || s === 'both') {
      root.classList.toggle('dark', t === 'dark');
      root.classList.toggle('light', t === 'light');
    }
    if (s === 'attr') root.setAttribute('data-theme', t);
    root.style.colorScheme = t;
    try { localStorage.setItem('theme', t); localStorage.setItem('color-scheme', t); } catch (e) {}
    if (typeof window.__setTheme === 'function') { try { window.__setTheme(t); } catch (e) {} }
    return t;
  })()`;
  return page.evaluate(script);
}

function initScriptFor({ theme, freeze }) {
  return `(() => {
  const THEME = ${JSON.stringify(theme)};
  const FREEZE_CSS = ${JSON.stringify(FREEZE_CSS)};
  const applyTheme = () => {
    try {
      const root = document.documentElement;
      if (!root) return;
      root.dataset.theme = THEME;
      root.setAttribute('data-theme', THEME);
      root.classList.toggle('dark', THEME === 'dark');
      root.classList.toggle('light', THEME === 'light');
      root.style.colorScheme = THEME;
    } catch (e) {}
  };
  const applyFreeze = () => {
    try {
      if (!document.documentElement) return;
      let el = document.getElementById('dsh-capture-freeze');
      if (!el) {
        el = document.createElement('style');
        el.id = 'dsh-capture-freeze';
        (document.head || document.documentElement).appendChild(el);
      }
      el.textContent = FREEZE_CSS;
    } catch (e) {}
  };
  try { localStorage.setItem('theme', THEME); localStorage.setItem('color-scheme', THEME); } catch (e) {}
  ${freeze ? 'applyFreeze();' : ''}
  applyTheme();
  if (typeof window.__setTheme === 'function') { try { window.__setTheme(THEME); } catch (e) {} }
  document.addEventListener('DOMContentLoaded', () => { applyTheme(); ${freeze ? 'applyFreeze();' : ''} }, { once: true });
  window.addEventListener('load', () => { applyTheme(); ${freeze ? 'applyFreeze();' : ''} }, { once: true });
})()`;
}

async function runActions(page, actions, { timeoutMs }) {
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const label = `action#${i + 1} (${a.type}${a.selector ? ` ${a.selector}` : ''})`;
    try {
      switch (a.type) {
        case 'click':
          await page.click(a.selector, { timeout: timeoutMs });
          break;
        case 'fill':
          await page.fill(a.selector, String(a.value ?? ''), { timeout: timeoutMs });
          break;
        case 'eval': {
          const out = await page.evaluate(`(() => { ${a.script} })()`);
          if (out === false) throw new CdpError(`${label} 返回 false`, '检查 eval 脚本里的条件（如 window.__setEmpty 是否存在）。');
          break;
        }
        case 'wait':
          if (a.selector) await page.waitForSelector(a.selector, { timeout: timeoutMs, visible: a.visible === true });
          else await page.waitForTimeout(Number(a.ms ?? a.duration ?? 300));
          break;
        case 'scroll':
          await page.scrollTo({ y: Number(a.y ?? 0), x: Number(a.x ?? 0), selector: a.selector || null });
          break;
        case 'hover':
          await page.hover(a.selector);
          break;
        case 'none':
        case 'screenshot-only':
          break;
        default:
          throw new UsageError(`未知 action 类型 ${a.type}`);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      e.message = `${label} 失败: ${e.message}`;
      throw e;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 单组合截图                                                         */
/* ------------------------------------------------------------------ */

async function captureOne(browser, config, item, index) {
  const started = Date.now();
  const outFile = path.join(config.out, item.file);
  const entry = {
    index,
    route: item.route,
    state: item.state,
    theme: item.theme,
    viewport: item.viewport,
    url: item.url,
    file: item.file,
    ok: false,
    durationMs: 0,
    sha256: null,
    bytes: 0,
    width: 0,
    height: 0,
    error: null,
  };
  let page;
  const consoleErrors = [];
  try {
    page = await browser.newPage();
    await page.setDeviceMetrics(item.viewport);
    await page.setEmulatedMedia({
      prefersColorScheme: normalizeColorScheme(item.theme),
      ...(config.freezeAnimations ? { prefersReducedMotion: 'reduce' } : {}),
    });
    // A9：收集 console error / 页面异常（供 accept-verify 判定）
    page.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') consoleErrors.push({ kind: 'console', text: (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 500) });
    });
    page.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails || {};
      consoleErrors.push({ kind: 'pageerror', text: String(d.exception?.description || d.text || 'unknown').slice(0, 500) });
    });
    await page.addInitScript(initScriptFor({ theme: item.theme, freeze: config.freezeAnimations }));
    await page.goto(item.url, { waitUntil: 'load', timeout: config.timeoutMs });
    if (config.waitForFonts) {
      await page.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true').catch(() => {});
    }
    await applyTheme(page, item.theme, config.themeStrategy);
    if (item.actions.length) await page.waitForTimeout(50);
    await runActions(page, item.actions, { timeoutMs: config.timeoutMs });
    if (config.settleAfterActions) await page.waitForTimeout(config.settleAfterActions);
    await page.waitForTimeout(config.waitMs);
    const shot = await page.screenshot({
      fullPage: config.fullPage,
      width: item.viewport.width,
      height: item.viewport.height,
      deviceScaleFactor: item.viewport.deviceScaleFactor,
      format: config.format,
    });
    if (!shot.buffer || shot.buffer.length < 40) {
      throw new CdpError('截图数据为空', '页面可能白屏或渲染崩溃；先用普通浏览器打开同一 URL 确认。');
    }
    const dims = pngSize(shot.buffer);
    if (config.format === 'png' && (!dims.width || !dims.height)) {
      throw new CdpError('截图返回的不是合法 PNG', 'Chromium 版本过旧或 CDP 后端不是 Chromium？换 --browser chrome/edge 重试。');
    }
    await fsp.mkdir(path.dirname(outFile), { recursive: true });
    await fsp.writeFile(outFile, shot.buffer);
    entry.ok = true;
    entry.sha256 = sha256Buf(shot.buffer);
    entry.bytes = shot.buffer.length;
    entry.width = dims.width;
    entry.height = dims.height;
    entry.error = null;
  } catch (err) {
    entry.error = err?.message || String(err);
    entry.hint = err?.hint || undefined;
  } finally {
    if (page) await page.close().catch(() => {});
  }
  entry.consoleErrors = consoleErrors;
  entry.durationMs = Date.now() - started;
  return entry;
}

/* ------------------------------------------------------------------ */
/* 主流程                                                             */
/* ------------------------------------------------------------------ */

async function main() {
  const { help, opts } = parseCli(process.argv.slice(2), {
    options: {
      '--config': { key: 'config', type: 'string' },
      '--browser': { key: 'browser', type: 'string' },
      '--cdp-url': { key: 'cdpUrl', type: 'string' },
      '--dry-run': { key: 'dryRun', type: 'boolean', default: false },
      '--json': { key: 'json', type: 'string' },
      '--only': { key: 'only', type: 'string' },
    },
    minPositional: 0,
    maxPositional: 0,
  });
  if (help) { console.log(HELP); return 0; }
  if (!opts.config) throw new UsageError('缺少 --config <accept.config.json>', '示例: node capture-acceptance.mjs --config accept.config.json');

  const config = await loadConfig(opts.config);
  let matrix = buildMatrix(config);
  if (opts.only) {
    const [r, s] = opts.only.split(':');
    matrix = matrix.filter((m) => m.route === r && (!s || m.state === s));
    if (!matrix.length) throw new UsageError(`--only ${opts.only} 没有匹配的组合`, `可用 route: ${config.routes.map((r) => r.id).join(', ')}`);
  }

  const stateCount = config.routes.reduce((n, r) => n + r.states.length, 0);
  console.log(`\n${opts.dryRun ? '[dry-run] ' : ''}验收矩阵: ${config.routes.length} route × state（${config.statesMode}，共 ${stateCount} 个组合输入）× ` +
    `${config.viewports.length} viewport × ${config.themes.length} theme = ${matrix.length} 张`);
  console.log(`  baseUrl: ${config.baseUrl}`);
  console.log(`  out:     ${config.out}`);
  console.log(`  视口:    ${config.viewports.map((v) => `${v.width}x${v.height}@${v.deviceScaleFactor}x`).join(', ')}`);
  console.log(`  主题:    ${config.themes.join(', ')}${config.freezeAnimations ? '（冻结动画）' : ''}${config.fullPage ? '（整页）' : '（仅视口）'}${config.waitForFonts ? '（等字体）' : ''}`);
  for (const route of config.routes) {
    console.log(`  [${route.id}] states: ${route.states.map((s) => s.id).join(', ')}`);
  }
  for (const item of matrix) console.log(`    ${item.file}`);

  if (opts.dryRun) {
    console.log(`\n[dry-run] 未启动浏览器；矩阵与文件名校验通过。去掉 --dry-run 即可实际截图。`);
    if (opts.json) {
      await writeJson(path.resolve(opts.json), {
        tool: `capture-acceptance.mjs@${VERSION}`, dryRun: true, generatedAt: nowIso(), config: { ...config }, plan: matrix.map((m) => m.file),
      });
    }
    return 0;
  }

  let browser;
  let browserInfo = null;
  const startedAt = nowIso();
  try {
    if (opts.cdpUrl) {
      const wsUrl = await resolveCdpUrl(opts.cdpUrl);
      browser = await attachBrowser(wsUrl, { timeoutMs: 15000 });
      browserInfo = { name: 'attached', path: wsUrl, version: null };
    } else {
      browser = await launchBrowser({ browser: opts.browser, timeoutMs: 30000 });
      const ver = await browser.version();
      browserInfo = { name: browser.browserName, path: browser.browserPath, version: ver?.product || null };
    }
    console.log(`\n浏览器: ${browserInfo.name} ${browserInfo.version || ''}`.trim());

    const captures = [];
    for (let i = 0; i < matrix.length; i++) {
      const item = matrix[i];
      process.stdout.write(`  [${String(i + 1).padStart(2)}/${matrix.length}] ${item.file} `);
      const entry = await captureOne(browser, config, item, i);
      captures.push(entry);
      if (entry.ok) {
        console.log(`✔ ${entry.width}x${entry.height} ${humanBytes(entry.bytes)} ${entry.durationMs}ms`);
      } else {
        console.log(`✖ ${entry.error}`);
      }
    }

    const failed = captures.filter((c) => !c.ok);
    const byTheme = {};
    const byRoute = {};
    for (const c of captures) {
      byTheme[c.theme] = (byTheme[c.theme] || 0) + (c.ok ? 1 : 0);
      byRoute[c.route] = (byRoute[c.route] || 0) + (c.ok ? 1 : 0);
    }
    const manifest = {
      tool: `capture-acceptance.mjs@${VERSION}`,
      startedAt,
      finishedAt: nowIso(),
      config: {
        file: config.file, baseUrl: config.baseUrl, out: config.out,
        viewports: config.viewports, themes: config.themes,
        routes: config.routes,
        states: [...new Set(config.routes.flatMap((r) => r.states.map((s) => s.id)))].sort().map((id) => ({ id })),
        statesMode: config.statesMode,
        freezeAnimations: config.freezeAnimations, waitMs: config.waitMs,
        fullPage: config.fullPage, format: config.format,
        waitForFonts: config.waitForFonts, thresholds: config.thresholds,
      },
      browser: browserInfo,
      summary: {
        total: captures.length,
        ok: captures.length - failed.length,
        failed: failed.length,
        bytes: captures.reduce((n, c) => n + (c.bytes || 0), 0),
        byTheme,
        byRoute,
      },
      captures,
      failed: failed.map((c) => ({ file: c.file, route: c.route, state: c.state, theme: c.theme, error: c.error })),
    };
    const manifestPath = path.join(config.out, 'manifest.json');
    await writeJson(manifestPath, manifest);
    if (opts.json) await writeJson(path.resolve(opts.json), manifest);

    console.log(`\n${failed.length ? '✖' : '✔'} 截图完成: ${manifest.summary.ok}/${manifest.summary.total} 成功` +
      `（${humanBytes(manifest.summary.bytes)}）`);
    if (failed.length) {
      console.log('\n失败组合:');
      for (const f of failed) console.log(`  ✖ ${f.file}\n    ${f.error}`);
    }
    console.log(`\nmanifest: ${manifestPath}`);
    return failed.length ? 1 : 0;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }).catch((err) => die(err));
}

export { loadConfig, buildMatrix, routeUrl, captureOne, initScriptFor, runActions, applyTheme, FREEZE_CSS };
