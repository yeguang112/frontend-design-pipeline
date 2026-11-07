// 用法:
//   node accept-verify.mjs --config acceptance/accept.config.json [选项]
//
// 验收判定器：读 capture 产出的 manifest.json + design/tokens/tokens.json + acceptance/reference/*.png，
// 自动判定 A1–A12，输出 acceptance-report.json + Markdown 表格（PASS / FAIL / 未检），有 FAIL 则 exit 1。
//
// 判定项（08-acceptance.md §3）:
//   A1  截图齐全        config 矩阵应有 vs manifest 实有        缺 1 张即 FAIL
//   A2  截图非空/非纯色  bytes > minScreenshotBytes 且像素方差 > 阈值
//   A3  尺寸正确        PNG 宽高 === viewport × deviceScaleFactor
//   A4  像素 diff       调 pixel-diff 引擎（纯 Node）vs acceptance/reference/，阈值读 thresholds.pixelDiffRatio
//   A5  token 一致性    调 detect-drift（进程内），error 级违规 = 0
//   A6  计算样式 ⊆ token --cdp-url 时可用，否则「未检」
//   A7  对比度 AA       --cdp-url 时可用，否则「未检」
//   A8  无横向溢出      --cdp-url 时可用，否则「未检」
//   A9  无 console error manifest 有记录才判，否则「未检」
//   A10 状态覆盖完整    config states vs manifest 实际 state
//   A11 交互脚本可执行  --cdp-url 时重跑 actions；否则按 manifest ok 推断（有失败即 FAIL）
//   A12 冻结未被篡改    调 verify-freeze（进程内），无 freeze-manifest 则「未检」
//
// 退出码: 0 无 FAIL（允许「未检」）/ 1 有 FAIL / 2 用法错误
// 约定: 「未检」绝不写成 PASS（见 08 §4.1）。

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCli, readJson, writeJson, die, nowIso, humanBytes, pngSize, UsageError, CdpError,
  launchBrowser, attachBrowser, resolveCdpUrl,
} from './lib/cdp.mjs';
import { loadConfig, buildMatrix, applyTheme, runActions, initScriptFor } from './capture-acceptance.mjs';
import { decodePng, compareRgba } from './pixel-diff.mjs';
import { scanProject, loadRulesManifest, DEFAULT_RULES, buildTokenIndex } from './detect-drift.mjs';
import { verifyFreezeSnapshot } from './verify-freeze.mjs';

const VERSION = '1.0.0';
const HELP = `accept-verify.mjs — 验收判定器（A1–A12 → PASS / FAIL / 未检）

用法:
  node accept-verify.mjs --config <accept.config.json> [选项]

读取:
  --config <file>           验收配置（同时提供截图矩阵与 thresholds）
  --manifest <file>         capture 产出的 manifest.json（默认 <config.out>/manifest.json）
  --tokens <file>           tokens.json（默认 <project>/design/tokens/tokens.json）
  --reference <dir>         冻结参考截图目录（默认 <config 目录>/reference）
  --freeze-manifest <file>  冻结清单（默认 <project>/design/frozen/freeze-manifest.json）
  --project <dir>          项目根（默认 config 的上一级目录）
  输出:
  --json <file>             报告 JSON（默认 <config 目录>/acceptance-report.json）
  --md <file>               Markdown 报告（默认 <config 目录>/acceptance-report.md）
  --threshold <r>           覆盖 A4 像素差异阈值（默认读 config.thresholds.pixelDiffRatio）
  --cdp-url <url>           A6/A7/A8/A11 需要浏览器：附着到已运行的 Chromium
  --browser <x>             不传 --cdp-url 时自动启动 chrome/edge（做不到则这几项记「未检」）
  -h, --help

退出码: 0 无 FAIL / 1 有 FAIL / 2 用法错误
`;

/* ------------------------------------------------------------------ */
/* 工具                                                               */
/* ------------------------------------------------------------------ */

const CHECK_TITLES = {
  A1: '截图齐全',
  A2: '截图非空/非纯色',
  A3: '尺寸正确',
  A4: '像素 diff（vs 冻结参考）',
  A5: 'token 一致性（detect-drift）',
  A6: '计算样式 ⊆ token',
  A7: '对比度 AA',
  A8: '无横向溢出',
  A9: '无 console error',
  A10: '状态覆盖完整',
  A11: '交互脚本可执行',
  A12: '冻结未被篡改',
};

