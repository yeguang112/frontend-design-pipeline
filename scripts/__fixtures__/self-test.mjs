// 用法（测试用，不是交付脚本）:
//   node __fixtures__/self-test.mjs
//
// 一条命令重跑全部自测（不需要浏览器；浏览器相关的 capture/pixel 用 mock CDP 与纯 Node 引擎验证）：
//   1. 各脚本 --help
//   2. lib/cdp.mjs 协议层（对 mock CDP 服务器）
//   3. extract-tokens（fixture 站点）
//   4. detect-drift（违规 fixture 必须 12 条规则全命中；干净 fixture 必须 0 违规）
//   5. verify-freeze（--write/ PASS / MODIFIED+MISSING+EXTRA）
//   6. capture-acceptance（dry-run + 对 mock CDP 真实跑 2 route × 2 state × 2 theme 截图）
//   7. pixel-diff（同图 / 改 1 像素 / 阈值 0 / 16x16 超阈值 / 尺寸不一致）
// 退出码: 0 全部通过 / 1 有失败

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockCdp } from './mock-cdp-server.mjs';
import { pngSize } from '../lib/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const work = path.join(here, 'out-self-test');
const results = [];

/** 用 stdio:'inherit' 跑子进程（受限环境下 pipe 可能 EPERM） */
function runNode(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    p.on('error', () => resolve(-1));
    p.on('exit', (code) => resolve(code));
  });
}

async function test(name, args, expectedExit, after) {
  const t0 = Date.now();
  const code = await runNode(args);
  const ok = code === expectedExit;
  let detail = `exit ${code} (expect ${expectedExit}) ${Date.now() - t0}ms`;
  if (ok && after) {
    try {
      const extra = await after();
      if (extra) detail += ` — ${extra}`;
      results.push({ name, ok: true, detail });
      return;
    } catch (err) {
      results.push({ name, ok: false, detail: `${detail} — 断言失败: ${err.message}` });
      return;
    }
  }
  results.push({ name, ok, detail });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

await fsp.rm(work, { recursive: true, force: true });
await fsp.mkdir(work, { recursive: true });

/* 1. --help */
for (const script of ['extract-tokens.mjs', 'detect-drift.mjs', 'capture-acceptance.mjs', 'verify-freeze.mjs', 'pixel-diff.mjs']) {
  await test(`--help ${script}`, [script, '--help'], 0);
}
await test('--help lib/cdp.mjs', ['lib/cdp.mjs', '--help'], 0);

/* 2. lib 协议层 */
await test('lib/cdp.mjs mock 协议层', ['__fixtures__/test-lib-cdp.mjs'], 0);

/* 3. extract-tokens */
await test('extract-tokens fixture 站点', ['extract-tokens.mjs', '__fixtures__/sample-site', '--out', '__fixtures__/out-tokens'], 0, async () => {
  const t = JSON.parse(await fsp.readFile(path.join(here, 'out-tokens', 'tokens.json'), 'utf8'));
  assert(t.color?.['color-bg']?.$value === '#08090a', `color.bg = ${t.color?.['color-bg']?.$value}`);
  assert(t.color?.['color-text']?.$value === '#e6e8ec', `color.text = ${t.color?.['color-text']?.$value}`);
  assert(t.color?.['color-accent']?.$value === '#3b82f6', `color.accent = ${t.color?.['color-accent']?.$value}`);
  assert(t.scale?.spacing?.some((s) => s.value === '16px'), 'spacing scale 缺 16px');
  assert(t.scale?.fontSize?.length === 6, `fontSize steps = ${t.scale?.fontSize?.length}`);
  const unmappedTotal = Object.values(t.unmapped || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
  assert(unmappedTotal === 0, `unmapped 应为空，实际 ${unmappedTotal} 条`);
  const css = await fsp.readFile(path.join(here, 'out-tokens', 'tokens.css'), 'utf8');
  assert(css.includes('--color-bg: #08090a;'), 'tokens.css 缺 --color-bg');
  assert(css.includes('--space-4: 16px;'), 'tokens.css 缺 --space-4: 16px');
  const md = await fsp.readFile(path.join(here, 'out-tokens', 'tokens.md'), 'utf8');
  assert(md.includes('| token | 值 | 角色 | 使用次数 |'), 'tokens.md 缺表格');
  return `${Object.keys(t.color).length} 色 / ${t.scale.spacing.length} 间距步进 / ${t.scale.fontSize.length} 字号步进`;
});

/* 4. detect-drift：违规必须 12 条规则全命中 */
await test('detect-drift 违规 fixture', ['detect-drift.mjs', '__fixtures__/drift-project', '--tokens', '__fixtures__/tokens.json', '--json', path.join(work, 'drift.json')], 1, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'drift.json'), 'utf8'));
  const rules = new Set(r.violations.map((v) => v.rule));
  const expected = ['hardcoded-color', 'ai-purple-gradient', 'glassmorphism', 'raw-font-family', 'off-scale-font-size',
    'off-scale-spacing', 'off-scale-radius', 'inline-style', 'excessive-radius', 'emoji-icon', 'shadow-stack', 'magic-zindex'];
  const missing = expected.filter((x) => !rules.has(x));
  assert(missing.length === 0, `未命中的规则: ${missing.join(', ')}`);
  assert(r.summary.bySeverity.error > 0 && r.summary.bySeverity.warn > 0, '严重级统计异常');
  assert(r.violations.every((v) => v.file && v.line > 0 && v.snippet && v.message && v.howToFix), '违规条目字段不全');
  return `${r.summary.total} 条违规 / 12 规则全命中 / error ${r.summary.bySeverity.error}`;
});

