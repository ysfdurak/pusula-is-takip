// Pilot önizlemesi tarayıcı testi: boş başlar, yönetici kurulumu, üye ekleme, kullanıcı olarak deneme, sıfırlama.
// Kullanım: node tests/e2e/preview.mjs dist-preview   (GitHub Pages'teki gibi /pilot-onizleme/ altında sunulur)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

const html = await readFile(join(resolve(process.argv[2] || 'dist-preview'), 'index.html'));
const server = createServer((req, res) => {
  if (!req.url.startsWith('/pilot-onizleme/')) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/pilot-onizleme/`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) failures.push(label); };

try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(url);
  check(await p.isVisible('h1:has-text("Pilot önizlemesi")'), 'Kurulum ekranı açılıyor');
  await p.fill('input[name=name]', 'Pilot Yönetici');
  await p.fill('input[name=email]', 'yonetici@sirket.test');
  await p.fill('input[name=workspace]', 'Depo Pilotu');
  await p.click('button:has-text("Önizlemeyi başlat")');
  await p.waitForSelector('text=Bugün benim gündemim');
  check(await p.isVisible('.design-banner >> text=Pilot önizlemesi'), 'Önizleme bandı görünüyor');
  await p.click('.sidebar nav button:has-text("İş listesi")');
  check(!(await p.isVisible('text=Eksik koli bildirimlerini tamamla')), 'Örnek veri yok, boş başlıyor');

  await p.click('.sidebar nav button:has-text("Benim panom")');
  await p.fill('input[placeholder^="Ne yapılacak?"]', 'İlk pilot işi');
  await p.keyboard.press('Enter');
  await p.click('.sidebar nav button:has-text("İş listesi")');
  check(await p.isVisible('text=İlk pilot işi'), 'Yönetici iş ekleyebiliyor');

  await p.click('.sidebar nav button:has-text("Ekipler")');
  await p.click('button:has-text("Üye ekle")');
  await p.fill('.modal input[name=name]', 'Ece Kaya');
  await p.fill('.modal input[name=email]', 'ece@sirket.test');
  await p.click('.modal-footer button[type=submit]');
  await p.waitForSelector('.member-card:has-text("Ece Kaya")');
  check(true, 'Yönetici üye ekleyebiliyor');

  await p.selectOption('select[aria-label="Kullanıcı olarak dene"]', 'ece@sirket.test');
  await p.waitForSelector('.account:has-text("Ece Kaya")');
  await p.click('.sidebar nav button:has-text("İş listesi")');
  check(await p.isVisible('text=İlk pilot işi'), 'Üye olarak genel işi görüyor');
  await p.reload();
  await p.waitForSelector('.account:has-text("Ece Kaya")');
  check(true, 'Veriler ve seçili kullanıcı yenilemede korunuyor');

  await p.click('button[aria-label="Önizlemeyi sıfırla"]');
  await Promise.all([p.waitForEvent('load'), p.click('.modal-footer button[type=submit]')]);
  check(await p.isVisible('h1:has-text("Pilot önizlemesi")'), 'Sıfırlayınca kurulum ekranına dönüyor');
  check(errors.length === 0, `Sayfa hatası yok ${errors.join(' | ')}`);
} catch (e) {
  check(false, `Beklenmeyen hata: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(`${failures.length} kontrol başarısız`); process.exit(1); }
console.log('Pilot önizlemesi testleri geçti.');
