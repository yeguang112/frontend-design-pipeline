// 用法（测试用 fixture 生成器）:
//   node __fixtures__/gen-pixel-fixtures.mjs
//
// 用 pixel-diff.mjs 导出的纯 Node PNG 编码器画几张确定性图片，供像素对比自测：
//   pixel/ref.png          240x160 参考图
//   pixel/same.png         与 ref 逐字节相同
//   pixel/one-pixel.png    仅 1 个像素不同（ratio 1/38400，低于默认阈值 -> PASS）
//   pixel/tiny-ref.png     16x16（1 像素 = 0.39% > 默认 0.3% -> FAIL）
//   pixel/tiny-same.png    与 tiny-ref 相同
//   pixel/tiny-one-pixel.png  16x16 里改 1 个像素
//   pixel/smaller.png      120x80（尺寸不一致用）
// 不依赖浏览器/第三方库；重复运行结果一致。

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../pixel-diff.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'pixel');

function fill(rgba, w, x, y, [r, g, b, a = 255]) {
  const o = (y * w + x) * 4;
  rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
}

function drawCard(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 背景：竖直渐变（确定性整数运算）
      const t = Math.round((y / Math.max(1, h - 1)) * 24);
      let c = [8 + t, 9 + Math.round(t * 0.7), 10 + Math.round(t * 0.5)];
      // 卡片
      const inCard = x >= 24 && x < w - 24 && y >= 20 && y < h - 20;
      if (inCard) c = [18, 20, 26];
      // 卡片描边
      const onBorder = inCard && (x === 24 || x === w - 25 || y === 20 || y === h - 21);
      if (onBorder) c = [38, 42, 51];
      // accent 竖条
      if (x >= 40 && x < 48 && y >= 36 && y < 88) c = [59, 130, 246];
      // 文字条（3 行）
      for (const [ty, tw] of [[100, 96], [116, 72], [132, 120]]) {
        if (y >= ty && y < ty + 6 && x >= 40 && x < 40 + tw) c = [230, 232, 236];
      }
      // 右下角圆角块（模拟按钮）
      if (x >= w - 96 && x < w - 40 && y >= h - 48 && y < h - 28) c = [59, 130, 246];
      fill(rgba, w, x, y, [...c, 255]);
    }
  }
  return rgba;
}

function drawTiny(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const checker = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
      fill(rgba, w, x, y, checker ? [24, 26, 32, 255] : [40, 44, 52, 255]);
    }
  }
  // 一个 accent 点，方便确认"改一像素"位置
  fill(rgba, w, 5, 5, [59, 130, 246, 255]);
  return rgba;
}

function cloneWithPixel(rgba, w, x, y, color) {
  const out = Buffer.from(rgba);
  fill(out, w, x, y, color);
  return out;
}

await fsp.mkdir(outDir, { recursive: true });
const written = [];
async function save(name, buffer) {
  const p = path.join(outDir, name);
  await fsp.writeFile(p, buffer);
  written.push(`${name} (${buffer.length} B)`);
}

const refW = 240, refH = 160;
const ref = drawCard(refW, refH);
await save('ref.png', encodePng(refW, refH, ref));
await save('same.png', encodePng(refW, refH, Buffer.from(ref)));
await save('one-pixel.png', encodePng(refW, refH, cloneWithPixel(ref, refW, 120, 80, [255, 0, 0, 255])));

const tinyW = 16, tinyH = 16;
const tiny = drawTiny(tinyW, tinyH);
await save('tiny-ref.png', encodePng(tinyW, tinyH, tiny));
await save('tiny-same.png', encodePng(tinyW, tinyH, Buffer.from(tiny)));
await save('tiny-one-pixel.png', encodePng(tinyW, tinyH, cloneWithPixel(tiny, tinyW, 8, 8, [255, 0, 0, 255])));

const small = drawCard(120, 80);
await save('smaller.png', encodePng(120, 80, small));

console.log(`已生成 ${written.length} 张 fixture PNG -> ${outDir}`);
for (const w of written) console.log(`  ${w}`);
