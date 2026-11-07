// 用法（本文件是共享库，也可以直接运行做自检）:
//   node lib/cdp.mjs              # 探测本机浏览器 + 起一个 headless 页面 + 自检截图
//   node lib/cdp.mjs --help
//
// 零第三方依赖：只用 Node 24 内置模块 + 本机 Chrome/Edge + 全局 WebSocket。
// 导出的公共 API（其他脚本按需 import）:
//   launchBrowser({ browser?, headless?, extraArgs?, timeoutMs?, keepProfile? }) -> Browser
//   findBrowser({ browser? }) -> { path, name }
//   CdpError / UsageError
//   通用工具: sha256Buf sha256File walkFiles pngSize nowIso humanBytes
//             parseColor toHex rgbToHsl hueOf findColorLiterals inDeclarationValue
//             parseCli readJson writeJson sleep
//
// Browser: .newPage() .version() .close() .port .wsUrl .browserPath
// Page:    .goto(url,{waitUntil}) .evaluate(expr) .evaluateFn(fn,...args)
//          .screenshot({fullPage,clip,width,height,deviceScaleFactor,format})
//          .setDeviceMetrics({width,height,deviceScaleFactor})
//          .setEmulatedMedia({prefersColorScheme,prefersReducedMotion})
//          .addInitScript(src) .addStyleTag(css) .waitForSelector(sel)
//          .click(sel) .fill(sel,val) .hover(sel) .scrollTo({y,selector})
//          .waitForTimeout(ms) .close()

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const VERSION = '1.0.0';
const DEFAULT_TIMEOUT = 30_000;

/* ------------------------------------------------------------------ */
/* 错误类型                                                           */
/* ------------------------------------------------------------------ */

export class CdpError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'CdpError';
    this.exitCode = 1;
    this.hint = hint || '';
  }
}

export class UsageError extends Error {
  constructor(message, help) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = 2;
    this.help = help || '';
  }
}

/* ------------------------------------------------------------------ */
/* 浏览器探测                                                         */
/* ------------------------------------------------------------------ */

const PROGRAM_FILES = process.env['ProgramFiles'] || 'C:\\Program Files';
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const LOCAL_APP_DATA = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');

