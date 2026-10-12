// MARNYS · Beauty In & Out — deterministic renderer
//   node render.js [workers=4] [fps=50] [sub=4]     env: LANG_=ku|ar  OUT=renders/picture_ku.mp4  WORK_DIR=<frame caches>  CHROME=<browser path>
// Seeks window.__seek(t) for every sample, captures JPEG via CDP, and lets ffmpeg average `sub` samples across a
// 180° shutter (real motion blur on the graphics; the 25 fps footage is held for exactly 2 frames at 50 fps).
const puppeteer = require('puppeteer-core');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WORK = process.env.WORK_DIR || path.join(ROOT, 'work');
const BROWSER = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const LANG = process.env.LANG_ || 'ku';
const OUT = process.env.OUT || path.join(ROOT, 'renders', `picture_${LANG}.mp4`);
const SEG = path.join(WORK, `seg_${LANG}`);
const MIME = { '.json': 'application/json', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const [WORKERS = 4, FPS = 50, SUB = 4] = process.argv.slice(2).map(Number);

async function openPage(tag) {
  const browser = await puppeteer.launch({
    executablePath: BROWSER, headless: 'new',
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [])],
    defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = new URL(req.url());
    if (u.hostname !== 'film.local') return req.abort();
    const p = decodeURIComponent(u.pathname);
    const f = p.startsWith('/work/') ? path.join(WORK, p.slice(6)) : path.join(ROOT, p);
    if (!fs.existsSync(f)) { console.error(`[${tag}] missing`, p); return req.respond({ status: 404, body: '' }); }
    req.respond({ status: 200, contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  page.on('pageerror', e => console.error(`[${tag}] pageerror`, e.message));
  await page.goto(`http://film.local/index.html?lang=${LANG}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 120000 });
  const cdp = await page.createCDPSession();
  const grab = async t => {
    await page.evaluate(async t => { await window.__seek(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 97, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 }, optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  };
  const dur = await page.evaluate('window.__dur');
  return { browser, grab, dur };
}

async function worker(k, a, b) {
  const { browser, grab } = await openPage('w' + k);
  const out = path.join(SEG, `s${k}.mp4`);
  // keep the captures' full range in the intermediate (finish.sh converts pc → tv once); newer ffmpeg would squeeze it here
  const vf = (SUB > 1 ? `tmix=frames=${SUB}:weights=${Array(SUB).fill(1).join(' ')},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB` : 'null') + ',scale=out_range=pc,format=yuv444p';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-pix_fmt', 'yuv444p', '-color_range', 'pc', '-r', String(FPS), out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const t0 = Date.now();
  for (let i = a; i < b; i++) {
    for (let j = 0; j < SUB; j++) {
      const buf = await grab(i / FPS + j * (0.5 / FPS) / SUB);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    if ((i - a) % 50 === 0) console.log(`[w${k}] ${i - a}/${b - a} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close();
  return out;
}

(async () => {
  fs.mkdirSync(SEG, { recursive: true }); fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const probe = await openPage('probe'); const DUR = probe.dur; await probe.browser.close();
  const total = Math.round(DUR * FPS), per = Math.ceil(total / WORKERS);
  console.log(`render ${LANG}: ${total} frames @ ${FPS} fps × ${SUB} samples, ${WORKERS} workers`);
  const started = Date.now();
  const segs = await Promise.all([...Array(WORKERS).keys()].map(k => worker(k, k * per, Math.min(total, (k + 1) * per))));
  const list = path.join(SEG, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', OUT], { stdio: 'inherit' });
  console.log(`done ${OUT} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
})().catch(e => { console.error(e); process.exit(1); });
