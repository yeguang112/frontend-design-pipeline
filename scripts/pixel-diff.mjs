// 用法:
//   node pixel-diff.mjs <ref.png> <cur.png> [--threshold 0.003] [--out diff.json] [--diff <path>] [--engine auto|cdp|node] [--help]
//
// 两图逐像素对比，输出 changedPixels / ratio，按阈值判定 PASS/FAIL，并保存差异可视化图（差异像素涂红）。
// 引擎:
//   cdp  = 用 CDP 打开空白页，把两张 PNG 以 dataURL 载入 canvas 逐像素比较（默认优先）
//   node = 纯 Node 解 PNG（zlib + 逐行反滤波），不启动浏览器（沙箱/CI 可用，且逐字节精确）
//   auto = 先试 cdp，失败自动降级到 node（会打印原因）
// 退出码: 0 未超阈值 / 1 超阈值或尺寸不一致 / 2 用法错误
//
// 输出: diff JSON（默认 <cur>.diff.json）+ 差异图（默认 <cur>.diff.png）

import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  parseCli, writeJson, die, sha256Buf, nowIso, humanBytes, pngSize,
  UsageError, CdpError, launchBrowser, attachBrowser, resolveCdpUrl,
} from './lib/cdp.mjs';

const VERSION = '1.0.0';
const HELP = `pixel-diff.mjs — 像素级对比（CDP canvas 或纯 Node PNG 解码）

用法:
  node pixel-diff.mjs <ref.png> <cur.png> [选项]

选项:
  --threshold <r>       允许的差异像素比例上限（0–1，默认 0.003 = 0.3%）
  --channel-threshold <n>  单像素任一通道差值 <= n 视为相同（0–255，默认 0；
                        1–2 可吸收字体抗锯齿/半透明舍入抖动）
  --out <file>          diff JSON 输出路径（默认 <cur>.diff.json；传 "-" 不写文件）
  --diff <file>         差异图输出路径（默认 <cur>.diff.png）
  --engine <x>          auto | cdp | node（默认 auto：先试 cdp，失败降级 node）
  --browser <x>         chrome | edge | 绝对路径（cdp 引擎用）
  --cdp-url <url>       附着到已运行的 Chromium
  -h, --help            显示本帮助

判定:
  ratio = changedPixels / totalPixels；ratio <= threshold 且尺寸一致 => PASS(0)，否则 FAIL(1)
  尺寸不一致直接 FAIL（并在 JSON 里写明两图尺寸）

差异图: 以 cur 为底，差异像素涂成纯红 #ff0000，其余像素保持原样。

退出码: 0 PASS / 1 FAIL / 2 用法错误

已知限制:
  - node 引擎只支持 8-bit、非隔行的 PNG（Chrome 截图 / canvas 导出都满足）；16-bit 或 Adam7 隔行会明确报错。
  - cdp 引擎经 canvas getImageData，半透明像素可能有 ±1 舍入；需要逐字节精确时用 --engine node。
  - 两款浏览器/两种 DPI/字体环境渲染的同一页面像素本就不同，跨机器比对前先统一环境。
`;

