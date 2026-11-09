// Pilot sunucusu tarayıcı testi: gerçek sunucu + SQLite, geliştirme girişi (Microsoft yerine).
// Kullanım: npm run build:pilot && node tests/e2e/pilot.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const port = 5300 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'pusula-e2e-'));
const env = { ...process.env, NODE_ENV: '', AUTH_MODE: 'dev', PUSULA_ADMINS: 'deneme@sirket.test', PUSULA_WORKSPACE_NAME: 'Depo Pilotu', APP_URL: base + '/', PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, MAIL_MODE: 'off' };
function startServer() {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => String(d).includes('Pusula pilot sunucusu') && resolve(child));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (code) => reject(new Error('sunucu kapandı: ' + code)));
  });
}
const stop = (child) => new Promise((r) => { child.once('exit', r); child.kill('SIGTERM'); });

const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) failures.push(label); };
let server = await startServer();
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/');
  await page.waitForSelector('text=Şirket hesabınla giriş yap', { timeout: 10000 });
  check(true, 'Oturum yokken giriş ekranı görünüyor');
  await page.click('text=Şirket hesabınla giriş yap');
  await page.click('text=deneme@sirket.test olarak gir');
  await page.waitForSelector('input[placeholder^="Ne yapılacak?"]', { timeout: 10000 });
  if (process.env.SHOT_DIR) await page.screenshot({ path: process.env.SHOT_DIR + '/pilot-giris.png' });
  check((await page.content()).includes('Depo Pilotu'), 'Giriş sonrası pilot çalışma alanı açılıyor');
  check(!(await page.isVisible('text=Tasarım demosu')), 'Demo bandı görünmüyor');
  await page.fill('input[placeholder^="Ne yapılacak?"]', 'Rampa 3 kontrolü');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.click('.sidebar nav button:has-text("İş listesi")');
  check(await page.isVisible('text=Rampa 3 kontrolü'), 'Yeni iş sunucuya kaydedildi');

  await stop(server);
  server = await startServer();
  await page.reload();
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.click('.sidebar nav button:has-text("İş listesi")');
  check(await page.isVisible('text=Rampa 3 kontrolü'), 'Sunucu yeniden başladıktan sonra iş ve oturum korunuyor');

  await page.click('.account-logout');
  await page.waitForSelector('text=Oturum kapatıldı');
  const api = (await page.context().request.get(base + '/api/workspace')).status();
  check(api === 401, 'Oturum kapatınca API erişimi kesiliyor');
  check(errors.length === 0, `Sayfa hatası yok ${errors.join(' | ')}`);
} catch (e) {
  check(false, `Beklenmeyen hata: ${e.message}`);
} finally {
  await browser.close();
  await stop(server);
}
if (failures.length) { console.error(`${failures.length} kontrol başarısız`); process.exit(1); }
console.log('Pilot tarayıcı testleri geçti.');
