// Gerçek proje geçmişini (src/shared/portfolio.json) kendi hesabına ayrı bir çalışma alanı olarak yükler.
// Yalnızca bu e-posta adresi alanın üyesi (yöneticisi) olur; başka kimse göremez.
//
// Sunucu ÇALIŞIRKEN çalıştırma: sunucu veriyi bellekte tutar ve kendi kaydıyla bu alanı silebilir. Sunucuda:
//   cd ~/pusula-is-takip/deploy
//   sudo docker compose -f docker-compose.ortak.yml stop pusula
//   sudo docker compose -f docker-compose.ortak.yml run --rm pusula node server/portfoy-yukle.js eposta@ornek.com "Ad Soyad"
//   sudo docker compose -f docker-compose.ortak.yml start pusula
//
// Aynı adla alan zaten varsa dokunmaz. Yeniden yüklemek için sona --yenile ekle (alanın işleri portfolio.json'daki hâline döner).
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { openStore } from './store.js';
import { DEFAULT_NOTIFY_POLICY } from '../src/shared/workspaceModel.js';
import { PORTFOLIO_NAME, portfolioState } from '../src/shared/portfolioData.js';

export function loadPortfolio(store, email, name = '', { refresh = false } = {}) {
  email = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Geçerli bir e-posta adresi gerekli.');
  const data = store.load();
  const existing = data.workspaces.find(
    (w) => !w.demo && w.name === PORTFOLIO_NAME && (data.members[w.id] || []).some((m) => m.email === email),
  );
  const state = portfolioState({ owner: email, manager: email });
  if (existing && !refresh) return { id: existing.id, created: false, refreshed: false };
  if (existing) {
    data.states[existing.id] = state;
    data.revisions[existing.id] = (data.revisions[existing.id] || 0) + 1;
    store.persist();
    store.audit(email, 'portfolio_refreshed', existing.id);
    return { id: existing.id, created: false, refreshed: true };
  }
  const id = randomUUID();
  data.workspaces.push({ id, name: PORTFOLIO_NAME });
  data.members[id] = [{ email, name: name || email.split('@')[0], department: '', role: 'owner', active: 1, mail_enabled: 0, notify_self: 0 }];
  data.states[id] = state;
  data.revisions[id] = 0;
  data.policies[id] = DEFAULT_NOTIFY_POLICY;
  store.persist();
  store.audit(email, 'portfolio_loaded', id);
  return { id, created: true, refreshed: false };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter((a) => a !== '--yenile');
  const [email, ...nameParts] = args;
  if (!email) {
    console.error('Kullanım: node server/portfoy-yukle.js eposta@ornek.com "Ad Soyad" [--yenile]');
    process.exit(1);
  }
  const config = loadConfig({ ...process.env, AUTH_MODE: 'dev', NODE_ENV: '' });
  const store = openStore(config.dbFile);
  try {
    const r = loadPortfolio(store, email, nameParts.join(' '), { refresh: process.argv.includes('--yenile') });
    const s = portfolioState();
    console.log(
      r.created
        ? `"${PORTFOLIO_NAME}" alanı oluşturuldu: ${s.projects.length} proje, ${s.tasks.length} iş, ${s.decisions.length} karar.`
        : r.refreshed
          ? `"${PORTFOLIO_NAME}" alanı portfolio.json'a göre yenilendi.`
          : `"${PORTFOLIO_NAME}" alanı zaten var; dokunulmadı. Yenilemek için --yenile ekle.`,
    );
  } finally {
    store.close();
  }
}
