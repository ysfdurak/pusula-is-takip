// Pusula pilot sunucusu — başlatma.  Kullanım: npm start   (ayarlar: .env.example, docs/PILOT_KURULUM.md)
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import { openStore } from './store.js';
import { createEntraAuth, createGoogleAuth } from './auth.js';
import { createGraphMailer } from './mail/graphMailer.js';
import { createApp } from './app.js';

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const config = loadConfig();
if (config.errors.length) {
  console.error('Pusula başlatılamadı, ayarları kontrol et:\n - ' + config.errors.join('\n - '));
  process.exit(1);
}
if (!existsSync(config.htmlFile)) {
  console.error(`Arayüz bulunamadı: ${config.htmlFile}\nÖnce "npm run build:pilot" çalıştır.`);
  process.exit(1);
}
if (!config.admins.length) log('Uyarı: PUSULA_ADMINS boş. İlk çalışma alanı oluşturulmaz ve kimse giriş yapamaz.');
if (config.demoMode) log(`Ziyaretçi demo alanları AÇIK: üye olmayan herkes ${config.demoTtlDays} günlük örnek alan alır (en fazla ${config.demoMax}).`);
if (config.authMode === 'dev') log('UYARI: AUTH_MODE=dev — gerçek giriş (Microsoft/Google) KAPALI. Yalnızca kendi bilgisayarında deneme için.');

mkdirSync(config.dataDir, { recursive: true });
const store = openStore(config.dbFile);
const auth = config.authMode === 'entra' ? createEntraAuth(config.entra) : config.authMode === 'google' ? createGoogleAuth(config.google) : null;
const mailer = config.mailMode === 'outlook' ? createGraphMailer(config.graph) : null;
let boardHtml = null;
if (config.mcpEnabled) {
  if (existsSync(config.boardHtmlFile)) boardHtml = readFileSync(config.boardHtmlFile, 'utf8');
  else log(`Uyarı: MCP pano arayüzü bulunamadı (${config.boardHtmlFile}). "npm run build:mcp-app" çalıştır; o zamana kadar pano metin olarak döner.`);
}
const app = createApp({ config, store, auth, html: readFileSync(config.htmlFile), mailer, log, boardHtml });

app.cleanupDemo(); // açılışta süresi dolmuş demo alanları

const timers = [
  setInterval(() => app.flushMail(), 30_000),
  setInterval(() => app.sendDigest(), 5 * 60_000),
  setInterval(() => (store.sessions.purge(), app.purgeOAuth(), app.cleanupDemo(), app.purgeAnalytics()), 3600e3),
  setInterval(() => {
    try {
      log(`Yedek alındı: ${store.backup(config.backupDir, config.backupKeep)}`);
    } catch (err) {
      log(`Yedek alınamadı: ${err.message}`);
    }
  }, 24 * 3600e3),
];
timers.forEach((t) => t.unref());

const server = createServer(app.handle);
server.listen(config.port, config.host, () => {
  log(`Pusula pilot sunucusu: ${config.appUrl} (dinlenen ${config.host}:${config.port}) · giriş: ${config.authMode} · e-posta: ${config.mailMode}`);
  try {
    log(`Açılış yedeği: ${store.backup(config.backupDir, config.backupKeep)}`);
  } catch (err) {
    log(`Yedek alınamadı: ${err.message}`);
  }
});

function shutdown(signal) {
  log(`${signal} alındı, kapanıyor…`);
  server.close(() => {
    store.persist();
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
