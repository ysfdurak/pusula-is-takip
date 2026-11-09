import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Varsayılan: tek dosyalı tasarım demosu (index.html, tarayıcı içi örnek veri).
// --pilot: aynı arayüzü sunucu moduna alır ve pilot/index.html üretir.
//   - Uygulama /api/workspace uç noktasıyla konuşur (GET/POST, 401 oturum, 409 çakışma).
//   - CSP connect-src 'self' olur; yalnızca aynı alan adındaki API'ye istek atılabilir.
//   Sunucu bu depoda yoktur; bkz. docs/PILOT_IHTIYACLARI.md.
const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const pilot = process.argv.includes('--pilot');

let js = read('src/app.bundle.js');
let template = read('src/index.template.html');

if (pilot) {
  const demoMount = '.render((0,q.jsx)(Yr,{demo:!0}))';
  if (!js.includes(demoMount)) throw new Error('Demo bayrağı pakette bulunamadı; app.bundle.js değişmiş olabilir.');
  js = js.replace(demoMount, '.render((0,q.jsx)(Yr,{demo:!1}))');
  // Özgün paket ChatGPT ile girişe yönlendiriyor; pilotta şirket hesabıyla giriş (SSO) kullanılır.
  const signIn = 'href:`/signin-with-chatgpt?return_to=%2F`,target:`_top`,children:[`ChatGPT ile devam et `';
  if (!js.includes(signIn)) throw new Error('Giriş bağlantısı pakette bulunamadı.');
  js = js.replace(signIn, 'href:`/auth/login?return_to=%2F`,target:`_top`,children:[`Şirket hesabınla giriş yap `');
  if (!template.includes("connect-src 'none'")) throw new Error("CSP connect-src 'none' bulunamadı.");
  template = template
    .replace("connect-src 'none'", "connect-src 'self'")
    .replace('İnternetsiz Tasarım Demosu', 'Pilot');
}

const html = template
  .replace('__PUSULA_CSS__', () => read('src/styles.css'))
  .replace('__PUSULA_JS__', () => js);
if (html.includes('__PUSULA_CSS__') || html.includes('__PUSULA_JS__')) throw new Error('Unresolved template placeholder');

if (pilot) {
  mkdirSync(resolve(root, 'pilot'), { recursive: true });
  writeFileSync(resolve(root, 'pilot/index.html'), html, 'utf8');
  console.log('Built pilot/index.html (server mode, needs /api/workspace)');
} else {
  writeFileSync(resolve(root, 'index.html'), html, 'utf8');
  console.log('Built index.html from src/');
}