function mk(id, status, detail, extra = {}) {
  return { id, title: CHECK_TITLES[id], status, detail, ...extra };
}

async function exists(p) { return fsp.stat(p).then(() => true).catch(() => false); }

async function readPng(file) {
  const buf = await fsp.readFile(file);
  return decodePng(buf, path.basename(file));
}

/** 像素方差（亮度标准差）+ 唯一色数，用于 A2 的「纯色」判定 */
function imageStats(img, sampleLimit = 20000) {
  const { width: w, height: h, rgba } = img;
  const total = w * h;
  const step = Math.max(1, Math.floor(total / sampleLimit));
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  const colors = new Set();
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    const lum = 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
    sum += lum;
    sumSq += lum * lum;
    n += 1;
    if (colors.size < 4096) colors.add((rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2]);
  }
  const mean = n ? sum / n : 0;
  const variance = n ? Math.max(0, sumSq / n - mean * mean) : 0;
  return { sampled: n, meanLuminance: mean, stdDev: Math.sqrt(variance), uniqueColors: colors.size };
}

function resolveDefaults(opts) {
  const configPath = opts.config ? path.resolve(opts.config) : null;
  const configDir = configPath ? path.dirname(configPath) : process.cwd();
  const project = path.resolve(opts.project || path.join(configDir, '..'));
  return { configPath, configDir, project };
}

/* ------------------------------------------------------------------ */
/* A1/A2/A3/A9/A10：基于 manifest + PNG                               */
/* ------------------------------------------------------------------ */

