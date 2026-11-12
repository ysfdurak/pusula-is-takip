// Kullanım ölçümü ve geri bildirim: yalnızca demo ziyaretçileri, takma kimlik, içerik yok; yönetici özeti; Claude kanalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadConfig } from '../../server/config.js';
import { openStore } from '../../server/store.js';
import { createApp } from '../../server/app.js';

const ADMIN = 'yusuf@sirket.test';
const AYSE = 'ayse@gmail.test';
const KEYS = { [ADMIN]: 'a'.repeat(40), [AYSE]: 'k'.repeat(40) };

const running = new Set();
test.after(async () => { for (const close of running) await close(); });

async function start(env = {}) {
  const config = loadConfig({ APP_URL: 'http://localhost:0/', AUTH_MODE: 'dev', PUSULA_ADMINS: ADMIN, DATA_DIR: mkdtempSync(join(tmpdir(), 'pusula-an-')), DEMO_MODE: 'true',
    MCP_ENABLED: 'true', MCP_TOKENS: Object.entries(KEYS).map(([e, k]) => `${e}:${k}`).join(','), ...env });
  assert.deepEqual(config.errors, []);
  const store = openStore(config.dbFile);
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}`;
  config.appUrl = base + '/';
  const app = createApp({ config, store, auth: null, html: Buffer.from('<!doctype html>'), log: () => {} });
  server.on('request', app.handle);
  let closed = false;
  const close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    return new Promise((r) => { server.close(() => { store.close(); r(); }); server.closeAllConnections(); });
  };
  running.add(close);
  const login = async (email) => (await fetch(`${base}/auth/dev?email=${encodeURIComponent(email)}`, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
  const post = (cookie, path, body, origin = base) => fetch(base + path, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const events = () => store.db.prepare('SELECT visitor, event, channel FROM analytics_events ORDER BY id').all();
  const mcp = async (email) => {
    const client = new Client({ name: 't', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${KEYS[email]}` } } }));
    return client;
  };
  return { base, app, store, login, post, events, mcp };
}

test('yalnızca demo ziyaretçisi ölçülür; e-posta ve içerik yazılmaz; şirket kurulumunda hiç olay yok', async () => {
  const s = await start();
  const ayse = await s.login(AYSE);
  await s.login(ADMIN);
  const ws = s.app.service.get(AYSE, '').workspaces[0].id;
  // Arayüz: bir iş aç
  const snap = s.app.service.get(AYSE, ws);
  const next = structuredClone(snap.state);
  next.tasks.push({ id: 'gizli-is', title: 'Çok gizli müşteri adı', status: 'todo', assignees: [AYSE] });
  assert.equal((await s.post(ayse, '/api/workspace', { action: 'save', id: ws, revision: snap.revision, state: next, reason: '' })).status, 200);
  assert.equal((await s.post(ayse, '/api/event', { name: 'ekran:team' })).status, 200);

  const rows = s.events();
  assert.deepEqual(rows.map((r) => r.event), ['oturum:demo_acildi', 'oturum:giris', 'is:created', 'ekran:team']);
  assert.equal(new Set(rows.map((r) => r.visitor)).size, 1, 'yönetici ölçülmedi');
  const dump = JSON.stringify(s.store.db.prepare('SELECT * FROM analytics_events').all());
  assert.ok(!dump.includes(AYSE) && !dump.includes('gizli'), 'e-posta ve iş adı yok');

  // Şirket kurulumu (demo kapalı): kimse ölçülmez
  const company = await start({ DEMO_MODE: 'false' });
  await company.login(ADMIN);
  assert.equal((await company.post(await company.login(ADMIN), '/api/event', { name: 'ekran:team' })).status, 200);
  assert.equal(company.events().length, 0);
});