export const BROWSER_CANDIDATES = [
  { name: 'chrome', label: 'Google Chrome', paths: [
    path.join(PROGRAM_FILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(PROGRAM_FILES_X86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(LOCAL_APP_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ] },
  { name: 'edge', label: 'Microsoft Edge', paths: [
    path.join(PROGRAM_FILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(PROGRAM_FILES_X86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ] },
];

/**
 * 找到可用的 Chromium 浏览器可执行文件。
 * @param {{browser?: string}} [opts] browser: 'chrome' | 'edge' | 绝对路径 | 任意含 exe 的路径片段
 */
export function findBrowser(opts = {}) {
  const override = opts.browser || process.env.DSH_BROWSER_PATH || process.env.CHROME_PATH;
  if (override) {
    if (fs.existsSync(override)) return { path: override, name: path.basename(override) };
    // 允许传 "chrome"/"edge" 名字或路径片段
    const wanted = override.toLowerCase();
    for (const c of BROWSER_CANDIDATES) {
      if (c.name === wanted) {
        for (const p of c.paths) if (fs.existsSync(p)) return { path: p, name: c.label };
      }
    }
    for (const c of BROWSER_CANDIDATES) {
      for (const p of c.paths) {
        if (p.toLowerCase().includes(wanted) && fs.existsSync(p)) return { path: p, name: c.label };
      }
    }
    throw new CdpError(
      `找不到浏览器: "${override}"`,
      `传 --browser <绝对路径>，或用 --browser chrome / --browser edge。\n` +
      `已探测路径：\n${BROWSER_CANDIDATES.flatMap((c) => c.paths).map((p) => '  ' + p).join('\n')}`,
    );
  }
  const seen = [];
  for (const c of BROWSER_CANDIDATES) {
    for (const p of c.paths) {
      seen.push(p);
      if (fs.existsSync(p)) return { path: p, name: c.label };
    }
  }
  throw new CdpError(
    '找不到 Chrome / Edge（CDP 后端只支持 Chromium 内核）。',
    `安装 Google Chrome 或 Microsoft Edge，或用 --browser <exe 绝对路径> / 环境变量 DSH_BROWSER_PATH 指定。\n` +
    `已探测：\n${seen.map((p) => '  ' + p).join('\n')}`,
  );
}

/* ------------------------------------------------------------------ */
/* CDP 连接（Node 内置全局 WebSocket）                                 */
/* ------------------------------------------------------------------ */

class Connection {
  constructor(wsUrl, { timeout = DEFAULT_TIMEOUT } = {}) {
    this.wsUrl = wsUrl;
    this.timeout = timeout;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map(); // method -> Set<fn>
    this.closed = false;
    this.closeReason = null;
    this.ws = null;
  }

  async open() {
    // Node >= 22 自带全局 WebSocket（undici）。没有则明确报错，而不是静默失败。
    if (typeof WebSocket !== 'function') {
      throw new CdpError(
        `当前 Node (${process.version}) 没有全局 WebSocket。`,
        '需要 Node >= 22（本机要求 Node 24）。用 node -v 确认版本后重试。',
      );
    }
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        try { ws.close(); } catch { /* ignore */ }
        reject(new CdpError(`连接 CDP WebSocket 超时（${this.timeout}ms）: ${this.wsUrl}`,
          '浏览器可能启动失败或被安全软件拦截；用 --verbose 看浏览器 stderr。'));
      }, this.timeout);
      const onOpen = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new CdpError(`CDP WebSocket 连接失败: ${this.wsUrl}`,
        '确认 --remote-debugging-port 未被安全软件拦截；或换 --browser edge 试一次。')); };
      const cleanup = () => { clearTimeout(timer); ws.removeEventListener('open', onOpen); ws.removeEventListener('error', onError); };
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('error', onError, { once: true });
    });
    ws.addEventListener('message', (ev) => this._onMessage(ev));
    ws.addEventListener('close', () => this._onClose());
    ws.addEventListener('error', () => { /* 由 close/pending 超时统一处理 */ });
  }

  _onMessage(ev) {
    let msg;
    try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); }
    catch { return; }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject, timer, method } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) {
        reject(new CdpError(
          `CDP ${method} 失败: ${msg.error.message} (code ${msg.error.code ?? '?'})`,
          hintForCdpError(method, msg.error),
        ));
      } else resolve(msg.result ?? {});
      return;
    }
    if (msg.method) {
      const set = this.listeners.get(msg.method);
      if (set) for (const fn of [...set]) { try { fn(msg.params ?? {}, msg.sessionId); } catch { /* 监听器异常不炸连接 */ } }
      const wild = this.listeners.get('*');
      if (wild) for (const fn of [...wild]) { try { fn(msg.params ?? {}, msg.sessionId, msg.method); } catch { /* ignore */ } }
    }
  }

  _onClose() {
    this.closed = true;
    this.closeReason = 'CDP WebSocket 已关闭（浏览器进程可能已退出）';
    for (const [, { reject, timer, method }] of this.pending) {
      clearTimeout(timer);
      reject(new CdpError(`${this.closeReason}，未完成的 ${method} 已取消`));
    }
    this.pending.clear();
  }

  send(method, params = {}, sessionId, { timeout = this.timeout } = {}) {
    if (this.closed) return Promise.reject(new CdpError(`${this.closeReason}，无法发送 ${method}`));
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CdpError(`CDP 调用超时（${timeout}ms）: ${method}`,
          method === 'Page.navigate' ? '页面可能加载不完整（图片/字体过大或 file:// 路径不存在）。' : ''));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.ws.send(JSON.stringify(payload)); }
      catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new CdpError(`发送 CDP ${method} 失败: ${err.message}`));
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
    return () => { const s = this.listeners.get(method); if (s) s.delete(fn); };
  }

  close() {
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

function hintForCdpError(method, error) {
  const m = String(error?.message || '');
  if (/Session with given id not found|No target with given id/i.test(m)) return '页面/会话已关闭（可能崩溃或导航到别处），重试该组合。';
  if (/Cannot navigate to invalid URL/i.test(m)) return 'URL 不合法：file:// 需写成 file:///D:/path/index.html（三个斜杠，正斜杠）。';
  if (/net::ERR_FILE_NOT_FOUND/i.test(m)) return 'file:// 指向的文件不存在，检查 baseUrl 路径。';
  if (/net::ERR_ABORTED/i.test(m)) return '导航被中断（同时触发两次导航或页面自行跳转），检查页面脚本。';
  if (method.startsWith('Runtime.')) return '页面脚本抛错；先用 evaluate 检查选择器/函数是否存在。';
  return '';
}

/* ------------------------------------------------------------------ */
/* Browser / Page                                                     */
/* ------------------------------------------------------------------ */

const liveBrowsers = new Set();
let cleanupHooked = false;

function hookProcessCleanup() {
  if (cleanupHooked) return;
  cleanupHooked = true;
  const syncKill = (b) => { try { if (b.proc && b.proc.exitCode === null) b.proc.kill('SIGKILL'); } catch { /* ignore */ } };
  process.once('exit', () => { for (const b of liveBrowsers) syncKill(b); });
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(sig, () => {
      Promise.allSettled([...liveBrowsers].map((b) => b.close())).finally(() => process.exit(sig === 'SIGINT' ? 130 : 143));
    });
  }
  process.once('uncaughtException', (err) => {
    console.error(`[cdp] 未捕获异常: ${err?.stack || err}`);
    Promise.allSettled([...liveBrowsers].map((b) => b.close())).finally(() => process.exit(1));
  });
}

export class Browser {
  constructor(opts = {}) {
    this.opts = opts;
    this.proc = null;
    this.conn = null;
    this.port = 0;
    this.wsUrl = '';
    this.browserPath = '';
    this.browserName = '';
    this.userDataDir = '';
    this.stderrLog = [];
    this.pages = new Set();
    this.closed = false;
  }

  async launch() {
    const found = findBrowser({ browser: this.opts.browser });
    this.browserPath = found.path;
    this.browserName = found.name;
    this.userDataDir = path.join(os.tmpdir(), `dsh-cdp-${process.pid}-${randomUUID().slice(0, 8)}`);
    await fsp.mkdir(this.userDataDir, { recursive: true });

    const args = [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-component-update',
      '--mute-audio',
      '--metrics-recording-only',
      '--allow-file-access-from-files',
      '--force-color-profile=srgb',
      '--window-size=1440,900',
      'about:blank',
      ...(this.opts.extraArgs || []),
    ];
    if (this.opts.headless === false) args.splice(args.indexOf('--headless=new'), 1);

    const timeoutMs = this.opts.timeoutMs || DEFAULT_TIMEOUT;
    const { wsUrl } = await this._spawnAndWait(args, timeoutMs);

    this.wsUrl = wsUrl;
    this.port = Number(new URL(wsUrl).port || 0);
    this.conn = new Connection(wsUrl, { timeout: this.opts.timeoutMs || DEFAULT_TIMEOUT });
    await this.conn.open();
    liveBrowsers.add(this);
    hookProcessCleanup();
    return this;
  }

