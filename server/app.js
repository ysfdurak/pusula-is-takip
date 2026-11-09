// Pusula pilot sunucusu: HTTP katmanı (giriş, oturum, /api/workspace, statik arayüz).
import { createWorkspaceService } from '../src/shared/workspaceService.js';
import { DEFAULT_NOTIFY_POLICY, EMPTY_STATE } from '../src/shared/workspaceModel.js';
import { processOutbox } from './mail/outbox.js';
import { randomToken } from './auth.js';
import { randomUUID } from 'node:crypto';

const MAX_BODY = 2 * 1024 * 1024;
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
 */
export function createApp({ config, store, auth, html, mailer = null, log = () => {} }) {
  const admins = new Set(config.admins);
  const names = new Map(); // oturumdaki görünen adlar (yeni çalışma alanı sahibi için)
  const service = createWorkspaceService({
    load: store.load,
    persist: store.persist,
    newId: randomUUID,
    mailMode: () => (mailer ? 'live' : 'off'),
    profileFor: (email) => ({ email, name: names.get(email) || email.split('@')[0], department: '' }),
    canCreateWorkspace: (email) => admins.has(email),
  });

  bootstrap();

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

  const isMember = (email) => Object.values(store.load().members).some((list) => list.some((m) => m.email === email && m.active));

  /** Girişte, yönetici tarafından eklenmiş üye kaydının adını Microsoft'taki adla tamamlar */
  function syncProfile(email, name) {
    names.set(email, name);
    let changed = false;
    for (const list of Object.values(store.load().members)) {
      for (const m of list) {
        if (m.email === email && name && (!m.name || m.name === email.split('@')[0]) && m.name !== name) {
          m.name = name;
          changed = true;
        }
      }
    }
    if (changed) store.persist();
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
  const safeReturn = (value) => (typeof value === 'string' && /^\/(?!\/)[^\s]*$/.test(value) ? value : '/');

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
    syncProfile(user.email, user.name);
    const id = store.sessions.create(user.email, user.name, config.sessionHours);
    store.audit(user.email, 'login');
    redirect(res, `${basePath}${safeReturn(returnTo)}`, [sessionCookie(id, config.sessionHours * 3600)]);
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
      return redirect(res, auth.authorizeUrl({ state, nonce, verifier }));
    }
    if (path === '/auth/dev' && config.authMode === 'dev') {
      const email = String(url.searchParams.get('email') || '').toLowerCase();
      if (!admins.has(email) && !isMember(email)) return denyNonMember(res, email);
      return startSession(res, { email, name: email.split('@')[0] }, '/');
    }
    if (path === '/auth/callback' && req.method === 'GET' && auth) {
      if (url.searchParams.get('error')) {
        return page(res, 400, 'Giriş tamamlanamadı', url.searchParams.get('error_description') || url.searchParams.get('error'), { href: `${basePath}/auth/login`, text: 'Yeniden dene' });
      }
      const saved = store.loginStates.take(url.searchParams.get('state'));
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
    if (path === '/auth/logout') {
      const id = cookieValue(req);
      if (id) store.sessions.delete(id);
      headers(res, { 'Set-Cookie': sessionCookie('', 0) });
      return page(res, 200, 'Oturum kapatıldı', 'Pusula oturumun kapatıldı.', { href: `${basePath}/auth/login`, text: 'Yeniden giriş yap' });
    }

    // API
    if (path === '/api/workspace') {
      const session = store.sessions.get(cookieValue(req));
      if (!session) return json(res, 401, { error: 'Oturum açman gerekiyor.' });
      const email = session.email;
      if (!admins.has(email) && !isMember(email)) {
        store.sessions.deleteForEmail(email);
        return json(res, 401, { error: 'Pusula erişimin kaldırılmış.' });
      }
      try {
        if (req.method === 'GET') {
          return json(res, 200, service.get(email, url.searchParams.get('id') || '', url.searchParams.get('task') || ''));
        }
        if (req.method !== 'POST') return json(res, 405, { error: 'Yöntem desteklenmiyor.' });
        // Başka sitelerden gelen istekleri reddet (CSRF): kaynak bilgisi varsa uygulama adresiyle aynı olmalı.
        const origin = req.headers.origin;
        if (origin && origin !== appOrigin) return json(res, 403, { error: 'İstek kaynağı reddedildi.' });
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'JSON bekleniyor.' });
        const body = await readJson(req);
        if (body.action === 'flush') {
          const member = store.load().members[body.id]?.find((m) => m.email === email && m.active);
          if (member?.role !== 'owner') return json(res, 403, { error: 'Bu işlemi yalnızca yönetici yapabilir.' });
          const r = await flushMail();
          return json(res, 200, { configured: !!mailer, accepted: r.accepted || 0 });
        }
        const result = service.post(email, body);
        if (['save', 'member', 'policy', 'create'].includes(body.action)) {
          store.audit(email, body.action, body.action === 'member' ? `${body.email} · ${body.role}` : body.reason || body.name || '');
        }
        flushMail();
        return json(res, 200, result);
      } catch (err) {
        if (err.status) return json(res, err.status, { error: err.message });
        const message = String(err.message || 'Beklenmeyen hata');
        const status = message.includes('Kayıt değişti') ? 409 : /erişimin yok|yalnızca|Görüntüleme rolünde/.test(message) ? 403 : 400;
        if (status === 400 && !(err instanceof Error && err.constructor === Error)) log(`API hatası: ${err.stack || message}`);
        return json(res, status, { error: message });
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
    service,
  };
}
