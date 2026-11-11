// MCP kapısı entegrasyon testleri: gerçek HTTP sunucusu + SQLite + resmi MCP istemcisi.
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
import { MCP_TOOL_NAMES } from '../../server/mcp.js';

const ADMIN = 'deniz@sirket.test';
const ECE = 'ece@sirket.test';
const ADMIN_KEY = 'a'.repeat(40);
const ECE_KEY = 'e'.repeat(40);
const HTML = Buffer.from('<!doctype html><title>Pusula</title>');

const running = new Set();
test.after(async () => { for (const close of running) await close(); });

async function start(env = {}) {
  const config = loadConfig({
    APP_URL: 'http://localhost:0/', AUTH_MODE: 'dev', PUSULA_ADMINS: ADMIN, DATA_DIR: mkdtempSync(join(tmpdir(), 'pusula-mcp-')),
    MCP_ENABLED: 'true', MCP_TOKENS: `${ADMIN}:${ADMIN_KEY},${ECE}:${ECE_KEY}`, ...env,
  });
  assert.deepEqual(config.errors, []);
  const store = openStore(config.dbFile);
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  config.appUrl = base + '/';
  const app = createApp({ config, store, auth: null, html: HTML, log: () => {} });
  server.on('request', app.handle);
  const close = () => new Promise((r) => { server.close(() => { store.close(); r(); }); server.closeAllConnections(); });
  running.add(close);
  return { base, app, store };
}

async function connect(base, key) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }));
  return client;
}

const parse = (result) => JSON.parse(result.content[0].text);

test('ayarlar: MCP varsayılan kapalı; kişisel anahtar isteğe bağlı ama en az 32 karakter', () => {
  const base = { APP_URL: 'http://localhost:8080/', AUTH_MODE: 'dev', PUSULA_ADMINS: ADMIN };
  assert.equal(loadConfig(base).mcpEnabled, false);
  assert.deepEqual(loadConfig({ ...base, MCP_ENABLED: 'true' }).errors, []);
  assert.match(loadConfig({ ...base, MCP_TOKENS: `${ADMIN}:kisa` }).errors.join(), /en az 32 karakter/);
});

test('kapalıyken /mcp yok; anahtarsız ya da yanlış anahtarla erişilemez', async () => {
  const off = await start({ MCP_ENABLED: 'false', MCP_TOKENS: '' });
  assert.equal((await fetch(off.base + '/mcp', { method: 'POST' })).status, 404);
  const { base } = await start();
  const post = (headers) => fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: '{}' });
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ Authorization: 'Bearer ' + 'x'.repeat(40) })).status, 401);
  assert.equal((await post({ Authorization: `Bearer ${ADMIN_KEY}`, Origin: 'https://kotu.example' })).status, 403);
  assert.equal((await fetch(base + '/mcp', { headers: { Authorization: `Bearer ${ADMIN_KEY}` } })).status, 405);
});

test('araç listesi ve yetki: üye olmayan anahtar sahibi reddedilir', async () => {
  const { base } = await start();
  const admin = await connect(base, ADMIN_KEY);
  const { tools } = await admin.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [...MCP_TOOL_NAMES].sort());
  assert.equal(tools.find((t) => t.name === 'gundemim').annotations.readOnlyHint, true);
  assert.equal(tools.find((t) => t.name === 'is_olustur').annotations.readOnlyHint, false);
  // Ece'nin anahtarı var ama henüz Pusula üyesi değil
  await assert.rejects(connect(base, ECE_KEY), /403|erişimin/);
});

test('MCP App: panom aracı arayüz kaynağına işaret eder; kaynak HTML döner; veri hem yapılandırılmış hem metin', async () => {
  const { base } = await start();
  const admin = await connect(base, ADMIN_KEY);
  const { tools } = await admin.listTools();
  const board = tools.find((t) => t.name === 'panom');
  assert.equal(board._meta.ui.resourceUri, 'ui://pusula/panom.html');
  const { contents } = await admin.readResource({ uri: 'ui://pusula/panom.html' });
  assert.equal(contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.match(contents[0].text, /<!doctype html>/i);
  assert.deepEqual(contents[0]._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
  const result = await admin.callTool({ name: 'panom', arguments: {} });
  assert.equal(result.structuredContent.kullanici, ADMIN);
  assert.ok(result.structuredContent.calismaAlani);
  assert.deepEqual(result.structuredContent.geciken, []);
  assert.match(result.content[0].text, /^Pano: 0 geciken/);
});

test('uçtan uca: iş aç, ata, termin değiştir, tamamla; kurallar ve denetim kaydı', async () => {
  const { base, app, store } = await start();
  const admin = await connect(base, ADMIN_KEY);
  const [space] = parse(await admin.callTool({ name: 'calisma_alanlarim', arguments: {} }));
  assert.equal(space.rol, 'owner');
  app.service.post(ADMIN, { action: 'member', id: space.id, email: ECE, name: 'Ece', department: '', role: 'editor', active: true, originalEmail: '' });

  const created = parse(await admin.callTool({ name: 'is_olustur', arguments: { baslik: 'Rampa 2 sayımı', sorumlular: [ECE], termin: '2099-01-10' } }));
  assert.deepEqual(created.sorumlular, [ECE]);

  const ece = await connect(base, ECE_KEY);
  const agenda = parse(await ece.callTool({ name: 'isleri_listele', arguments: { sorumlu: 'ben' } }));
  assert.equal(agenda.toplam, 1);

  // Gerekçesiz termin değişikliği iş kuralı hatası olarak döner (isError), bağlantı kopmaz
  const noReason = await ece.callTool({ name: 'termin_degistir', arguments: { isId: created.id, termin: '2099-01-12', gerekce: ' ' } });
  assert.equal(noReason.isError, true);
  assert.match(noReason.content[0].text, /gerekçe/);
  const moved = parse(await ece.callTool({ name: 'termin_degistir', arguments: { isId: created.id, termin: '2099-01-12', gerekce: 'Araç gecikti' } }));
  assert.equal(moved.ilkTermin, '2099-01-10');

  const done = parse(await ece.callTool({ name: 'durum_degistir', arguments: { isId: created.id, durum: 'done' } }));
  assert.equal(done.durum, 'done');
  // Web arayüzünün gördüğü veri aynı (tek çekirdek)
  const web = app.service.get(ADMIN, space.id);
  assert.equal(web.state.tasks.find((t) => t.id === created.id).status, 'done');
  // Yazma işlemleri denetim kaydına düşer
  const audits = store.db.prepare("SELECT email, action FROM audit WHERE action LIKE 'mcp:%'").all().map((r) => `${r.email} ${r.action}`);
  assert.ok(audits.includes(`${ECE} mcp:durum_degistir`));
  assert.ok(audits.includes(`${ADMIN} mcp:is_olustur`));
});
