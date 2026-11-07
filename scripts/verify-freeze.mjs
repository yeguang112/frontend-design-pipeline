// 用法:
//   node verify-freeze.mjs <freeze-manifest.json> [--base <dir>] [--json <report.json>] [--help]
//   node verify-freeze.mjs --write <dir> [--out <manifest.json>] [--force] [--help]
//
// 校验冻结快照：逐文件比对 sha256 + 字节数，并找出目录里新增的 UI 文件。
// 输出 PASS / MODIFIED / MISSING / EXTRA 清单；有变更 exit 1。
// --write 模式用于「冻结」时刻生成 manifest。
//
// manifest 格式:
//   { "version": 1, "frozen_at": "2026-01-01T00:00:00.000Z",
//     "files": { "index.html": {"sha256":"…","bytes":123}, "css/app.css": {…} } }
//
// 退出码: 0 完全一致 / 1 有变更或读取失败 / 2 用法错误

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCli, readJson, writeJson, die, sha256File, nowIso, humanBytes,
  walkFiles, UsageError, CdpError,
} from './lib/cdp.mjs';

const VERSION = '1.0.0';
const HELP = `verify-freeze.mjs — 冻结快照校验 / 生成

校验模式:
  node verify-freeze.mjs <freeze-manifest.json> [选项]
    --base <dir>      被冻结的根目录（默认：manifest 所在目录）
    --json <file>     报告输出路径（默认 ./freeze-report.json；传 "-" 不写文件）
    --strict-extras   目录里新增任意文件都算 EXTRA（默认只看 UI 文件）

冻结模式:
  node verify-freeze.mjs --write <dir> [选项]
    --out <file>      manifest 输出路径（默认 <dir>/freeze-manifest.json）
    --force           已存在时覆盖
    --label <text>    给这次冻结加个备注（写入 meta.label）

判定:
  PASS      文件全部一致
  MODIFIED  sha256 或字节数变了
  MISSING   manifest 里有、磁盘上没有
  EXTRA     磁盘上有、manifest 里没有的 UI 文件（.html/.css/.js/.tsx/.vue/.svg/.png…）

退出码: 0 = PASS / 1 = 有变更或失败 / 2 = 用法错误
`;

const UI_EXTS = new Set([
  '.html', '.htm', '.xhtml', '.css', '.scss', '.sass', '.less', '.styl',
  '.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs', '.vue', '.svelte',
  '.wxml', '.wxss', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico',
  '.json', '.md',
]);

async function collectFrozenFiles(root, { strictExtras = false, excludeNames = [] } = {}) {
  const exts = strictExtras ? null : UI_EXTS;
  const files = await walkFiles(root, {
    exts,
    ignoreNames: ['freeze-manifest.json', 'freeze-report.json', 'drift-report.json', ...excludeNames],
  });
  return files;
}

/* ------------------------------------------------------------------ */
/* --write                                                            */
/* ------------------------------------------------------------------ */

async function writeManifest(dirArg, opts) {
  const root = path.resolve(dirArg);
  const stat = await fsp.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new CdpError(`目录不存在: ${root}`, '传一个要冻结的目录（HTML 原型根目录）。');

  const files = await collectFrozenFiles(root);
  if (files.length === 0) throw new CdpError(`${root} 下没有可冻结的 UI 文件`, '确认目录选对了（UI 扩展名: html/css/js/tsx/vue/svg/png…）。');

  const entries = {};
  let totalBytes = 0;
  for (const f of files) {
    const sha = await sha256File(f.abs);
    entries[f.rel] = { sha256: sha, bytes: f.size };
    totalBytes += f.size;
  }
  const manifest = {
    version: 1,
    frozen_at: nowIso(),
    files: entries,
    meta: {
      tool: `verify-freeze.mjs@${VERSION}`,
      root,
      fileCount: files.length,
      totalBytes,
      ...(opts.label ? { label: opts.label } : {}),
      ...(opts.approvedBy ? { approvedBy: opts.approvedBy } : {}),
      ...(opts.quote ? { quote: opts.quote } : {}),
      ...(opts.guidelinesVersion ? { guidelinesVersion: opts.guidelinesVersion } : {}),
    },
  };
  const outPath = path.resolve(opts.out || path.join(root, 'freeze-manifest.json'));
  const exists = await fsp.stat(outPath).then(() => true).catch(() => false);
  if (exists && !opts.force) {
    throw new CdpError(`manifest 已存在: ${outPath}`, '这是保护机制（避免覆盖上一次冻结基线）。确认要重建时加 --force。');
  }
  await writeJson(outPath, manifest);
  console.log(`\n✔ 已冻结 ${files.length} 个文件 (${humanBytes(totalBytes)})`);
  console.log(`  manifest: ${outPath}`);
  console.log(`  frozen_at: ${manifest.frozen_at}`);
  console.log(`  后续校验: node verify-freeze.mjs "${outPath}" --base "${root}"`);
  return 0;
}

