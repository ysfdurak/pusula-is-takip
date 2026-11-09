// Tekrarlanan işler: sonraki termin hesabı ve tamamlanınca açılan kopya.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDue } from '../../src/shared/recurrence.js';
import { demoGet, demoPost, setDemoActor, resetDemoData } from '../../src/demo/demoServer.js';

const iso = (ms) => new Date(ms).toISOString();

test('sonraki termin: günlük, hafta içi, haftalık, aylık (ay sonu korunur)', () => {
  // Cuma 17:00 TSİ = 14:00Z
  const friday = '2026-11-06T14:00:00Z';
  const before = Date.parse('2026-11-06T10:00:00Z');
  assert.equal(iso(nextDue(friday, 'daily', before)), '2026-11-07T14:00:00.000Z');
  assert.equal(iso(nextDue(friday, 'weekdays', before)), '2026-11-09T14:00:00.000Z');
  assert.equal(iso(nextDue(friday, 'weekly', before)), '2026-11-13T14:00:00.000Z');
  assert.equal(iso(nextDue('2026-01-31T14:00:00Z', 'monthly', 0)), '2026-02-28T14:00:00.000Z');
  // Kaçırılan tekrarlar atlanır: sonraki termin şu andan sonra olur
  assert.equal(iso(nextDue(friday, 'daily', Date.parse('2026-11-10T20:00:00Z'))), '2026-11-11T14:00:00.000Z');
});

test('tekrarlanan iş tamamlanınca sıradaki kopya bir kez açılır', () => {
  resetDemoData();
  setDemoActor('deniz@example.test');
  let ws = demoGet('design');
  const state = structuredClone(ws.state);
  const task = state.tasks.find((t) => t.status === 'todo' && !t.requireApproval && !t.depends.length && !t.checklistRequired)
    || state.tasks.find((t) => t.status === 'todo');
  task.requireApproval = false;
  task.checklistRequired = false;
  task.dueAt = '';
  task.date = '';
  task.recurrence = 'weekly';
  assert.throws(
    () => demoPost({ action: 'save', id: 'design', revision: ws.revision, state, reason: 'tekrar' }),
    /Tekrarlanan iş için termin/,
  );
  task.dueAt = new Date(Date.now() + 864e5).toISOString();
  let saved = demoPost({ action: 'save', id: 'design', revision: ws.revision, state, reason: 'tekrar' });
  const next = structuredClone(saved.state);
  for (const b of next.blockers) if (b.task === task.id) b.resolved = true;
  const t2 = next.tasks.find((t) => t.id === task.id);
  t2.status = 'done';
  t2.depends = [];
  t2.waitingReason = '';
  t2.waitingNote = '';
  saved = demoPost({ action: 'save', id: 'design', revision: saved.revision, state: next, reason: '' });
  const copies = saved.state.tasks.filter((t) => t.recurrenceOf === task.id);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].status, 'todo');
  assert.equal(copies[0].recurrence, 'weekly');
  assert.equal(Date.parse(copies[0].dueAt) - Date.parse(t2.dueAt), 7 * 864e5);
  assert.ok(copies[0].checklist.every((s) => !s.done));
  // Yeniden açıp tekrar tamamlamak ikinci kopya üretmez
  const again = structuredClone(saved.state);
  again.tasks.find((t) => t.id === task.id).status = 'doing';
  saved = demoPost({ action: 'save', id: 'design', revision: saved.revision, state: again, reason: '' });
  const again2 = structuredClone(saved.state);
  again2.tasks.find((t) => t.id === task.id).status = 'done';
  saved = demoPost({ action: 'save', id: 'design', revision: saved.revision, state: again2, reason: '' });
  assert.equal(saved.state.tasks.filter((t) => t.recurrenceOf === task.id).length, 1);
});
