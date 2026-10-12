const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WORK = process.env.WORK_DIR;
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', defaultViewport: { width: 1080, height: 1920 } });
  const page = await browser.newPage(); await page.setRequestInterception(true);
  page.on('request', req => { const u = new URL(req.url()); if (u.hostname !== 'film.local') return req.abort();
    const p = decodeURIComponent(u.pathname); const f = p.startsWith('/work/') ? path.join(WORK, p.slice(6)) : path.join(ROOT, p);
    if (!fs.existsSync(f)) return req.respond({ status: 404, body: '' }); req.respond({ status: 200, body: fs.readFileSync(f) }); });
  await page.goto('http://film.local/index.html'); await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const op = async t => page.evaluate(async t => { await window.__seek(t); const e = document.querySelector('#bug'); return [t, getComputedStyle(e).opacity, e.style.opacity]; }, t);
  for (const t of [0.5, 2.38, 4.9, 8.2, 13.4, 17, 13.4, 8.2, 4.9, 0.5, 3.8, 0.5]) console.log(JSON.stringify(await op(t)));
  await browser.close();
})();
