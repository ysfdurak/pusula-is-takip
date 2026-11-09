// YALNIZCA GELİŞTİRME İÇİN: pilot derlemesini (dist-pilot/index.html) yerelde /api/workspace ile çalıştırır.
// Veriler bellektedir ve sunucu kapanınca silinir. Giriş, yetki doğrulaması ve HTTPS yoktur;
// gerçek kullanıcılar veya şirket verisi için kullanmayın. Bkz. docs/PILOT_IHTIYACLARI.md
//
//   npm run build:pilot && npm run dev:api        → http://127.0.0.1:5174
//   Örnek kullanıcıyı değiştirmek için: http://127.0.0.1:5174/?as=ece@example.test
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { demoGet, demoPost, setDemoActor } from '../src/demo/demoServer.js';

const port = Number(process.env.PORT || 5174);
const htmlPath = new URL('../dist-pilot/index.html', import.meta.url);
if (!existsSync(htmlPath)) {
  console.error('Önce pilot derlemesini üretin: npm run build:pilot');
  process.exit(1);
}
const html = readFileSync(htmlPath);

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
      return json(200, demoPost(JSON.parse(raw || '{}')));
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
}).listen(port, '127.0.0.1', () => console.log(`Pusula pilot (geliştirme) → http://127.0.0.1:${port}`));
