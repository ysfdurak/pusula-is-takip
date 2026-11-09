// Tarayıcı duman testi: yayınlanacak site klasörünü yerel bir sunucuda açar,
// temel kullanıcı akışlarını Chromium ile dener. Kullanım: node tests/e2e/smoke.mjs _site
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.argv[2] || '_site');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(root)) throw new Error('outside');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) failures.push(label); };

async function page(viewport) {
  const p = await browser.newPage({ viewport });
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(String(e)));
  return p;
}

try {
  // 1) Kök tasarım demosu — masaüstü
  const d = await page({ width: 1440, height: 900 });
  await d.goto(`${base}/`);
  await d.waitForSelector('text=Bugün benim gündemim', { timeout: 10000 });
  check(true, 'Demo açılıyor ve Benim panom görünüyor');
  const title = `Duman testi ${Date.now()}`;
  await d.fill('input[placeholder^="Ne yapılacak?"]', title);
  await d.keyboard.press('Enter');
  await d.click('.sidebar nav button:has-text("İş listesi")');
  check(await d.isVisible(`text=${title}`), 'Hızlı eklenen iş İş listesi’nde görünüyor');
  await d.reload();
  await d.click('.sidebar nav button:has-text("İş listesi")');
  check(await d.isVisible(`text=${title}`), 'İş sayfa yenilendikten sonra korunuyor');
  for (const name of ['Ekip panosu', 'Ekipler', 'Bildirimler']) {
    await d.click(`.sidebar nav button:has-text("${name}")`);
    check((await d.innerText('.content')).length > 50, `${name} ekranı açılıyor`);
  }
  check(d.errors.length === 0, `Demo sayfa hatası yok ${d.errors.join(' | ')}`);

  // 2) Kök demo — telefon genişliği
  const m = await page({ width: 390, height: 844 });
  await m.goto(`${base}/`);
  await m.waitForSelector('text=Bugün benim gündemim');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, 'Telefonda yatay taşma yok');
  check(await m.isVisible('.bottom-nav'), 'Telefonda alt menü görünüyor');

  // 3) Modüler React sürümü
  const r = await page({ width: 1280, height: 800 });
  await r.goto(`${base}/modern/`);
  await r.waitForSelector('text=Pusula', { timeout: 10000 });
  check(r.errors.length === 0, `Modern sürüm hatasız açılıyor ${r.errors.join(' | ')}`);
} catch (e) {
  check(false, `Beklenmeyen hata: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(`${failures.length} kontrol başarısız`); process.exit(1); }
console.log('Tüm duman testleri geçti.');
