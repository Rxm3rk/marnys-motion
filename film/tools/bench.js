// capture-speed benchmark: node tools/bench.js gpu|cpu
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WORK = process.env.WORK_DIR;
(async () => {
  const mode = process.argv[2];
  const args = ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text'];
  if (mode === 'gpu') args.push('--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization', '--enable-zero-copy');
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args, defaultViewport: { width: 1080, height: 1920 } });
  const page = await browser.newPage(); await page.setRequestInterception(true);
  page.on('request', req => { const u = new URL(req.url()); if (u.hostname !== 'film.local') return req.abort();
    const p = decodeURIComponent(u.pathname); const f = p.startsWith('/work/') ? path.join(WORK, p.slice(6)) : path.join(ROOT, p);
    if (!fs.existsSync(f)) return req.respond({ status: 404, body: '' }); req.respond({ status: 200, body: fs.readFileSync(f) }); });
  await page.goto('http://film.local/index.html'); await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const gpu = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); if (!gl) return 'no webgl'; const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl'; });
  const cdp = await page.createCDPSession();
  const res = {};
  for (const T of [1.0, 2.4, 4.0, 8.0, 13.5, 16.5]) {
    const t0 = Date.now();
    let a = 0, b = 0, c = 0;
    for (let i = 0; i < 6; i++) {
      const t = T + i * 0.02;
      let s0 = Date.now();
      await page.evaluate(async t => { await window.__seek(t); }, t); a += Date.now() - s0; s0 = Date.now();
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); b += Date.now() - s0; s0 = Date.now();
      await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 }, optimizeForSpeed: true }); c += Date.now() - s0;
    }
    res[T] = `seek ${(a / 6).toFixed(0)} raf ${(b / 6).toFixed(0)} cap ${(c / 6).toFixed(0)}`;
  }
  console.log(mode, gpu, JSON.stringify(res));
  await browser.close();
})();
