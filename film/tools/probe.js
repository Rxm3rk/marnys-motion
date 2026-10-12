// Debug helper: open the composition, seek, and print computed styles / rects for selectors.
//   node tools/probe.js <t> <sel1,sel2,...>
const puppeteer = require('puppeteer-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WORK = process.env.WORK_DIR;
const BROWSER = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
(async () => {
  const [t, sels] = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', defaultViewport: { width: 1080, height: 1920 } });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => { const u = new URL(req.url()); if (u.hostname !== 'film.local') return req.abort();
    const p = decodeURIComponent(u.pathname); const f = p.startsWith('/work/') ? path.join(WORK, p.slice(6)) : path.join(ROOT, p);
    if (!fs.existsSync(f)) return req.respond({ status: 404, body: '' }); req.respond({ status: 200, body: fs.readFileSync(f) }); });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(`http://film.local/index.html${process.env.QS ? '?' + process.env.QS : ''}`);
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await page.evaluate(async t => window.__seek(t), Number(t));
  const out = await page.evaluate(sels => sels.split(',').map(s => { const e = document.querySelector(s); if (!e) return [s, 'missing'];
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return [s, { transform: cs.transform, origin: cs.transformOrigin, opacity: cs.opacity, filter: cs.filter, rect: [r.x, r.y, r.width, r.height].map(v => Math.round(v)) }]; }), sels);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