  /**
   * 启动浏览器进程并等到 CDP ws 端点。
   * stderr 捕获优先用管道；某些受限环境（Windows 沙箱 / AppContainer）禁止创建命名管道，
   * spawn 会 EPERM —— 此时自动降级为「stderr 重定向到日志文件 + 轮询读取」，
   * 仍然实现「从 stderr 的 DevTools listening on ws://… 取端口」的语义。
   * 双保险：同时轮询 <user-data-dir>/DevToolsActivePort。
   */
  async _spawnAndWait(args, timeoutMs) {
    let pipeErr = null;
    try {
      const spawnPiped = () => {
        const proc = spawn(this.browserPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        const getText = () => this.stderrLog.join('\n');
        lineSplitter(proc.stdout, (line) => this._pushLog(line));
        lineSplitter(proc.stderr, (line) => this._pushLog(line));
        proc.on('error', (err) => this._pushLog(`spawn error: ${err.code || ''} ${err.message}`));
        return { proc, getText };
      };
      const spawned = spawnPiped();
      this.proc = spawned.proc;
      return { wsUrl: await this._waitForEndpoint(spawned, timeoutMs) };
    } catch (err) {
      if (!isStdioPipeDenied(err)) throw err;
      pipeErr = err;
      this._pushLog(`[cdp] stdio 管道不可用 (${err.code || err.message})，改用日志文件捕获浏览器 stderr`);
      try { this.proc?.kill?.(); } catch { /* ignore */ }
    }

    // 降级路径：stdout/stderr 都重定向到同一个日志文件
    const logPath = path.join(os.tmpdir(), `dsh-cdp-${process.pid}-${randomUUID().slice(0, 8)}.log`);
    const fd = fs.openSync(logPath, 'w');
    let proc;
    try {
      proc = spawn(this.browserPath, args, { stdio: ['ignore', fd, fd], windowsHide: true });
    } catch (err) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
      throw new CdpError(`无法启动浏览器 ${this.browserPath}: ${err.code || ''} ${err.message}`,
        `当前环境可能禁止启动该程序。先在普通终端手动执行一次：\n  "${this.browserPath}" --version\n` +
        '若手动可运行而这里失败，说明是 DSH 沙箱限制（不是脚本 bug）。');
    }
    try { fs.closeSync(fd); } catch { /* ignore */ }
    this.proc = proc;
    this._logPath = logPath;
    proc.on('error', (err) => this._pushLog(`spawn error: ${err.code || ''} ${err.message}`));
    const getText = () => { try { return fs.readFileSync(logPath, 'utf8'); } catch { return ''; } };
    return { wsUrl: await this._waitForEndpoint({ proc, getText }, timeoutMs) };
  }

  _pushLog(line) {
    if (line === undefined || line === null) return;
    this.stderrLog.push(String(line));
    if (this.stderrLog.length > 400) this.stderrLog.splice(0, this.stderrLog.length - 400);
  }

  _waitForEndpoint({ proc, getText }, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let lastText = '';
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearInterval(iv);
        clearTimeout(timer);
        fn(value);
      };
      const fail = (reason, detail) => {
        const tail = (getText() || '').trim().split(/\r?\n/).slice(-15).join('\n') || '(浏览器没有输出任何内容)';
        const sandboxed = /crashpad|OpenProcess|self-terminating|0x5\b|拒绝访问/i.test(tail);
        finish(reject, new CdpError(
          `浏览器启动失败：${reason}`,
          sandboxed
            ? '浏览器被当前进程沙箱拦截（crashpad 无法 OpenProcess，Chromium 会自行退出）。\n' +
              '这不是脚本问题。解决办法任选其一：\n' +
              '  1) 在普通终端 / CI（不受 DSH 文件沙箱限制）里运行本脚本；\n' +
              '  2) 自己先启动 Chrome：chrome.exe --remote-debugging-port=9222 --headless=new ...，再用 --cdp-url http://127.0.0.1:9222 连上去；\n' +
              '  3) pixel-diff 支持 --engine node（纯 Node 解码 PNG，不需要浏览器）。'
            : `浏览器 stderr 尾部：\n${tail}`,
        ));
      };
      const check = () => {
        const text = getText() || '';
        if (text !== lastText) {
          lastText = text;
          const m = text.match(/DevTools listening on (ws:\/\/\S+)/);
          if (m) return finish(resolve, m[1]);
        }
        if (proc && proc.exitCode !== null) return fail(`进程已退出 (code=${proc.exitCode}, signal=${proc.signalCode || 'null'})`);
        const active = readDevToolsActivePort(this.userDataDir);
        if (active) return finish(resolve, active);
      };
      const iv = setInterval(check, 60);
      const timer = setTimeout(() => fail(`${timeoutMs}ms 内没有打印 "DevTools listening on ws://…"`), timeoutMs);
      check();
    });
  }


  async version() {
    try { return await this.conn.send('Browser.getVersion', {}, undefined, { timeout: 5000 }); }
    catch { return null; }
  }

  async newPage() {
    if (this.closed) throw new CdpError('浏览器已关闭，不能新建页面');
    const { targetId } = await this.conn.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.conn.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, targetId, sessionId);
    await page.init();
    return page;
  }

  /** 方便写法：起页面 -> 回调 -> 一定关页面 */
  async withPage(fn) {
    const page = await this.newPage();
    try { return await fn(page); } finally { await page.close().catch(() => {}); }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const p of [...this.pages]) await p.close().catch(() => {});
    this.pages.clear();
    // 附着模式（连别人的浏览器）绝不能 Browser.close，否则会关掉用户的浏览器
    if (!this.attached) {
      try { await this.conn?.send('Browser.close', {}, undefined, { timeout: 3000 }); }
      catch { try { this.proc?.kill(); } catch { /* ignore */ } }
    }
    try { this.conn?.close(); } catch { /* ignore */ }
    if (this.proc) {
      const exited = await waitExit(this.proc, 5000);
      if (!exited) { try { this.proc.kill('SIGKILL'); } catch { /* ignore */ } await waitExit(this.proc, 2000); }
    }
    liveBrowsers.delete(this);
    if (!this.opts.keepProfile) await rmrfRetry(this.userDataDir);
    if (this._logPath) { try { fs.unlinkSync(this._logPath); } catch { /* ignore */ } }
  }
}