test('olay uç noktası: bilinmeyen ad ve başka siteden istek reddedilir', async () => {
  const s = await start();
  const ayse = await s.login(AYSE);
  assert.equal((await s.post(ayse, '/api/event', { name: '<script>' })).status, 400);
  assert.equal((await s.post(ayse, '/api/event', { name: 'is:created' })).status, 400, 'iş olayları sunucuda üretilir, arayüz uyduramaz');
  assert.equal((await s.post(ayse, '/api/event', { name: 'ekran:team' }, 'https://kotu.example')).status, 403);
  assert.equal((await fetch(s.base + '/api/event', { method: 'POST', body: '{}' })).status, 401);
});

test('geri bildirim: puan ve metin kuralları; e-posta yalnızca izinle; herkes gönderebilir', async () => {
  const s = await start();
  const ayse = await s.login(AYSE);
  const admin = await s.login(ADMIN);
  assert.equal((await s.post(ayse, '/api/feedback', {})).status, 400);
  assert.equal((await s.post(ayse, '/api/feedback', { rating: 9 })).status, 400);
  assert.equal((await s.post(ayse, '/api/feedback', { rating: 4, message: 'Kanban çok iyi', screen: 'tasks' })).status, 200);
  assert.equal((await s.post(ayse, '/api/feedback', { message: 'Mobilde menü zor', contact: true })).status, 200);
  assert.equal((await s.post(admin, '/api/feedback', { rating: 5 })).status, 200);
  const rows = s.store.db.prepare('SELECT email, rating, message FROM feedback ORDER BY id').all();
  assert.deepEqual(rows.map((r) => r.email), [null, AYSE, null]);
  const summary = s.app.analytics.summary();
  assert.equal(summary.geriBildirim.adet, 3);
  assert.equal(summary.geriBildirim.ortalamaPuan, 4.5);
});

test('Claude kanalı: araç kullanımı ölçülür, geri bildirim Claude\'dan da gelir; istatistik aracı yalnızca yöneticide', async () => {
  const s = await start();
  await s.login(AYSE);
  const ayse = await s.mcp(AYSE);
  await ayse.callTool({ name: 'panom', arguments: {} });
  await ayse.callTool({ name: 'geri_bildirim_gonder', arguments: { metin: 'Claude içinden pano harika', puan: 5 } });
  assert.ok(!(await ayse.listTools()).tools.some((t) => t.name === 'kullanim_istatistikleri'));
  const claudeEvents = s.events().filter((r) => r.channel === 'claude').map((r) => r.event);
  assert.ok(claudeEvents.includes('claude:geri_bildirim_gonder') && claudeEvents.includes('is:geri_bildirim'));

  const admin = await s.mcp(ADMIN);
  const stats = JSON.parse((await admin.callTool({ name: 'kullanim_istatistikleri', arguments: {} })).content[0].text);
  assert.equal(stats.ziyaretci, 1);
  assert.equal(stats.claudeKullanan, 1);
  assert.equal(stats.geriBildirim.son[0].kanal, 'claude');
});

test('yönetici sayfası: yalnızca PUSULA_ADMINS; geri bildirim metni HTML olarak çalışmaz; demo silinince sayılar kalır', async () => {
  const s = await start();
  const ayse = await s.login(AYSE);
  await s.post(ayse, '/api/feedback', { message: '<img src=x onerror=alert(1)>' });
  assert.equal((await fetch(s.base + '/yonetim/istatistik', { headers: { Cookie: ayse } })).status, 403);
  const admin = await s.login(ADMIN);
  const res = await fetch(s.base + '/yonetim/istatistik', { headers: { Cookie: admin } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await res.text();
  assert.match(html, /Demo kullanımı/);
  assert.ok(!html.includes('<img src=x') && html.includes('&lt;img src=x'));
  // Demo alanı silinir; takma kimlikli olaylar kalır
  s.app.cleanupDemo(Date.now() + 8 * 864e5);
  const json = await (await fetch(s.base + '/yonetim/istatistik.json', { headers: { Cookie: admin } })).json();
  assert.equal(json.ziyaretci, 1);
  assert.equal(json.yeniDemoAlani, 1);
});
