#!/usr/bin/env node
/**
 * check-skill-size.mjs — 技能体量预算检查
 *
 * 读 skill-budget.json，测量 T0（SKILL.md）/ T1（references）/ T2（数据）的体量，
 * 超预算即 exit 1。用途：每次整合前后跑一次，防止技能持续肿胀。
 *
 * 用法:
 *   node scripts/check-skill-size.mjs [--json <file|->] [--budget <file>]
 *
 * 退出码: 0 通过 / 1 超预算 / 2 用法错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const HELP = `check-skill-size.mjs — 技能体量预算检查

用法:
  node scripts/check-skill-size.mjs [选项]

选项:
  --json <file|->   输出 JSON（- 表示 stdout）
  --budget <file>   预算文件（默认 <root>/skill-budget.json）
  -h, --help

退出码: 0 通过 / 1 超预算 / 2 用法错误`;

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) { console.log(HELP); process.exit(0); }
let jsonOut = null, budgetPath = path.join(ROOT, 'skill-budget.json');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') jsonOut = args[++i];
  else if (args[i] === '--budget') budgetPath = path.resolve(args[++i]);
  else { console.error(`未知参数: ${args[i]}`); process.exit(2); }
}
if (!fs.existsSync(budgetPath)) { console.error(`找不到预算文件: ${budgetPath}`); process.exit(2); }

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const B = budget.budgets || {};
const violations = [];
const rows = [];

function lineCount(text) { return text.split('\n').length; }
function sizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const q = path.join(dir, e.name);
    total += e.isDirectory() ? sizeBytes(q) : fs.statSync(q).size;
  }
  return total;
}
function addRow(name, actual, limit, unit, note = '') {
  const ok = limit == null || actual <= limit;
  if (!ok) violations.push({ name, actual, limit, unit, note });
  rows.push({ name, actual, limit, unit, ok, note });
  return ok;
}

/* T0: SKILL.md */
const skillPath = path.join(ROOT, 'SKILL.md');
const skill = fs.readFileSync(skillPath, 'utf8');
const skillLines = lineCount(skill);
const skillBytes = Buffer.byteLength(skill);
addRow('SKILL.md 行数', skillLines, B.skillMd?.maxLines, '行');
addRow('SKILL.md 字节', skillBytes, B.skillMd?.maxBytes, 'B');

/* 触发词 */
let triggers = 0;
const fmEnd = skill.startsWith('---') ? skill.indexOf('\n---', 3) : -1;
if (fmEnd > 0) {
  const fm = skill.slice(3, fmEnd).split('\n');
  const start = fm.findIndex((l) => /^triggers:\s*$/.test(l));
  if (start >= 0) {
    for (let i = start + 1; i < fm.length; i++) {
      if (/^[A-Za-z_]/.test(fm[i])) break;
      if (/^\s*-\s+\S/.test(fm[i])) triggers++;
    }
  }
}
addRow('触发词数量', triggers, B.triggers?.max, '个');

/* T1: references */
const refDir = path.join(ROOT, 'references');
const refs = fs.existsSync(refDir)
  ? fs.readdirSync(refDir).filter((f) => f.endsWith('.md')).sort()
  : [];
let refTotal = 0, refMaxLines = 0, refMaxBytes = 0, refMaxName = '', refMaxLineName = '';
for (const f of refs) {
  const p = path.join(refDir, f);
  const text = fs.readFileSync(p, 'utf8');
  const bytes = Buffer.byteLength(text);
  const lines = lineCount(text);
  refTotal += bytes;
  if (bytes > refMaxBytes) { refMaxBytes = bytes; refMaxName = f; }
  if (lines > refMaxLines) { refMaxLines = lines; refMaxLineName = f; }
  addRow(`  · ${f} 行数`, lines, B.references?.maxFileLines, '行');
  addRow(`  · ${f} 字节`, bytes, B.references?.maxFileBytes, 'B');
}
addRow('references 文件数', refs.length, B.references?.maxFiles, '个');
addRow('references 总字节', refTotal, B.references?.maxTotalBytes, 'B');