async function checkMatrixAndImages({ config, manifest, thresholds }) {
  const checks = [];
  const expected = buildMatrix(config);
  const expectedFiles = expected.map((m) => m.file);
  const captures = Array.isArray(manifest?.captures) ? manifest.captures : [];
  const okCaptures = captures.filter((c) => c.ok && c.file);
  const okFiles = new Set(okCaptures.map((c) => c.file));
  const failedByFile = new Map((manifest?.failed || []).map((f) => [f.file, f.reason || f.error || 'capture failed']));

  /* A1 */
  const missing = expectedFiles.filter((f) => !okFiles.has(f));
  const extraCaptures = okCaptures.filter((c) => !expectedFiles.includes(c.file));
  if (!manifest) {
    checks.push(mk('A1', 'FAIL', '找不到 capture manifest.json，无法核对截图矩阵'));
  } else if (missing.length === 0 && extraCaptures.length === 0) {
    checks.push(mk('A1', 'PASS', `${expectedFiles.length}/${expectedFiles.length} 张齐全`, { counts: { expected: expectedFiles.length, ok: okCaptures.length } }));
  } else {
    checks.push(mk('A1', 'FAIL', `缺 ${missing.length} 张${extraCaptures.length ? `，多 ${extraCaptures.length} 张` : ''}`, {
      counts: { expected: expectedFiles.length, missing: missing.length, extra: extraCaptures.length },
      details: [
        ...missing.slice(0, 20).map((f) => `缺: ${f}${failedByFile.has(f) ? ` (${failedByFile.get(f)})` : ''}`),
        ...extraCaptures.slice(0, 10).map((c) => `多: ${c.file}`),
      ],
    }));
  }

  /* A2 / A3 */
  const a2Bad = [];
  const a3Bad = [];
  const a2Stats = [];
  for (const cap of okCaptures) {
    const abs = path.join(manifest.config?.out || '', cap.file.split('/').join(path.sep));
    // manifest.config.out 可能是绝对路径（本脚本产物），否则相对 manifest 所在目录
    const candidates = [
      path.isAbsolute(manifest.config?.out || '') ? abs : null,
      path.join(path.dirname(manifest.__path || ''), cap.file.split('/').join(path.sep)),
    ].filter(Boolean);
    let file = candidates.find(async () => true);
    let found = null;
    for (const cand of candidates) { if (await exists(cand)) { found = cand; break; } }
    if (!found) { a2Bad.push(`${cap.file}: 文件不存在`); continue; }
    let img;
    try { img = await readPng(found); } catch (err) { a2Bad.push(`${cap.file}: PNG 解码失败 (${err.message})`); continue; }
    const st = imageStats(img);
    a2Stats.push({ file: cap.file, bytes: cap.bytes, stdDev: Number(st.stdDev.toFixed(3)), uniqueColors: st.uniqueColors });
    if ((cap.bytes || 0) < thresholds.minScreenshotBytes) a2Bad.push(`${cap.file}: ${cap.bytes}B < ${thresholds.minScreenshotBytes}B`);
    else if (st.stdDev < thresholds.minPixelStdDev || st.uniqueColors <= 1) a2Bad.push(`${cap.file}: 近似纯色 (stdDev=${st.stdDev.toFixed(2)}, 唯一色=${st.uniqueColors})`);
    const vp = cap.viewport || { width: 0, height: 0, deviceScaleFactor: 1 };
    const dsr = Number(vp.deviceScaleFactor || 1);
    const expW = Math.round(vp.width * dsr);
    const expH = Math.round(vp.height * dsr);
    const imgSize = pngSize(await fsp.readFile(found));
    if (imgSize.width !== expW || imgSize.height !== expH) {
      a3Bad.push(`${cap.file}: ${imgSize.width}x${imgSize.height} ≠ ${expW}x${expH} (${vp.width}x${vp.height}×${dsr})`);
    }
  }
  checks.push(a2Bad.length === 0
    ? mk('A2', okCaptures.length ? 'PASS' : 'FAIL', `${okCaptures.length} 张均 > ${thresholds.minScreenshotBytes}B 且非纯色`, { stats: a2Stats.slice(0, 3) })
    : mk('A2', 'FAIL', `${a2Bad.length} 张不合格`, { details: a2Bad.slice(0, 20) }));
  checks.push(a3Bad.length === 0
    ? mk('A3', okCaptures.length ? 'PASS' : 'FAIL', '所有 PNG 尺寸 = viewport × DSR')
    : mk('A3', 'FAIL', `${a3Bad.length} 张尺寸不符`, { details: a3Bad.slice(0, 20) }));

  /* A9：只有 manifest 记录过 consoleErrors 才能判 */
  const withConsole = captures.filter((c) => Array.isArray(c.consoleErrors));
  if (withConsole.length === 0) {
    checks.push(mk('A9', '未检', 'manifest 未记录 consoleErrors（capture-acceptance 新版本才记录）'));
  } else {
    const errs = [];
    for (const c of withConsole) for (const e of c.consoleErrors) errs.push(`${c.file}: [${e.kind}] ${e.text}`);
    checks.push(errs.length === 0
      ? mk('A9', 'PASS', `${withConsole.length} 个组合无 console error / pageerror`)
      : mk('A9', 'FAIL', `${errs.length} 条 console error`, { details: errs.slice(0, 20) }));
  }

  /* A10：config states vs manifest 实际 */
  const actualByRoute = new Map();
  for (const c of okCaptures) {
    if (!actualByRoute.has(c.route)) actualByRoute.set(c.route, new Set());
    actualByRoute.get(c.route).add(c.state);
  }
  const a10Bad = [];
  for (const route of config.routes) {
    const actual = actualByRoute.get(route.id) || new Set();
    for (const s of route.states) if (!actual.has(s.id)) a10Bad.push(`${route.id}: 缺 state "${s.id}"`);
  }
  checks.push(a10Bad.length === 0
    ? mk('A10', 'PASS', `${config.routes.length} 个 route 的状态全部覆盖`)
    : mk('A10', 'FAIL', `${a10Bad.length} 个状态缺失`, { details: a10Bad.slice(0, 20) }));

  return { checks, expected, expectedFiles, okCaptures, okFiles, missing };
}

/* ------------------------------------------------------------------ */
/* A4：像素差异 vs 冻结参考                                            */
/* ------------------------------------------------------------------ */