/** 附着到已经运行的 Chromium（需用 --remote-debugging-port 启动过） */
export async function attachBrowser(wsUrl, { timeoutMs = DEFAULT_TIMEOUT } = {}) {
  if (!/^wss?:\/\//.test(wsUrl)) throw new UsageError(`--cdp-url 需要 ws:// 或 wss:// 地址，收到 "${wsUrl}"`);
  const b = new Browser({ timeoutMs });
  b.attached = true;
  b.wsUrl = wsUrl;
  b.port = Number(new URL(wsUrl).port || 0);
  b.browserName = 'attached';
  b.conn = new Connection(wsUrl, { timeout: timeoutMs });
  await b.conn.open();
  liveBrowsers.add(b);
  hookProcessCleanup();
  return b;
}

/** 用 http://host:port 形式给出调试地址时，先取 /json/version 里的 ws 地址 */
export async function resolveCdpUrl(input, { timeoutMs = DEFAULT_TIMEOUT } = {}) {
  if (/^wss?:\/\//.test(input)) return input;
  if (!/^https?:\/\//.test(input)) throw new UsageError(`--cdp-url 需要 http(s):// 或 ws(s):// 地址，收到 "${input}"`);
  const url = new URL('/json/version', input).toString();
  const body = await new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => req.destroy(new CdpError(`请求超时: ${url}`, '浏览器是否已用 --remote-debugging-port 启动？')));
    req.on('error', (err) => reject(new CdpError(`无法连接 ${url}: ${err.message}`,
      '先在普通终端启动：chrome.exe --remote-debugging-port=9222 --headless=new --user-data-dir=%TEMP%\\cdp-profile')));
  });
  let json;
  try { json = JSON.parse(body); } catch { throw new CdpError(`${url} 返回的不是 JSON`, '确认给的是 Chromium 的调试端口（不是网页端口）。'); }
  if (!json.webSocketDebuggerUrl) throw new CdpError(`${url} 里没有 webSocketDebuggerUrl`, '确认 --remote-debugging-port 已生效，且未被别的程序占用。');
  return json.webSocketDebuggerUrl;
}

/** 受限环境判断：不能建 stdio 命名管道时降级为日志文件 */
function isStdioPipeDenied(err) {
  const code = String(err?.code || '');
  return ['EPERM', 'EACCES', 'ENOTSUP', 'EMFILE', 'ENFILE'].includes(code);
}

/** 读 Chrome 写在 user-data-dir 里的 DevToolsActivePort（端口 + 浏览器 ws 路径） */
function readDevToolsActivePort(userDataDir) {
  if (!userDataDir) return null;
  try {
    const txt = fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8');
    const [port, wsPath] = txt.split(/\r?\n/);
    if (!port || !wsPath) return null;
    const p = Number(port);
    if (!Number.isInteger(p) || p <= 0) return null;
    return `ws://127.0.0.1:${p}${wsPath.startsWith('/') ? '' : '/'}${wsPath}`;
  } catch { return null; }
}

