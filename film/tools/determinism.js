// Determinism check: capture times in two different seek orders and compare pixels.
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'); const WORK = process.env.WORK_DIR;
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text'], defaultViewport: { width: 1080, height: 1920 } });
  const page = await browser.newPage(); await page.setRequestInterception(true);
  page.on('request', req => { const u = new URL(req.url()); if (u.hostname !== 'film.local') return req.abort();
    const p = decodeURIComponent(u.pathname); const f = p.startsWith('/work/') ? path.join(WORK, p.slice(6)) : path.join(ROOT, p);
    if (!fs.existsSync(f)) return req.respond({ status: 404, body: '' }); req.respond({ status: 200, body: fs.readFileSync(f) }); });
  await page.goto('http://film.local/index.html'); await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const times = [0.5, 2.38, 4.9, 8.2, 11.9, 12.7, 13.4, 15.5, 17.0];
  const shot = async t => { await page.evaluate(async t => { await window.__seek(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, t);
    return await page.screenshot({ type: 'png' }); };
  const a = {}, b = {};
  for (const t of times) a[t] = await shot(t);
  for (const t of [...times].reverse()) { await shot(t + 3.3 > 18 ? 1 : t + 3.3); b[t] = await shot(t); }
  const out = process.env.OUTD; fs.mkdirSync(out, { recursive: true });
  for (const t of times) { fs.writeFileSync(path.join(out, `a_${t}.png`), a[t]); fs.writeFileSync(path.join(out, `b_${t}.png`), b[t]); }
  await browser.close();
})();
