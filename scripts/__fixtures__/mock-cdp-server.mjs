// 用法（测试用 fixture，不是交付脚本）:
//   node __fixtures__/mock-cdp-server.mjs            # 起一个假 CDP 服务器，打印 ws 地址，保持运行
//   node __fixtures__/mock-cdp-server.mjs --help
//
// 作用：在**没有浏览器**的环境里验证 lib/cdp.mjs 的协议层（WebSocket 帧编解码、request id 映射、
// 事件订阅、session 扁平化、超时与错误传播）。它实现了 CDP 的一个最小子集：
//   Browser.getVersion / Browser.close
//   Target.createTarget / Target.attachToTarget / Target.closeTarget
//   Page.enable / Page.navigate(+load 事件) / Page.getLayoutMetrics / Page.captureScreenshot
//   Runtime.enable / Runtime.evaluate（只认少量表达式，模拟页面）
//   Network.enable / Emulation.setDeviceMetricsOverride / Emulation.setEmulatedMedia
// 只用于测试，不要拿它当作产品能力的替代。

import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import zlib from 'node:zlib';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ---------------- 极简 WebSocket 服务端 ---------------- */

function decodeFrames(buf) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = offset + 2;
    if (len === 126) { if (p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (p + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    const maskLen = masked ? 4 : 0;
    if (p + maskLen + len > buf.length) break;
    const mask = masked ? buf.subarray(p, p + 4) : null;
    p += maskLen;
    const payload = Buffer.alloc(len);
    buf.copy(payload, 0, p, p + len);
    if (mask) for (let i = 0; i < len; i++) payload[i] ^= mask[i % 4];
    frames.push({ fin, opcode, payload });
    offset = p + len;
  }
  return { frames, rest: buf.subarray(offset) };
}

function encodeFrame(payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (data.length < 126) header = Buffer.from([0x80 | opcode, data.length]);
  else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(data.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
  return Buffer.concat([header, data]);
}

/* ---------------- 测试用 PNG（8x8 纯色） ---------------- */

function tinyPng(w = 8, h = 8, rgba = [40, 90, 200, 255]) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const p = row + 1 + x * 4;
      raw[p] = rgba[0]; raw[p + 1] = rgba[1]; raw[p + 2] = rgba[2]; raw[p + 3] = rgba[3];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return crc ^ -1;
}

/* ---------------- CDP 模拟 ---------------- */

export function startMockCdp({ quiet = true, port = 0 } = {}) {
  const state = { targets: new Map(), sessions: new Map(), nextTarget: 1, nextSession: 1, requests: [] };
  const server = http.createServer((req, res) => {
    if (req.url === '/json/version') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ Browser: 'Mock/1.0', 'Protocol-Version': '1.3', webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/browser/mock` }));
      return;
    }
    res.statusCode = 404; res.end('nope');
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket', 'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`, '', '',
    ].join('\r\n'));

    let pending = Buffer.alloc(0);
    const sendRaw = (obj) => {
      const text = JSON.stringify(obj);
      try { socket.write(encodeFrame(text)); } catch { /* ignore */ }
    };
    const emit = (method, params, sessionId) => sendRaw(sessionId ? { method, params, sessionId } : { method, params });

    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      const { frames, rest } = decodeFrames(pending);
      pending = rest;
      for (const f of frames) {
        if (f.opcode === 0x8) { try { socket.end(encodeFrame(Buffer.alloc(0), 0x8)); } catch { /* ignore */ } return; }
        if (f.opcode === 0x9) { try { socket.write(encodeFrame(f.payload, 0xA)); } catch { /* ignore */ } continue; }
        if (f.opcode !== 0x1) continue;
        let msg;
        try { msg = JSON.parse(f.payload.toString('utf8')); } catch { continue; }
        state.requests.push(msg.method);
        handle(msg, sendRaw, emit);
      }
    });
    socket.on('error', () => {});
  });

  function handle(msg, sendRaw, emit) {
    const { id, method, params = {}, sessionId } = msg;
    const reply = (result) => sendRaw(sessionId ? { id, result, sessionId } : { id, result });
    const replyErr = (code, message) => sendRaw(sessionId ? { id, error: { code, message }, sessionId } : { id, error: { code, message } });

    switch (method) {
      case 'Browser.getVersion':
        return reply({ product: 'MockCDP/1.0', revision: 'mock', userAgent: 'mock', jsVersion: 'mock' });
      case 'Browser.close':
        reply({});
        return;
      case 'Target.createTarget': {
        const targetId = `T${state.nextTarget++}`;
        state.targets.set(targetId, { url: params.url || 'about:blank', session: null });
        return reply({ targetId });
      }
      case 'Target.attachToTarget': {
        const targetId = params.targetId;
        if (!state.targets.has(targetId)) return replyErr(-32602, `No target with given id: ${targetId}`);
        const sid = `S${state.nextSession++}`;
        state.sessions.set(sid, targetId);
        state.targets.get(targetId).session = sid;
        return reply({ sessionId: sid });
      }
      case 'Target.detachFromTarget':
        state.sessions.delete(params.sessionId);
        return reply({});
      case 'Target.closeTarget': {
        const sid = state.targets.get(params.targetId)?.session;
        if (sid) state.sessions.delete(sid);
        state.targets.delete(params.targetId);
        return reply({ success: true });
      }
      case 'Page.navigate': {
        const targetId = state.sessions.get(sessionId);
        const t = state.targets.get(targetId);
        if (!t) return replyErr(-32602, 'No target');
        t.url = params.url;
        reply({ frameId: `F-${targetId}`, loaderId: 'L1' });
        setTimeout(() => emit('Page.frameNavigated', { frame: { id: `F-${targetId}`, url: params.url, loaderId: 'L1' } }, sessionId), 5);
        setTimeout(() => emit('Page.domContentEventFired', { timestamp: Date.now() / 1000 }, sessionId), 10);
        setTimeout(() => emit('Page.loadEventFired', { timestamp: Date.now() / 1000 }, sessionId), 15);
        return;
      }
      case 'Page.getLayoutMetrics':
        return reply({ cssContentSize: { x: 0, y: 0, width: 320, height: 200 }, contentSize: { x: 0, y: 0, width: 320, height: 200 } });
      case 'Page.captureScreenshot':
        return reply({ data: tinyPng(16, 16).toString('base64') });
      case 'Page.enable': case 'Page.addScriptToEvaluateOnNewDocument':
        return reply({ identifier: 'script-1' });
      case 'Runtime.enable': case 'Network.enable': case 'Emulation.setDeviceMetricsOverride':
      case 'Emulation.setEmulatedMedia': case 'Input.dispatchMouseEvent':
        return reply({});
      case 'Runtime.evaluate': {
        const expr = String(params.expression || '');
        const ok = (val, type) => reply({ result: { type, value: val } });
        if (expr === 'document.title') return ok('mock-title', 'string');
        if (/document\.body\.textContent/.test(expr)) return ok('MOCK', 'string');
        if (/1\s*\+\s*1/.test(expr)) return ok(2, 'number');
        // hover 需要 rect；scrollIntoView / scrollTo 直接成功
        if (/getBoundingClientRect/.test(expr)) return ok({ x: 10, y: 10, width: 20, height: 20 }, 'object');
        if (/scrollIntoView|window\.scrollTo/.test(expr)) return ok(true, 'boolean');
        if (/document\.querySelector/.test(expr)) return ok(true, 'boolean');
        if (params.awaitPromise && /reject|throw/.test(expr)) {
          return reply({ result: { type: 'undefined' }, exceptionDetails: { text: 'Uncaught (in promise)', exception: { description: 'Error: mock failure' } } });
        }
        return ok(undefined, 'undefined');
      }
      default:
        return replyErr(-32601, `'${method}' wasn't found`);
    }
  }

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({
        port: actual,
        wsUrl: `ws://127.0.0.1:${actual}/devtools/browser/mock`,
        httpUrl: `http://127.0.0.1:${actual}`,
        state,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('mock-cdp-server.mjs');
if (isDirectRun) {
  if (process.argv.includes('--help')) {
    console.log(`mock-cdp-server.mjs — 假 CDP 服务器（仅供测试 lib/cdp.mjs）

用法:
  node __fixtures__/mock-cdp-server.mjs        起服务，打印 ws 地址，Ctrl+C 结束
  node __fixtures__/mock-cdp-server.mjs --help

支持的方法见文件顶部注释。`);
    process.exit(0);
  }
  const srv = await startMockCdp({ quiet: false, port: Number(process.env.MOCK_CDP_PORT || 0) });
  console.log(`mock CDP listening: ${srv.wsUrl}`);
  console.log(`http endpoint: ${srv.httpUrl}/json/version`);
  process.once('SIGINT', async () => { await srv.close(); process.exit(0); });
}
