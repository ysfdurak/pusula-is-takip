// Outlook / Exchange Online üzerinden e-posta: Microsoft Graph sendMail (uygulama izni, istemci kimlik bilgisi akışı).
// Gönderici tek bir ortak posta kutusudur (örn. pusula@sirket.com.tr). BT kurulumu: docs/OUTLOOK_BILDIRIMLERI.md
export class MailError extends Error {
  constructor(message, { status = 0, retryable = false, retryAfterMs = 0 } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export function createGraphMailer({ tenantId, clientId, clientSecret, sender, fetchImpl = globalThis.fetch }) {
  for (const [k, v] of Object.entries({ tenantId, clientId, clientSecret, sender })) {
    if (!v) throw new Error(`Outlook gönderimi için ${k} eksik.`);
  }
  let token = null;
  let expiresAt = 0;

  async function getToken(force = false) {
    if (!force && token && Date.now() < expiresAt - 60_000) return token;
    const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new MailError(`Microsoft oturumu alınamadı: ${data.error_description || data.error || res.status}`, { status: res.status });
    }
    token = data.access_token;
    expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    return token;
  }

  async function post(message, accessToken) {
    return fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: false }),
    });
  }

  async function send({ to, subject, html }) {
    const message = {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to } }],
    };
    let res = await post(message, await getToken());
    if (res.status === 401) res = await post(message, await getToken(true)); // süresi dolmuş anahtar
    if (res.status === 202) return { accepted: true };
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.message || `HTTP ${res.status}`;
    const retryAfterMs = Number(res.headers?.get?.('retry-after') || 0) * 1000;
    throw new MailError(`Outlook gönderimi reddetti: ${reason}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
      retryAfterMs,
    });
  }

  return { name: 'Outlook', send };
}
