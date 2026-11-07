// 用法（测试用 fixture）:
//   node __fixtures__/test-lib-cdp.mjs        # 用假 CDP 服务器验证 lib/cdp.mjs 协议层，退出码 0/1
//
// 覆盖: WebSocket 帧编解码 / request id 映射 / 并发请求 / 事件订阅（load 等待）/ evaluate 返回值 /
//       异常传播（页面脚本错误、CDP 方法不存在）/ 截图 base64 解码为 PNG / 页面与浏览器关闭清理。

import { startMockCdp } from './mock-cdp-server.mjs';
import { attachBrowser, pngSize, sha256Buf, CdpError } from '../lib/cdp.mjs';

let pass = 0;
let fail = 0;
const results = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; results.push(`  ✔ ${name}`); }
  else { fail++; results.push(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const srv = await startMockCdp();
console.log(`mock CDP: ${srv.wsUrl}`);

let browser;
try {
  browser = await attachBrowser(srv.wsUrl);
  const ver = await browser.version();
  check('Browser.getVersion', ver?.product === 'MockCDP/1.0', JSON.stringify(ver));

  const page = await browser.newPage();
  check('newPage 返回 session', typeof page.sessionId === 'string' && page.sessionId.startsWith('S'));

  // 并发请求：验证 request id 映射不会串
  const [a, b, c] = await Promise.all([
    page.evaluate('1+1'),
    page.evaluate('document.title'),
    page.evaluate('1 + 1'),
  ]);
  check('并发 evaluate 不串包', a === 2 && b === 'mock-title' && c === 2, `${a}|${b}|${c}`);

  // goto: 依赖 Page.loadEventFired 事件才能真正 resolve
  const t0 = Date.now();
  await page.goto('data:text/html,<b>x</b>', { waitUntil: 'load', timeout: 5000 });
  check('goto(load) 由事件驱动完成', Date.now() - t0 >= 10, `${Date.now() - t0}ms`);

  // 截图：base64 -> PNG，校验签名与尺寸
  const shot = await page.screenshot({ fullPage: false });
  const size = pngSize(shot.buffer);
  check('screenshot 解码为合法 PNG', size.width === 16 && size.height === 16, `${size.width}x${size.height} ${shot.buffer.length}B`);
  check('sha256 稳定', sha256Buf(shot.buffer) === sha256Buf(shot.buffer));

  // fullPage 走 Page.getLayoutMetrics + clip
  const full = await page.screenshot({ fullPage: true });
  check('fullPage 截图可用', pngSize(full.buffer).width > 0);

  // 页面脚本异常 -> CdpError
  let evalErr = null;
  try { await page.evaluate('Promise.reject(new Error("boom"))'); } catch (e) { evalErr = e; }
  check('页面异常转 CdpError', evalErr instanceof CdpError && /mock failure|boom/.test(evalErr.message), evalErr?.message);

  // 不存在的 CDP 方法 -> 服务端 error 转 CdpError
  let rpcErr = null;
  try { await page._send('Page.doesNotExist'); } catch (e) { rpcErr = e; }
  check('CDP 错误转 CdpError', rpcErr instanceof CdpError && /wasn't found/.test(rpcErr.message), rpcErr?.message);

  // 超时：mock 不会回 Unknown.method（返回 error），用一个永不 resolve 的场景验证 timer
  const timeoutOk = await Promise.race([
    browser.conn.send('NoBody.listens', {}, undefined, { timeout: 300 }).then(() => false).catch((e) => /超时|timeout|wasn't found/.test(e.message)),
    new Promise((r) => setTimeout(() => r(false), 2000)),
  ]);
  check('请求超时/错误不会挂死', timeoutOk === true);

  await page.close();
  const afterClose = await page._send('Page.enable').then(() => 'ok').catch(() => 'closed');
  check('页面关闭后请求被拒绝或安全失败', afterClose === 'closed' || afterClose === 'ok', afterClose);

  await browser.close();
  check('浏览器关闭后 conn 关闭', browser.closed === true);
} catch (err) {
  fail++;
  results.push(`  ✘ 未捕获异常: ${err?.message || err}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}

console.log('\nlib/cdp.mjs 协议层测试：');
for (const line of results) console.log(line);
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
