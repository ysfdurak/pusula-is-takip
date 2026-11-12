// MCP App tarayıcı testi: gerçek pilot sunucusu + /mcp + deneme host'u + "Benim panom" arayüzü.
// Claude'un yaptığını taklit eden host (tools/mcp-host) panoyu yalıtılmış iframe'de açar; test düğmelere basar.
// Kullanım: npm run test:mcp-app   (önce panom ve host derlenir)
//   Ekran görüntüleri: MCP_APP_SCREENSHOT=dosya.png npm run test:mcp-app  (dosya-kural.png ve dosya.png)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { loadConfig } from '../../server/config.js';
import { openStore } from '../../server/store.js';
import { createApp } from '../../server/app.js';

const USER = 'deneme@sirket.test';
const KEY = 'gelistirme-anahtari-yalnizca-yerel-deneme';
const hostHtml = readFileSync('tmp/mcp-host/index.html');
const boardHtml = readFileSync('dist-mcp-app/panom.html', 'utf8');

// Pilot sunucusu (geliştirme girişi, MCP açık, geçici veri)
const config = loadConfig({
  APP_URL: 'http://localhost:8080/', AUTH_MODE: 'dev', PUSULA_ADMINS: USER, DATA_DIR: mkdtempSync(join(tmpdir(), 'pusula-app-')),
  MCP_ENABLED: 'true', MCP_TOKENS: `${USER}:${KEY}`,
});
assert.deepEqual(config.errors, []);
const store = openStore(config.dbFile);
const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;
config.appUrl = base + '/';
const app = createApp({ config, store, auth: null, html: Buffer.from('<!doctype html>'), boardHtml, log: () => {} });
// Host sayfası aynı adresten sunulur: tarayıcı /mcp'ye istek atarken kaynak (Origin) uygulamanın kendisi olur.
server.on('request', (req, res) =>
  req.url.startsWith('/__host') ? (res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }), res.end(hostHtml)) : app.handle(req, res),
);

// Örnek veri: bugün termini olan iki iş; biri zorunlu kontrol listeli
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const ws = app.service.get(USER, '').workspaces[0].id;
const snap = app.service.get(USER, ws);
const next = structuredClone(snap.state);
const due = new Date(Date.parse(today + 'T23:59:59.999+03:00')).toISOString();
next.tasks.push(
  { id: 't-rampa', title: 'Rampa 3 sayımı', status: 'todo', assignees: [USER], dueAt: due, date: today, priority: 'high', requireApproval: false },
  { id: 't-rapor', title: 'Vardiya kapanış raporu', status: 'doing', assignees: [USER], dueAt: due, date: today, requireApproval: false, checklistRequired: true,
    checklist: [{ id: 'k1', text: 'Sayım imzalandı', done: false, doneBy: '', doneAt: '' }] },
);
app.service.post(USER, { action: 'save', id: ws, revision: snap.revision, state: next, reason: '' });

const browser = await chromium.launch(existsSync('/usr/bin/google-chrome') && !process.env.CI ? { executablePath: '/usr/bin/google-chrome' } : {});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/__host');
  const board = page.frameLocator('iframe[title="Benim panom"]');
  await board.getByText('Rampa 3 sayımı').waitFor({ timeout: 15000 });
  await board.getByText('Vardiya kapanış raporu').waitFor();
  console.log('✓ Pano Claude benzeri host içinde açıldı ve iki iş görünüyor');

  // Kural sunucuda: zorunlu kontrol adımı bitmeden tamamlanamaz; hata kartın altında görünür
  const report = board.locator('.card', { hasText: 'Vardiya kapanış raporu' });
  await report.getByRole('button', { name: 'Tamamla' }).click();
  await report.locator('.msg').getByText('Zorunlu kontrol adımlarını tamamla').waitFor();
  console.log('✓ Tamamlama kuralı arayüzde gösterildi (sunucudan gelen hata)');
  if (process.env.MCP_APP_SCREENSHOT) await page.screenshot({ path: process.env.MCP_APP_SCREENSHOT.replace(/\.png$/, '-kural.png'), fullPage: true });

  // Başla → Tamamla: iş panodan düşer, Claude'a bilgi gider
  const rampa = board.locator('.card', { hasText: 'Rampa 3 sayımı' });
  await rampa.getByRole('button', { name: 'Başla' }).click();
  await page.locator('#log').getByText('"Başla" işlemini yaptı').waitFor();
  await board.locator('.card', { hasText: 'Rampa 3 sayımı' }).getByRole('button', { name: 'Tamamla' }).click();
  await board.getByText('Rampa 3 sayımı').waitFor({ state: 'detached' });
  await page.locator('#log').getByText('"Tamamla" işlemini yaptı').waitFor();
  assert.equal(app.service.get(USER, ws).state.tasks.find((t) => t.id === 't-rampa').status, 'done');
  console.log('✓ Başla ve Tamamla çalıştı; web arayüzünün verisi de güncellendi; Claude\'a bilgi gitti');

  // Ayrıntı: sohbete kullanıcı adına mesaj
  await report.getByRole('button', { name: 'Ayrıntı' }).click();
  await page.locator('#log').getByText('ayrıntısını göster').waitFor();
  console.log('✓ Ayrıntı düğmesi sohbete mesaj gönderdi');

  // Denetim kaydı: panodan yapılan değişiklikler de MCP işlemi olarak kayıtlı
  const audits = store.db.prepare("SELECT action FROM audit WHERE action LIKE 'mcp:%'").all().map((r) => r.action);
  assert.ok(audits.filter((a) => a === 'mcp:durum_degistir').length >= 2);
  assert.deepEqual(errors, []);
  if (process.env.MCP_APP_SCREENSHOT) await page.screenshot({ path: process.env.MCP_APP_SCREENSHOT, fullPage: true });
  console.log('MCP App tarayıcı testi geçti.');
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
  store.close();
}
process.exit(failed ? 1 : 0);
