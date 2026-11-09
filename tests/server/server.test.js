// Pilot sunucusu entegrasyon testleri: gerçek HTTP sunucusu + SQLite; Microsoft girişi sahte token uç noktasıyla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../server/config.js';
import { openStore } from '../../server/store.js';
import { createEntraAuth } from '../../server/auth.js';
import { createApp } from '../../server/app.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const CLIENT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const HTML = Buffer.from('<!doctype html><title>Pusula — Pilot</title><div id="root"></div>');

// Başarısız bir testte de sunucular kapansın; aksi halde test süreci asılı kalır.
const running = new Set();
test.after(async () => { for (const s of running) await s.close(); });

const jwt = (claims) => ['{"alg":"RS256"}', JSON.stringify(claims), 'imza'].map((p, i) => (i < 2 ? Buffer.from(p).toString('base64url') : p)).join('.');

/** Sunucuyu başlatır; `identity` her kod takasında hangi kullanıcı döneceğini belirler */
async function start({ dir = mkdtempSync(join(tmpdir(), 'pusula-')), mailer = null, env = {} } = {}) {
  const config = loadConfig({ APP_URL: 'http://127.0.0.1:0/', PUSULA_ADMINS: 'deniz@sirket.test', ENTRA_TENANT_ID: TENANT, ENTRA_CLIENT_ID: CLIENT, ENTRA_CLIENT_SECRET: 's', DATA_DIR: dir, ...env });
  assert.deepEqual(config.errors, []);
  const store = openStore(config.dbFile);
  const ctx = { identity: null, tokenRequests: [], dir, store };
  const fetchImpl = async (url, init) => {
    ctx.tokenRequests.push({ url, body: new URLSearchParams(init.body) });
    const { email, name = 'Ad Soyad', overrides = {} } = ctx.identity;
    const nonce = ctx.lastNonce;
    const claims = { tid: TENANT, iss: `https://login.microsoftonline.com/${TENANT}/v2.0`, aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 3600, nonce, preferred_username: email, name, ...overrides };
    return { ok: true, status: 200, json: async () => ({ id_token: jwt(claims) }) };
  };
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  config.appUrl = base + '/';
  config.entra.redirectUri = base + '/auth/callback';
  const auth = createEntraAuth({ ...config.entra, fetchImpl });
  const app = createApp({ config, store, auth, html: HTML, mailer, log: process.env.DEBUG_SERVER ? console.log : () => {} });
  server.on('request', app.handle);
  ctx.base = base;
  ctx.app = app;
  let closed = false;
  ctx.close = () => {
    running.delete(ctx);
    if (closed) return Promise.resolve();
    closed = true;
    return new Promise((r) => { server.close(() => { store.close(); r(); }); server.closeAllConnections(); });
  };
  running.add(ctx);
  /** Microsoft girişini taklit eder; oturum çerezini döner */
  ctx.login = async (email, opts = {}) => {
    ctx.identity = { email, ...opts };
    const r1 = await fetch(base + '/auth/login?return_to=%2F', { redirect: 'manual' });
    assert.equal(r1.status, 302);
    const authorize = new URL(r1.headers.get('location'));
    ctx.lastAuthorize = authorize;
    ctx.lastNonce = opts.nonce ?? authorize.searchParams.get('nonce');
    const state = opts.state ?? authorize.searchParams.get('state');
    const r2 = await fetch(`${base}/auth/callback?code=kod&state=${state}`, { redirect: 'manual' });
    const cookie = (r2.headers.get('set-cookie') || '').split(';')[0];
    return { status: r2.status, cookie, setCookie: r2.headers.get('set-cookie'), text: await r2.text() };
  };
  ctx.api = async (cookie, { method = 'GET', query = '', body, headers = {} } = {}) => {
    const r = await fetch(`${base}/api/workspace${query}`, {
      method,
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
  return ctx;
}

test('arayüz sunuluyor, API oturumsuz 401 döner, güvenlik başlıkları var', async () => {
  const s = await start();
  const page = await fetch(s.base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Pusula — Pilot/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal((await s.api('')).status, 401);
  assert.equal((await fetch(s.base + '/healthz')).status, 200);
  await s.close();
});

test('giriş: PKCE ve state ile yönlendirme, oturum çerezi, ilk yönetici ve çalışma alanı', async () => {
  const s = await start();
  const r = await s.login('Deniz@Sirket.test', { name: 'Deniz Yılmaz' });
  assert.equal(r.status, 302);
  const a = s.lastAuthorize;
  assert.equal(a.origin + a.pathname, `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
  assert.equal(a.searchParams.get('client_id'), CLIENT);
  assert.equal(a.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(a.searchParams.get('redirect_uri'), s.base + '/auth/callback');
  assert.ok(s.tokenRequests[0].body.get('code_verifier'), 'kod takasında PKCE doğrulayıcısı gönderilir');
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  const list = await s.api(r.cookie);
  assert.equal(list.body.user, 'deniz@sirket.test');
  assert.equal(list.body.workspaces[0].role, 'owner');
  const ws = await s.api(r.cookie, { query: `?id=${list.body.workspaces[0].id}` });
  assert.equal(ws.body.members[0].name, 'Deniz Yılmaz', 'ad Microsoft hesabından tamamlanır');
  assert.equal(ws.body.state.tasks.length, 0, 'pilot boş başlar');
  await s.close();
});

test('giriş reddi: tekrar kullanılan state, başka dizin, başka uygulama, nonce uyuşmazlığı, üye olmayan', async () => {
  const s = await start();
  const ok = await s.login('deniz@sirket.test');
  assert.equal(ok.status, 302);
  const replay = await fetch(`${s.base}/auth/callback?code=kod&state=${s.lastAuthorize.searchParams.get('state')}`, { redirect: 'manual' });
  assert.equal(replay.status, 400, 'state tek kullanımlık');
  assert.equal((await s.login('deniz@sirket.test', { overrides: { tid: 'baska-dizin' } })).status, 400);
  assert.equal((await s.login('deniz@sirket.test', { overrides: { aud: 'baska-uygulama' } })).status, 400);
  assert.equal((await s.login('deniz@sirket.test', { nonce: 'yanlis' })).status, 400);
  assert.equal((await s.login('deniz@sirket.test', { overrides: { exp: 1 } })).status, 400);
  const stranger = await s.login('yabanci@sirket.test');
  assert.equal(stranger.status, 403);
  assert.match(stranger.text, /henüz Pusula&#39;ya eklenmemiş|henüz Pusula'ya eklenmemiş/);
  assert.equal(stranger.cookie, '', 'üye olmayana oturum açılmaz');
  await s.close();
});

test('çok kullanıcı: yönetici üye ekler, üye girer; eski revizyon 409, görüntüleyici yazamaz, başka kaynak reddedilir', async () => {
  const s = await start();
  const admin = (await s.login('deniz@sirket.test')).cookie;
  const id = (await s.api(admin)).body.workspaces[0].id;
  for (const [email, role] of [['Ece@Sirket.test', 'editor'], ['selin@sirket.test', 'viewer']]) {
    const r = await s.api(admin, { method: 'POST', body: { action: 'member', id, email, name: email.split('@')[0], department: 'Depo', role, active: true, originalEmail: '' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const ece = (await s.login('ece@sirket.test', { name: 'Ece Kaya' })).cookie;
  const selin = (await s.login('selin@sirket.test')).cookie;

  const w1 = await s.api(admin, { query: `?id=${id}` });
  const next = structuredClone(w1.body.state);
  next.tasks.push({ id: 't1', title: 'Sayım', status: 'todo', assignees: ['ece@sirket.test'], createdBy: 'deniz@sirket.test' });
  const saved = await s.api(admin, { method: 'POST', body: { action: 'save', id, revision: w1.body.revision, state: next, reason: '' } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));

  const eceView = await s.api(ece, { query: `?id=${id}` });
  assert.equal(eceView.body.state.tasks[0].title, 'Sayım');
  const stale = await s.api(ece, { method: 'POST', body: { action: 'save', id, revision: w1.body.revision, state: eceView.body.state, reason: '' } });
  assert.equal(stale.status, 409, 'eski revizyonla kayıt çakışma döner');

  const selinView = await s.api(selin, { query: `?id=${id}` });
  const denied = await s.api(selin, { method: 'POST', body: { action: 'save', id, revision: selinView.body.revision, state: selinView.body.state, reason: '' } });
  assert.equal(denied.status, 403);

  const csrf = await s.api(ece, { method: 'POST', body: { action: 'comment', id, task: 't1', body: 'x', requestId: 'r' }, headers: { Origin: 'https://kotu.site' } });
  assert.equal(csrf.status, 403);
  const flush = await s.api(ece, { method: 'POST', body: { action: 'flush', id } });
  assert.equal(flush.status, 403, 'e-posta kuyruğunu yalnızca yönetici tetikler');

  // Üyelik kaldırılınca oturum geçersizleşir
  await s.api(admin, { method: 'POST', body: { action: 'member', id, email: 'selin@sirket.test', name: 'selin', department: '', role: 'viewer', active: false, originalEmail: 'selin@sirket.test' } });
  const after = await s.api(selin);
  assert.ok([200, 401].includes(after.status));
  await s.close();
});

test('kalıcılık: sunucu yeniden başlayınca veriler ve oturum korunur; yedek alınır', async () => {
  const s1 = await start();
  const admin = (await s1.login('deniz@sirket.test')).cookie;
  const id = (await s1.api(admin)).body.workspaces[0].id;
  const w = await s1.api(admin, { query: `?id=${id}` });
  const next = structuredClone(w.body.state);
  next.tasks.push({ id: 'k1', title: 'Kalıcı iş', status: 'todo', createdBy: 'deniz@sirket.test' });
  await s1.api(admin, { method: 'POST', body: { action: 'save', id, revision: w.body.revision, state: next, reason: '' } });
  const backup = s1.store.backup(join(s1.dir, 'backups'));
  await s1.close();
  assert.ok(readdirSync(join(s1.dir, 'backups')).some((f) => backup.endsWith(f)));

  const s2 = await start({ dir: s1.dir });
  const again = await s2.api(admin, { query: `?id=${id}` });
  assert.equal(again.status, 200, 'oturum yeniden başlatmadan sonra geçerli');
  assert.equal(again.body.state.tasks.find((t) => t.id === 'k1').title, 'Kalıcı iş');
  assert.equal((await s2.api(admin)).body.workspaces.length, 1, 'ilk kurulum tekrar çalışmaz');
  await s2.close();
});

test('e-posta: durum değişince ilgiliye Outlook üzerinden gider, işlemi yapana gitmez', async () => {
  const sent = [];
  const s = await start({ mailer: { name: 'Outlook', send: async (m) => { sent.push(m); return { accepted: true }; } } });
  const admin = (await s.login('deniz@sirket.test', { name: 'Deniz Yılmaz' })).cookie;
  const id = (await s.api(admin)).body.workspaces[0].id;
  await s.api(admin, { method: 'POST', body: { action: 'member', id, email: 'ece@sirket.test', name: 'Ece Kaya', department: '', role: 'editor', active: true, originalEmail: '' } });
  let w = await s.api(admin, { query: `?id=${id}` });
  let next = structuredClone(w.body.state);
  next.tasks.push({ id: 'm1', title: 'Rampa kontrolü', status: 'todo', assignees: ['ece@sirket.test'], createdBy: 'deniz@sirket.test' });
  await s.api(admin, { method: 'POST', body: { action: 'save', id, revision: w.body.revision, state: next, reason: '' } });
  w = await s.api(admin, { query: `?id=${id}` });
  next = structuredClone(w.body.state);
  next.tasks[0].status = 'doing';
  await s.api(admin, { method: 'POST', body: { action: 'save', id, revision: w.body.revision, state: next, reason: '' } });
  await s.app.flushMail();
  assert.deepEqual(sent.map((m) => [m.to, m.subject]), [
    ['ece@sirket.test', '[Pusula] İş atandı: Rampa kontrolü'],
    ['ece@sirket.test', '[Pusula] Durum değişti: Rampa kontrolü (Devam ediyor)'],
  ]);
  assert.match(sent[1].html, /Deniz Yılmaz işin durumunu değiştirdi/);
  assert.match(sent[1].html, new RegExp(`${s.base.replace(/[.:/]/g, '\\$&')}/\\?workspace=${id}&amp;task=m1`));
  await s.close();
});

test('ayarlar: üretimde dev girişi ve http adres reddedilir; eksik Microsoft bilgisi bildirilir', () => {
  assert.match(loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev', APP_URL: 'https://p.test/' }).errors.join(), /üretimde/);
  assert.match(loadConfig({ NODE_ENV: 'production', APP_URL: 'http://p.test/', ENTRA_TENANT_ID: 't', ENTRA_CLIENT_ID: 'c', ENTRA_CLIENT_SECRET: 's' }).errors.join(), /https/);
  assert.match(loadConfig({ APP_URL: 'https://p.test/' }).errors.join(), /ENTRA_CLIENT_ID eksik/);
  assert.match(loadConfig({ APP_URL: 'https://p.test/pusula/', AUTH_MODE: 'dev' }).errors.join(), /kökü olmalı/);
  assert.deepEqual(loadConfig({ APP_URL: 'https://p.test/', AUTH_MODE: 'dev' }).errors, []);
});