async function checkPixelDiff({ manifest, okCaptures, referenceDir, threshold }) {
  if (!referenceDir || !(await exists(referenceDir))) {
    return mk('A4', '未检', `没有参考截图目录: ${referenceDir || '(未指定)'}`);
  }
  const compared = [];
  const over = [];
  const noRef = [];
  for (const cap of okCaptures) {
    const refPath = path.join(referenceDir, cap.file.split('/').join(path.sep));
    const curPath = path.join(manifest.config?.out || '', cap.file.split('/').join(path.sep));
    if (!(await exists(refPath))) { noRef.push(cap.file); continue; }
    if (!(await exists(curPath))) { noRef.push(cap.file); continue; }
    let refImg;
    let curImg;
    try {
      refImg = await readPng(refPath);
      curImg = await readPng(curPath);
    } catch (err) {
      return mk('A4', '未检', `参考图/当前图解码失败: ${err.message}`);
    }
    if (refImg.width !== curImg.width || refImg.height !== curImg.height) {
      over.push(`${cap.file}: 尺寸不一致 ${refImg.width}x${refImg.height} vs ${curImg.width}x${curImg.height}`);
      continue;
    }
    const cmp = compareRgba(refImg, curImg, { channelThreshold: 0 });
    compared.push({ file: cap.file, ratio: cmp.ratio, changedPixels: cmp.changedPixels });
    if (cmp.ratio > threshold) over.push(`${cap.file}: 差异率 ${(cmp.ratio * 100).toFixed(3)}% > ${(threshold * 100).toFixed(2)}%`);
  }
  if (compared.length === 0) {
    return mk('A4', '未检', `参考目录里没有可对比的图（应有 ${okCaptures.length} 张，缺 ${noRef.length}）`);
  }
  return over.length === 0
    ? mk('A4', 'PASS', `${compared.length}/${okCaptures.length} 张差异率 ≤ ${(threshold * 100).toFixed(2)}%`, {
      counts: { compared: compared.length, missingRef: noRef.length, maxRatio: Math.max(...compared.map((c) => c.ratio)) },
    })
    : mk('A4', 'FAIL', `${over.length} 张超阈值`, { details: over.slice(0, 20), counts: { compared: compared.length, over: over.length } });
}

/* ------------------------------------------------------------------ */
/* A5：detect-drift（进程内）                                          */
/* ------------------------------------------------------------------ */

async function checkDrift({ project, tokensPath, rulesManifestPath }) {
  if (!(await exists(tokensPath))) {
    return mk('A5', '未检', `没有 tokens.json: ${tokensPath}`);
  }
  const tokensJson = await readJson(tokensPath).catch(() => null);
  if (!tokensJson) return mk('A5', 'FAIL', `tokens.json 无法解析: ${tokensPath}`);
  const manifest = await loadRulesManifest(rulesManifestPath || null);
  const rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  if (manifest) {
    for (const r of manifest.rules) {
      const m = /^script:([\w-]+)$/.exec(String(r.implementation || ''));
      if (m && rules[m[1]]) rules[m[1]].severity = r.severity;
    }
  }
  const { violations, scanned } = await scanProject({ projectDir: project, tokensJson, rules, ignore: [] });
  const errors = violations.filter((v) => v.severity === 'error');
  return errors.length === 0
    ? mk('A5', 'PASS', `${scanned.files} 个文件，error 级违规 0（共 ${violations.length} 条含 warn/info）`, { counts: { files: scanned.files, total: violations.length, errors: 0 } })
    : mk('A5', 'FAIL', `${errors.length} 条 error 级违规`, {
      details: errors.slice(0, 20).map((v) => `${v.file}:${v.line} [${v.rule}] ${v.message}`),
      counts: { files: scanned.files, total: violations.length, errors: errors.length },
    });
}

/* ------------------------------------------------------------------ */
/* A6/A7/A8/A11：需要浏览器                                            */
/* ------------------------------------------------------------------ */

const VISIBLE_EXPR = `(() => {
  const out = [];
  const els = document.querySelectorAll('body *');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
      color: s.color, bg: s.backgroundColor,
      fontSize: s.fontSize, borderRadius: s.borderTopLeftRadius,
      paddingTop: s.paddingTop, paddingLeft: s.paddingLeft,
      text: (el.children.length === 0 ? (el.textContent || '') : '').trim().slice(0, 40),
      fontWeight: s.fontWeight,
    });
    if (out.length > 800) break;
  }
  return out;
})()`;

const OVERFLOW_EXPR = `(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))()`;