/* 4b. detect-drift：干净项目必须 0 违规（误报率） */
await fsp.mkdir(path.join(work, 'clean-project'), { recursive: true });
await fsp.copyFile(path.join(here, 'drift-project', 'clean.css'), path.join(work, 'clean-project', 'clean.css'));
await test('detect-drift 干净 fixture（0 误报）', ['detect-drift.mjs', path.join(work, 'clean-project'), '--tokens', '__fixtures__/tokens.json', '--json', path.join(work, 'drift-clean.json')], 0, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'drift-clean.json'), 'utf8'));
  assert(r.summary.total === 0, `应为 0 违规，实际 ${r.summary.total}`);
  return 'total=0';
});

/* 5. verify-freeze */
await test('verify-freeze --write', ['verify-freeze.mjs', '--write', '__fixtures__/freeze', '--force', '--label', 'self-test'], 0, async () => {
  const m = JSON.parse(await fsp.readFile(path.join(here, 'freeze', 'freeze-manifest.json'), 'utf8'));
  assert(m.version === 1 && m.files && Object.keys(m.files).length === 3, `manifest 结构异常`);
  assert(m.files['index.html']?.sha256?.length === 64, 'sha256 长度异常');
  return `${Object.keys(m.files).length} 文件`;
});
await test('verify-freeze PASS', ['verify-freeze.mjs', '__fixtures__/freeze/freeze-manifest.json', '--json', path.join(work, 'freeze-pass.json')], 0);

// 准备一个"漂移后"的目录：改 1 个 / 删 1 个 / 增 1 个
const mutated = path.join(work, 'mutated');
fs.cpSync(path.join(here, 'freeze'), mutated, { recursive: true });
fs.rmSync(path.join(mutated, 'freeze-manifest.json'), { force: true });
fs.appendFileSync(path.join(mutated, 'index.html'), '\n<!-- self-test: simulated drift -->\n');
fs.rmSync(path.join(mutated, 'css', 'app.css'));
fs.writeFileSync(path.join(mutated, 'new-page.html'), '<!DOCTYPE html><title>new</title>\n');

await test('verify-freeze 有变更 FAIL', ['verify-freeze.mjs', '__fixtures__/freeze/freeze-manifest.json', '--base', mutated, '--json', path.join(work, 'freeze-fail.json')], 1, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'freeze-fail.json'), 'utf8'));
  assert(r.summary.modified === 1 && r.summary.missing === 1 && r.summary.extra === 1, `统计异常: ${JSON.stringify(r.summary)}`);
  assert(r.summary.status === 'FAIL', 'status 应为 FAIL');
  return 'MODIFIED 1 / MISSING 1 / EXTRA 1';
});