/* ------------------------------------------------------------------ */
/* 校验（纯函数，供 accept-verify 复用）                               */
/* ------------------------------------------------------------------ */

/**
 * 比对 manifest 与磁盘。返回结构化的 PASS/MODIFIED/MISSING/EXTRA。
 * @param {object} manifest 已解析的 freeze-manifest
 * @param {string} baseDir  被冻结的根目录
 */
export async function verifyFreezeSnapshot(manifest, baseDir, { strictExtras = false } = {}) {
  const entries = Object.entries(manifest.files || {});
  if (entries.length === 0) throw new CdpError('manifest 的 files 为空', '用 --write 重新冻结。');
  const results = { pass: [], modified: [], missing: [] };
  for (const [rel, expected] of entries.sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const abs = path.join(baseDir, rel.split('/').join(path.sep));
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) { results.missing.push({ file: rel }); continue; }
    const actualSha = await sha256File(abs);
    const expectedSha = String(expected.sha256 || '').toLowerCase();
    const expectedBytes = Number(expected.bytes);
    if (actualSha === expectedSha && (!Number.isFinite(expectedBytes) || stat.size === expectedBytes)) {
      results.pass.push({ file: rel, sha256: actualSha, bytes: stat.size });
    } else {
      const reasons = [];
      if (actualSha !== expectedSha) reasons.push(`sha256 ${expectedSha.slice(0, 12)}… -> ${actualSha.slice(0, 12)}…`);
      if (Number.isFinite(expectedBytes) && stat.size !== expectedBytes) reasons.push(`bytes ${expectedBytes} -> ${stat.size}`);
      results.modified.push({
        file: rel, expectedSha256: expectedSha, actualSha256: actualSha,
        expectedBytes: Number.isFinite(expectedBytes) ? expectedBytes : null,
        actualBytes: stat.size,
        reason: reasons.join('; ') || '内容变化',
      });
    }
  }
  const frozenSet = new Set(Object.keys(manifest.files || {}));
  const diskFiles = await collectFrozenFiles(baseDir, { strictExtras });
  const extra = diskFiles
    .filter((f) => !frozenSet.has(f.rel))
    .map((f) => ({ file: f.rel, bytes: f.size }))
    .sort((a, b) => (a.file < b.file ? -1 : 1));
  const changed = results.modified.length + results.missing.length + extra.length;
  return {
    version: manifest.version ?? 1,
    frozen_at: manifest.frozen_at ?? null,
    total: entries.length,
    pass: results.pass,
    modified: results.modified,
    missing: results.missing,
    extra,
    changed,
    status: changed === 0 ? 'PASS' : 'FAIL',
    strictExtras,
  };
}

/* ------------------------------------------------------------------ */
/* 校验（CLI）                                                         */
/* ------------------------------------------------------------------ */

