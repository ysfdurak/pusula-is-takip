// Pusula OAuth yetkilendirme sunucusu: Claude gibi MCP istemcilerinin kullanıcı adına /mcp'ye bağlanması için.
//
// Neden gerekli? claude.ai'deki "özel bağlayıcı" sabit bir anahtar kabul etmez; MCP standardındaki
// OAuth 2.1 akışını bekler. Akış (MCP Authorization, 2025-06-18):
//
//   1) Claude /mcp'ye anahtarsız gider → 401 + "yetkiyi şuradan öğren" (WWW-Authenticate: resource_metadata)
//   2) /.well-known/oauth-protected-resource → "yetkilendirme sunucusu bu adres"
//   3) /.well-known/oauth-authorization-server → uç noktaların listesi
//   4) /oauth/register → Claude kendini istemci olarak kaydeder (Dynamic Client Registration, RFC 7591)
//   5) /oauth/authorize → kullanıcı Pusula'ya NORMAL yoldan girer (Google/Microsoft), izin ekranında "İzin ver"e basar
//   6) /oauth/token → Claude tek kullanımlık kodu, PKCE doğrulayıcısıyla birlikte erişim anahtarına çevirir
//   7) /mcp → Authorization: Bearer <erişim anahtarı>
//
// Güvenlik kararları:
//   - PKCE (S256) zorunlu: kod çalınsa bile doğrulayıcı olmadan kullanılamaz.
//   - Yönlendirme adresi kayıttakiyle birebir aynı olmalı; yalnızca https (ya da localhost).
//   - Anahtarlar veritabanında açık tutulmaz, SHA-256 özetleri saklanır (oturumlarla aynı kural).
//   - Erişim anahtarı 1 saat, yenileme anahtarı 30 gün; her yenilemede yenileme anahtarı değişir (rotation).
//   - Anahtar yalnızca bu sunucunun /mcp adresi için geçerlidir (resource, RFC 8707).
//   - İzin ekranı, onaydan sonra hangi adrese dönüleceğini gösterir: sahte adlı bir istemciyi fark etmek için.
//   - Kişi Pusula'dan çıkarılırsa anahtarı da çalışmaz (/mcp her istekte üyeliği kontrol eder).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ACCESS_TTL = 3600e3;
const REFRESH_TTL = 30 * 864e5;
const CODE_TTL = 10 * 60e3;
const PENDING_TTL = 10 * 60e3;
const MAX_CLIENTS = 500;

