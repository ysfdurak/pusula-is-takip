// YALNIZCA GELİŞTİRME İÇİN: pilot derlemesini (dist-pilot/index.html) yerelde /api/workspace ile çalıştırır.
// Veriler bellektedir ve sunucu kapanınca silinir. Giriş, yetki doğrulaması ve HTTPS yoktur;
// gerçek kullanıcılar veya şirket verisi için kullanmayın. Bkz. docs/PILOT_IHTIYACLARI.md
//
//   npm run build:pilot && npm run dev:api        → http://127.0.0.1:5174
//   Örnek kullanıcıyı değiştirmek için: http://127.0.0.1:5174/?as=ece@example.test
//
// E-posta (MAIL_MODE):
//   preview (varsayılan) → e-postalar tmp/mail-preview/ klasörüne HTML olarak yazılır
//   outlook              → Microsoft Graph ile gerçekten gönderilir (docs/OUTLOOK_BILDIRIMLERI.md)
//   off                  → e-posta yok; bildirimler "bağlantı bekliyor" görünür
// MAIL_ALLOWED_DOMAINS=sirket.com.tr → yalnızca bu alan adlarına gönder (virgülle birden fazla)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { configureDemoMail, demoGet, demoPost, markMail, pendingMail, setDemoActor } from '../src/demo/demoServer.js';
import { processOutbox } from '../server/mail/outbox.js';
import { createGraphMailer } from '../server/mail/graphMailer.js';
import { createPreviewMailer } from '../server/mail/previewMailer.js';

const port = Number(process.env.PORT || 5174);
const appUrl = process.env.APP_URL || `http://127.0.0.1:${port}/`;
const htmlPath = new URL('../dist-pilot/index.html', import.meta.url);
if (!existsSync(htmlPath)) {
  console.error('Önce pilot derlemesini üretin: npm run build:pilot');
  process.exit(1);
}
const html = readFileSync(htmlPath);

const mode = process.env.MAIL_MODE || 'preview';
const allowedDomains = (process.env.MAIL_ALLOWED_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
let mailer = null;
if (mode === 'outlook') {
  mailer = createGraphMailer({
    tenantId: process.env.GRAPH_TENANT_ID,
    clientId: process.env.GRAPH_CLIENT_ID,
    clientSecret: process.env.GRAPH_CLIENT_SECRET,
    sender: process.env.MAIL_SENDER,
  });
} else if (mode === 'preview') {
  mailer = createPreviewMailer(new URL('../tmp/mail-preview/', import.meta.url).pathname);
}
configureDemoMail(mailer ? 'live' : 'off');

let sending = Promise.resolve();
const flush = () => {
  if (!mailer) return Promise.resolve({ accepted: 0 });
  // Gönderimler sırayla işlenir; aynı bildirim iki kez gönderilmez.
  sending = sending.then(() => processOutbox({ pending: pendingMail, mark: markMail, mailer, appUrl, allowedDomains }));
  return sending.then((r) => {
    if (r.accepted || r.failed || r.retry) console.log(`E-posta: ${r.accepted} gönderildi, ${r.failed} başarısız, ${r.retry} yeniden denenecek`);
    return r;
  }, (err) => { console.error('E-posta kuyruğu hatası:', err.message); return { accepted: 0 }; });
};
setInterval(flush, 30_000).unref();

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/api/workspace') {
    try {
      if (req.method === 'GET') return json(200, demoGet(url.searchParams.get('id') || '', url.searchParams.get('task') || ''));
      if (req.method !== 'POST') return json(405, { error: 'Yöntem desteklenmiyor.' });
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw || '{}');
      if (body.action === 'flush') {
        const r = await flush();
        return json(200, { configured: !!mailer, accepted: r.accepted || 0 });
      }
      const result = demoPost(body);
      flush(); // yanıtı bekletmeden arka planda gönder
      return json(200, result);
    } catch (err) {
      // Arayüz 409'u çakışma ekranına, diğer hataları mesaj olarak gösterir.
      return json(String(err.message).includes('Kayıt değişti') ? 409 : 400, { error: err.message });
    }
  }
  if (url.pathname === '/auth/login') {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  if (url.searchParams.has('as')) {
    try { setDemoActor(url.searchParams.get('as')); } catch (err) { return json(400, { error: err.message }); }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(port, '127.0.0.1', () =>
  console.log(`Pusula pilot (geliştirme) → ${appUrl}  ·  e-posta: ${mode}${mode === 'preview' ? ' (tmp/mail-preview/)' : ''}`),
);
