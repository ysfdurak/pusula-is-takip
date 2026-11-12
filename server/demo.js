// Ziyaretçi demo alanları (DEMO_MODE=true): portföy ziyaretçisi Google ile girer, kendine ait örnek verili bir
// çalışma alanı açılır. Herkesin alanı ayrıdır: ziyaretçiler birbirinin verisini bozamaz, e-posta adresini göremez.
//
// Kurallar:
//   - Ziyaretçi kendi alanının yöneticisidir (her özelliği deneyebilsin). Ekip arkadaşları kurgusaldır (@example.test).
//   - Demo alanına yalnızca @example.test adresli kişi eklenebilir: ziyaretçi gerçek birini davet edemez.
//   - Alan DEMO_TTL_DAYS gün sonra tümüyle silinir (iş, yorum, ek, oturum, Claude bağlantısı). Yeniden giren yenisini alır.
//   - En fazla DEMO_MAX_SANDBOXES alan: sunucu kötüye kullanımla dolmasın.
//   - Yönetici adresleri (PUSULA_ADMINS) demo alanı almaz; gerçek çalışma alanları demodan etkilenmez.
import { randomUUID } from 'node:crypto';
import { DEMO_USERS, createSampleData } from '../src/shared/sampleData.js';

export const DEMO_DOMAIN = 'example.test';
const OWNER = DEMO_USERS[0];

/**
 * @param {object} o
 * @param {object} o.store     server/store.js
 * @param {number} o.ttlDays
 * @param {number} o.max
 * @param {(msg: string) => void} [o.log]
 */
export function createDemoSandboxes({ store, ttlDays = 7, max = 300, log = () => {} }) {
  const isDemo = (workspaceId) => !!store.load().workspaces.find((w) => w.id === workspaceId)?.demo;
  const sandboxOf = (email) => store.load().workspaces.find((w) => w.demo?.owner === email) || null;

  /** Ziyaretçiye örnek verili yeni alan açar. Örnek verideki yönetici (Deniz) ziyaretçinin kendisi olur. */
  function create(user, now = Date.now()) {
    const data = store.load();
    if (sandboxOf(user.email)) return sandboxOf(user.email).id;
    if (data.workspaces.filter((w) => w.demo).length >= max) throw Object.assign(new Error('Demo şu an dolu.'), { code: 'full' });
    const sample = createSampleData(now);
    const id = randomUUID();
    const name = user.name || user.email.split('@')[0];
    // Örnek veride Deniz'in adresi ve adı geçen her yer ziyaretçiye çevrilir (atamalar, yorumlar, geçmiş)
    const swap = (value) => JSON.parse(JSON.stringify(value).replaceAll(OWNER.email, user.email).replaceAll(OWNER.name, name));
    const scoped = (list) => swap(list.filter((x) => x.workspace === 'design')).map((x) => ({ ...x, id: `${id}-${x.id}`, workspace: id }));

    data.workspaces.push({ id, name: `Demo · ${name}`, demo: { owner: user.email, created: now } });
    data.members[id] = swap(sample.members.design).map((m) => ({ ...m, active: 1, mail_enabled: 0, oid: m.email === user.email ? user.oid || '' : '' }));
    data.states[id] = swap(sample.states.design);
    data.revisions[id] = 0;
    data.policies[id] = sample.policies.design;
    for (const key of ['notifications', 'comments', 'activities', 'times']) data[key].push(...scoped(sample[key] || []));
    store.persist();
    store.audit(user.email, 'demo_created', id);
    log(`Demo alanı açıldı: ${user.email}`);
    return id;
  }

  /** Süresi dolan demo alanlarını tümüyle siler. */
  function cleanup(now = Date.now()) {
    const data = store.load();
    const expired = data.workspaces.filter((w) => w.demo && w.demo.created <= now - ttlDays * 864e5);
    if (!expired.length) return 0;
    const ids = new Set(expired.map((w) => w.id));
    for (const file of (data.files || []).filter((f) => ids.has(f.workspace))) store.blobs.remove(file.id);
    data.workspaces = data.workspaces.filter((w) => !ids.has(w.id));
    for (const key of ['members', 'states', 'revisions', 'policies', 'digests']) for (const id of ids) delete data[key]?.[id];
    for (const key of ['notifications', 'comments', 'activities', 'times', 'files']) data[key] = (data[key] || []).filter((x) => !ids.has(x.workspace));
    store.persist();
    for (const w of expired) {
      const stillMember = Object.values(data.members).some((list) => list.some((m) => m.email === w.demo.owner && m.active));
      if (!stillMember) {
        store.sessions.deleteForEmail(w.demo.owner);
        try {
          store.db.prepare('DELETE FROM oauth_tokens WHERE email = ?').run(w.demo.owner);
        } catch {
          // OAuth tablosu yoksa (MCP kapalı) yapılacak bir şey yok
        }
      }
      store.audit(w.demo.owner, 'demo_deleted', w.id);
    }
    log(`Süresi dolan ${expired.length} demo alanı silindi.`);
    return expired.length;
  }

  /** Demo alanına üye eklerken: yalnızca kurgusal adresler. */
  function memberError(workspaceId, email) {
    if (!isDemo(workspaceId)) return null;
    return String(email || '').toLowerCase().endsWith('@' + DEMO_DOMAIN)
      ? null
      : `Demo alanına yalnızca kurgusal kişi eklenebilir (adresi @${DEMO_DOMAIN} ile bitmeli, ör. ayse@${DEMO_DOMAIN}).`;
  }

  return { create, cleanup, isDemo, sandboxOf, memberError, ttlDays };
}
