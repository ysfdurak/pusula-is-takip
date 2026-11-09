// Outlook göndericisi, e-posta şablonu ve gönderim kuyruğu (gerçek Microsoft'a bağlanmadan)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, taskLink } from '../../server/mail/templates.js';
import { createGraphMailer, MailError } from '../../server/mail/graphMailer.js';
import { processOutbox } from '../../server/mail/outbox.js';

const item = (o = {}) => ({
  notification: { id: 'n1', workspace: 'ws1', task: 't1', recipient: 'ece@sirket.com.tr', kind: 'status', title: 'Durum değişti: Sayım', body: '', meta: { before: 'todo', after: 'doing' }, ...o },
  task: { id: 't1', title: 'Sayım <A koridoru>', status: 'doing', teamId: 'stok', priority: 'high', dueAt: '2026-11-10T12:00:00.000Z' },
  teams: [{ id: 'stok', name: 'Stok Kontrol' }],
  workspace: { id: 'ws1', name: 'Depo' },
  actorName: 'Deniz Yılmaz',
  recipientName: 'Ece Kaya',
});

test('şablon: konu, Jira benzeri açıklama, güvenli HTML ve işe bağlantı', () => {
  const mail = buildEmail({ ...item(), appUrl: 'https://pusula.sirket.com.tr/' });
  assert.equal(mail.to, 'ece@sirket.com.tr');
  assert.equal(mail.subject, '[Pusula] Durum değişti: Sayım (Devam ediyor)');
  assert.match(mail.html, /Deniz Yılmaz işin durumunu değiştirdi: Başlanmadı → Devam ediyor/);
  assert.match(mail.html, /Sayım &lt;A koridoru&gt;/);
  assert.match(mail.html, /Stok Kontrol/);
  assert.match(mail.html, /href="https:\/\/pusula\.sirket\.com\.tr\/\?workspace=ws1&amp;task=t1"/);
  assert.equal(taskLink('https://p.test/app/', 'w', 't'), 'https://p.test/app/?workspace=w&task=t');
});

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    return { ok: r.status < 400, status: r.status, json: async () => r.body || {}, headers: { get: (k) => (r.headers || {})[k.toLowerCase()] } };
  };
  fn.calls = calls;
  return fn;
}
const cfg = { tenantId: 'tenant', clientId: 'client', clientSecret: 'secret', sender: 'pusula@sirket.com.tr' };

test('Outlook: istemci kimlik bilgisiyle oturum alır, ortak kutudan gönderir, anahtarı yeniden kullanır', async () => {
  const fetchImpl = fakeFetch([{ status: 200, body: { access_token: 'tok', expires_in: 3600 } }, { status: 202 }, { status: 202 }]);
  const mailer = createGraphMailer({ ...cfg, fetchImpl });
  await mailer.send({ to: 'ece@sirket.com.tr', subject: 'Konu', html: '<p>x</p>' });
  await mailer.send({ to: 'mert@sirket.com.tr', subject: 'Konu', html: '<p>y</p>' });
  const [token, send1, send2] = fetchImpl.calls;
  assert.equal(token.url, 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token');
  assert.match(token.init.body, /grant_type=client_credentials/);
  assert.match(token.init.body, /scope=https%3A%2F%2Fgraph\.microsoft\.com%2F\.default/);
  assert.equal(send1.url, 'https://graph.microsoft.com/v1.0/users/pusula%40sirket.com.tr/sendMail');
  assert.equal(send1.init.headers.Authorization, 'Bearer tok');
  const body = JSON.parse(send1.init.body);
  assert.equal(body.saveToSentItems, false);
  assert.equal(body.message.body.contentType, 'HTML');
  assert.equal(body.message.toRecipients[0].emailAddress.address, 'ece@sirket.com.tr');
  assert.equal(fetchImpl.calls.length, 3, 'ikinci gönderimde yeni oturum açılmaz');
  assert.equal(JSON.parse(send2.init.body).message.toRecipients[0].emailAddress.address, 'mert@sirket.com.tr');
});

test('Outlook: süresi dolmuş anahtarda bir kez yeniler; 429 yeniden denenebilir, 403 denenemez', async () => {
  const f1 = fakeFetch([{ status: 200, body: { access_token: 'a' } }, { status: 401 }, { status: 200, body: { access_token: 'b' } }, { status: 202 }]);
  await createGraphMailer({ ...cfg, fetchImpl: f1 }).send({ to: 'x@sirket.com.tr', subject: 's', html: 'h' });
  assert.equal(f1.calls[3].init.headers.Authorization, 'Bearer b');

  const f2 = fakeFetch([{ status: 200, body: { access_token: 'a' } }, { status: 429, headers: { 'retry-after': '5' }, body: { error: { message: 'Too many' } } }]);
  await assert.rejects(createGraphMailer({ ...cfg, fetchImpl: f2 }).send({ to: 'x@sirket.com.tr', subject: 's', html: 'h' }), (e) => e instanceof MailError && e.retryable && e.retryAfterMs === 5000);

  const f3 = fakeFetch([{ status: 200, body: { access_token: 'a' } }, { status: 403, body: { error: { message: 'Access is denied' } } }]);
  await assert.rejects(createGraphMailer({ ...cfg, fetchImpl: f3 }).send({ to: 'x@sirket.com.tr', subject: 's', html: 'h' }), (e) => !e.retryable && /Access is denied/.test(e.message));
  assert.throws(() => createGraphMailer({ ...cfg, sender: '' }), /sender eksik/);
});

test('kuyruk: gönderir, şirket dışını engeller, geçici hatada yeniden dener, kalıcı hatada bırakır', async () => {
  const items = [item(), item({ id: 'n2', recipient: 'dis@gmail.com' }), item({ id: 'n3', mail_attempts: 0 }), item({ id: 'n4', mail_attempts: 2 })];
  const marks = [];
  const mailer = {
    name: 'Test',
    send: async ({ to, subject }) => {
      if (marks.filter((m) => m[1] === 'sending').length >= 3) throw new MailError('yoğun', { retryable: true });
      return { accepted: true, to, subject };
    },
  };
  const r = await processOutbox({ pending: () => items, mark: (...m) => marks.push(m), mailer, appUrl: 'https://p.test/', allowedDomains: ['sirket.com.tr'] });
  assert.deepEqual(r, { accepted: 2, failed: 2, retry: 0 });
  assert.deepEqual(marks.filter((m) => m[1] !== 'sending').map((m) => [m[0], m[1]]), [['n1', 'accepted'], ['n2', 'failed'], ['n3', 'accepted'], ['n4', 'failed']]);
  const r2 = await processOutbox({ pending: () => [item({ id: 'n5' })], mark: () => {}, mailer: { name: 'T', send: async () => { throw new MailError('yoğun', { retryable: true }); } }, appUrl: 'https://p.test/' });
  assert.deepEqual(r2, { accepted: 0, failed: 0, retry: 1 });
});
