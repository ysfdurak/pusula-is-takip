// Bildirim kuralları ve örnek sunucunun e-posta kuyruğu
import test from 'node:test';
import assert from 'node:assert/strict';
import { mailStatus, statusRecipients, commentRecipients } from '../../src/shared/notificationRules.js';
import { configureDemoMail, demoGet, demoPost, pendingMail, markMail, resetDemoData, setDemoActor } from '../../src/demo/demoServer.js';

const member = (o = {}) => ({ email: 'ece@x.test', active: 1, mail_enabled: 1, notify_self: 0, ...o });
const policy = { assigned: true, status: true, comment: true, completed: true, managers: true };

test('e-posta durumu: demo, bağlantısız, kendi işlemi, tercih ve kural', () => {
  const base = { kind: 'status', recipient: 'ece@x.test', actor: 'deniz@x.test', member: member(), policy, task: {} };
  assert.equal(mailStatus({ ...base, mode: 'demo' }), 'disabled');
  assert.equal(mailStatus({ ...base, mode: 'off' }), 'no_config');
  assert.equal(mailStatus({ ...base, mode: 'live' }), 'queued');
  assert.equal(mailStatus({ ...base, mode: 'live', actor: 'ece@x.test' }), 'self');
  assert.equal(mailStatus({ ...base, mode: 'live', actor: 'ece@x.test', member: member({ notify_self: 1 }) }), 'queued');
  assert.equal(mailStatus({ ...base, mode: 'live', member: member({ mail_enabled: 0 }) }), 'muted');
  assert.equal(mailStatus({ ...base, mode: 'live', policy: { ...policy, status: false } }), 'muted');
  assert.equal(mailStatus({ ...base, mode: 'live', task: { notifyEmail: false } }), 'muted');
});

test('alıcılar: ilgililer, yöneticiler (kurala bağlı) ve önceki yorumcular', () => {
  const task = { createdBy: 'a@x.test', coordinator: '', assignees: ['B@x.test'], watchers: ['c@x.test'], teamId: 't', relatedTeamIds: [] };
  const state = { teams: [{ id: 't', active: true, leads: ['lead@x.test'], members: [] }] };
  assert.deepEqual(statusRecipients(task, state, policy), ['a@x.test', 'b@x.test', 'c@x.test', 'lead@x.test']);
  assert.deepEqual(statusRecipients(task, state, { ...policy, managers: false }), ['a@x.test', 'b@x.test', 'c@x.test']);
  assert.deepEqual(commentRecipients(task, ['d@x.test', 'a@x.test']), ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test']);
});

test('örnek sunucu: durum değişince ilgililere e-posta sıraya girer, işlemi yapana girmez', () => {
  configureDemoMail('live');
  resetDemoData();
  setDemoActor('deniz@example.test');
  const ws = demoGet('design');
  const next = structuredClone(ws.state);
  next.tasks.find((t) => t.id === 'd6').status = 'doing';
  demoPost({ action: 'save', id: 'design', revision: ws.revision, state: next, reason: '' });
  const fresh = demoGet('design').notifications.filter((n) => n.task === 'd6' && n.kind === 'status');
  const byRecipient = Object.fromEntries(fresh.map((n) => [n.recipient, n.mail]));
  assert.equal(byRecipient['mert@example.test'], 'queued');
  assert.equal(byRecipient['deniz@example.test'], 'self');
  const queued = pendingMail();
  assert.ok(queued.some((q) => q.notification.recipient === 'mert@example.test' && q.task.id === 'd6' && q.actorName === 'Deniz Yılmaz'));
  markMail(queued[0].notification.id, 'accepted', 'tamam');
  assert.equal(pendingMail().length, queued.length - 1);
  assert.equal(demoGet('design').mailConfigured, true);
});

test('örnek sunucu: yorum, daha önce yorum yazan kişiye de bildirilir', () => {
  configureDemoMail('live');
  resetDemoData();
  setDemoActor('ece@example.test');
  demoPost({ action: 'comment', id: 'design', task: 'd2', body: 'Taşıyıcı aradı', requestId: 'c1' });
  setDemoActor('deniz@example.test');
  demoPost({ action: 'comment', id: 'design', task: 'd2', body: 'Teşekkürler', requestId: 'c2' });
  const n = demoGet('design').notifications.filter((x) => x.kind === 'comment' && x.body === 'Teşekkürler');
  assert.ok(n.some((x) => x.recipient === 'ece@example.test' && x.mail === 'queued'));
});