class Page {
  constructor(browser, targetId, sessionId) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.closed = false;
    this.timeout = browser.opts.timeoutMs || DEFAULT_TIMEOUT;
    this._network = { inflight: 0, lastActivity: Date.now(), enabled: false };
    browser.pages.add(this);
  }

  _send(method, params = {}, opts = {}) {
    return this.browser.conn.send(method, params, this.sessionId, { timeout: opts.timeout ?? this.timeout });
  }

  on(method, fn) { return this.browser.conn.on(method, (params, sessionId) => { if (sessionId === this.sessionId) fn(params); }); }

  /** 启用领域 + 记录网络活动（给 networkIdle 用）；幂等 */
  async init() {
    if (this._inited) return this;
    this._inited = true;
    await this._send('Page.enable');
    await this._send('Runtime.enable');
    await this._send('Network.enable');
    this._network.enabled = true;
    this.on('Network.requestWillBeSent', () => { this._network.inflight++; this._network.lastActivity = Date.now(); });
    this.on('Network.loadingFinished', () => { this._network.inflight = Math.max(0, this._network.inflight - 1); this._network.lastActivity = Date.now(); });
    this.on('Network.loadingFailed', () => { this._network.inflight = Math.max(0, this._network.inflight - 1); this._network.lastActivity = Date.now(); });
    this.on('Page.domContentEventFired', () => this._resolveWaiters('domcontentloaded'));
    this.on('Page.loadEventFired', () => { this._resolveWaiters('domcontentloaded'); this._resolveWaiters('load'); });
    this._waiters = new Set();
    return this;
  }

  _resolveWaiters(stage) {
    const set = this._waiters;
    if (!set) return;
    for (const w of [...set]) {
      if (w.waitUntil === stage) { set.delete(w); w.finish(); }
    }
  }

  async goto(url, { waitUntil = 'load', timeout = this.timeout } = {}) {
    const allowed = ['commit', 'domcontentloaded', 'load', 'networkIdle'];
    if (!allowed.includes(waitUntil)) throw new UsageError(`waitUntil 只支持 ${allowed.join(' / ')}，收到 "${waitUntil}"`);
    await this.init();
    const waiter = this._lifecycleWaiter(waitUntil, timeout);
    const res = await this._send('Page.navigate', { url }, { timeout });
    if (res.errorText) {
      waiter.cancel();
      throw new CdpError(`导航失败 ${url}: ${res.errorText}`, hintForCdpError('Page.navigate', { message: res.errorText }));
    }
    await waiter.promise;
    return res;
  }

  _lifecycleWaiter(waitUntil, timeout) {
    let done = false;
    let timer = null;
    let resolveP, rejectP;
    const promise = new Promise((res, rej) => { resolveP = res; rejectP = rej; });
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (this._waiters) this._waiters.delete(waiter);
      resolveP();
    };
    const fail = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (this._waiters) this._waiters.delete(waiter);
      rejectP(err);
    };
    const waiter = { waitUntil, finish };
    timer = setTimeout(() => fail(new CdpError(`等待页面 ${waitUntil} 超时（${timeout}ms）`,
      '页面可能有一直未结束的请求；把 waitUntil 改成 "domcontentloaded" 或 "commit"。')), timeout);
    if (waitUntil === 'commit') { setImmediate(finish); return { promise, cancel: finish }; }

    this._waiters = this._waiters || new Set();
    this._waiters.add(waiter);

    if (waitUntil === 'networkIdle') {
      // 网络静默判断：inflight 归零且 600ms 无新活动
      const iv = setInterval(() => {
        if (this._network.inflight === 0 && Date.now() - this._network.lastActivity >= 600) finish();
      }, 100);
      promise.catch(() => {}).finally(() => clearInterval(iv));
    }
    return { promise, cancel: finish };
  }

  async evaluate(expr, { timeout = this.timeout, awaitPromise = true } = {}) {
    const res = await this._send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise, userGesture: true, includeCommandLineAPI: true,
    }, { timeout });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      const msg = d.exception?.description || d.text || '未知脚本错误';
      throw new CdpError(`页面内 evaluate 抛错: ${msg.split('\n')[0]}`,
        '检查表达式本身、以及页面是否已加载到目标状态。');
    }
    return unwrapRemote(res.result);
  }

  /** evaluateFn((a,b)=>..., a, b) —— 函数在页面里执行，参数 JSON 传入 */
  async evaluateFn(fn, ...args) {
    const src = `(${fn.toString()})(...${JSON.stringify(args)})`;
    return this.evaluate(src);
  }

  async waitForSelector(selector, { timeout = this.timeout, visible = false } = {}) {
    const start = Date.now();
    const expr = visible
      ? `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; })()`
      : `!!document.querySelector(${JSON.stringify(selector)})`;
    while (Date.now() - start < timeout) {
      if (await this.evaluate(expr)) return true;
      await sleep(50);
    }
    throw new CdpError(`等待选择器超时: ${selector}`,
      '确认选择器拼写与页面 DOM 一致（可用 --dump-html 看页面结构）；或给该 state 加 wait。');
  }

  async addInitScript(source) {
    await this._send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async addStyleTag(css) {
    await this.evaluateFn((text) => {
      let el = document.getElementById('dsh-injected-style');
      if (!el) { el = document.createElement('style'); el.id = 'dsh-injected-style'; document.head.appendChild(el); }
      el.textContent = text;
      return true;
    }, css);
  }

  async setDeviceMetrics({ width, height, deviceScaleFactor = 1, mobile = false } = {}) {
    if (!width || !height) throw new UsageError('setDeviceMetrics 需要 width 和 height');
    await this._send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor, mobile,
      screenWidth: width, screenHeight: height,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    });
  }

  async setEmulatedMedia({ prefersColorScheme, prefersReducedMotion } = {}) {
    const features = [];
    if (prefersColorScheme) features.push({ name: 'prefers-color-scheme', value: prefersColorScheme });
    if (prefersReducedMotion) features.push({ name: 'prefers-reduced-motion', value: prefersReducedMotion });
    await this._send('Emulation.setEmulatedMedia', { media: 'screen', features });
  }

  async getLayoutMetrics() {
    return this._send('Page.getLayoutMetrics');
  }

  async screenshot(opts = {}) {
    const { fullPage = false, clip = null, width, height, deviceScaleFactor, format = 'png' } = opts;
    if (width && height) await this.setDeviceMetrics({ width, height, deviceScaleFactor: deviceScaleFactor || 1 });
    const params = { format, fromSurface: true, captureBeyondViewport: false };
    if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: clip.scale || 1 };
    else if (fullPage) {
      const m = await this.getLayoutMetrics();
      const cs = m.cssContentSize || m.contentSize;
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: Math.max(1, Math.ceil(cs.width)), height: Math.max(1, Math.ceil(cs.height)), scale: 1 };
    }
    const res = await this._send('Page.captureScreenshot', params, { timeout: Math.max(this.timeout, 60_000) });
    const buffer = Buffer.from(res.data, 'base64');
    const size = pngSize(buffer);
    return { buffer, width: size.width, height: size.height, format };
  }

  async click(selector, { timeout = this.timeout } = {}) {
    await this.waitForSelector(selector, { timeout, visible: true });
    await this.evaluateFn((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('element not found: ' + sel);
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      el.click();
      return true;
    }, selector);
  }

  async fill(selector, value, { timeout = this.timeout } = {}) {
    await this.waitForSelector(selector, { timeout, visible: true });
    await this.evaluateFn((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('element not found: ' + sel);
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, val); else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, selector, value);
  }

  async hover(selector) {
    await this.waitForSelector(selector, { visible: true });
    const box = await this.evaluateFn((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, selector);
    if (!box) throw new CdpError(`hover 目标不存在: ${selector}`);
    await this._send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, button: 'none', buttons: 0 });
    await sleep(80);
  }

  async scrollTo({ y = 0, x = 0, selector = null } = {}) {
    if (selector) {
      await this.evaluateFn((sel) => { document.querySelector(sel)?.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; }, selector);
    } else {
      await this.evaluateFn((sx, sy) => { window.scrollTo({ left: sx, top: sy, behavior: 'instant' }); return true; }, x, y);
    }
    await sleep(50);
  }

  async waitForTimeout(ms) { await sleep(Math.max(0, ms)); }

  async close() {
    if (this.closed) return;
    this.closed = true;
    try { await this.browser.conn.send('Target.closeTarget', { targetId: this.targetId }, undefined, { timeout: 3000 }); }
    catch { /* ignore */ }
    try { await this.browser.conn.send('Target.detachFromTarget', { sessionId: this.sessionId }, undefined, { timeout: 2000 }); }
    catch { /* ignore */ }
    this.browser.pages.delete(this);
  }
}