/* 分阶段加载量（T1，按 tiers.onDemand 计算；T2 数据不计入上下文） */
const tiers = budget.tiers?.onDemand || {};
const phaseLoad = {};
for (const [phase, list] of Object.entries(tiers)) {
  let bytes = 0;
  for (const rel of list) {
    if (rel.includes('<') || rel.startsWith('data/') || rel.startsWith('systems/')) continue;
    const fp = path.join(ROOT, rel);
    if (fs.existsSync(fp)) bytes += Buffer.byteLength(fs.readFileSync(fp, 'utf8'));
  }
  phaseLoad[phase] = bytes;
  addRow(`阶段加载 ${phase}`, bytes, B.phaseLoadMaxBytes, 'B');
}

/* templates / scripts */
const tplDir = path.join(ROOT, 'templates');
const tplCount = fs.existsSync(tplDir) ? fs.readdirSync(tplDir).filter((f) => fs.statSync(path.join(tplDir, f)).isFile()).length : 0;
addRow('templates 文件数', tplCount, B.templates?.maxFiles, '个');

const scriptsDir = path.join(ROOT, 'scripts');
const rootMjs = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.mjs')).length : 0;
addRow('scripts 根 .mjs 数', rootMjs, B.scripts?.maxRootMjs, '个');

/* T2: data */
const data = {
  'brand-specs': sizeBytes(path.join(ROOT, 'brand-specs')) / 1024 / 1024,
  examples: sizeBytes(path.join(ROOT, 'examples')) / 1024 / 1024,
  systems: sizeBytes(path.join(ROOT, 'systems')) / 1024 / 1024
};
addRow('brand-specs 体积', Number(data['brand-specs'].toFixed(2)), B.data?.maxBrandSpecsMB, 'MB');
addRow('examples 体积', Number(data.examples.toFixed(2)), B.data?.maxExamplesMB, 'MB');
addRow('systems 体积', Number(data.systems.toFixed(2)), B.data?.maxSystemsMB, 'MB');

/* 报告 */
const ints = budget.integrations || [];
const report = {
  tool: 'check-skill-size.mjs@1.0.0',
  root: ROOT,
  generatedAt: new Date().toISOString(),
  budgetFile: path.relative(ROOT, budgetPath),
  metrics: {
    skillMd: { lines: skillLines, bytes: skillBytes },
    triggers,
    references: { count: refs.length, totalBytes: refTotal, maxLines: refMaxLines, maxLinesFile: refMaxLineName, maxBytes: refMaxBytes, maxBytesFile: refMaxName },
    templates: tplCount,
    rootScripts: rootMjs,
    dataMB: { 'brand-specs': Number(data['brand-specs'].toFixed(2)), examples: Number(data.examples.toFixed(2)), systems: Number(data.systems.toFixed(2)) },
    integrations: ints.length,
    phaseLoadBytes: phaseLoad
  },
  summary: { status: violations.length ? 'FAIL' : 'PASS', violations: violations.length },
  violations,
  rows
};

const pad = (s, n) => String(s).padEnd(n, ' ');
console.log(`\n技能体量预算检查  (${path.relative(process.cwd(), budgetPath)})`);
console.log(`${pad('项', 30)} ${pad('实测', 14)} ${pad('上限', 14)} 结果`);
console.log('-'.repeat(70));
for (const r of rows) {
  if (r.name.startsWith('  · ')) continue;
  const actual = `${r.actual}${r.unit}`;
  const limit = r.limit == null ? '—' : `${r.limit}${r.unit}`;
  console.log(`${pad(r.name, 30)} ${pad(actual, 14)} ${pad(limit, 14)} ${r.ok ? 'PASS' : 'FAIL'}`);
}
if (violations.length) {
  console.log('\n超预算项：');
  for (const v of violations) console.log(`  ✖ ${v.name}: ${v.actual}${v.unit} > ${v.limit}${v.unit}`);
  console.log('\n处理顺序：拆（split）→ 删（retire）→ 下沉（T1→T2）→ 提预算（最后手段，需写理由）');
}
console.log(`\n判定: ${violations.length ? 'FAIL' : 'PASS'}${violations.length ? `（${violations.length} 项超预算）` : ''}`);

if (jsonOut) {
  const text = JSON.stringify(report, null, 2);
  if (jsonOut === '-') console.log(text);
  else fs.writeFileSync(path.resolve(jsonOut), text);
}
process.exit(violations.length ? 1 : 0);