/* ================================================================== */
/* PNG 编解码（纯 Node，zlib）                                         */
/* ================================================================== */

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** RGBA8 -> PNG Buffer */
export function encodePng(width, height, rgba) {
  const bytesPerRow = width * 4 + 1;
  const raw = Buffer.alloc(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    raw[y * bytesPerRow] = 0; // filter: none
    rgba.copy(raw, y * bytesPerRow + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * PNG Buffer -> {width,height,rgba}
 * 支持 8-bit、非隔行、colorType 0/2/3/4/6（含 PLTE + tRNS）。
 */
export function decodePng(buffer, label = 'PNG') {
  if (!buffer || buffer.length < 8 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new CdpError(`${label} 不是 PNG 文件`, '只支持 PNG；其它格式先用浏览器/工具转成 PNG。');
  }
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null, trns = null;
  const idatParts = [];
  while (offset + 8 <= buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idatParts.push(data);
    else if (type === 'IEND') break;
  }
  if (!width || !height) throw new CdpError(`${label} 缺少 IHDR`, '文件可能损坏。');
  if (bitDepth !== 8) {
    throw new CdpError(`${label} 是 ${bitDepth}-bit PNG，node 引擎只支持 8-bit`,
      '用 --engine cdp（canvas 解码），或先用图像工具转成 8-bit PNG。');
  }
  if (interlace !== 0) {
    throw new CdpError(`${label} 是 Adam7 隔行 PNG，node 引擎不支持`,
      '用 --engine cdp，或先用图像工具另存为非隔行 PNG。');
  }
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new CdpError(`${label} 的 colorType=${colorType} 不支持`, '只支持 0/2/3/4/6。');
  if (colorType === 3 && !palette) throw new CdpError(`${label} 是索引色但缺少 PLTE`, '文件可能损坏。');

  const compressed = Buffer.concat(idatParts);
  let raw;
  try { raw = zlib.inflateSync(compressed); }
  catch (err) { throw new CdpError(`${label} IDAT 解压失败: ${err.message}`, '文件可能被截断。'); }

  const bpp = channels; // bitDepth 8
  const rowBytes = width * bpp;
  const expected = (rowBytes + 1) * height;
  if (raw.length < expected) throw new CdpError(`${label} 像素数据不完整（${raw.length} < ${expected}）`, '文件可能被截断。');

  // 逐行反滤波
  const pixels = Buffer.alloc(rowBytes * height);
  let prev = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowBytes + 1)];
    const src = raw.subarray(y * (rowBytes + 1) + 1, y * (rowBytes + 1) + 1 + rowBytes);
    const out = Buffer.alloc(rowBytes);
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 0xff;
          break;
        }
        default: throw new CdpError(`${label} 出现未知滤波器 ${filter}`, '文件可能损坏。');
      }
      out[x] = v;
    }
    out.copy(pixels, y * rowBytes);
    prev = out;
  }

  // 转 RGBA
  const rgba = Buffer.alloc(width * height * 4);
  const trnsGray = colorType === 0 && trns && trns.length >= 2 ? trns.readUInt16BE(0) : null;
  const trnsRgb = colorType === 2 && trns && trns.length >= 6
    ? [trns.readUInt16BE(0), trns.readUInt16BE(2), trns.readUInt16BE(4)] : null;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (colorType === 6) {
      rgba[o] = pixels[i * 4]; rgba[o + 1] = pixels[i * 4 + 1]; rgba[o + 2] = pixels[i * 4 + 2]; rgba[o + 3] = pixels[i * 4 + 3];
    } else if (colorType === 2) {
      const r = pixels[i * 3], g = pixels[i * 3 + 1], b = pixels[i * 3 + 2];
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b;
      rgba[o + 3] = trnsRgb && r === trnsRgb[0] && g === trnsRgb[1] && b === trnsRgb[2] ? 0 : 255;
    } else if (colorType === 0) {
      const g = pixels[i];
      rgba[o] = g; rgba[o + 1] = g; rgba[o + 2] = g;
      rgba[o + 3] = trnsGray !== null && g === trnsGray ? 0 : 255;
    } else if (colorType === 4) {
      const g = pixels[i * 2];
      rgba[o] = g; rgba[o + 1] = g; rgba[o + 2] = g; rgba[o + 3] = pixels[i * 2 + 1];
    } else {
      const idx = pixels[i];
      const p = idx * 3;
      if (p + 2 >= palette.length) throw new CdpError(`${label} 调色板索引越界 (${idx})`, '文件可能损坏。');
      rgba[o] = palette[p]; rgba[o + 1] = palette[p + 1]; rgba[o + 2] = palette[p + 2];
      rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, rgba };
}

/* ================================================================== */
/* 像素比较                                                           */
/* ================================================================== */

/** 纯 Node 比较 */
export function compareRgba(ref, cur, { channelThreshold = 0 } = {}) {
  const { width: w, height: h } = ref;
  const a = ref.rgba;
  const b = cur.rgba;
  const total = w * h;
  const diff = Buffer.from(b); // 以 cur 为底
  let changed = 0;
  let maxDelta = 0;
  let sumDelta = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const dr = Math.abs(a[o] - b[o]);
      const dg = Math.abs(a[o + 1] - b[o + 1]);
      const db = Math.abs(a[o + 2] - b[o + 2]);
      const da = Math.abs(a[o + 3] - b[o + 3]);
      const d = Math.max(dr, dg, db, da);
      if (d > maxDelta) maxDelta = d;
      if (d > channelThreshold) {
        changed += 1;
        sumDelta += d;
        diff[o] = 255; diff[o + 1] = 0; diff[o + 2] = 0; diff[o + 3] = 255;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    width: w, height: h, totalPixels: total,
    changedPixels: changed,
    ratio: total ? changed / total : 0,
    maxChannelDelta: maxDelta,
    meanChannelDelta: changed ? Number((sumDelta / changed).toFixed(3)) : 0,
    bbox: changed ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    diffRgba: diff,
  };
}