const token = () => randomBytes(32).toString('base64url');
const hash = (value) => createHash('sha256').update(String(value)).digest('base64url');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Yönlendirme adresi: https ya da yerel geliştirme (http://localhost, 127.0.0.1); parça (#) yok. */
export function validRedirectUri(value) {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * @param {object} o
 * @param {import('node:sqlite').DatabaseSync} o.db
 * @param {string} o.origin       uygulamanın kök adresi (https://pusula.ysfdurak.com)
 * @param {string} o.basePath
 * @param {(req) => {email: string, name: string}|null} o.session   tarayıcı oturumu (çerez)
 * @param {(email: string) => boolean} o.isAllowed                    Pusula üyesi mi
 * @param {object} o.http         app.js yardımcıları: headers, json, page, redirect, readBody
 * @param {(email, action, detail) => void} o.audit
 * @param {() => number} [o.now]
 */
export function createOAuthServer({ db, origin, basePath = '', session, isAllowed, http, audit, now = () => Date.now() }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_pending (id TEXT PRIMARY KEY, email TEXT NOT NULL, params TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_codes (hash TEXT PRIMARY KEY, client_id TEXT NOT NULL, email TEXT NOT NULL, redirect_uri TEXT NOT NULL,
      challenge TEXT NOT NULL, resource TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_tokens (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, client_id TEXT NOT NULL, email TEXT NOT NULL,
      resource TEXT NOT NULL, grant_id TEXT NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL);
  `);

  const issuer = origin + basePath;
  const resource = issuer + '/mcp';
  const resourceMetadataUrl = issuer + '/.well-known/oauth-protected-resource';
  const { headers, json, page, redirect, readBody } = http;

  // Bu uç noktaları tarayıcıdaki MCP istemcileri (ör. MCP Inspector) de çağırır; çerez kullanılmadığı için herkese açık CORS güvenlidir.
  function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  const oauthError = (res, status, error, description) => json(res, status, { error, error_description: description });

  const getClient = (id) => {
    const row = id ? db.prepare('SELECT id, name, redirect_uris FROM oauth_clients WHERE id = ?').get(String(id)) : null;
    return row ? { id: row.id, name: row.name, redirectUris: JSON.parse(row.redirect_uris) } : null;
  };

  function issueTokens(clientId, email, grantId) {
    const access = token();
    const refresh = token();
    const t = now();
    const insert = db.prepare('INSERT INTO oauth_tokens (hash, kind, client_id, email, resource, grant_id, expires, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insert.run(hash(access), 'access', clientId, email, resource, grantId, t + ACCESS_TTL, t);
    insert.run(hash(refresh), 'refresh', clientId, email, resource, grantId, t + REFRESH_TTL, t);
    return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL / 1000, refresh_token: refresh };
  }

  /** Erişim anahtarını doğrular; geçerliyse kullanıcının e-postası. */
  function verifyAccessToken(value) {
    if (!value) return null;
    const row = db.prepare("SELECT email, client_id, resource, expires FROM oauth_tokens WHERE hash = ? AND kind = 'access'").get(hash(value));
    if (!row || row.expires <= now() || row.resource !== resource) return null;
    return { email: row.email, clientId: row.client_id };
  }

  function purge() {
    const t = now();
    db.prepare('DELETE FROM oauth_tokens WHERE expires <= ?').run(t);
    db.prepare('DELETE FROM oauth_codes WHERE created <= ?').run(t - CODE_TTL);
    db.prepare('DELETE FROM oauth_pending WHERE created <= ?').run(t - PENDING_TTL);
  }

  // --- Uç noktalar -------------------------------------------------------------

  function protectedResourceMetadata(res) {
    cors(res);
    return json(res, 200, { resource, authorization_servers: [issuer], bearer_methods_supported: ['header'], resource_name: 'Pusula' });
  }

  function authorizationServerMetadata(res) {
    cors(res);
    return json(res, 200, {
      issuer,
      authorization_endpoint: issuer + '/oauth/authorize',
      token_endpoint: issuer + '/oauth/token',
      registration_endpoint: issuer + '/oauth/register',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: true,
    });
  }

  /** İstemci kaydı (RFC 7591). Açık kayıt standarttır; asıl koruma kullanıcının izin ekranıdır. */
  async function register(req, res) {
    cors(res);
    let body;
    try {
      body = await readBody(req, 'json');
    } catch {
      return oauthError(res, 400, 'invalid_client_metadata', 'Geçersiz istek gövdesi.');
    }
    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > 5 || !uris.every((u) => typeof u === 'string' && u.length <= 500 && validRedirectUri(u))) {
      return oauthError(res, 400, 'invalid_redirect_uri', 'redirect_uris: 1-5 adet https (ya da localhost) adresi gerekli.');
    }
    if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') {
      return oauthError(res, 400, 'invalid_client_metadata', 'Yalnızca açık istemci (token_endpoint_auth_method: none) desteklenir; PKCE zorunludur.');
    }
    if (db.prepare('SELECT COUNT(*) AS n FROM oauth_clients').get().n >= MAX_CLIENTS) {
      return oauthError(res, 400, 'invalid_client_metadata', 'İstemci kaydı sınırına ulaşıldı.');
    }
    const name = String(body.client_name || 'MCP istemcisi').replace(/[\u0000-\u001f]/g, '').slice(0, 80);
    const id = token();
    db.prepare('INSERT INTO oauth_clients (id, name, redirect_uris, created) VALUES (?, ?, ?, ?)').run(id, name, JSON.stringify(uris), now());
    return json(res, 201, {
      client_id: id,
      client_id_issued_at: Math.floor(now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  }

  /** GET /oauth/authorize: parametreleri doğrula, giriş iste, izin ekranını göster. */
  function authorizeGet(req, res, url) {
    const p = Object.fromEntries(url.searchParams);
    const client = getClient(p.client_id);
    // İstemci ya da yönlendirme adresi geçersizse hiçbir yere yönlendirilmez (açık yönlendirmeye karşı)
    if (!client) return page(res, 400, 'Bağlantı isteği geçersiz', 'Bu uygulama Pusula\'da kayıtlı değil. Bağlantıyı uygulamadan yeniden başlat.');
    if (!client.redirectUris.includes(p.redirect_uri)) return page(res, 400, 'Bağlantı isteği geçersiz', 'Dönüş adresi uygulamanın kaydıyla eşleşmiyor.');
    const fail = (error, description) => {
      const back = new URL(p.redirect_uri);
      back.searchParams.set('error', error);
      back.searchParams.set('error_description', description);
      if (p.state) back.searchParams.set('state', p.state);
      back.searchParams.set('iss', issuer);
      return redirect(res, back.toString());
    };
    if (p.response_type !== 'code') return fail('unsupported_response_type', 'Yalnızca response_type=code desteklenir.');
    if (!p.code_challenge || p.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge)) {
      return fail('invalid_request', 'PKCE (S256) zorunlu.');
    }
    if (p.resource && p.resource.replace(/\/$/, '') !== resource) return fail('invalid_target', 'Bu anahtar yalnızca Pusula MCP adresi için verilebilir.');

    const user = session(req);
    if (!user) return redirect(res, `${basePath}/auth/login?return_to=${encodeURIComponent(url.pathname.slice(basePath.length) + url.search)}`);
    if (!isAllowed(user.email)) return page(res, 403, 'Pusula erişimin yok', `${user.email} hesabı Pusula'ya eklenmemiş. Ekibinin Pusula yöneticisinden seni eklemesini iste.`);

    const id = token();
    const params = { client_id: client.id, redirect_uri: p.redirect_uri, code_challenge: p.code_challenge, state: p.state || '' };
    db.prepare('INSERT INTO oauth_pending (id, email, params, created) VALUES (?, ?, ?, ?)').run(id, user.email, JSON.stringify(params), now());
    const target = new URL(p.redirect_uri).host;
    // form-action, formun gönderildiği adresle birlikte ardından gelen yönlendirmeyi de kapsar (Chrome):
    // onaydan sonra uygulamanın dönüş adresine (ör. claude.ai) gidilebilmesi için o kaynak da izinli olmalı.
    const backOrigin = new URL(p.redirect_uri).origin;
    headers(res, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${backOrigin}; frame-ancestors 'none'`,
    });
    res.statusCode = 200;
    return res.end(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bağlantı izni · Pusula</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f7f8f4;color:#243c33;display:grid;place-items:center;min-height:90vh;margin:0">
<form method="post" action="${basePath}/oauth/authorize" style="max-width:460px;background:#fff;border:1px solid #e6eae1;border-radius:10px;padding:28px;line-height:1.5">
<p style="font-weight:bold;margin:0 0 12px">pusula.</p>
<h1 style="font-size:20px;margin:0 0 8px"><b>${escapeHtml(client.name)}</b> Pusula hesabına bağlanmak istiyor</h1>
<p style="margin:0 0 12px">Hesap: <b>${escapeHtml(user.email)}</b></p>
<p style="margin:0 0 6px">İzin verirsen bu uygulama senin yetkilerinle:</p>
<ul style="margin:0 0 12px;padding-left:20px"><li>görebildiğin işleri, ekip ve proje durumunu okuyabilir,</li><li>iş açabilir; durum, termin, sorumlu ve kontrol listesini değiştirebilir, yorum ekleyebilir.</li></ul>
<p style="margin:0 0 12px">Üye ve rol yönetimi, çalışma kuralları, silme ve ekler <b>yapılamaz</b>.</p>
<p style="margin:0 0 16px;font-size:13px;color:#5d6f66">Onaydan sonra <b>${escapeHtml(target)}</b> adresine döneceksin. Bu adresi tanımıyorsan izin verme.</p>
<input type="hidden" name="id" value="${id}">
<button type="submit" name="decision" value="allow" style="background:#2c6549;color:#fff;border:0;border-radius:6px;padding:10px 18px;font-weight:bold;cursor:pointer">İzin ver</button>
<button type="submit" name="decision" value="deny" style="margin-left:8px;background:transparent;border:1px solid #c9d1c4;border-radius:6px;padding:10px 18px;cursor:pointer">Vazgeç</button>
<p style="margin:16px 0 0;font-size:12px;color:#5d6f66">Bağlantıları <a href="${basePath}/oauth/baglantilar" style="color:#2c6549">Bağlı uygulamalar</a> sayfasından kaldırabilirsin.</p>
</form></body></html>`);
  }

  /** POST /oauth/authorize: kullanıcının kararı. Bekleyen istek oturumdaki kişiye bağlıdır ve tek kullanımlıktır. */
  async function authorizePost(req, res) {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && requestOrigin !== origin) return page(res, 403, 'İstek reddedildi', 'İstek başka bir siteden geldi.');
    const user = session(req);
    if (!user) return page(res, 401, 'Oturum bulunamadı', 'Bağlantıyı uygulamadan yeniden başlat.');
    const form = await readBody(req, 'form');
    const row = db.prepare('SELECT email, params, created FROM oauth_pending WHERE id = ?').get(String(form.id || ''));
    db.prepare('DELETE FROM oauth_pending WHERE id = ?').run(String(form.id || ''));
    if (!row || row.email !== user.email || row.created <= now() - PENDING_TTL) {
      return page(res, 400, 'İzin isteğinin süresi doldu', 'Bağlantıyı uygulamadan yeniden başlat.');
    }
    const p = JSON.parse(row.params);
    const back = new URL(p.redirect_uri);
    if (p.state) back.searchParams.set('state', p.state);
    back.searchParams.set('iss', issuer);
    if (form.decision !== 'allow') {
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('error_description', 'Kullanıcı izin vermedi.');
      return redirect(res, back.toString());
    }
    const code = token();
    db.prepare('INSERT INTO oauth_codes (hash, client_id, email, redirect_uri, challenge, resource, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(hash(code), p.client_id, user.email, p.redirect_uri, p.code_challenge, resource, now());
    audit(user.email, 'oauth_grant', getClient(p.client_id)?.name || p.client_id);
    back.searchParams.set('code', code);
    return redirect(res, back.toString());
  }

  /** POST /oauth/token: kod → anahtar ya da yenileme. */
  async function tokenEndpoint(req, res) {
    cors(res);
    res.setHeader('Pragma', 'no-cache');
    let form;
    try {
      form = await readBody(req, 'form');
    } catch {
      return oauthError(res, 400, 'invalid_request', 'Geçersiz istek gövdesi.');
    }
    const client = getClient(form.client_id);
    if (!client) return oauthError(res, 401, 'invalid_client', 'İstemci tanınmadı.');
    if (form.resource && form.resource.replace(/\/$/, '') !== resource) return oauthError(res, 400, 'invalid_target', 'Geçersiz resource.');

    if (form.grant_type === 'authorization_code') {
      const key = hash(form.code || '');
      const row = db.prepare('SELECT client_id, email, redirect_uri, challenge, created FROM oauth_codes WHERE hash = ?').get(key);
      db.prepare('DELETE FROM oauth_codes WHERE hash = ?').run(key); // tek kullanımlık: başarısız denemede de silinir
      if (!row || row.client_id !== client.id || row.created <= now() - CODE_TTL) return oauthError(res, 400, 'invalid_grant', 'Kod geçersiz ya da süresi dolmuş.');
      if (row.redirect_uri !== form.redirect_uri) return oauthError(res, 400, 'invalid_grant', 'Dönüş adresi eşleşmiyor.');
      const expected = Buffer.from(row.challenge);
      const actual = Buffer.from(createHash('sha256').update(String(form.code_verifier || '')).digest('base64url'));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return oauthError(res, 400, 'invalid_grant', 'PKCE doğrulaması başarısız.');
      if (!isAllowed(row.email)) return oauthError(res, 400, 'invalid_grant', 'Kullanıcının Pusula erişimi yok.');
      return json(res, 200, issueTokens(client.id, row.email, token()));
    }

    if (form.grant_type === 'refresh_token') {
      const key = hash(form.refresh_token || '');
      const row = db.prepare("SELECT client_id, email, grant_id, expires FROM oauth_tokens WHERE hash = ? AND kind = 'refresh'").get(key);
      if (!row || row.client_id !== client.id || row.expires <= now()) return oauthError(res, 400, 'invalid_grant', 'Yenileme anahtarı geçersiz.');
      if (!isAllowed(row.email)) return oauthError(res, 400, 'invalid_grant', 'Kullanıcının Pusula erişimi yok.');
      // Yenileme anahtarı her kullanımda değişir; eski erişim anahtarları da kapanır.
      db.prepare('DELETE FROM oauth_tokens WHERE grant_id = ?').run(row.grant_id);
      return json(res, 200, issueTokens(client.id, row.email, row.grant_id));
    }
    return oauthError(res, 400, 'unsupported_grant_type', 'Desteklenen: authorization_code, refresh_token.');
  }

  /** Bağlı uygulamalar: kullanıcı kendi bağlantılarını görür ve kaldırır. */
  async function connections(req, res) {
    const user = session(req);
    if (!user) return redirect(res, `${basePath}/auth/login?return_to=${encodeURIComponent('/oauth/baglantilar')}`);
    if (req.method === 'POST') {
      const requestOrigin = req.headers.origin;
      if (!requestOrigin || requestOrigin !== origin) return page(res, 403, 'İstek reddedildi', 'İstek başka bir siteden geldi.');
      const form = await readBody(req, 'form');
      const removed = db.prepare('DELETE FROM oauth_tokens WHERE grant_id = ? AND email = ?').run(String(form.grant || ''), user.email);
      if (removed.changes) audit(user.email, 'oauth_revoke', String(form.grant).slice(0, 8));
    }
    const rows = db
      .prepare(
        "SELECT t.grant_id, c.name, MIN(t.created) AS since FROM oauth_tokens t JOIN oauth_clients c ON c.id = t.client_id WHERE t.email = ? AND t.kind = 'refresh' AND t.expires > ? GROUP BY t.grant_id, c.name ORDER BY since DESC",
      )
      .all(user.email, now());
    const list = rows.length
      ? rows
          .map(
            (r) => `<li style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-top:1px solid #eef0ea">
<span><b>${escapeHtml(r.name)}</b><br><small style="color:#5d6f66">Bağlantı: ${new Date(r.since).toLocaleDateString('tr-TR')}</small></span>
<form method="post" action="${basePath}/oauth/baglantilar" style="margin:0"><input type="hidden" name="grant" value="${escapeHtml(r.grant_id)}">
<button type="submit" style="background:transparent;border:1px solid #c9d1c4;border-radius:6px;padding:6px 12px;cursor:pointer">Kaldır</button></form></li>`,
          )
          .join('')
      : '<li style="color:#5d6f66">Bağlı uygulama yok.</li>';
    headers(res, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" });
    res.statusCode = 200;
    return res.end(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bağlı uygulamalar · Pusula</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f7f8f4;color:#243c33;display:grid;place-items:center;min-height:90vh;margin:0">
<main style="width:min(460px,92vw);background:#fff;border:1px solid #e6eae1;border-radius:10px;padding:28px"><p style="font-weight:bold;margin:0 0 12px">pusula.</p>
<h1 style="font-size:20px;margin:0 0 4px">Bağlı uygulamalar</h1><p style="margin:0 0 12px;color:#5d6f66">${escapeHtml(user.email)} hesabına bağlı yapay zekâ uygulamaları. Kaldırdığın uygulama hemen erişimini kaybeder.</p>
<ul style="list-style:none;margin:0;padding:0">${list}</ul><p style="margin:16px 0 0"><a href="${basePath}/" style="color:#2c6549;font-weight:bold">Pusula'ya dön</a></p></main></body></html>`);
  }

  /** app.js'den çağrılır: yol bu modüle aitse işler ve true döner. */
  async function handle(req, res, path, url) {
    if (req.method === 'OPTIONS' && (path.startsWith('/.well-known/oauth-') || ['/oauth/register', '/oauth/token', '/mcp'].includes(path))) {
      cors(res);
      res.statusCode = 204;
      res.end();
      return true;
    }
    if (req.method === 'GET' && (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp')) {
      protectedResourceMetadata(res);
      return true;
    }
    if (req.method === 'GET' && path === '/.well-known/oauth-authorization-server') {
      authorizationServerMetadata(res);
      return true;
    }
    if (req.method === 'POST' && path === '/oauth/register') return register(req, res).then(() => true);
    if (req.method === 'GET' && path === '/oauth/authorize') {
      authorizeGet(req, res, url);
      return true;
    }
    if (req.method === 'POST' && path === '/oauth/authorize') return authorizePost(req, res).then(() => true);
    if (req.method === 'POST' && path === '/oauth/token') return tokenEndpoint(req, res).then(() => true);
    if (path === '/oauth/baglantilar' && ['GET', 'POST'].includes(req.method)) return connections(req, res).then(() => true);
    return false;
  }

  return { handle, verifyAccessToken, purge, resource, resourceMetadataUrl };
}
