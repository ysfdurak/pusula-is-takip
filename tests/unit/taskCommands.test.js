// İnce servis katmanı: komutlar kuralları kopyalamadan `save` üzerinden çalışır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceService } from '../../src/shared/workspaceService.js';
import { createTaskCommands } from '../../src/shared/taskCommands.js';

const ADMIN = 'deniz@x.test';
const ECE = 'ece@x.test';
const SELIN = 'selin@x.test';
const NOW = Date.parse('2026-11-11T09:00:00Z');

/** Bellekte çalışan servis + komutlar; bir yönetici, bir üye ve bir görüntüleyiciyle. */
function setup() {
  const data = { workspaces: [], members: {}, states: {}, revisions: {}, policies: {}, notifications: [], comments: [], activities: [], times: [], files: [] };
  let counter = 0;
  const newId = () => 'id' + ++counter;
  const service = createWorkspaceService({ load: () => data, persist: () => {}, newId });
  const commands = createTaskCommands(service, { newId, now: () => NOW });
  const { id } = service.post(ADMIN, { action: 'create', name: 'Depo' });
  for (const [email, role] of [[ECE, 'editor'], [SELIN, 'viewer']]) {
    service.post(ADMIN, { action: 'member', id, email, name: email, department: '', role, active: true, originalEmail: '' });
  }
  return { data, service, commands, id };
}

test('çalışma alanı tekse otomatik seçilir', () => {
  const { commands, id } = setup();
  assert.equal(commands.resolveWorkspace(ADMIN), id);
});

test('iş oluşturma: termin gün sonuna çevrilir, "ben" kullanıcının kendisidir', () => {
  const { commands } = setup();
  const task = commands.createTask(ECE, { baslik: 'Rampa 3 sayımı', sorumlular: ['ben'], termin: '2026-11-12', oncelik: 'high' });
  assert.equal(task.baslik, 'Rampa 3 sayımı');
  assert.deepEqual(task.sorumlular, [ECE]);
  assert.equal(task.termin, '2026-11-12');
  assert.equal(task.ilkTermin, '2026-11-12');
  assert.equal(task.geciken, false);
});

test('iş oluşturma: görüntüleyici ve ekip dışı sorumlu reddedilir', () => {
  const { commands } = setup();
  assert.throws(() => commands.createTask(SELIN, { baslik: 'x' }), /Görüntüleme rolünde/);
  assert.throws(() => commands.createTask(ADMIN, { baslik: 'x', sorumlular: ['yabanci@x.test'] }), /Aktif ekip üyesi/);
  assert.throws(() => commands.createTask(ADMIN, { baslik: 'x', sorumlular: [SELIN] }), /Aktif ekip üyesi/);
});

test('durum: tamamlama kuralları sunucu tarafında da uygulanır', () => {
  const { commands, data, id } = setup();
  const task = commands.createTask(ADMIN, { baslik: 'Kapanış raporu', sorumlular: [ECE] });
  // Zorunlu kontrol listesi olan iş, adım bitmeden tamamlanamaz
  const stored = data.states[id].tasks.find((t) => t.id === task.id);
  stored.checklistRequired = true;
  stored.checklist = [{ id: 'k1', text: 'Sayım imzalandı', done: false, doneBy: '', doneAt: '' }];
  assert.throws(() => commands.changeStatus(ECE, { isId: task.id, durum: 'done' }), /henüz tamamlanamaz/);
  commands.toggleChecklistItem(ECE, { isId: task.id, maddeId: 'k1', tamam: true });
  assert.equal(commands.changeStatus(ECE, { isId: task.id, durum: 'done' }).durum, 'done');
  // Geçmişe durum değişikliği yazılır (kural workspaceService'te, komutta değil)
  assert.ok(data.activities.some((a) => a.task === task.id && a.kind === 'status' && a.after === 'done'));
});

test('termin değişikliği: gerekçe zorunlu, ilk termin korunur', () => {
  const { commands } = setup();
  const task = commands.createTask(ADMIN, { baslik: 'Sevkiyat planı', termin: '2026-11-12' });
  assert.throws(() => commands.changeDue(ADMIN, { isId: task.id, termin: '2026-11-15', gerekce: ' ' }), /gerekçe/);
  const moved = commands.changeDue(ADMIN, { isId: task.id, termin: '2026-11-15', gerekce: 'Araç gecikti' });
  assert.equal(moved.termin, '2026-11-15');
  assert.equal(moved.ilkTermin, '2026-11-12');
  assert.equal(moved.terminRevizyonu, 1);
});

