// Pilot sunucusu ayarları (ortam değişkenleri). Örnek: .env.example
import { join, resolve } from 'node:path';

const list = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

export function loadConfig(env = process.env) {
  const errors = [];
  const port = Number(env.PORT || 8080);
  const appUrl = env.APP_URL || `http://localhost:${port}/`;
  let parsed;
  try {
    parsed = new URL(appUrl);
  } catch {
    errors.push('APP_URL geçerli bir adres değil.');
  }
  if (parsed && parsed.pathname !== '/') errors.push('APP_URL alan adının kökü olmalı (örn. https://pusula.sirket.com.tr/); alt klasör desteklenmez.');

  const production = env.NODE_ENV === 'production';
  const authMode = env.AUTH_MODE || 'entra';
  if (!['entra', 'dev'].includes(authMode)) errors.push('AUTH_MODE "entra" ya da "dev" olmalı.');
  const local = parsed && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (authMode === 'dev' && production) errors.push('AUTH_MODE=dev üretimde (NODE_ENV=production) kullanılamaz.');
  if (authMode === 'dev' && parsed && !local) errors.push('AUTH_MODE=dev yalnızca APP_URL localhost iken kullanılabilir.');
  if (parsed && !local && parsed.protocol !== 'https:') errors.push('APP_URL https:// ile başlamalı (yalnızca localhost için http kabul edilir).');

  const entra = {
    tenantId: env.ENTRA_TENANT_ID,
    clientId: env.ENTRA_CLIENT_ID,
    clientSecret: env.ENTRA_CLIENT_SECRET,
    redirectUri: new URL('auth/callback', appUrl).toString(),
  };
  if (authMode === 'entra') for (const k of ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET']) if (!env[k]) errors.push(`${k} eksik.`);

  const mailMode = env.MAIL_MODE || 'off';
  if (!['off', 'outlook'].includes(mailMode)) errors.push('MAIL_MODE "off" ya da "outlook" olmalı.');
  const graph = {
    tenantId: env.GRAPH_TENANT_ID || env.ENTRA_TENANT_ID,
    clientId: env.GRAPH_CLIENT_ID || env.ENTRA_CLIENT_ID,
    clientSecret: env.GRAPH_CLIENT_SECRET || env.ENTRA_CLIENT_SECRET,
    sender: env.MAIL_SENDER,
  };
  if (mailMode === 'outlook' && !graph.sender) errors.push('MAIL_SENDER eksik.');

  // MCP kapısı (/mcp): varsayılan KAPALI. Şirket verisinin yapay zekâ araçlarına bağlanmaması gereken
  // kurulumlarda kapalı bırakılır. Kimlik şimdilik kişisel erişim anahtarıyla doğrulanır:
  // MCP_TOKENS="eposta:anahtar,eposta2:anahtar2" (anahtar en az 32 karakter; üretmek için: openssl rand -hex 32)
  const mcpEnabled = env.MCP_ENABLED === 'true';
  const mcpTokens = new Map();
  for (const pair of String(env.MCP_TOKENS || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const at = pair.lastIndexOf(':');
    const email = pair.slice(0, at).trim().toLowerCase();
    const token = pair.slice(at + 1).trim();
    if (at < 1 || !email.includes('@')) errors.push('MCP_TOKENS biçimi "eposta:anahtar" olmalı.');
    else if (token.length < 32) errors.push(`MCP_TOKENS: ${email} için anahtar en az 32 karakter olmalı.`);
    else if ([...mcpTokens.values()].includes(email) || mcpTokens.has(token)) errors.push('MCP_TOKENS: her kişi ve anahtar bir kez yazılmalı.');
    else mcpTokens.set(token, email);
  }
  if (mcpEnabled && !mcpTokens.size) errors.push('MCP_ENABLED=true iken en az bir MCP_TOKENS kaydı gerekli.');

  const admins = list(env.PUSULA_ADMINS);
  const dataDir = resolve(env.DATA_DIR || './data');
  return {
    errors,
    production,
    host: env.HOST || '0.0.0.0',
    port,
    appUrl: parsed ? parsed.toString() : appUrl,
    authMode,
    entra,
    mailMode,
    graph,
    mailAllowedDomains: list(env.MAIL_ALLOWED_DOMAINS),
    admins,
    mcpEnabled,
    mcpTokens,
    workspaceName: env.PUSULA_WORKSPACE_NAME || 'Pusula',
    dataDir,
    dbFile: join(dataDir, 'pusula.db'),
    backupDir: resolve(env.BACKUP_DIR || join(dataDir, 'backups')),
    backupKeep: Number(env.BACKUP_KEEP || 14),
    sessionHours: Number(env.SESSION_HOURS || 10),
    sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES || 120),
    // Sabah özeti saati (Türkiye saati, 5–11); DIGEST_HOUR=off kapatır
    digestHour: env.DIGEST_HOUR === 'off' ? null : Math.min(Math.max(Number(env.DIGEST_HOUR) || 8, 5), 11),
    maxFileMb: Math.min(Math.max(Number(env.MAX_FILE_MB || 5), 1), 5),
    htmlFile: resolve(env.PUSULA_HTML || new URL('../dist-pilot/index.html', import.meta.url).pathname),
  };
}
