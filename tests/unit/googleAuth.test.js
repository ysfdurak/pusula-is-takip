// Google ile giriş: yetkilendirme adresi ve kimlik belirteci kuralları (server/auth.js → createGoogleAuth)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAuth } from '../../server/auth.js';
import { loadConfig } from '../../server/config.js';

const CLIENT = '123.apps.googleusercontent.com';
const jwt = (claims) => ['{"alg":"RS256"}', JSON.stringify(claims), 'imza'].map((p, i) => (i < 2 ? Buffer.from(p).toString('base64url') : p)).join('.');
const good = (over = {}) => ({ iss: 'https://accounts.google.com', aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n1', sub: '1089', email: 'Ece@Gmail.com', email_verified: true, name: 'Ece Kaya', ...over });

test('yetkilendirme adresi: PKCE, nonce, hesap seçimi; tek alan adı varsa hd', () => {
  const auth = createGoogleAuth({ clientId: CLIENT, clientSecret: 's', redirectUri: 'https://p.example/auth/callback', allowedDomains: ['sirket.com.tr'] });
  const url = new URL(auth.authorizeUrl({ state: 'st', nonce: 'n1', verifier: 'v'.repeat(43) }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('nonce'), 'n1');
  assert.equal(url.searchParams.get('prompt'), 'select_account');
  assert.equal(url.searchParams.get('hd'), 'sirket.com.tr');
});

test('kimlik belirteci: geçerli hesap; doğrulanmamış e-posta, yanlış hedef, nonce ve alan adı reddedilir', () => {
  const auth = createGoogleAuth({ clientId: CLIENT, clientSecret: 's', redirectUri: 'https://p.example/auth/callback' });
  assert.deepEqual(auth.verify(jwt(good()), 'n1'), { email: 'ece@gmail.com', name: 'Ece Kaya', oid: 'google:1089' });
  assert.throws(() => auth.verify(jwt(good({ email_verified: false })), 'n1'), /doğrulanmamış/);
  assert.throws(() => auth.verify(jwt(good({ aud: 'baska' })), 'n1'), /bu uygulama için değil/);
  assert.throws(() => auth.verify(jwt(good({ iss: 'https://kotu.example' })), 'n1'), /tanınmadı/);
  assert.throws(() => auth.verify(jwt(good()), 'n2'), /eşleşmedi/);
  assert.throws(() => auth.verify(jwt(good({ exp: 1 })), 'n1'), /süresi dolmuş/);
  const company = createGoogleAuth({ clientId: CLIENT, clientSecret: 's', redirectUri: 'x', allowedDomains: ['sirket.com.tr'] });
  assert.throws(() => company.verify(jwt(good()), 'n1'), /izin verilen alan/);
  assert.equal(company.verify(jwt(good({ email: 'ece@sirket.com.tr', hd: 'sirket.com.tr' })), 'n1').email, 'ece@sirket.com.tr');
});

test('kod takası: Google token uç noktası, PKCE doğrulayıcısı gönderilir', async () => {
  let sent;
  const auth = createGoogleAuth({ clientId: CLIENT, clientSecret: 's', redirectUri: 'https://p.example/auth/callback',
    fetchImpl: async (url, init) => ((sent = { url, body: new URLSearchParams(init.body) }), { ok: true, json: async () => ({ id_token: 'tok' }) }) });
  assert.equal(await auth.redeem('kod', 'dogrulayici'), 'tok');
  assert.equal(sent.url, 'https://oauth2.googleapis.com/token');
  assert.equal(sent.body.get('code_verifier'), 'dogrulayici');
});

test('ayarlar: AUTH_MODE=google için istemci bilgileri zorunlu', () => {
  const base = { APP_URL: 'https://pusula.example/', AUTH_MODE: 'google', PUSULA_ADMINS: 'a@x.test' };
  assert.match(loadConfig(base).errors.join(), /GOOGLE_CLIENT_ID eksik/);
  const ok = loadConfig({ ...base, GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 's', GOOGLE_ALLOWED_DOMAINS: 'Sirket.com.tr' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.google.redirectUri, 'https://pusula.example/auth/callback');
  assert.deepEqual(ok.google.allowedDomains, ['sirket.com.tr']);
});