function unwrapRemote(result) {
  if (!result) return undefined;
  if (result.type === 'undefined') return undefined;
  if (Object.prototype.hasOwnProperty.call(result, 'value')) return result.value;
  if (result.unserializableValue) return result.unserializableValue;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 小工具                                                             */
/* ------------------------------------------------------------------ */

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function lineSplitter(stream, onLine) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, idx).replace(/\r$/, '')); buf = buf.slice(idx + 1); }
    if (buf.length > 8192) { onLine(buf); buf = ''; }
  });
  stream.on('end', () => { if (buf) onLine(buf); });
}

function waitExit(proc, ms) {
  if (!proc || proc.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    proc.once('exit', () => { clearTimeout(t); resolve(true); });
  });
}

async function rmrfRetry(dir, attempts = 6) {
  if (!dir) return true;
  for (let i = 0; i < attempts; i++) {
    try { await fsp.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); return true; }
    catch { await sleep(150 * (i + 1)); }
  }
  return false; // Windows 上偶发被占用：留给系统清理 tmp，不算失败
}

export function sha256Buf(buf) { return createHash('sha256').update(buf).digest('hex'); }

export async function sha256File(file) {
  const h = createHash('sha256');
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, null);
      if (!bytesRead) break;
      h.update(buf.subarray(0, bytesRead));
    }
  } finally { await fh.close(); }
  return h.digest('hex');
}

export function pngSize(buffer) {
  if (!buffer || buffer.length < 24) return { width: 0, height: 0 };
  const sig = buffer.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return { width: 0, height: 0 };
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function nowIso() { return new Date().toISOString(); }

/** 按顶层分隔符切分（忽略括号/引号内部的逗号或分号）—— CSS 值/token 解析共用 */
export function splitTopLevel(text, seps = ',') {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && seps.includes(ch)) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

export function humanBytes(n) {
  if (!Number.isFinite(n)) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit',
  'coverage', '.cache', '.turbo', '.parcel-cache', 'vendor', '.idea', '.vscode', '__pycache__',
]);

/**
 * 递归收集文件（按相对路径排序，POSIX 分隔符，保证确定性）。
 * @returns {Promise<Array<{abs:string, rel:string, size:number}>>}
 */
export async function walkFiles(root, { exts = null, ignoreDirs = DEFAULT_IGNORE_DIRS, ignoreNames = [] } = {}) {
  const out = [];
  const stat = await fsp.stat(root).catch(() => null);
  if (!stat) return out;
  if (stat.isFile()) return [{ abs: root, rel: path.basename(root), size: stat.size }];
  const ignoreNameSet = new Set(ignoreNames);
  async function visit(dir) {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.isDirectory()) {
        if (ignoreDirs.has(e.name)) continue;
        await visit(path.join(dir, e.name));
      } else if (e.isFile()) {
        if (ignoreNameSet.has(e.name)) continue;
        const abs = path.join(dir, e.name);
        if (exts && !exts.has(path.extname(e.name).toLowerCase())) continue;
        const st = await fsp.stat(abs).catch(() => null);
        if (!st) continue;
        out.push({ abs, rel: path.relative(root, abs).split(path.sep).join('/'), size: st.size });
      }
    }
  }
  await visit(root);
  out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return out;
}

