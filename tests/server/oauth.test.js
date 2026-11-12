// OAuth yetkilendirme sunucusu: resmi MCP istemcisinin yerleşik OAuth akışıyla uçtan uca (Claude'un izlediği yol).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { loadConfig } from '../../server/config.js';
import { openStore } from '../../server/store.js';
import { createApp } from '../../server/app.js';
import { validRedirectUri } from '../../server/oauth.js';

const ADMIN = 'deniz@sirket.test';
const ECE = 'ece@sirket.test';
const CALLBACK = 'http://localhost:9999/callback';

const running = new Set();
test.after(async () => { for (const close of running) await close(); });

async function start() {
  const config = loadConfig({ APP_URL: 'http://localhost:0/', AUTH_MODE: 'dev', PUSULA_ADMINS: ADMIN, DATA_DIR: mkdtempSync(join(tmpdir(), 'pusula-oauth-')), MCP_ENABLED: 'true' });
  assert.deepEqual(config.errors, []);
  const store = openStore(config.dbFile);
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}`;
  config.appUrl = base + '/';
  const app = createApp({ config, store, auth: null, html: Buffer.from('<!doctype html>'), log: () => {} });
  server.on('request', app.handle);
  const close = () => new Promise((r) => { server.close(() => { store.close(); r(); }); server.closeAllConnections(); });
  running.add(close);
  /** Geliştirme girişiyle tarayıcı oturumu (çerez) */
  const login = async (email) => (await fetch(`${base}/auth/dev?email=${encodeURIComponent(email)}`, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
  return { base, app, store, login };
}

/** MCP istemcisinin OAuth tarafı: Claude'un sakladığı bilgileri bellekte tutar. */
class Provider {
  redirectUrl = CALLBACK;
  clientMetadata = { client_name: 'Claude (test)', redirect_uris: [CALLBACK], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' };
  clientInformation() { return this.client; }
  saveClientInformation(c) { this.client = c; }
  tokens() { return this.saved; }
  saveTokens(t) { this.saved = t; }
  redirectToAuthorization(url) { this.authorizationUrl = url; }
  saveCodeVerifier(v) { this.verifier = v; }
  codeVerifier() { return this.verifier; }
}

/** Kullanıcının tarayıcıda yaptığı: izin ekranını aç, "İzin ver"e bas, dönüş adresindeki kodu al. */
async function consent(base, cookie, authorizationUrl, decision = 'allow') {
  const pageRes = await fetch(authorizationUrl, { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  const id = html.match(/name="id" value="([^"]+)"/)[1];
  const r = await fetch(base + '/oauth/authorize', {
    method: 'POST', redirect: 'manual',
    headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id, decision }),
  });
  assert.equal(r.status, 302);
  return { html, location: new URL(r.headers.get('location')) };
}

test('yönlendirme adresi kuralı: https ya da localhost, parça yok', () => {
  assert.equal(validRedirectUri('https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(validRedirectUri('http://localhost:6274/oauth/callback'), true);
  assert.equal(validRedirectUri('http://kotu.example/cb'), false);
  assert.equal(validRedirectUri('https://claude.ai/cb#x'), false);
  assert.equal(validRedirectUri('javascript:alert(1)'), false);
});

test('keşif: anahtarsız /mcp 401 + üst veri adresi; üst veriler doğru', async () => {
  const { base } = await start();
  const r = await fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('www-authenticate'), `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`);
  const prm = await (await fetch(base + '/.well-known/oauth-protected-resource')).json();
  assert.deepEqual(prm.authorization_servers, [base]);
  assert.equal(prm.resource, base + '/mcp');
  const as = await (await fetch(base + '/.well-known/oauth-authorization-server')).json();
  assert.equal(as.registration_endpoint, base + '/oauth/register');
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
});

test('uçtan uca: resmi MCP istemcisi kayıt olur, kullanıcı izin verir, araç çağrılır, anahtar yenilenir', async () => {
  const { base, login, store } = await start();
  const provider = new Provider();
  const url = new URL(base + '/mcp');

  // 1) İlk bağlantı: istemci kendini kaydeder ve kullanıcıyı izin ekranına yönlendirmek ister
  const first = new StreamableHTTPClientTransport(url, { authProvider: provider });
  await assert.rejects(new Client({ name: 't', version: '1' }).connect(first), UnauthorizedError);
  assert.ok(provider.client.client_id, 'istemci kaydı');
  assert.equal(provider.authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(provider.authorizationUrl.searchParams.get('resource'), base + '/mcp');

  // 2) Oturumsuz kullanıcı önce Pusula girişine gönderilir, dönüşte izin adresine geri gelir
  const noSession = await fetch(provider.authorizationUrl, { redirect: 'manual' });
  assert.equal(noSession.status, 302);
  assert.match(noSession.headers.get('location'), /^\/auth\/login\?return_to=%2Foauth%2Fauthorize/);

  // 3) Kullanıcı izin verir; izin ekranı istemcinin adını ve dönüş adresini gösterir
  const cookie = await login(ADMIN);
  const { html, location } = await consent(base, cookie, provider.authorizationUrl);
  assert.match(html, /Claude \(test\)/);
  assert.match(html, /localhost:9999/);
  assert.equal(location.origin + location.pathname, CALLBACK);
  assert.equal(location.searchParams.get('iss'), base);
  await first.finishAuth(location.searchParams.get('code'));
  assert.equal(provider.saved.token_type, 'Bearer');

  // 4) Anahtarla bağlan, araç çağır
  const client = new Client({ name: 't', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(url, { authProvider: provider }));
  const created = JSON.parse((await client.callTool({ name: 'is_olustur', arguments: { baslik: 'OAuth ile açılan iş' } })).content[0].text);
  assert.equal(created.baslik, 'OAuth ile açılan iş');

  // 5) Kod tek kullanımlık; veritabanında anahtarlar açık değil
  const reuse = await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: location.searchParams.get('code'), client_id: provider.client.client_id, redirect_uri: CALLBACK, code_verifier: provider.verifier }) });
  assert.equal((await reuse.json()).error, 'invalid_grant');
  const stored = store.db.prepare('SELECT hash FROM oauth_tokens').all().map((r) => r.hash);
  assert.ok(!stored.includes(provider.saved.access_token) && !stored.includes(provider.saved.refresh_token));

  // 6) Yenileme: yeni anahtar çifti; eski erişim anahtarı kapanır
  const old = provider.saved;
  const refreshed = await (await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: old.refresh_token, client_id: provider.client.client_id }) })).json();
  assert.ok(refreshed.access_token && refreshed.refresh_token !== old.refresh_token);
  const call = (token) => fetch(base + '/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal((await call(old.access_token)).status, 401);
  assert.equal((await call(refreshed.access_token)).status, 200);

  // 7) Bağlı uygulamalar sayfasından kaldırınca anahtar hemen çalışmaz
  const list = await (await fetch(base + '/oauth/baglantilar', { headers: { Cookie: cookie } })).text();
  const grant = list.match(/name="grant" value="([^"]+)"/)[1];
  await fetch(base + '/oauth/baglantilar', { method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant }) });
  assert.equal((await call(refreshed.access_token)).status, 401);
  const audits = store.db.prepare("SELECT action FROM audit WHERE action LIKE 'oauth_%'").all().map((r) => r.action);
  assert.deepEqual(audits, ['oauth_grant', 'oauth_revoke']);
});

test('saldırı denemeleri: yanlış PKCE, yanlış dönüş adresi, başka kaynak, başkasının izin isteği, red', async () => {
  const { base, login, app } = await start();
  const reg = await (await fetch(base + '/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'X', redirect_uris: [CALLBACK] }) })).json();
  assert.equal((await fetch(base + '/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['http://kotu.example/cb'] }) })).status, 400);
  const verifier = 'v'.repeat(50);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authUrl = (over = {}) => `${base}/oauth/authorize?` + new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: CALLBACK, code_challenge: challenge, code_challenge_method: 'S256', state: 's1', ...over });
  const cookie = await login(ADMIN);

  // Kayıtsız dönüş adresi: yönlendirme YAPILMAZ (açık yönlendirmeye karşı)
  const badRedirect = await fetch(authUrl({ redirect_uri: 'https://kotu.example/cb' }), { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(badRedirect.status, 400);
  // PKCE yoksa ya da başka bir kaynak istenirse istemciye hata döner
  const noPkce = await fetch(authUrl({ code_challenge_method: 'plain' }), { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(new URL(noPkce.headers.get('location')).searchParams.get('error'), 'invalid_request');
  const otherResource = await fetch(authUrl({ resource: 'https://baska.example/mcp' }), { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(new URL(otherResource.headers.get('location')).searchParams.get('error'), 'invalid_target');

  // Başka bir kullanıcının izin isteği onaylanamaz
  app.service.post(ADMIN, { action: 'member', id: app.service.get(ADMIN, '').workspaces[0].id, email: ECE, name: 'Ece', department: '', role: 'editor', active: true, originalEmail: '' });
  const izinSayfasi = await fetch(authUrl(), { headers: { Cookie: cookie } });
  // İzin formu gönderildikten sonra dönüş adresine yönlenebilmeli: CSP form-action o kaynağa izin vermeli
  assert.match(izinSayfasi.headers.get('content-security-policy'), /form-action 'self' http:\/\/localhost:9999;/);
  const pageHtml = await izinSayfasi.text();
  const id = pageHtml.match(/name="id" value="([^"]+)"/)[1];
  const eceCookie = await login(ECE);
  const stolen = await fetch(base + '/oauth/authorize', { method: 'POST', redirect: 'manual', headers: { Cookie: eceCookie, Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id, decision: 'allow' }) });
  assert.equal(stolen.status, 400);
  // Başka siteden gelen onay reddedilir
  const crossSite = await fetch(base + '/oauth/authorize', { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: 'https://kotu.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id, decision: 'allow' }) });
  assert.equal(crossSite.status, 403);

  // "Vazgeç": istemciye access_denied
  const denied = await consent(base, cookie, authUrl(), 'deny');
  assert.equal(denied.location.searchParams.get('error'), 'access_denied');
  assert.equal(denied.location.searchParams.get('state'), 's1');

  // Yanlış PKCE doğrulayıcısı
  const { location } = await consent(base, cookie, authUrl());
  const wrong = await (await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: location.searchParams.get('code'), client_id: reg.client_id, redirect_uri: CALLBACK, code_verifier: 'w'.repeat(50) }) })).json();
  assert.equal(wrong.error, 'invalid_grant');
});

test('Pusula\'dan çıkarılan kişinin anahtarı çalışmaz', async () => {
  const { base, login, app } = await start();
  const ws = app.service.get(ADMIN, '').workspaces[0].id;
  app.service.post(ADMIN, { action: 'member', id: ws, email: ECE, name: 'Ece', department: '', role: 'editor', active: true, originalEmail: '' });
  const reg = await (await fetch(base + '/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'X', redirect_uris: [CALLBACK] }) })).json();
  const verifier = 'v'.repeat(50);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = `${base}/oauth/authorize?` + new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: CALLBACK, code_challenge: challenge, code_challenge_method: 'S256' });
  const { location } = await consent(base, await login(ECE), url);
  const tokens = await (await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: location.searchParams.get('code'), client_id: reg.client_id, redirect_uri: CALLBACK, code_verifier: verifier }) })).json();
  app.service.post(ADMIN, { action: 'member', id: ws, email: ECE, name: 'Ece', department: '', role: 'editor', active: false, originalEmail: ECE });
  const r = await fetch(base + '/mcp', { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal(r.status, 403);
});
