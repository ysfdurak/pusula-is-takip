// Sabah özeti: içerik seçimi, gönderim saati, günde bir kez, tercih ve şirket dışı adres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { digestFor, istanbulClock } from '../../src/shared/digest.js';
import { runDigest } from '../../server/mail/digest.js';
import { buildDigestEmail } from '../../server/mail/templates.js';

// Pazartesi 9 Kasım 2026, 08:30 TSİ
const NOW = Date.parse('2026-11-09T05:30:00Z');
const iso = (h) => new Date(NOW + h * 3600e3).toISOString();
const member = (email, extra = {}) => ({ email, name: email.split('@')[0], role: 'editor', active: 1, mail_enabled: 1, notify_self: 0, ...extra });

function data() {
  return {
    workspaces: [{ id: 'w', name: 'Depo' }],
    members: { w: [member('ece@sirket.test'), member('mert@sirket.test', { digest_enabled: 0 }), member('dis@baska.test'), member('lead@sirket.test')] },
    states: {
      w: {
        teams: [{ id: 't', name: 'Sevkiyat', members: ['ece@sirket.test', 'lead@sirket.test'], leads: ['lead@sirket.test'] }],
        projects: [], decisions: [], blockers: [],
        tasks: [
          { id: 'late', title: 'Geciken', status: 'doing', assignees: ['ece@sirket.test'], dueAt: iso(-20), teamId: 't' },
          { id: 'today', title: 'Bugün', status: 'todo', assignees: ['ece@sirket.test'], dueAt: iso(8), teamId: 't' },
          { id: 'week', title: 'Perşembe', status: 'todo', assignees: ['ece@sirket.test'], dueAt: iso(72), teamId: 't' },
          { id: 'far', title: 'Uzak', status: 'todo', assignees: ['ece@sirket.test'], dueAt: iso(400), teamId: 't' },
          { id: 'done', title: 'Bitti', status: 'done', assignees: ['ece@sirket.test'], dueAt: iso(-5), teamId: 't' },
          { id: 'pool', title: 'Havuz', status: 'todo', assignees: [], teamId: 't' },
          { id: 'mert', title: 'Mert işi', status: 'todo', assignees: ['mert@sirket.test'], dueAt: iso(2) },
          { id: 'dis', title: 'Dış', status: 'todo', assignees: ['dis@baska.test'], dueAt: iso(2) },
        ],
      },
    },
  };
}

test('özet içeriği: geciken, bugün, bu hafta; kapatan üye ve bitmiş iş yok; yöneticiye havuz', () => {
  const items = digestFor(data(), NOW);
  const ece = items.find((i) => i.member.email === 'ece@sirket.test');
  assert.deepEqual([ece.overdue, ece.today, ece.week].map((l) => l.map((t) => t.id)), [['late'], ['today'], ['week']]);
  assert.ok(!items.some((i) => i.member.email === 'mert@sirket.test'));
  assert.deepEqual(items.find((i) => i.member.email === 'lead@sirket.test').pool.map((t) => t.id), ['pool']);
  const mail = buildDigestEmail(ece, 'https://pusula.sirket.test/');
  assert.match(mail.subject, /1 geciken, 1 bugün, 1 bu hafta/);
  assert.ok(mail.html.includes('task=late'));
});

test('gönderim: hafta içi saatinde günde bir kez; hafta sonu ve saatinden önce gitmez; şirket dışı atlanır', async () => {
  const d = data();
  const sent = [];
  const mailer = { name: 'test', send: async (m) => sent.push(m.to) };
  const opts = { load: () => d, persist: () => {}, mailer, appUrl: 'https://p.test/', hour: 8, allowedDomains: ['sirket.test'] };
  assert.equal(istanbulClock(NOW).weekday, 1);
  await runDigest({ ...opts, now: NOW - 3600e3 }); // 07:30
  assert.equal(sent.length, 0);
  await runDigest({ ...opts, now: NOW });
  assert.deepEqual(sent.sort(), ['ece@sirket.test', 'lead@sirket.test']);
  await runDigest({ ...opts, now: NOW + 600e3 });
  assert.equal(sent.length, 2, 'aynı gün ikinci kez gitmez');
  await runDigest({ ...opts, now: Date.parse('2026-11-14T06:00:00Z') }); // cumartesi
  assert.equal(sent.length, 2);
});
