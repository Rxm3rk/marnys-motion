// Render a local HTML page to PNG stills (optionally seeking window.__seek(t) first).
//   node tools/shot.js <page.html> <outPrefix> [t1,t2,...] [W=1080] [H=1920]
// Files are served from the film folder through request interception (http://film.local/...).
// URLs under /work/ map to WORK_DIR (frame caches kept outside OneDrive).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORK = process.env.WORK_DIR || path.join(ROOT, 'work');
const BROWSER = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const MIME = { '.json': 'application/json', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

function resolveUrl(u) {
  const p = decodeURIComponent(u.pathname);
  if (p.startsWith('/work/')) return path.join(WORK, p.slice(6));
  return path.join(ROOT, p);
}

(async () => {
  const [page_, outPrefix, times_ = '0', W_ = '1080', H_ = '1920'] = process.argv.slice(2);
  const W = Number(W_), H = Number(H_);
  const browser = await puppeteer.launch({
    executablePath: BROWSER, headless: 'new',
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--allow-file-access-from-files'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = new URL(req.url());
    if (u.hostname !== 'film.local') return req.abort();
    const f = resolveUrl(u);
    if (!fs.existsSync(f)) { console.error('missing', u.pathname); return req.respond({ status: 404, body: '' }); }
    req.respond({ status: 200, contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  page.on('console', m => { if (/error|warn/i.test(m.type()) || process.env.VERBOSE) console.log('[page]', m.text().slice(0, 500)); });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(`http://film.local/${page_}${process.env.QS ? '?' + process.env.QS : ''}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (await page.evaluate(() => typeof window.__seek === 'function')) await page.waitForFunction('window.__ready === true', { timeout: 120000 });
  fs.mkdirSync(path.dirname(path.resolve(outPrefix)), { recursive: true });
  for (const t of times_.split(',').map(Number)) {
    await page.evaluate(async t => { if (window.__seek) await window.__seek(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, t);
    const f = `${outPrefix}_${t.toFixed(2)}.png`;
    await page.screenshot({ path: f, clip: { x: 0, y: 0, width: W, height: H } });
    console.log(f);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
