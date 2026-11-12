// Ziyaretçi demo alanları (DEMO_MODE=true): kişiye özel örnek alan, yalıtım, kurgusal üye kuralı, süre sonunda silme.
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
const CAN = 'can@gmail.test';
const AYSE_KEY = 'k'.repeat(40);

const running = new Set();
test.after(async () => { for (const close of running) await close(); });

async function start(env = {}, dir = mkdtempSync(join(tmpdir(), 'pusula-demo-'))) {
  const config = loadConfig({ APP_URL: 'http://localhost:0/', AUTH_MODE: 'dev', PUSULA_ADMINS: ADMIN, DATA_DIR: dir, DEMO_MODE: 'true',
    MCP_ENABLED: 'true', MCP_TOKENS: `${AYSE}:${AYSE_KEY}`, ...env });
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
    running.delete(close);
    return new Promise((r) => { server.close(() => { store.close(); r(); }); server.closeAllConnections(); });
  };
  running.add(close);
  const login = (email) => fetch(`${base}/auth/dev?email=${encodeURIComponent(email)}`, { redirect: 'manual' });
  const cookieOf = (r) => r.headers.get('set-cookie').split(';')[0];
  const api = (cookie, body) => fetch(base + '/api/workspace', body
    ? { method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { headers: { Cookie: cookie } });
  return { base, app, store, login, cookieOf, api, dir, close };
}

test('ayarlar: demo varsayılan kapalı; şirket girişiyle birlikte açılamaz', () => {
  const base = { APP_URL: 'http://localhost:8080/', AUTH_MODE: 'dev', PUSULA_ADMINS: ADMIN };
  assert.equal(loadConfig(base).demoMode, false);
  assert.match(loadConfig({ ...base, APP_URL: 'https://p.example/', AUTH_MODE: 'entra', ENTRA_TENANT_ID: 't', ENTRA_CLIENT_ID: 'c', ENTRA_CLIENT_SECRET: 's', DEMO_MODE: 'true' }).errors.join(), /DEMO_MODE/);
});

test('ilk giriş: kendi örnek alanı açılır, karşılama sayfası süreyi söyler; ikinci girişte aynı alan', async () => {
  const { base, login, cookieOf, api } = await start();
  const first = await login(AYSE);
  assert.equal(first.status, 200);
  const html = await first.text();
  assert.match(html, /Demo alanın hazır/);
  assert.match(html, /7 gün sonra silinir/);
  const cookie = cookieOf(first);
  const { workspaces } = await (await api(cookie)).json();
  assert.equal(workspaces.length, 1);
  assert.equal(workspaces[0].role, 'owner');
  assert.match(workspaces[0].name, /^Demo · /);
  const ws = await (await fetch(`${base}/api/workspace?id=${workspaces[0].id}`, { headers: { Cookie: cookie } })).json();
  // Örnek verideki yönetici (Deniz) ziyaretçinin kendisi oldu: işler ona atanmış
  assert.ok(ws.state.tasks.some((t) => t.assignees.includes(AYSE)));
  assert.ok(!JSON.stringify(ws).includes('deniz@example.test'));
  const again = await login(AYSE);
  assert.equal(again.status, 302);
  assert.equal((await (await api(cookieOf(again))).json()).workspaces.length, 1);
});

test('yalıtım: ziyaretçi başkasının ve yöneticinin alanını göremez; yönetici demo alanı almaz', async () => {
  const { login, cookieOf, api, app } = await start();
  const ayse = cookieOf(await login(AYSE));
  const can = cookieOf(await login(CAN));
  const admin = cookieOf(await login(ADMIN));
  const ayseWs = (await (await api(ayse)).json()).workspaces[0].id;
  const canList = (await (await api(can)).json()).workspaces;
  assert.equal(canList.length, 1);
  assert.notEqual(canList[0].id, ayseWs);
  assert.throws(() => app.service.get(CAN, ayseWs), /erişimin yok/);
  const adminList = (await (await api(admin)).json()).workspaces;
  assert.deepEqual(adminList.map((w) => w.name), ['Pusula']);
});

test('demo alanına yalnızca kurgusal kişi eklenir; yeniden başlatmada ziyaretçi yöneticiliğini kaybetmez', async () => {
  const s = await start();
  const ayse = s.cookieOf(await s.login(AYSE));
  const id = (await (await s.api(ayse)).json()).workspaces[0].id;
  const member = (email) => s.api(ayse, { action: 'member', id, email, name: 'X', department: '', role: 'editor', active: true, originalEmail: '' });
  const real = await member('gercek.kisi@gmail.com');
  assert.equal(real.status, 400);
  assert.match((await real.json()).error, /kurgusal/);
  assert.equal((await member('ayse.k@example.test')).status, 200);
  // Sunucu yeniden başlar: PUSULA_ADMINS dışındaki yöneticileri düşüren kural demo alanlarına dokunmaz
  await s.close();
  const again = await start({}, s.dir);
  assert.equal(again.app.service.get(AYSE, '').workspaces[0].role, 'owner');
});

test('Claude da çalışır: ziyaretçinin panosu örnek işlerle dolu', async () => {
  const { base, login } = await start();
  await login(AYSE);
  const client = new Client({ name: 't', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${AYSE_KEY}` } } }));
  const board = (await client.callTool({ name: 'panom', arguments: {} })).structuredContent;
  assert.equal(board.kullanici, AYSE);
  assert.ok(board.geciken.length + board.bugun.length + board.buHafta.length > 0);
});

test('süre dolunca alan, verisi ve oturumu silinir; sınır dolunca yeni alan açılmaz', async () => {
  const { login, cookieOf, api, app, store } = await start({ DEMO_MAX_SANDBOXES: '1' });
  const ayse = cookieOf(await login(AYSE));
  const id = (await (await api(ayse)).json()).workspaces[0].id;
  assert.ok(store.load().comments.some((c) => c.workspace === id));
  const full = await login(CAN);
  assert.equal(full.status, 503);
  assert.match(await full.text(), /Demo şu an dolu/);

  assert.equal(app.cleanupDemo(Date.now() + 8 * 864e5), 1);
  const data = store.load();
  assert.ok(!data.workspaces.some((w) => w.id === id));
  assert.ok(!data.states[id] && !data.members[id]);
  assert.ok(!['notifications', 'comments', 'activities', 'times'].some((k) => data[k].some((x) => x.workspace === id)));
  assert.equal((await api(ayse)).status, 401, 'oturum kapandı');
  // Yeniden giren yeni alan alır
  assert.equal((await login(AYSE)).status, 200);
});