/* ================================================================== */
/* CDP canvas 引擎                                                    */
/* ================================================================== */

const CANVAS_COMPARE_FN = async function canvasCompare(refDataUrl, curDataUrl, channelThreshold) {
  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败（dataURL 可能过大或被截断）'));
    img.src = src;
  });
  const [a, b] = await Promise.all([load(refDataUrl), load(curDataUrl)]);
  const w = a.naturalWidth;
  const h = a.naturalHeight;
  if (w !== b.naturalWidth || h !== b.naturalHeight) {
    return { sizeMismatch: true, refWidth: w, refHeight: h, curWidth: b.naturalWidth, curHeight: b.naturalHeight };
  }
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
  const cb = document.createElement('canvas'); cb.width = w; cb.height = h;
  const xa = ca.getContext('2d', { willReadFrequently: true });
  const xb = cb.getContext('2d', { willReadFrequently: true });
  xa.drawImage(a, 0, 0);
  xb.drawImage(b, 0, 0);
  const da = xa.getImageData(0, 0, w, h).data;
  const dbRaw = xb.getImageData(0, 0, w, h).data;
  const db = new Uint8ClampedArray(dbRaw);
  let changed = 0;
  let maxDelta = 0;
  let sumDelta = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const d = Math.max(
        Math.abs(da[o] - db[o]), Math.abs(da[o + 1] - db[o + 1]),
        Math.abs(da[o + 2] - db[o + 2]), Math.abs(da[o + 3] - db[o + 3]),
      );
      if (d > maxDelta) maxDelta = d;
      if (d > channelThreshold) {
        changed += 1;
        sumDelta += d;
        db[o] = 255; db[o + 1] = 0; db[o + 2] = 0; db[o + 3] = 255;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const dc = document.createElement('canvas'); dc.width = w; dc.height = h;
  const xc = dc.getContext('2d');
  xc.putImageData(new ImageData(db, w, h), 0, 0);
  return {
    sizeMismatch: false,
    width: w, height: h,
    changedPixels: changed,
    totalPixels: w * h,
    maxChannelDelta: maxDelta,
    meanChannelDelta: changed ? sumDelta / changed : 0,
    bbox: changed ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    diffDataUrl: dc.toDataURL('image/png'),
  };
};

