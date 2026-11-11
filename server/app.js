// Pusula pilot sunucusu: HTTP katmanı (giriş, oturum, /api/workspace, statik arayüz).
import { createWorkspaceService } from '../src/shared/workspaceService.js';
import { DEFAULT_NOTIFY_POLICY, EMPTY_STATE } from '../src/shared/workspaceModel.js';
import { processOutbox } from './mail/outbox.js';
import { runDigest } from './mail/digest.js';
import { randomToken } from './auth.js';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createMcpHandler } from './mcp.js';

const MAX_BODY = 8 * 1024 * 1024; // 5 MB ek dosya base64 ile ~6,7 MB eder
const COOKIE = 'pusula_sid';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param {object} o
 * @param {object} o.config     server/config.js çıktısı
 * @param {object} o.store      server/store.js
 * @param {object|null} o.auth  server/auth.js (Entra); dev modunda null
 * @param {Buffer} o.html       dist-pilot/index.html
 * @param {object|null} o.mailer
 * @param {(msg: string) => void} [o.log]
 * @param {string|null} [o.boardHtml]  MCP App sayfası (dist-mcp-app/panom.html)
 */
export function createApp({ config, store, auth, html, mailer = null, log = () => {}, boardHtml = null }) {
  const admins = new Set(config.admins);
  const names = new Map(); // oturumdaki görünen adlar (yeni çalışma alanı sahibi için)
  const service = createWorkspaceService({
    load: store.load,
    persist: store.persist,
    newId: randomUUID,
    mailMode: () => (mailer ? 'live' : 'off'),
    profileFor: (email) => ({ email, name: names.get(email) || email.split('@')[0], department: '' }),
    canCreateWorkspace: (email) => admins.has(email),
    blobs: store.blobs,
    maxFileBytes: config.maxFileMb * 1024 * 1024,
  });

  bootstrap();
  syncAdmins();

  // MCP kapısı: aynı servisi (aynı kurallar, aynı veri) kullanır; yalnızca kimlik doğrulama farklıdır.
  const mcp = config.mcpEnabled
    ? createMcpHandler({
        service,
        newId: randomUUID,
        audit: (email, action, detail) => store.audit(email, action, detail),
        afterWrite: () => flushMail(),
        log,
        boardHtml,
      })
    : null;
  // Anahtarlar özetleriyle (SHA-256) sabit sürede karşılaştırılır: zamanlama ile tahmin edilemez.
  const digestOf = (value) => createHash('sha256').update(value).digest();
  const mcpKeys = [...(config.mcpTokens || new Map())].map(([token, email]) => ({ hash: digestOf(token), email }));
  function mcpUser(req) {
    const m = String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
    if (!m) return null;
    const hash = digestOf(m[1]);
    return mcpKeys.find((k) => timingSafeEqual(k.hash, hash))?.email || null;
  }

  /** İlk kurulum: hiç çalışma alanı yoksa yöneticiler için bir tane oluşturulur. */
  function bootstrap() {
    const data = store.load();
    if (data.workspaces.length || !admins.size) return;
    const id = randomUUID();
    data.workspaces.push({ id, name: config.workspaceName });
    data.members[id] = [...admins].map((email) => ({ email, name: email.split('@')[0], department: '', role: 'owner', active: 1, mail_enabled: 1, notify_self: 0 }));
    data.states[id] = structuredClone(EMPTY_STATE);
    data.revisions[id] = 0;
    data.policies[id] = { ...DEFAULT_NOTIFY_POLICY };
    store.persist();
    store.audit('system', 'bootstrap', `${config.workspaceName} · ${[...admins].join(', ')}`);
    log(`İlk çalışma alanı oluşturuldu: ${config.workspaceName} (${[...admins].join(', ')})`);
  }

  /**
   * Yönetici (owner) rolünü PUSULA_ADMINS belirler: listede olmayan yöneticiler ekip üyesine düşürülür.
   * Bir çalışma alanı yöneticisiz kalacaksa düşürme yapılmaz.
   */
  function syncAdmins() {
    if (!admins.size) return;
    const data = store.load();
    for (const [wsId, list] of Object.entries(data.members)) {
      const extra = list.filter((m) => m.role === 'owner' && !admins.has(m.email));
      const remaining = list.filter((m) => m.role === 'owner' && m.active && admins.has(m.email));
      if (!extra.length) continue;
      if (!remaining.length) {
        log(`Uyarı: ${wsId} çalışma alanında PUSULA_ADMINS listesinden yönetici yok; yöneticiler değiştirilmedi.`);
        continue;
      }
      for (const m of extra) {
        m.role = 'editor';
        store.audit('system', 'owner_removed', `${wsId} · ${m.email}`);
        log(`${m.email} artık yönetici değil (PUSULA_ADMINS).`);
      }
    }
    store.persist();
  }

  const isMember = (email) => Object.values(store.load().members).some((list) => list.some((m) => m.email === email && m.active));

  /**
   * Girişte üye kaydını Microsoft hesabına bağlar ve adını tamamlar.
   * İlk girişte hesabın değişmeyen kimliği (oid) kaydedilir; sonraki girişlerde aynı adresi taşıyan
   * başka bir hesap (örneğin yeniden kullanılan bir adres) reddedilir.
   * @returns {boolean} hesap eşleşiyorsa true
   */
  function bindAccount(user) {
    const memberships = Object.values(store.load().members).flatMap((list) => list.filter((m) => m.email === user.email));
    if (memberships.some((m) => m.oid && user.oid && m.oid !== user.oid)) return false;
    names.set(user.email, user.name);
    for (const m of memberships) {
      if (user.oid && !m.oid) m.oid = user.oid;
      if (user.name && (!m.name || m.name === user.email.split('@')[0])) m.name = user.name;
    }
    store.persist();
    return true;
  }

  // --- E-posta kuyruğu -----------------------------------------------------
  let sending = Promise.resolve({ accepted: 0 });
  function flushMail() {
    if (!mailer) return Promise.resolve({ accepted: 0, failed: 0, retry: 0 });
    sending = sending
      .catch(() => {})
      .then(() => processOutbox({ pending: service.pendingMail, mark: service.markMail, mailer, appUrl: config.appUrl, allowedDomains: config.mailAllowedDomains }))
      .then((r) => {
        if (r.accepted || r.failed || r.retry) log(`E-posta: ${r.accepted} gönderildi, ${r.failed} başarısız, ${r.retry} yeniden denenecek`);
        return r;
      })
      .catch((err) => {
        log(`E-posta kuyruğu hatası: ${err.message}`);
        return { accepted: 0, failed: 0, retry: 0 };
      });
    return sending;
  }

  /** Sabah özeti; aynı gün aynı kişiye ikinci kez gitmez (sunucu saatlik/5 dakikalık çağırır) */
  function sendDigest(now = Date.now()) {
    if (!mailer || config.digestHour === null) return Promise.resolve({ sent: 0, skipped: 0, failed: 0 });
    sending = sending
      .catch(() => {})
      .then(() => runDigest({ load: store.load, persist: store.persist, mailer, appUrl: config.appUrl, hour: config.digestHour, allowedDomains: config.mailAllowedDomains, now, log }))
      .then((r) => {
        if (r.sent || r.failed) log(`Sabah özeti: ${r.sent} gönderildi, ${r.failed} başarısız`);
        return r;
      })
      .catch((err) => {
        log(`Sabah özeti hatası: ${err.message}`);
        return { sent: 0, skipped: 0, failed: 0 };
      });
    return sending;
  }

  // --- Yardımcılar -----------------------------------------------------------
  const secure = config.appUrl.startsWith('https://');
  const appOrigin = new URL(config.appUrl).origin;
  const basePath = new URL(config.appUrl).pathname.replace(/\/$/, '');

  function headers(res, extra = {}) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  }
  function json(res, status, body) {
    headers(res, { 'Content-Type': 'application/json; charset=utf-8' });
    res.statusCode = status;
    res.end(JSON.stringify(body));
  }
  function page(res, status, title, message, link = null) {
    headers(res, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
    res.statusCode = status;
    res.end(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Pusula</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f7f8f4;color:#243c33;display:grid;place-items:center;min-height:90vh;margin:0">
<main style="max-width:460px;background:#fff;border:1px solid #e6eae1;border-radius:10px;padding:28px"><p style="font-weight:bold;margin:0 0 12px">pusula.</p>
<h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1><p style="line-height:1.5">${escapeHtml(message)}</p>
${link ? `<p><a href="${escapeHtml(link.href)}" style="color:#2c6549;font-weight:bold">${escapeHtml(link.text)}</a></p>` : ''}</main></body></html>`);
  }
  function redirect(res, location, cookies = []) {
    headers(res);
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.statusCode = 302;
    res.setHeader('Location', location);
    res.end();
  }
  const cookieValue = (req) => {
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    return m ? m[1] : null;
  };
  const sessionCookie = (id, maxAgeSec) =>
    `${COOKIE}=${id}; Path=${basePath || '/'}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
  /** Girişten sonra dönülecek yol: yalnızca uygulama içindeki göreli yollar (açık yönlendirmeye karşı) */
  const safeReturn = (value) => {
    if (typeof value !== 'string' || !/^\/[A-Za-z0-9\-._~/?=&%#]*$/.test(value) || value.startsWith('//')) return '/';
    try {
      return new URL(value, appOrigin).origin === appOrigin ? value : '/';
    } catch {
      return '/';
    }
  };
  const LOGIN_COOKIE = 'pusula_login';
  const loginCookie = (state, maxAgeSec) => `${LOGIN_COOKIE}=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
  const readCookie = (req, name) => {
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? m[1] : null;
  };

  async function readJson(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw Object.assign(new Error('İstek çok büyük.'), { status: 413 });
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      throw Object.assign(new Error('Geçersiz istek.'), { status: 400 });
    }
  }

  function startSession(res, user, returnTo) {
    if (!bindAccount(user)) {
      store.audit(user.email, 'login_denied', 'hesap kimliği eşleşmedi');
      return page(res, 403, 'Hesap eşleşmedi', `${user.email} adresi Pusula'da başka bir Microsoft hesabına bağlı. Pusula yöneticine başvur.`);
    }
    const id = store.sessions.create(user.email, user.name, config.sessionHours);
    store.audit(user.email, 'login');
    redirect(res, `${basePath}${safeReturn(returnTo)}`, [sessionCookie(id, config.sessionHours * 3600), loginCookie('', 0)]);
  }

  function denyNonMember(res, email) {
    store.audit(email, 'login_denied');
    page(res, 403, 'Pusula erişimin yok', `${email} hesabı henüz Pusula'ya eklenmemiş. Ekibinin Pusula yöneticisinden seni eklemesini iste.`, { href: `${basePath}/auth/logout`, text: 'Başka hesapla dene' });
  }

  // --- İstek yönlendirme -----------------------------------------------------
  async function handle(req, res) {
    const url = new URL(req.url, appOrigin);
    let path = url.pathname;
    if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length) || '/';

    if (path === '/healthz') return json(res, 200, { ok: true });

    // Giriş
    if (path === '/auth/login' && req.method === 'GET') {
      if (config.authMode === 'dev') {
        return page(res, 200, 'Geliştirme girişi', 'Bu sunucu geliştirme modunda. Microsoft girişi yerine aşağıdaki adreslerden biriyle girebilirsin: ' +
          [...new Set([...admins, ...Object.values(store.load().members).flat().map((m) => m.email)])].join(', '),
          { href: `${basePath}/auth/dev?email=${encodeURIComponent([...admins][0] || '')}`, text: `${[...admins][0] || ''} olarak gir` });
      }
      const state = randomToken();
      const nonce = randomToken();
      const verifier = randomToken();
      store.loginStates.save(state, nonce, verifier, safeReturn(url.searchParams.get('return_to')));
      // state bu tarayıcıya bağlanır: başkasının giriş bağlantısıyla oturum açtırılamaz (giriş CSRF'i)
      return redirect(res, auth.authorizeUrl({ state, nonce, verifier }), [loginCookie(state, 600)]);
    }
    if (path === '/auth/dev' && config.authMode === 'dev') {
      const email = String(url.searchParams.get('email') || '').toLowerCase();
      if (!admins.has(email) && !isMember(email)) return denyNonMember(res, email);
      return startSession(res, { email, name: email.split('@')[0], oid: '' }, '/');
    }
    if (path === '/auth/callback' && req.method === 'GET' && auth) {
      if (url.searchParams.get('error')) {
        return page(res, 400, 'Giriş tamamlanamadı', url.searchParams.get('error_description') || url.searchParams.get('error'), { href: `${basePath}/auth/login`, text: 'Yeniden dene' });
      }
      const state = url.searchParams.get('state');
      const saved = state && readCookie(req, LOGIN_COOKIE) === state ? store.loginStates.take(state) : null;
      if (!saved) return page(res, 400, 'Giriş süresi doldu', 'Giriş isteği bulunamadı ya da 10 dakikadan eski. Yeniden giriş yap.', { href: `${basePath}/auth/login`, text: 'Giriş yap' });
      try {
        const idToken = await auth.redeem(url.searchParams.get('code'), saved.verifier);
        const user = auth.verify(idToken, saved.nonce);
        if (!admins.has(user.email) && !isMember(user.email)) return denyNonMember(res, user.email);
        return startSession(res, user, saved.return_to);
      } catch (err) {
        log(`Giriş hatası: ${err.message}`);
        return page(res, 400, 'Giriş tamamlanamadı', err.message, { href: `${basePath}/auth/login`, text: 'Yeniden dene' });
      }
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin && origin !== appOrigin) return page(res, 403, 'İstek reddedildi', 'Oturum kapatma isteği başka bir siteden geldi.');
      const id = cookieValue(req);
      if (id) store.sessions.delete(id);
      headers(res, { 'Set-Cookie': sessionCookie('', 0) });
      return page(res, 200, 'Oturum kapatıldı', 'Pusula oturumun kapatıldı.', { href: `${basePath}/auth/login`, text: 'Yeniden giriş yap' });
    }
    if (path === '/auth/logout') {
      // Bağlantıyla (GET) oturum kapatılmaz; onay formu gösterilir.
      headers(res, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'" });
      res.statusCode = 200;
      return res.end(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Oturumu kapat · Pusula</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f7f8f4;color:#243c33;display:grid;place-items:center;min-height:90vh;margin:0">
<form method="post" action="${basePath}/auth/logout" style="max-width:420px;background:#fff;border:1px solid #e6eae1;border-radius:10px;padding:28px">
<p style="font-weight:bold;margin:0 0 12px">pusula.</p><h1 style="font-size:20px;margin:0 0 16px">Oturumu kapatmak istiyor musun?</h1>
<button type="submit" style="background:#2c6549;color:#fff;border:0;border-radius:6px;padding:10px 18px;font-weight:bold;cursor:pointer">Oturumu kapat</button>
<a href="${basePath}/" style="margin-left:12px;color:#2c6549">Vazgeç</a></form></body></html>`);
    }

    // API
    if (path === '/api/workspace') {
      const session = store.sessions.get(cookieValue(req), config.sessionIdleMinutes);
      if (!session) return json(res, 401, { error: 'Oturum açman gerekiyor.' });
      const email = session.email;
      if (!admins.has(email) && !isMember(email)) {
        store.sessions.deleteForEmail(email);
        return json(res, 401, { error: 'Pusula erişimin kaldırılmış.' });
      }
      try {
        if (req.method === 'GET') {
          return json(res, 200, service.get(email, url.searchParams.get('id') || '', url.searchParams.get('task') || '', url.searchParams.get('file') || ''));
        }
        if (req.method !== 'POST') return json(res, 405, { error: 'Yöntem desteklenmiyor.' });
        // Başka sitelerden gelen istekleri reddet (CSRF): kaynak bilgisi varsa uygulama adresiyle aynı olmalı.
        const origin = req.headers.origin;
        const fetchSite = req.headers['sec-fetch-site'];
        if (origin ? origin !== appOrigin : fetchSite && fetchSite !== 'same-origin') {
          return json(res, 403, { error: 'İstek kaynağı reddedildi.' });
        }
        if (!origin && !fetchSite) return json(res, 403, { error: 'İstek kaynağı belirtilmemiş.' });
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'JSON bekleniyor.' });
        const body = await readJson(req);
        if (body.action === 'flush') {
          const member = store.load().members[body.id]?.find((m) => m.email === email && m.active);
          if (member?.role !== 'owner') return json(res, 403, { error: 'Bu işlemi yalnızca yönetici yapabilir.' });
          const r = await flushMail();
          return json(res, 200, { configured: !!mailer, accepted: r.accepted || 0 });
        }
        const result = service.post(email, body);
        if (['save', 'member', 'policy', 'create', 'attach', 'detach'].includes(body.action)) {
          store.audit(email, body.action, body.action === 'member' ? `${body.email} · ${body.role}` : body.action === 'detach' ? body.file : body.reason || body.name || '');
        }
        flushMail();
        return json(res, 200, result);
      } catch (err) {
        if (err.status) return json(res, err.status, { error: err.message });
        // Servisin kendi iş kuralı hataları (Error) kullanıcıya gösterilir; beklenmeyenler (TypeError, şema hatası…) gösterilmez.
        if (!(err instanceof Error) || err.constructor !== Error) {
          log(`API hatası: ${err?.stack || err}`);
          return json(res, 400, { error: 'İstek işlenemedi.' });
        }
        const message = err.message;
        const status = message.includes('Kayıt değişti') ? 409 : /erişimin yok|yalnızca|Görüntüleme rolünde/.test(message) ? 403 : 400;
        return json(res, status, { error: message });
      }
    }

    // MCP kapısı
    if (path === '/mcp') {
      if (!mcp) return json(res, 404, { error: 'MCP kapısı bu kurulumda kapalı.' });
      // Tarayıcıdan gelen istekler yalnızca uygulamanın kendi adresinden kabul edilir (DNS rebinding'e karşı).
      const origin = req.headers.origin;
      if (origin && origin !== appOrigin) return json(res, 403, { error: 'İstek kaynağı reddedildi.' });
      const email = mcpUser(req);
      if (!email) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        return json(res, 401, { error: 'Geçerli bir MCP erişim anahtarı gerekli.' });
      }
      if (!admins.has(email) && !isMember(email)) return json(res, 403, { error: 'Pusula erişimin kaldırılmış.' });
      // Durumsuz (stateless) çalışır: yalnızca POST. Sunucudan istemciye akış (GET) ve oturum kapatma (DELETE) yok.
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Yöntem desteklenmiyor.' });
      }
      try {
        const body = await readJson(req);
        return await mcp.handle(req, res, email, body);
      } catch (err) {
        if (err.status) return json(res, err.status, { error: err.message });
        throw err;
      }
    }

    // Arayüz (tek dosya)
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      headers(res, { 'Content-Type': 'text/html; charset=utf-8' });
      res.statusCode = 200;
      return res.end(html);
    }
    return page(res, 404, 'Sayfa bulunamadı', 'Aradığın sayfa yok.', { href: `${basePath}/`, text: "Pusula'ya dön" });
  }

  return {
    handle: (req, res) =>
      handle(req, res).catch((err) => {
        log(`Sunucu hatası: ${err.stack || err.message}`);
        if (!res.headersSent) json(res, 500, { error: 'Sunucu hatası.' });
      }),
    flushMail,
    sendDigest,
    service,
  };
}