test('liste: geciken, "benim" ve "açık" filtreleri', () => {
  const { commands, service } = setup();
  commands.createTask(ADMIN, { baslik: 'Geçmiş', sorumlular: [ECE], termin: '2026-11-11' });
  commands.createTask(ADMIN, { baslik: 'Gelecek', sorumlular: [ADMIN], termin: '2026-11-20' });
  assert.equal(commands.listTasks(ECE, { sorumlu: 'ben' }).toplam, 1);
  assert.equal(commands.listTasks(ADMIN, { durum: 'acik' }).toplam, 2);
  assert.equal(commands.listTasks(ADMIN, { geciken: true }).toplam, 0);
  // Üç gün sonra 11 Kasım terminli iş gecikmiş sayılır
  const later = createTaskCommands(service, { newId: () => 'x', now: () => NOW + 3 * 864e5 });
  assert.deepEqual(later.listTasks(ADMIN, { geciken: true }).isler.map((t) => t.baslik), ['Geçmiş']);
});

test('çakışma: arada başka biri kaydederse komut güncel veriyle yeniden dener', () => {
  const { commands, service, id } = setup();
  const task = commands.createTask(ADMIN, { baslik: 'Etiketleme', sorumlular: [ECE] });
  const other = commands.createTask(ADMIN, { baslik: 'Diğer iş' });
  // İlk okumadan hemen sonra başka bir kullanıcı kaydetmiş gibi davran
  const realGet = service.get;
  let interfered = false;
  service.get = (actor, ws, t) => {
    const snap = realGet(actor, ws, t);
    if (ws && !interfered) {
      interfered = true;
      const next = structuredClone(snap.state);
      next.tasks.find((x) => x.id === other.id).priority = 'urgent';
      service.post(ADMIN, { action: 'save', id, revision: snap.revision, state: next, reason: '' });
    }
    return snap;
  };
  assert.equal(commands.changeStatus(ECE, { calismaAlani: id, isId: task.id, durum: 'doing' }).durum, 'doing');
  service.get = realGet;
  // Başkasının değişikliği ezilmedi
  assert.equal(commands.listTasks(ADMIN, {}).isler.find((x) => x.id === other.id).oncelik, 'urgent');
});

test('yorum ve ayrıntı: eksikler ve son yorumlar döner', () => {
  const { commands } = setup();
  const task = commands.createTask(ADMIN, { baslik: 'Palet kontrolü', sorumlular: [ECE] });
  commands.addComment(ECE, { isId: task.id, metin: 'Başladım' });
  const detail = commands.taskDetail(ADMIN, { isId: task.id });
  assert.equal(detail.sonYorumlar[0].metin, 'Başladım');
  assert.deepEqual(detail.tamamlamakIcinEksikler, []);
});

test('gündem: sabah özetiyle aynı hesap; geciken, bugün, bu hafta ayrılır', () => {
  const { commands, service } = setup();
  commands.createTask(ADMIN, { baslik: 'Bugün', sorumlular: [ECE], termin: '2026-11-11' });
  commands.createTask(ADMIN, { baslik: 'Hafta', sorumlular: [ECE], termin: '2026-11-14' });
  commands.createTask(ADMIN, { baslik: 'Başkasının', sorumlular: [ADMIN], termin: '2026-11-11' });
  const agenda = commands.myAgenda(ECE);
  assert.deepEqual(agenda.bugun.map((t) => t.baslik), ['Bugün']);
  assert.deepEqual(agenda.buHafta.map((t) => t.baslik), ['Hafta']);
  const later = createTaskCommands(service, { newId: () => 'x', now: () => NOW + 864e5 });
  assert.deepEqual(later.myAgenda(ECE).geciken.map((t) => t.baslik), ['Bugün']);
});

test('ekip durumu ve engeller: pano hesabı ve açık engeller döner', () => {
  const { commands, data, id } = setup();
  const a = commands.createTask(ADMIN, { baslik: 'Sahipsiz' });
  const b = commands.createTask(ADMIN, { baslik: 'Engelli', sorumlular: [ECE] });
  data.states[id].blockers.push({ id: 'b1', project: '', task: b.id, title: 'Forklift arızalı', owner: 'Bakım', resolved: false });
  const status = commands.teamStatus(ADMIN);
  assert.equal(status.acik, 2);
  assert.deepEqual(status.sorumluBekleyen.map((t) => t.id), [a.id]);
  assert.deepEqual(status.engelli.map((t) => t.id), [b.id]);
  const blockers = commands.listBlockers(ECE);
  assert.deepEqual(blockers[0].engeller, ['Forklift arızalı']);
  assert.deepEqual(blockers[0].cozumSorumlulari, ['Bakım']);
  // Engelli iş tamamlanamaz
  assert.throws(() => commands.changeStatus(ECE, { isId: b.id, durum: 'done' }), /Forklift arızalı/);
});