async function runCdpDiff(refBuf, curBuf, { channelThreshold, browser: browserOpt, cdpUrl }) {
  let browser = null;
  let owned = false;
  try {
    if (cdpUrl) {
      browser = await attachBrowser(await resolveCdpUrl(cdpUrl), { timeoutMs: 15000 });
    } else {
      browser = await launchBrowser({ browser: browserOpt, timeoutMs: 30000 });
      owned = true;
    }
    const page = await browser.newPage();
    await page.goto('data:text/html,' + encodeURIComponent('<!doctype html><title>pixel-diff</title><body style="margin:0"></body>'));
    const refUrl = `data:image/png;base64,${refBuf.toString('base64')}`;
    const curUrl = `data:image/png;base64,${curBuf.toString('base64')}`;
    const result = await page.evaluateFn(CANVAS_COMPARE_FN, refUrl, curUrl, channelThreshold);
    await page.close();
    if (result?.sizeMismatch) {
      return { sizeMismatch: true, refWidth: result.refWidth, refHeight: result.refHeight, curWidth: result.curWidth, curHeight: result.curHeight };
    }
    if (!result || typeof result.changedPixels !== 'number') {
      throw new CdpError('canvas 比较没有返回结果', '页面里的 canvas 可能不可用；用 --engine node 重试。');
    }
    const diffBuf = Buffer.from(String(result.diffDataUrl).split(',')[1] || '', 'base64');
    if (pngSize(diffBuf).width === 0) throw new CdpError('差异图编码失败（不是合法 PNG）', '用 --engine node 重试。');
    return {
      width: result.width, height: result.height,
      totalPixels: result.totalPixels,
      changedPixels: result.changedPixels,
      ratio: result.totalPixels ? result.changedPixels / result.totalPixels : 0,
      maxChannelDelta: result.maxChannelDelta,
      meanChannelDelta: Number(result.meanChannelDelta.toFixed(3)),
      bbox: result.bbox,
      diffBuffer: diffBuf,
      sizeMismatch: false,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
    void owned;
  }
}

/* ================================================================== */
/* 主流程                                                             */
/* ================================================================== */

function defaultOutPath(curPath) {
  const dir = path.dirname(curPath);
  const base = path.basename(curPath).replace(/\.(png|jpe?g)$/i, '');
  return path.join(dir, `${base}.diff.json`);
}

function defaultDiffPath(curPath) {
  const dir = path.dirname(curPath);
  const base = path.basename(curPath).replace(/\.(png|jpe?g)$/i, '');
  return path.join(dir, `${base}.diff.png`);
}

async function main() {
  const { help, opts, positionals } = parseCli(process.argv.slice(2), {
    options: {
      '--threshold': { key: 'threshold', type: 'number', default: 0.003 },
      '--channel-threshold': { key: 'channelThreshold', type: 'number', default: 0 },
      '--out': { key: 'out', type: 'string' },
      '--diff': { key: 'diff', type: 'string' },
      '--engine': { key: 'engine', type: 'string', default: 'auto' },
      '--browser': { key: 'browser', type: 'string' },
      '--cdp-url': { key: 'cdpUrl', type: 'string' },
      '--json': { key: 'json', type: 'string' },
    },
    minPositional: 2,
    maxPositional: 2,
  });
  if (help) { console.log(HELP); return 0; }
  if (!['auto', 'cdp', 'node'].includes(opts.engine)) throw new UsageError(`--engine 只能是 auto/cdp/node，收到 "${opts.engine}"`);
  if (!(opts.threshold >= 0 && opts.threshold <= 1)) throw new UsageError(`--threshold 必须在 0–1 之间，收到 ${opts.threshold}`);
  if (!(opts.channelThreshold >= 0 && opts.channelThreshold <= 255)) throw new UsageError(`--channel-threshold 必须在 0–255 之间`);

  const refPath = path.resolve(positionals[0]);
  const curPath = path.resolve(positionals[1]);
  const refBuf = await fsp.readFile(refPath).catch(() => null);
  const curBuf = await fsp.readFile(curPath).catch(() => null);
  if (!refBuf) throw new CdpError(`参考图不存在: ${refPath}`, '确认路径；只支持 PNG。');
  if (!curBuf) throw new CdpError(`当前图不存在: ${curPath}`, '确认路径；只支持 PNG。');
  for (const [label, buf, p] of [['参考图', refBuf, refPath], ['当前图', curBuf, curPath]]) {
    if (buf.length < 8 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new CdpError(`${label} 不是 PNG: ${p}`, '只支持 PNG。截图产物本来就是 PNG；其它格式先用图像工具转换。');
    }
  }

  const refSize = pngSize(refBuf);
  const curSize = pngSize(curBuf);
  const outPath = opts.out === '-' ? null : path.resolve(opts.out || defaultOutPath(curPath));
  const diffPath = path.resolve(opts.diff || defaultDiffPath(curPath));

  const baseReport = {
    tool: `pixel-diff.mjs@${VERSION}`,
    generatedAt: nowIso(),
    ref: { path: refPath, sha256: sha256Buf(refBuf), bytes: refBuf.length, width: refSize.width, height: refSize.height, format: 'png' },
    cur: { path: curPath, sha256: sha256Buf(curBuf), bytes: curBuf.length, width: curSize.width, height: curSize.height, format: 'png' },
    params: { threshold: opts.threshold, channelThreshold: opts.channelThreshold, engine: opts.engine },
    engine: null,
    result: null,
    status: 'FAIL',
    reason: null,
    diffImage: null,
  };

  const finish = async (report) => {
    if (outPath) await writeJson(outPath, report);
    console.log(`\n${report.status === 'PASS' ? '✔ PASS' : '✖ FAIL'} 像素对比`);
    console.log(`  ref: ${refPath} (${report.ref.width}x${report.ref.height}, ${humanBytes(report.ref.bytes)})`);
    console.log(`  cur: ${curPath} (${report.cur.width}x${report.cur.height}, ${humanBytes(report.cur.bytes)})`);
    console.log(`  engine: ${report.engine}`);
    if (report.result) {
      console.log(`  changedPixels: ${report.result.changedPixels} / ${report.result.totalPixels}` +
        `  ratio: ${report.result.ratio.toFixed(6)}  (threshold ${opts.threshold})`);
      console.log(`  maxChannelDelta: ${report.result.maxChannelDelta}  meanChannelDelta: ${report.result.meanChannelDelta}`);
      if (report.result.bbox) {
        console.log(`  差异区域: x=${report.result.bbox.x} y=${report.result.bbox.y} w=${report.result.bbox.width} h=${report.result.bbox.height}`);
      }
    }
    console.log(`  判定: ${report.reason}`);
    if (report.diffImage) console.log(`  差异图: ${report.diffImage}`);
    if (outPath) console.log(`  JSON: ${outPath}`);
    return report.status === 'PASS' ? 0 : 1;
  };

  // 尺寸不一致：直接 FAIL，不必逐像素
  if (refSize.width !== curSize.width || refSize.height !== curSize.height) {
    baseReport.status = 'FAIL';
    baseReport.engine = 'skipped';
    baseReport.reason = `尺寸不一致: ref ${refSize.width}x${refSize.height} vs cur ${curSize.width}x${curSize.height}`;
    console.log(`\n✖ 尺寸不一致，无法逐像素比较：ref ${refSize.width}x${refSize.height}, cur ${curSize.width}x${curSize.height}`);
    return finish(baseReport);
  }

  let engine = opts.engine;
  let result = null;
  let lastErr = null;
  if (engine === 'auto' || engine === 'cdp') {
    try {
      result = await runCdpDiff(refBuf, curBuf, { channelThreshold: opts.channelThreshold, browser: opts.browser, cdpUrl: opts.cdpUrl });
      engine = 'cdp';
    } catch (err) {
      lastErr = err;
      if (engine === 'cdp') throw err;
      console.log(`\n⚠ CDP 引擎不可用，降级到 node 引擎：${err.message}`);
      if (err.hint) console.log(`  （${err.hint.split('\n')[0]}）`);
      engine = 'node';
    }
  }
  if (!result) {
    let refDecoded;
    let curDecoded;
    try {
      refDecoded = decodePng(refBuf, 'ref.png');
      curDecoded = decodePng(curBuf, 'cur.png');
    } catch (err) {
      if (lastErr) err.message += `（CDP 也失败: ${lastErr.message}）`;
      throw err;
    }
    if (refDecoded.width !== curDecoded.width || refDecoded.height !== curDecoded.height) {
      baseReport.status = 'FAIL';
      baseReport.reason = `尺寸不一致: ref ${refDecoded.width}x${refDecoded.height} vs cur ${curDecoded.width}x${curDecoded.height}`;
      return finish(baseReport);
    }
    const cmp = compareRgba(refDecoded, curDecoded, { channelThreshold: opts.channelThreshold });
    result = { ...cmp, diffBuffer: encodePng(cmp.width, cmp.height, cmp.diffRgba) };
    engine = engine === 'cdp' ? 'node' : engine === 'auto' ? 'node' : engine;
  }

  const ratio = result.totalPixels ? result.changedPixels / result.totalPixels : 0;
  baseReport.engine = engine;
  baseReport.result = {
    width: result.width,
    height: result.height,
    totalPixels: result.totalPixels,
    changedPixels: result.changedPixels,
    ratio,
    maxChannelDelta: result.maxChannelDelta,
    meanChannelDelta: result.meanChannelDelta,
    bbox: result.bbox,
    identical: result.changedPixels === 0,
  };
  const pass = ratio <= opts.threshold;
  baseReport.status = pass ? 'PASS' : 'FAIL';
  baseReport.reason = pass
    ? `ratio ${ratio.toFixed(6)} <= threshold ${opts.threshold}（${result.changedPixels} 像素差异，在容忍范围内）`
    : `ratio ${ratio.toFixed(6)} > threshold ${opts.threshold}（${result.changedPixels} 像素差异）`;

  await fsp.mkdir(path.dirname(diffPath), { recursive: true });
  await fsp.writeFile(diffPath, result.diffBuffer);
  baseReport.diffImage = diffPath;

  return finish(baseReport);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }).catch((err) => die(err));
}

export { crc32, runCdpDiff };