async function verify(manifestPath, opts) {
  const manifestAbs = path.resolve(manifestPath);
  let manifest;
  try {
    manifest = await readJson(manifestAbs);
  } catch (err) {
    throw new CdpError(`读取 manifest 失败: ${manifestAbs}: ${err.message}`, '确认路径正确且是合法 JSON。');
  }
  if (manifest.files === undefined) throw new CdpError(`${manifestAbs} 里没有 files 字段`, 'manifest 应形如 {"version":1,"frozen_at":"…","files":{…}}；用 --write 生成。');
  if (manifest.version !== undefined && manifest.version !== 1) {
    throw new CdpError(`不支持的 manifest version: ${manifest.version}`, '当前只支持 version=1；用 --write 重新生成。');
  }
  const baseDir = opts.base ? path.resolve(opts.base) : path.dirname(manifestAbs);
  const baseStat = await fsp.stat(baseDir).catch(() => null);
  if (!baseStat || !baseStat.isDirectory()) throw new CdpError(`基准目录不存在: ${baseDir}`, '用 --base 指定被冻结的根目录。');

  const snap = await verifyFreezeSnapshot(manifest, baseDir, { strictExtras: !!opts.strictExtras });
  const report = {
    tool: `verify-freeze.mjs@${VERSION}`,
    generatedAt: nowIso(),
    manifest: {
      file: manifestAbs,
      version: manifest.version ?? 1,
      frozen_at: manifest.frozen_at ?? null,
      fileCount: snap.total,
      label: manifest.meta?.label ?? null,
    },
    baseDir,
    summary: {
      total: snap.total,
      pass: snap.pass.length,
      modified: snap.modified.length,
      missing: snap.missing.length,
      extra: snap.extra.length,
      changed: snap.changed,
      status: snap.status,
      strictExtras: snap.strictExtras,
    },
    modified: snap.modified,
    missing: snap.missing,
    extra: snap.extra,
    pass: snap.pass.map((p) => p.file),
  };

  if (opts.json && opts.json !== '-') {
    const jsonPath = await writeJson(path.resolve(opts.json || 'freeze-report.json'), report);
    report.$reportPath = jsonPath;
  }

  /* 人类可读摘要 */
  console.log(`\n${snap.status === 'PASS' ? '✔ PASS' : '✖ FAIL'} 冻结校验: ${snap.status === 'PASS' ? '快照与磁盘完全一致' : `发现 ${snap.changed} 处变更`}`);
  console.log(`  manifest: ${manifestAbs}`);
  console.log(`  基准目录: ${baseDir}`);
  console.log(`  文件数:   ${snap.total}${manifest.frozen_at ? `, frozen_at ${manifest.frozen_at}` : ''}`);
  const sections = [
    ['MODIFIED', snap.modified, (m) => `  ${m.file}  (${m.reason})`],
    ['MISSING', snap.missing, (m) => `  ${m.file}`],
    ['EXTRA', snap.extra, (m) => `  ${m.file}  (${humanBytes(m.bytes)})`],
  ];
  for (const [label, list, fmt] of sections) {
    if (!list.length) continue;
    console.log(`\n${label} ${list.length}:`);
    for (const item of list.slice(0, 50)) console.log(fmt(item));
    if (list.length > 50) console.log(`  …还有 ${list.length - 50} 项（见 JSON 报告）`);
  }
  if (snap.status === 'PASS') console.log(`\nPASS ${snap.pass.length} 个文件 sha256 + 字节数全部一致`);
  if (report.$reportPath) console.log(`\nJSON 报告: ${report.$reportPath}`);
  console.log(snap.status === 'PASS' ? '\n结论: 未漂移' : '\n结论: 快照已漂移 —— 确认改动是有意的，然后重新--write 冻结基线');
  return snap.changed === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* 主流程                                                             */
/* ------------------------------------------------------------------ */

async function main() {
  const { help, opts, positionals } = parseCli(process.argv.slice(2), {
    options: {
      '--base': { key: 'base', type: 'string' },
      '--json': { key: 'json', type: 'string' },
      '--write': { key: 'write', type: 'string' },
      '--out': { key: 'out', type: 'string' },
      '--force': { key: 'force', type: 'boolean', default: false },
      '--label': { key: 'label', type: 'string' },
      '--approved-by': { key: 'approvedBy', type: 'string' },
      '--quote': { key: 'quote', type: 'string' },
      '--guidelines-version': { key: 'guidelinesVersion', type: 'string' },
      '--strict-extras': { key: 'strictExtras', type: 'boolean', default: false },
    },
    minPositional: 0,
    maxPositional: 1,
  });
  if (help) { console.log(HELP); return 0; }

  if (opts.write) {
    if (positionals.length) throw new UsageError('--write 模式下不要再传位置参数', '用法: node verify-freeze.mjs --write <dir> [--out <manifest.json>]');
    return writeManifest(opts.write, opts);
  }
  if (!positionals[0]) throw new UsageError('缺少 freeze-manifest.json', '用法: node verify-freeze.mjs <freeze-manifest.json> [--base <dir>]；或 --write <dir> 生成 manifest。');
  return verify(positionals[0], opts);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }).catch((err) => die(err));
}

export { writeManifest, verify, collectFrozenFiles, UI_EXTS };
