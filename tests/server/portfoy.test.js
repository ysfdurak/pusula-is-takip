// Portföy veri seti: geçerlilik, ziyaretçi demosunda isteğe bağlı kullanım, kendi hesaba yükleme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../server/config.js';
import { openStore } from '../../server/store.js';
import { createDemoSandboxes } from '../../server/demo.js';
import { loadPortfolio } from '../../server/portfoy-yukle.js';
import { PORTFOLIO_NAME, PORTFOLIO_OWNER, portfolioState } from '../../src/shared/portfolioData.js';

const store = () => openStore(join(mkdtempSync(join(tmpdir(), 'pusula-portfoy-')), 'pusula.db'));

test('veri seti şemaya ve yapı kurallarına uyar; tarihler geçerli UTC', () => {
  const s = portfolioState();
  assert.ok(s.projects.length >= 30 && s.tasks.length >= 100);
  for (const t of s.tasks) {
    assert.deepEqual(t.assignees, [PORTFOLIO_OWNER.email]);
    if (t.status === 'done' && t.createdAt) assert.ok(t.completedAt >= t.createdAt, `${t.id} tamamlanma oluşturmadan önce`);
    for (const step of t.checklist) assert.ok(!step.done || step.doneAt, `${t.id} adım tarihi eksik`);
  }
  assert.ok(s.decisions.length > 10);
});

test('varsayılan demo verisi değişmez; DEMO_DATASET=portfoy açıkça seçilmeli', () => {
  assert.equal(loadConfig({ AUTH_MODE: 'dev' }).demoDataset, 'ornek');
  assert.equal(loadConfig({ AUTH_MODE: 'dev', DEMO_DATASET: 'portfoy' }).demoDataset, 'portfoy');
  const st = store();
  const ornek = createDemoSandboxes({ store: st }).create({ email: 'a@gmail.test', name: 'A' });
  assert.match(st.load().workspaces.find((w) => w.id === ornek).name, /^Demo · /);
  assert.ok(!st.load().states[ornek].projects.some((p) => p.id === 'site'));
  st.close();
});

test('portföy demosu: ziyaretçi yönetici, işler Yusuf Durak\'ta', () => {
  const st = store();
  const id = createDemoSandboxes({ store: st, dataset: 'portfoy' }).create({ email: 'b@gmail.test', name: 'B' });
  const data = st.load();
  assert.equal(data.workspaces.find((w) => w.id === id).name, PORTFOLIO_NAME);
  const members = data.members[id];
  assert.equal(members.find((m) => m.email === 'b@gmail.test').role, 'owner');
  assert.ok(members.some((m) => m.email === PORTFOLIO_OWNER.email));
  assert.ok(data.states[id].projects.some((p) => p.id === 'pusula'));
  st.close();
});

test('kendi hesaba yükleme: tek üye, tekrar çalıştırınca dokunmaz, --yenile ile yeniler', () => {
  const st = store();
  const r1 = loadPortfolio(st, 'Yusuf@Ornek.test', 'Yusuf Durak');
  assert.equal(r1.created, true);
  const data = st.load();
  assert.deepEqual(data.members[r1.id].map((m) => [m.email, m.role]), [['yusuf@ornek.test', 'owner']]);
  assert.ok(data.states[r1.id].tasks.every((t) => t.assignees[0] === 'yusuf@ornek.test'));
  data.states[r1.id].tasks = [];
  const r2 = loadPortfolio(st, 'yusuf@ornek.test');
  assert.deepEqual([r2.id, r2.created, r2.refreshed], [r1.id, false, false]);
  assert.equal(st.load().states[r1.id].tasks.length, 0);
  const r3 = loadPortfolio(st, 'yusuf@ornek.test', '', { refresh: true });
  assert.equal(r3.refreshed, true);
  assert.ok(st.load().states[r1.id].tasks.length >= 100);
  assert.throws(() => loadPortfolio(st, 'gecersiz'), /e-posta/);
  st.close();
});
