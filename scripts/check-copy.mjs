#!/usr/bin/env node
/**
 * check-copy.mjs — 检查「提示词泄漏 / 元说明 / 装饰性小字」
 *
 * 背景：AI 会把自己的执行说明、用户的要求、设计理由渲染成页面上的小字
 *      （"（说明：这里用 8pt 网格）"、"参考自 Linear"、"（示例数据）" 没标注、
 *       "TODO"…）。这些文字属于**工程注释**，不是用户可见内容。
 *
 * 用法:
 *   node check-copy.mjs <file.html|dir> [选项]
 *
 * 选项:
 *   --config <file>   规则配置（默认内置；可覆盖 patterns/severity/allow）
 *   --json <file>     报告输出路径；传 "-" 打印到 stdout
 *   --fail-on <lvl>   error|warn（默认 error）
 *   --min-font <px>   最小可见字号（默认 12）
 *   -h, --help        帮助
 *
 * 退出码: 0=通过 1=有违规 2=用法错误
 *
 * 规则:
 *   prompt-leak      可见文案里出现提示词/说明/设计理由/参考来源等元信息
 *   todo-leftover    可见文案里残留 TODO / FIXME / lorem / placeholder
 *   placeholder-unlabeled  出现「示例/示例数据」但未标注为占位
 *   tiny-text        可见文字字号 < --min-font（默认 12px）
 *
 * 只读，不改任何文件。
 */
import fs from 'node:fs';
import path from 'node:path';

const HELP = `check-copy.mjs — 检查提示词泄漏 / 元说明 / 装饰性小字

用法:
  node check-copy.mjs <file.html|dir> [选项]

选项:
  --config <file>   规则配置 JSON（可选）
  --json <file>     报告输出路径；"-" 表示 stdout
  --fail-on <lvl>   error|warn（默认 error）
  --min-font <px>   最小可见字号（默认 12）
  -h, --help        显示帮助

退出码: 0=通过 1=有违规 2=用法错误`;

const DEFAULTS = {
  minFontSize: 12,
  rules: {
    'prompt-leak': {
      severity: 'error',
      // 说明类 / 设计理由 / 参考来源 / 提示词残留
      patterns: [
        '说明[:：]', '备注[:：]', '注意[:：]', '提示[:：]', '注[:：]',
        '本文档', '本页', '本示例', '本演示', '演示用', '仅供演示', '仅供参考',
        '参考自', '参考品牌', '设计意图', '设计理由', '设计说明',
        '提示词', '系统提示', 'prompt\\s*[:：]', 'AI\\s*生成', 'AI味',
        '非对称分栏', '视觉重心', '留白比例', '字距', '色板', '栅格',
        '占位文字', '占位符', 'placeholder\\s*text'
      ],
      allow: []
    },
    'todo-leftover': {
      severity: 'error',
      patterns: ['TODO', 'FIXME', 'XXX', 'lorem\\s+ipsum', '待补充', '待完善', '待定']
    },
    'placeholder-unlabeled': {
      severity: 'warn',
      patterns: ['示例数据(?![（(]\\s*示例)', '假数据']
    }
  }
};

/* ---------------- args ---------------- */
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) { console.log(HELP); process.exit(0); }

let input = null, configPath = null, jsonOut = null, failOn = 'error', minFont = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--config') configPath = argv[++i];
  else if (a === '--json') jsonOut = argv[++i];
  else if (a === '--fail-on') failOn = argv[++i];
  else if (a === '--min-font') minFont = parseFloat(argv[++i]);
  else if (a.startsWith('-')) { console.error(`未知选项: ${a}`); process.exit(2); }
  else if (!input) input = a;
}
if (!input) { console.error('缺少输入文件/目录\n\n' + HELP); process.exit(2); }
if (!fs.existsSync(input)) { console.error(`输入不存在: ${input}`); process.exit(2); }

const cfg = structuredClone(DEFAULTS);
if (configPath) {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(configPath, 'utf8'))); }
  catch (e) { console.error(`规则配置解析失败: ${e.message}`); process.exit(2); }
}
if (minFont) cfg.minFontSize = minFont;
const severities = { error: 3, warn: 2, info: 1 };
const threshold = severities[failOn] ?? 3;

/* ---------------- files ---------------- */
function walk(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return /\.(html?|xhtml)$/i.test(p) ? [p] : [];
  const out = [];
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
    const q = path.join(p, e.name);
    if (e.isDirectory()) out.push(...walk(q));
    else if (/\.(html?|xhtml)$/i.test(e.name)) out.push(q);
  }
  return out;
}

/* ---------------- text extraction ---------------- */
function lineAt(src, idx) { return src.slice(0, idx).split('\n').length; }

