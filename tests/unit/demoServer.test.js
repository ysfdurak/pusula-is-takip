// Tarayıcı içi örnek sunucu: /api/workspace sözleşmesinin başvuru uygulaması.
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoGet, demoPost, setDemoActor, resetDemoData } from '../../src/demo/demoServer.js';

const fresh = (actor = 'deniz@example.test') => { resetDemoData(); setDemoActor(actor); return demoGet('design'); };

test('GET: kullanıcı, rol ve örnek çalışma alanı döner', () => {
  const list = (resetDemoData(), demoGet(''));
  assert.equal(list.user, 'deniz@example.test');
  assert.equal(list.workspaces[0].id, 'design');
  const ws = fresh();
  assert.equal(ws.role, 'owner');
  assert.equal(ws.state.tasks.length, 12);
  assert.equal(typeof ws.revision, 'number');
});

test('save: eski revizyonla kayıt reddedilir (çakışma)', () => {
  const ws = fresh();
  assert.throws(() => demoPost({ action: 'save', id: 'design', revision: ws.revision - 1, state: ws.state, reason: '' }), /Kayıt değişti/);
});

test('save: termin değişikliği gerekçe ister; gerekçeyle revizyon artar', () => {
  const ws = fresh();
  const next = structuredClone(ws.state);
  const t = next.tasks.find((x) => x.id === 'd6');
  t.dueAt = new Date(Date.parse(t.dueAt) + 864e5).toISOString();
  assert.throws(() => demoPost({ action: 'save', id: 'design', revision: ws.revision, state: next, reason: '' }), /gerekçe/);
  const saved = demoPost({ action: 'save', id: 'design', revision: ws.revision, state: next, reason: 'Raf etiketi gecikti' });
  assert.equal(saved.revision, ws.revision + 1);
  assert.equal(saved.state.tasks.find((x) => x.id === 'd6').dueRevisionCount, 1);
});

test('görüntüleyici değişiklik yapamaz', () => {
  const ws = fresh('selin@example.test');
  assert.equal(ws.role, 'viewer');
  assert.throws(() => demoPost({ action: 'save', id: 'design', revision: ws.revision, state: ws.state, reason: '' }), /Görüntüleme rolünde/);
});

test('yorum: boş yorum reddedilir, yorum işe eklenir', () => {
  fresh();
  assert.throws(() => demoPost({ action: 'comment', id: 'design', task: 'd1', body: ' ', requestId: 'r1' }), /Yorumunu yaz/);
  demoPost({ action: 'comment', id: 'design', task: 'd1', body: 'Koliler sayıldı', requestId: 'r2' });
  demoPost({ action: 'comment', id: 'design', task: 'd1', body: 'Koliler sayıldı', requestId: 'r2' });
  const detail = demoGet('design', 'd1');
  assert.equal(detail.comments.filter((c) => c.body === 'Koliler sayıldı').length, 1, 'aynı requestId ikinci kez eklenmez');
});