/* --------------------------- 颜色工具 ------------------------------ */

const NAMED_COLORS = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255],
  transparent: [0, 0, 0, 0], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
};

/**
 * 解析颜色字面量 -> {r,g,b,a,hex,h,s,l}；无法解析返回 null。
 * 支持 #rgb/#rgba/#rrggbb/#rrggbbaa、rgb()/rgba()、hsl()/hsla()。
 */
export function parseColor(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, s)) {
    const [r, g, b, a = 1] = NAMED_COLORS[s];
    return colorRecord(r, g, b, a);
  }
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16), g = parseInt(h[1] + h[1], 16), b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return colorRecord(r, g, b, a);
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return colorRecord(r, g, b, a);
    }
    return null;
  }
  m = s.match(/^rgba?\((.*)\)$/);
  if (m) {
    const parts = splitArgs(m[1]);
    if (parts.length < 3) return null;
    const r = parseChannel(parts[0], 255), g = parseChannel(parts[1], 255), b = parseChannel(parts[2], 255);
    if (r === null || g === null || b === null) return null;
    const a = parts[3] === undefined ? 1 : clamp01(parseAlpha(parts[3]));
    return colorRecord(r, g, b, a);
  }
  m = s.match(/^hsla?\((.*)\)$/);
  if (m) {
    const parts = splitArgs(m[1]);
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]) || 0;
    const sat = clamp01(parseFloat(parts[1]) / 100);
    const lig = clamp01(parseFloat(parts[2]) / 100);
    const a = parts[3] === undefined ? 1 : clamp01(parseAlpha(parts[3]));
    const [r, g, b] = hslToRgb(h, sat, lig);
    return colorRecord(r, g, b, a);
  }
  return null;
}

function splitArgs(inner) {
  // 兼容 CSS Color 4 的空格语法：rgb(255 255 255 / .08)、hsl(220 10% 50% / .5)
  const s = inner.trim();
  if (s.includes(',')) return s.split(',').map((p) => p.trim()).filter((p) => p !== '');
  const slash = s.indexOf('/');
  const main = (slash === -1 ? s : s.slice(0, slash)).trim();
  const alpha = slash === -1 ? null : s.slice(slash + 1).trim();
  const parts = main.split(/\s+/).filter((p) => p !== '');
  if (alpha !== null && alpha !== '') parts.push(alpha);
  return parts;
}
function parseChannel(tok, scale) {
  if (tok.endsWith('%')) { const n = parseFloat(tok); return Number.isFinite(n) ? Math.round((n / 100) * scale) : null; }
  const n = parseFloat(tok);
  return Number.isFinite(n) ? clamp255(n) : null;
}
function parseAlpha(tok) {
  if (tok.endsWith('%')) return parseFloat(tok) / 100;
  const n = parseFloat(tok);
  return Number.isFinite(n) ? n : 1;
}
const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function colorRecord(r, g, b, a) {
  const hex = toHex({ r, g, b, a });
  const { h, s, l } = rgbToHsl(r, g, b);
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: Number(clamp01(a).toFixed(4)), hex, h, s, l };
}

export function toHex({ r, g, b, a = 1 }) {
  const hh = (n) => clamp255(n).toString(16).padStart(2, '0');
  const base = `#${hh(r)}${hh(g)}${hh(b)}`;
  return a !== undefined && a < 1 ? `${base}${hh(Math.round(clamp01(a) * 255))}` : base;
}

export function rgbToHsl(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d > 1e-9) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0));
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h: Number(h.toFixed(2)), s: Number(s.toFixed(4)), l: Number(l.toFixed(4)) };
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    let tt = t; if (tt < 0) tt += 1; if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [Math.round(hue2rgb(hh + 1 / 3) * 255), Math.round(hue2rgb(hh) * 255), Math.round(hue2rgb(hh - 1 / 3) * 255)];
}

export function hueOf(color) { return color && Number.isFinite(color.h) ? color.h : -1; }

export const COLOR_LITERAL_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?)\(\s*[^()]*\)/g;

/** 在一段文本里找所有颜色字面量（带偏移，便于报列号） */
export function findColorLiterals(text) {
  const out = [];
  if (!text) return out;
  const re = new RegExp(COLOR_LITERAL_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const color = parseColor(m[0]);
    if (color) out.push({ raw: m[0], index: m.index, end: m.index + m[0].length, color });
  }
  return out;
}

/**
 * 判断某个颜色字面量是否处于「声明值」位置（而不是 CSS 选择器如 #abc{ }）。
 * 说明：这是启发式判断，极端写法（跨行选择器）可能误判，见 README 已知限制。
 */