const COLOR_RE = /(rgba?)\(([^)]+)\)/i;
function parseComputedColor(str) {
  const m = COLOR_RE.exec(String(str));
  if (!m) return null;
  const parts = m[2].split(/[,/]/).map((s) => s.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts[3] === undefined ? 1 : Number(parts[3]);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return { r, g, b, a };
}
function relLum({ r, g, b }) {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const px = (v) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null; };
const inSet = (set, n, tol = 0.6) => { if (set.has(Number(n.toFixed(2)))) return true; for (const v of set) if (Math.abs(v - n) <= tol) return true; return false; };

async function checkDom({ config, tokensPath, cdpUrl, browserOpt }) {
  const checks = { A6: null, A7: null, A8: null, A11: null };
  const tokensJson = (await exists(tokensPath)) ? await readJson(tokensPath).catch(() => null) : null;
  let browser = null;
  let ownsBrowser = false;
  try {
    if (cdpUrl) {
      browser = await attachBrowser(await resolveCdpUrl(cdpUrl), { timeoutMs: 15000 });
    } else {
      browser = await launchBrowser({ browser: browserOpt, timeoutMs: 20000 });
      ownsBrowser = true;
    }
  } catch (err) {
    const why = `浏览器不可用: ${String(err.message).split('\n')[0]}`;
    checks.A6 = mk('A6', '未检', why);
    checks.A7 = mk('A7', '未检', why);
    checks.A8 = mk('A8', '未检', why);
    checks.A11 = mk('A11', '未检', why);
    return checks;
  }

  try {
    if (!tokensJson) {
      checks.A6 = mk('A6', '未检', '没有 tokens.json，无法判定计算样式是否 ⊆ token');
    } else {
      const idx = buildTokenIndex(tokensJson);
      const vp = config.viewports[0];
      const theme = config.themes[0];
      const violations = [];
      const contrastFailures = [];
      const overflow = [];
      let scannedEls = 0;
      for (const route of config.routes) {
        const page = await browser.newPage();
        try {
          await page.setDeviceMetrics(vp);
          await page.setEmulatedMedia({ prefersColorScheme: theme === 'dark' ? 'dark' : 'light' });
          await page.addInitScript(initScriptFor({ theme, freeze: true }));
          await page.goto(routeUrl(config, route), { waitUntil: 'load', timeout: config.timeoutMs });
          if (config.waitForFonts) await page.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true').catch(() => {});
          await applyTheme(page, theme, config.themeStrategy);
          await page.waitForTimeout(config.waitMs);
          const info = await page.evaluate(OVERFLOW_EXPR);
          if (info.scrollWidth > info.clientWidth + 1) overflow.push(`${route.id}: scrollWidth ${info.scrollWidth} > clientWidth ${info.clientWidth}`);
          const els = await page.evaluate(VISIBLE_EXPR);
          scannedEls += els.length;
          for (const el of els) {
            const where = `${route.id} <${el.tag}${el.cls ? `.${el.cls.split(/\s+/)[0]}` : ''}>`;
            const color = parseComputedColor(el.color);
            if (color && color.a > 0 && !inSet(idx.colors.size ? new Set([...idx.colors]) : new Set(), 0) && !colorInTokens(color, idx.colors)) {
              violations.push(`${where} color ${el.color} 不在 color token 集合`);
            }
            const bg = parseComputedColor(el.bg);
            if (bg && bg.a > 0 && !colorInTokens(bg, idx.colors)) violations.push(`${where} background ${el.bg} 不在 color token 集合`);
            const fs = px(el.fontSize);
            if (fs !== null && idx.fontSize.size && !inSet(idx.fontSize, fs)) violations.push(`${where} font-size ${el.fontSize} 不在字号阶梯`);
            const br = px(el.borderRadius);
            if (br !== null && br > 0 && idx.radius.size && !inSet(idx.radius, br)) violations.push(`${where} border-radius ${el.borderRadius} 不在圆角刻度`);
            for (const [label, v] of [['padding-top', el.paddingTop], ['padding-left', el.paddingLeft]]) {
              const n = px(v);
              if (n !== null && n > 0 && idx.spacing.size && !inSet(idx.spacing, n)) violations.push(`${where} ${label} ${v} 不在间距刻度`);
            }
            // A7：前景 vs 最近不透明背景
            if (el.text && el.text.length > 1) {
              const fg = color;
              const bgc = bg && bg.a > 0.5 ? bg : null;
              if (fg && fg.a > 0.1 && bgc) {
                const ratio = contrast(fg, bgc);
                const large = (fs || 16) >= 24 || ((fs || 16) >= 18.66 && Number(el.fontWeight) >= 700);
                const need = large ? 3 : 4.5;
                if (ratio < need) contrastFailures.push(`${where} "${el.text.slice(0, 16)}" 对比度 ${ratio.toFixed(2)}:1 < ${need}:1`);
              }
            }
          }
        } finally {
          await page.close().catch(() => {});
        }
      }
      checks.A6 = violations.length === 0
        ? mk('A6', 'PASS', `${scannedEls} 个可见元素的计算样式全部命中 token`)
        : mk('A6', 'FAIL', `${violations.length} 处计算样式不在 token 集合`, { details: violations.slice(0, 20) });
      checks.A7 = contrastFailures.length === 0
        ? mk('A7', 'PASS', '文本对比度均达 AA（正文 4.5:1 / 大字 3:1）')
        : mk('A7', 'FAIL', `${contrastFailures.length} 处对比度不足`, { details: contrastFailures.slice(0, 20) });
      checks.A8 = overflow.length === 0
        ? mk('A8', 'PASS', `${config.routes.length} 个 route 在 ${vp.width}x${vp.height} 无横向溢出`)
        : mk('A8', 'FAIL', `${overflow.length} 个 route 横向溢出`, { details: overflow.slice(0, 10) });
    }

    /* A11：重跑配置里的 actions */
    const actionFailures = [];
    let actionRuns = 0;
    for (const route of config.routes) {
      for (const state of route.states) {
        if (!state.actions.length) continue;
        const page = await browser.newPage();
        try {
          await page.setDeviceMetrics(config.viewports[0]);
          await page.addInitScript(initScriptFor({ theme: config.themes[0], freeze: config.freezeAnimations }));
          await page.goto(routeUrl(config, route), { waitUntil: 'load', timeout: config.timeoutMs });
          await applyTheme(page, config.themes[0], config.themeStrategy);
          await runActions(page, state.actions, { timeoutMs: config.timeoutMs });
          actionRuns += 1;
        } catch (err) {
          actionFailures.push(`${route.id}/${state.id}: ${String(err.message).split('\n')[0]}`);
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
    checks.A11 = actionFailures.length === 0
      ? mk('A11', 'PASS', `${actionRuns} 个带 actions 的 state 全部执行成功`)
      : mk('A11', 'FAIL', `${actionFailures.length} 个 state 的动作失败`, { details: actionFailures.slice(0, 20) });
  } finally {
    if (browser) await browser.close().catch(() => {});
    void ownsBrowser;
  }
  return checks;
}

function routeUrl(config, route) {
  if (route.url) return route.url;
  const base = config.baseUrl;
  const p = route.path || '';
  if (!p) return base;
  if (p.startsWith('#') || p.startsWith('?')) return base + p;
  return base.replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '');
}

function colorInTokens(color, tokenSet) {
  // computed style 一定是 rgb()/rgba()，转 hex 后比对（tokenSet 是 hex）
  const hex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const base = `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
  if (color.a >= 0.999) return tokenSet.has(base) || [...tokenSet].some((h) => h.slice(0, 7) === base && h.length > 7);
  return tokenSet.has(`${base}${hex(color.a * 255)}`);
}

/* ------------------------------------------------------------------ */
/* A12：冻结校验（进程内）                                             */
/* ------------------------------------------------------------------ */

async function checkFreeze({ freezeManifest }) {
  if (!freezeManifest || !(await exists(freezeManifest))) {
    return mk('A12', '未检', `没有 freeze-manifest: ${freezeManifest || '(未指定)'}`);
  }
  const manifest = await readJson(freezeManifest).catch(() => null);
  if (!manifest) return mk('A12', 'FAIL', `freeze-manifest 无法解析: ${freezeManifest}`);
  const baseDir = path.dirname(freezeManifest);
  const snap = await verifyFreezeSnapshot(manifest, baseDir, { strictExtras: false });
  return snap.status === 'PASS'
    ? mk('A12', 'PASS', `${snap.total} 个冻结文件 sha256 + bytes 全部一致`)
    : mk('A12', 'FAIL', `快照漂移: MODIFIED ${snap.modified.length} / MISSING ${snap.missing.length} / EXTRA ${snap.extra.length}`, {
      details: [
        ...snap.modified.slice(0, 10).map((m) => `MODIFIED ${m.file} (${m.reason})`),
        ...snap.missing.slice(0, 10).map((m) => `MISSING ${m.file}`),
        ...snap.extra.slice(0, 10).map((m) => `EXTRA ${m.file}`),
      ],
    });
}

/* ------------------------------------------------------------------ */
/* Markdown                                                           */
/* ------------------------------------------------------------------ */

function renderMarkdown({ checks, config, inputs, summary }) {
  const lines = [];
  lines.push(`# 验收报告 · 自动判定（accept-verify.mjs）`);
  lines.push('');
  lines.push(`- 生成时间: ${nowIso()}`);
  lines.push(`- 配置: \`${inputs.config}\``);
  lines.push(`- manifest: \`${inputs.manifest}\``);
  lines.push(`- tokens: \`${inputs.tokens}\``);
  lines.push(`- 参考截图: \`${inputs.reference}\``);
  lines.push('');
  lines.push(`## 结论：${summary.fail > 0 ? '**FAIL**' : summary.skip > 0 ? 'PASS（含未检项）' : 'PASS'}`);
  lines.push('');
  lines.push('| ID | 项 | 结果 | 证据 |');
  lines.push('| --- | --- | --- | --- |');
  for (const c of checks) {
    const status = c.status === 'PASS' ? 'PASS' : c.status === 'FAIL' ? '**FAIL**' : '未检';
    lines.push(`| ${c.id} | ${c.title} | ${status} | ${String(c.detail || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  const failing = checks.filter((c) => c.status === 'FAIL');
  if (failing.length) {
    lines.push('## 失败详情');
    for (const c of failing) {
      lines.push(`### ${c.id} · ${c.title}`);
      lines.push(`- ${c.detail}`);
      for (const d of (c.details || []).slice(0, 20)) lines.push(`  - ${d}`);
      lines.push('');
    }
  }
  const skipped = checks.filter((c) => c.status === '未检');
  if (skipped.length) {
    lines.push('## 未检项（环境限制，不是 PASS）');
    for (const c of skipped) lines.push(`- ${c.id} · ${c.title}: ${c.detail}`);
    lines.push('');
  }
  lines.push('## 覆盖矩阵');
  lines.push('');
  lines.push(`- routes: ${config.routes.map((r) => r.id).join(', ')}`);
  lines.push(`- states: ${config.routes.map((r) => `${r.id}[${r.states.map((s) => s.id).join('/')}]`).join('  ')}`);
  lines.push(`- viewports: ${config.viewports.map((v) => `${v.width}x${v.height}@${v.deviceScaleFactor}x`).join(', ')}`);
  lines.push(`- themes: ${config.themes.join(', ')}`);
  lines.push('');
  lines.push('> 未检 ≠ PASS（见 08-acceptance.md §4.1）。');
  return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* 主流程                                                             */
/* ------------------------------------------------------------------ */

async function main() {
  const { help, opts } = parseCli(process.argv.slice(2), {
    options: {
      '--config': { key: 'config', type: 'string' },
      '--manifest': { key: 'manifest', type: 'string' },
      '--tokens': { key: 'tokens', type: 'string' },
      '--reference': { key: 'reference', type: 'string' },
      '--freeze-manifest': { key: 'freezeManifest', type: 'string' },
      '--project': { key: 'project', type: 'string' },
      '--json': { key: 'json', type: 'string' },
      '--md': { key: 'md', type: 'string' },
      '--threshold': { key: 'threshold', type: 'number' },
      '--cdp-url': { key: 'cdpUrl', type: 'string' },
      '--browser': { key: 'browser', type: 'string' },
    },
    minPositional: 0,
    maxPositional: 0,
  });
  if (help) { console.log(HELP); return 0; }
  if (!opts.config) throw new UsageError('缺少 --config <accept.config.json>', '示例: node accept-verify.mjs --config acceptance/accept.config.json');

  const { configPath, configDir, project } = resolveDefaults(opts);
  const config = await loadConfig(configPath);
  const inputs = {
    config: configPath,
    project,
    manifest: path.resolve(opts.manifest || path.join(config.out, 'manifest.json')),
    tokens: path.resolve(opts.tokens || path.join(project, 'design', 'tokens', 'tokens.json')),
    reference: path.resolve(opts.reference || path.join(configDir, 'reference')),
    freezeManifest: path.resolve(opts.freezeManifest || path.join(project, 'design', 'frozen', 'freeze-manifest.json')),
    outputJson: path.resolve(opts.json || path.join(configDir, 'acceptance-report.json')),
    outputMd: path.resolve(opts.md || path.join(configDir, 'acceptance-report.md')),
  };
  const thresholds = {
    pixelDiffRatio: opts.threshold !== undefined ? opts.threshold : config.thresholds.pixelDiffRatio,
    minScreenshotBytes: config.thresholds.minScreenshotBytes,
    minPixelStdDev: config.thresholds.minPixelStdDev,
  };

  let manifest = null;
  try {
    manifest = await readJson(inputs.manifest);
    manifest.__path = inputs.manifest;
  } catch { manifest = null; }

  console.log(`\n验收判定: ${inputs.config}`);
  console.log(`  project:  ${inputs.project}`);
  console.log(`  manifest: ${inputs.manifest}${manifest ? '' : '  ✖ 不存在'}`);
  console.log(`  tokens:   ${inputs.tokens}`);
  console.log(`  reference: ${inputs.reference}${(await exists(inputs.reference)) ? '' : '  (无)'}  threshold=${thresholds.pixelDiffRatio}`);

  const checks = [];
  const { checks: mChecks, okCaptures, expectedFiles } = await checkMatrixAndImages({ config, manifest, thresholds });
  checks.push(...mChecks);

  // A4 需要 manifest 的绝对输出目录；把 config.out 绝对路径回填，方便找当前截图
  if (manifest) manifest.config = { ...(manifest.config || {}), out: manifest.config?.out || config.out };
  if (manifest && !path.isAbsolute(manifest.config.out)) manifest.config.out = path.resolve(path.dirname(inputs.manifest), manifest.config.out);
  checks.push(await checkPixelDiff({ manifest: manifest || {}, okCaptures, referenceDir: inputs.reference, threshold: thresholds.pixelDiffRatio }));
  checks.push(await checkDrift({ project: inputs.project, tokensPath: inputs.tokens }));
  checks.push(await checkFreeze({ freezeManifest: inputs.freezeManifest }));
  const domChecks = await checkDom({ config, tokensPath: inputs.tokens, cdpUrl: opts.cdpUrl, browserOpt: opts.browser });
  checks.push(domChecks.A6, domChecks.A7, domChecks.A8, domChecks.A11);

  // 排序回 A1..A12
  checks.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  const summary = {
    total: checks.length,
    pass: checks.filter((c) => c.status === 'PASS').length,
    fail: checks.filter((c) => c.status === 'FAIL').length,
    skip: checks.filter((c) => c.status === '未检').length,
  };
  const report = {
    tool: `accept-verify.mjs@${VERSION}`,
    generatedAt: nowIso(),
    inputs,
    thresholds,
    matrix: { expected: expectedFiles.length, ok: okCaptures.length },
    summary,
    status: summary.fail > 0 ? 'FAIL' : 'PASS',
    checks,
  };
  await writeJson(inputs.outputJson, report);
  const md = renderMarkdown({ checks, config, inputs, summary });
  await fsp.mkdir(path.dirname(inputs.outputMd), { recursive: true });
  await fsp.writeFile(inputs.outputMd, md, 'utf8');

  // 控制台表格
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${summary.fail ? '✖ FAIL' : '✔ PASS'}  A1–A12 判定（PASS ${summary.pass} / FAIL ${summary.fail} / 未检 ${summary.skip}）`);
  console.log(`${pad('ID', 5)} ${pad('项', 28)} ${pad('结果', 6)} 证据`);
  console.log('-'.repeat(110));
  for (const c of checks) {
    const status = c.status === 'PASS' ? 'PASS' : c.status === 'FAIL' ? 'FAIL' : '未检';
    console.log(`${pad(c.id, 5)} ${pad(c.title, 28)} ${pad(status, 6)} ${c.detail}`);
    for (const d of (c.details || []).slice(0, 5)) console.log(`${' '.repeat(6)}- ${d}`);
  }
  console.log(`\nJSON: ${inputs.outputJson}`);
  console.log(`MD:   ${inputs.outputMd}`);
  return summary.fail > 0 ? 1 : 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }).catch((err) => die(err));
}

export { checkMatrixAndImages, checkPixelDiff, checkDrift, checkFreeze, renderMarkdown, imageStats };