function extract(src) {
  // 保留原文以便算行号：逐段替换为等长空白
  let work = src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<script\b[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<style\b[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<template\b[\s\S]*?<\/template>/gi, (m) => m.replace(/[^\n]/g, ' '));
  const texts = [];
  // 可见文本节点
  const re = />([^<>]+)</g;
  let m;
  while ((m = re.exec(work))) {
    const raw = m[1];
    const t = raw.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (t) texts.push({ where: 'text', value: t, line: lineAt(work, m.index + 1) });
  }
  // 用户可见属性
  const attrRe = /\b(alt|title|placeholder|aria-label|aria-description|value)\s*=\s*"([^"]*)"/gi;
  while ((m = attrRe.exec(work))) {
    const t = m[2].replace(/\s+/g, ' ').trim();
    if (t) texts.push({ where: `attr:${m[1].toLowerCase()}`, value: t, line: lineAt(work, m.index) });
  }
  return texts;
}

/* ---------------- style font-size scan ---------------- */
function tinyTexts(src, minFont) {
  const hits = [];
  const re = /font-size\s*:\s*([\d.]+)px/gi;
  let m;
  while ((m = re.exec(src))) {
    const px = parseFloat(m[1]);
    if (px < minFont) hits.push({ line: lineAt(src, m.index), value: `${px}px` });
  }
  const remRe = /font-size\s*:\s*([\d.]+)rem/gi;
  while ((m = remRe.exec(src))) {
    const px = parseFloat(m[1]) * 16;
    if (px < minFont) hits.push({ line: lineAt(src, m.index), value: `${m[1]}rem (${px}px)` });
  }
  return hits;
}

/* ---------------- scan ---------------- */
const violations = [];
const files = walk(input);
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file) || file;

  for (const node of extract(src)) {
    for (const [ruleId, rule] of Object.entries(cfg.rules)) {
      for (const pat of rule.patterns || []) {
        let re;
        try { re = new RegExp(pat, 'i'); } catch { continue; }
        if (re.test(node.value)) {
          if ((rule.allow || []).some((a) => node.value.includes(a))) continue;
          if ((rule.allowPatterns || []).some((p) => new RegExp(p, 'i').test(node.value))) continue;
          violations.push({
            rule: ruleId, severity: rule.severity || 'warn', file: rel,
            line: node.line, where: node.where, snippet: node.value.slice(0, 120),
            message: ruleId === 'prompt-leak'
              ? '可见文案出现说明/设计理由/参考来源：应移到代码注释或 change-log，不要渲染给用户'
              : ruleId === 'todo-leftover'
                ? '可见文案残留 TODO/lorem：应删除或改成代码注释'
                : '疑似未标注的示例数据：请标注「（示例数据）」或删除',
            howToFix: '把这句写进 HTML 注释（<!-- design: … -->）或删除；用户可见文案只写产品内容'
          });
        }
      }
    }
  }

  for (const hit of tinyTexts(src, cfg.minFontSize)) {
    violations.push({
      rule: 'tiny-text', severity: 'warn', file: rel, line: hit.line, where: 'style',
      snippet: `font-size: ${hit.value}`,
      message: `可见字号小于 ${cfg.minFontSize}px，阅读困难且常是装饰性小字`,
      howToFix: '提升到 --text-xs(12px) 以上，或删除该微文案'
    });
  }
}

/* ---------------- report ---------------- */
const seen = new Set();
const dedup = [];
for (const v of violations) {
  const k = [v.rule, v.file, v.line, v.snippet].join('|');
  if (!seen.has(k)) { seen.add(k); dedup.push(v); }
}
violations.length = 0; violations.push(...dedup);

violations.sort((a, b) => (severities[b.severity] - severities[a.severity]) || a.file.localeCompare(b.file) || a.line - b.line);
const count = (sev) => violations.filter((v) => v.severity === sev).length;
const report = {
  tool: 'check-copy.mjs@1.0.0',
  input: path.resolve(input),
  scanned: { files: files.length },
  config: { minFontSize: cfg.minFontSize, failOn, rules: Object.keys(cfg.rules) },
  summary: { total: violations.length, error: count('error'), warn: count('warn') },
  violations
};

const outPath = jsonOut === '-' ? null : jsonOut;
if (outPath) { fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(report, null, 2)); }

console.log(`\n文案检查: ${files.length} 个文件, ${violations.length} 个问题（error ${report.summary.error} / warn ${report.summary.warn}）`);
if (violations.length) {
  console.log('');
  for (const v of violations.slice(0, 40)) {
    console.log(`  ${v.severity === 'error' ? 'error' : 'warn '} ${v.file}:${v.line} [${v.rule}] ${v.snippet}`);
    console.log(`         ${v.message}`);
  }
  if (violations.length > 40) console.log(`  … 其余 ${violations.length - 40} 条见报告`);
}
if (outPath) console.log(`\nJSON 报告: ${path.resolve(outPath)}`);

const failCount = violations.filter((v) => severities[v.severity] >= threshold).length;
console.log(`\n判定: fail-on=${failOn} -> ${failCount ? 'FAIL' : 'PASS'}`);
process.exit(failCount ? 1 : 0);