export function inDeclarationValue(line, start, end) {
  const before = line.slice(0, start);
  const after = line.slice(end);
  const beforeHasColon = before.includes(':');
  // 选择器尾部特征：, { : > ~ + . [ 之类；值位置后面跟的通常是 ; } ) 或换行
  const selectorTail = /^\s*(?:[,{>~+.[:]|$)/.test(after);
  if (selectorTail && !beforeHasColon) return false;
  // 行首/块首的裸 #abc {  /  #abc:hover
  if (/^[\s}]*$/.test(before) && /^\s*[{,:>~+.[]/.test(after)) return false;
  return true;
}

/* --------------------------- CLI 工具 ------------------------------ */

/**
 * 统一 CLI 解析：支持 --k v / --k=v / 短别名 / --help；
 * 未知选项或缺失值抛 UsageError（exit 2）。
 */
export function parseCli(argv, { options = {}, minPositional = 0, maxPositional = Infinity } = {}) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true, opts: {}, positionals: [] };
  const opts = {};
  for (const [flag, def] of Object.entries(options)) if ('default' in def) opts[def.key] = def.default;
  const byShort = new Map();
  for (const [flag, def] of Object.entries(options)) if (def.alias) byShort.set(def.alias, flag);
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positionals.push(...argv.slice(i + 1)); break; }
    let name = a, inlineVal = null;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { name = a.slice(0, eq); inlineVal = a.slice(eq + 1); }
    } else if (a.startsWith('-') && a.length === 2 && byShort.has(a)) {
      name = byShort.get(a);
    } else if (a.startsWith('-') && a.length > 1 && a !== '-') {
      throw new UsageError(`未知选项 ${a}`, '用 --help 查看支持的选项。');
    } else { positionals.push(a); continue; }

    const def = options[name];
    if (!def) throw new UsageError(`未知选项 ${name}`, '用 --help 查看支持的选项。');
    let val = inlineVal;
    if (def.type === 'boolean') { opts[def.key] = val === null ? true : !/^(false|0|no|off)$/i.test(val); continue; }
    if (val === null) {
      i += 1;
      val = argv[i];
      if (val === undefined) throw new UsageError(`选项 ${name} 需要一个值`, '用 --help 查看用法。');
    }
    if (def.type === 'number') {
      const n = Number(val);
      if (!Number.isFinite(n)) throw new UsageError(`选项 ${name} 需要数字，收到 "${val}"`, '用 --help 查看用法。');
      opts[def.key] = n;
    } else opts[def.key] = val;
  }
  if (positionals.length < minPositional) throw new UsageError(`缺少参数：需要至少 ${minPositional} 个位置参数，收到 ${positionals.length} 个`, '用 --help 查看用法。');
  if (positionals.length > maxPositional) throw new UsageError(`参数过多：最多 ${maxPositional} 个，收到 ${positionals.length} 个 -> ${positionals.slice(maxPositional).join(' ')}`, '用 --help 查看用法。');
  return { help: false, opts, positionals };
}

export async function readJson(file) {
  const txt = await fsp.readFile(file, 'utf8');
  return JSON.parse(txt.replace(/^\uFEFF/, ''));
}

export async function writeJson(file, obj) {
  await fsp.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return path.resolve(file);
}

/** 统一的致命错误出口：打印可执行信息 + 退出码 */
export function die(err) {
  const isUsage = err instanceof UsageError;
  const msg = err?.message || String(err);
  console.error(`\n✖ ${isUsage ? '用法错误' : '失败'}: ${msg}`);
  if (err?.hint) console.error(`\n如何修: ${err.hint}`);
  if (isUsage) console.error('\n--help 查看完整用法。');
  if (process.env.DSH_DEBUG && err?.stack) console.error(err.stack);
  process.exit(isUsage ? 2 : (err?.exitCode || 1));
}

/* --------------------------- 直接运行自检 --------------------------- */

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try { return import.meta.url === pathToFileURL(path.resolve(entry)).href; } catch { return false; }
})();

if (isDirectRun) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`lib/cdp.mjs — 共享 CDP 库（零第三方依赖）

用法:
  node lib/cdp.mjs                      探测浏览器 + 用真实页面自检截图
  node lib/cdp.mjs --browser edge       指定浏览器（chrome/edge/绝对路径）

自检内容: 启动 headless -> 打开 data: 页面 -> evaluate -> 截图 -> 校验 PNG -> 关闭并清理临时目录。

导出 API 见文件顶部注释；其他脚本 import 使用，不单独运行。`);
    process.exit(0);
  }
  const t0 = Date.now();
  let browser;
  try {
    const found = findBrowser({ browser: argv.includes('--browser') ? argv[argv.indexOf('--browser') + 1] : undefined });
    console.log(`浏览器: ${found.name} -> ${found.path}`);
    browser = await launchBrowser({ browser: argv.includes('--browser') ? argv[argv.indexOf('--browser') + 1] : undefined });
    console.log(`CDP 端口: ${browser.port}`);
    const ver = await browser.version();
    console.log(`版本: ${ver?.product || '?'} (${ver?.jsVersion || '?'})`);
    const page = await browser.newPage();
    await page.setDeviceMetrics({ width: 640, height: 360, deviceScaleFactor: 2 });
    await page.goto('data:text/html,' + encodeURIComponent('<body style="margin:0;background:#0b0c10;color:#66fcf1;font:700 32px system-ui;display:grid;place-items:center;height:100vh">CDP OK</body>'));
    const text = await page.evaluate('document.body.textContent.trim()');
    const shot = await page.screenshot({ fullPage: false });
    console.log(`evaluate: ${text}`);
    console.log(`截图: ${shot.width}x${shot.height}, ${humanBytes(shot.buffer.length)}, png=${pngSize(shot.buffer).width > 0}`);
    if (text !== 'CDP OK' || shot.buffer.length < 1000) throw new Error('自检断言失败');
    await page.close();
    console.log(`自检通过 (${Date.now() - t0}ms)`);
    process.exitCode = 0;
  } catch (err) {
    console.error(`\n✖ 自检失败: ${err?.message || err}`);
    if (err?.hint) console.error(`如何修: ${err.hint}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** 便捷入口 */
export async function launchBrowser(opts = {}) {
  const b = new Browser(opts);
  await b.launch();
  return b;
}