/* 6. capture-acceptance */
await test('capture-acceptance dry-run', ['capture-acceptance.mjs', '--config', '__fixtures__/accept.config.json', '--dry-run'], 0);
const mock = await startMockCdp({ port: 0 });
try {
  await test('capture-acceptance 真实截图（mock CDP）',
    ['capture-acceptance.mjs', '--config', '__fixtures__/accept.config.json', '--cdp-url', mock.httpUrl],
    0,
    async () => {
      const m = JSON.parse(await fsp.readFile(path.join(here, 'out-acceptance', 'manifest.json'), 'utf8'));
      assert(m.summary.total === 8 && m.summary.ok === 8, `应为 8/8 成功: ${JSON.stringify(m.summary)}`);
      for (const c of m.captures) {
        const abs = path.join(here, 'out-acceptance', c.file.split('/').join(path.sep));
        const buf = await fsp.readFile(abs);
        assert(pngSize(buf).width > 0, `${c.file} 不是合法 PNG`);
        assert(c.sha256?.length === 64 && c.bytes === buf.length, `${c.file} sha256/bytes 不一致`);
        assert(/^[a-z-]+\/[a-z-]+--\d+x\d+--(light|dark)\.png$/.test(c.file), `命名不符: ${c.file}`);
      }
      return `8 张 PNG（${m.captures[0].file} …）`;
    });
} finally {
  await mock.close();
}

/* 7. pixel-diff */
await test('gen-pixel-fixtures', ['__fixtures__/gen-pixel-fixtures.mjs'], 0);
await test('pixel-diff 同图 PASS', ['pixel-diff.mjs', '__fixtures__/pixel/ref.png', '__fixtures__/pixel/same.png', '--engine', 'node', '--out', path.join(work, 'same.json')], 0, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'same.json'), 'utf8'));
  assert(r.status === 'PASS' && r.result.changedPixels === 0 && r.result.ratio === 0, '同图应 0 差异');
  return 'changed=0 ratio=0';
});
await test('pixel-diff 改 1 像素默认阈值 PASS', ['pixel-diff.mjs', '__fixtures__/pixel/ref.png', '__fixtures__/pixel/one-pixel.png', '--engine', 'node', '--out', path.join(work, 'one.json')], 0, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'one.json'), 'utf8'));
  assert(r.result.changedPixels === 1, `changedPixels=${r.result.changedPixels}`);
  assert(r.result.bbox.width === 1 && r.result.bbox.x === 120, `bbox 异常 ${JSON.stringify(r.result.bbox)}`);
  const diff = await fsp.readFile(r.diffImage);
  assert(pngSize(diff).width === 240, 'diff.png 尺寸不对');
  return `1/38400, ratio=${r.result.ratio.toFixed(6)}`;
});
await test('pixel-diff 改 1 像素 --threshold 0 FAIL', ['pixel-diff.mjs', '__fixtures__/pixel/ref.png', '__fixtures__/pixel/one-pixel.png', '--engine', 'node', '--threshold', '0', '--out', path.join(work, 'one-strict.json')], 1);
await test('pixel-diff 16x16 超阈值 FAIL', ['pixel-diff.mjs', '__fixtures__/pixel/tiny-ref.png', '__fixtures__/pixel/tiny-one-pixel.png', '--engine', 'node', '--out', path.join(work, 'tiny.json')], 1, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'tiny.json'), 'utf8'));
  assert(r.result.ratio > 0.003, `ratio=${r.result.ratio}`);
  return `ratio=${r.result.ratio.toFixed(6)} > 0.003`;
});
await test('pixel-diff 尺寸不一致 FAIL', ['pixel-diff.mjs', '__fixtures__/pixel/ref.png', '__fixtures__/pixel/smaller.png', '--engine', 'node', '--out', path.join(work, 'size.json')], 1, async () => {
  const r = JSON.parse(await fsp.readFile(path.join(work, 'size.json'), 'utf8'));
  assert(/尺寸不一致/.test(r.reason), `reason=${r.reason}`);
  return r.reason;
});

/* 汇总 */
console.log('\n================ 自测汇总 ================');
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name.padEnd(42)} ${r.detail}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? '✘' : '✔'} ${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
