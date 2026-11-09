// Microsoft Entra ID ile giriş: OpenID Connect yetkilendirme kodu akışı + PKCE (gizli istemci).
import { createHash, randomBytes } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
export const randomToken = () => b64url(randomBytes(32));
export const pkceChallenge = (verifier) => b64url(createHash('sha256').update(verifier).digest());

export function createEntraAuth({ tenantId, clientId, clientSecret, redirectUri, fetchImpl = globalThis.fetch }) {
  for (const [k, v] of Object.entries({ tenantId, clientId, clientSecret, redirectUri })) {
    if (!v) throw new Error(`Microsoft girişi için ${k} eksik.`);
  }
  const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0`;

  function authorizeUrl({ state, nonce, verifier }) {
    const url = new URL(`${authority}/authorize`);
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async function redeem(code, verifier) {
    const res = await fetchImpl(`${authority}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        scope: 'openid profile email',
      }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id_token) throw new Error(`Microsoft girişi tamamlanamadı: ${data.error_description || data.error || res.status}`);
    return data.id_token;
  }

  /**
   * Kimlik belirtecini doğrular. Belirteç, istemci kimlik bilgisiyle doğrudan token uç noktasından
   * TLS üzerinden alındığı için imza yerine TLS sunucu doğrulamasına güvenilir (OpenID Connect Core 3.1.3.7, madde 6).
   * Yine de kiracı, hedef kitle, süre ve nonce zorunlu olarak kontrol edilir.
   */
  function verify(idToken, nonce) {
    const parts = String(idToken).split('.');
    if (parts.length !== 3) throw new Error('Geçersiz kimlik belirteci.');
    let claims;
    try {
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new Error('Geçersiz kimlik belirteci.');
    }
    const now = Math.floor(Date.now() / 1000);
    if (claims.tid !== tenantId) throw new Error('Bu Microsoft hesabı şirket dizinine ait değil.');
    if (claims.iss !== `https://login.microsoftonline.com/${tenantId}/v2.0`) throw new Error('Belirteci veren tanınmadı.');
    if (claims.aud !== clientId) throw new Error('Belirteç bu uygulama için değil.');
    if (!claims.exp || claims.exp < now - 60) throw new Error('Oturum belirtecinin süresi dolmuş.');
    if (!nonce || claims.nonce !== nonce) throw new Error('Giriş isteği eşleşmedi; yeniden dene.');
    const email = String(claims.email || claims.preferred_username || '').toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Hesapta e-posta adresi bulunamadı.');
    return { email, name: claims.name || email.split('@')[0] };
  }

  return { authorizeUrl, redeem, verify };
}
