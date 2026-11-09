// Ortak iş kuralları: pilot sunucusu da bu kuralları uygulamalıdır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeState, validateStructure, validateSchedule, canAccessTask, assertPermittedChanges,
  stampTaskMetadata, taskSchema,
} from '../../src/shared/workspaceModel.js';

const team = (id, members, leads = []) => ({ id, name: id, members, leads, active: true, workTypes: [] });
const task = (over = {}) => taskSchema.parse({ id: 't1', title: 'İş', status: 'todo', ...over });
const state = (over = {}) => normalizeState({ projects: [], tasks: [], decisions: [], blockers: [], ...over });

test('eski kayıtlar normalize edilir: tek sorumlu ve eski statüler', () => {
  const s = state({ tasks: [{ id: 'a', title: 'Eski', status: 'waiting', assignee: 'Ece@Example.test' }] });
  assert.equal(s.tasks[0].status, 'todo');
  assert.deepEqual(s.tasks[0].assignees, ['ece@example.test']);
  assert.equal(s.tasks[0].requireApproval, true);
});

test('yapı doğrulaması: tekrarlanan ekip ve üye olmayan yönetici', () => {
  assert.equal(validateStructure(state({ teams: [team('x', []), team('x', [])] })), 'Ekip kimliği tekrarlanamaz.');
  assert.equal(
    validateStructure(state({ teams: [team('x', ['a@x.test'], ['b@x.test'])] })),
    'Ekip yöneticileri ekip üyesi olmalı; üyeler tekrarlanamaz.',
  );
  assert.equal(validateStructure(state({ teams: [team('x', ['a@x.test'], ['a@x.test'])] })), null);
});

test('termin kuralları: zorunlu termin, başlangıçtan önce termin, azami süre', () => {
  const start = '2026-11-09T07:00:00.000Z';
  const current = state();
  const rules = (r) => ({ maxDurationDays: 0, dueRequired: false, ...r });
  assert.equal(
    validateSchedule(state({ workRules: rules({ dueRequired: true }), tasks: [task({ plannedStart: start })] }), current),
    'Bu ekipte termin tarihi zorunlu.',
  );
  assert.equal(
    validateSchedule(state({ tasks: [task({ plannedStart: start, dueAt: '2026-11-08T07:00:00.000Z' })] }), current),
    'Termin başlangıçtan önce olamaz.',
  );
  assert.match(
    validateSchedule(state({ workRules: rules({ maxDurationDays: 3 }), tasks: [task({ plannedStart: start, dueAt: '2026-11-20T07:00:00.000Z' })] }), current),
    /en fazla 3 takvim günü/,
  );
  assert.equal(validateSchedule(state({ tasks: [task({ plannedStart: start, dueAt: '2026-11-10T07:00:00.000Z' })] }), current), null);
});

test('görünürlük: ekip işi yalnızca ilgili kişilere ve yöneticiye görünür', () => {
  const s = state({ teams: [team('sevk', ['ece@x.test'])] });
  const t = task({ teamId: 'sevk' });
  assert.equal(canAccessTask(t, s, 'ece@x.test', 'editor'), true);
  assert.equal(canAccessTask(t, s, 'mert@x.test', 'editor'), false);
  assert.equal(canAccessTask(t, s, 'mert@x.test', 'owner'), true);
  assert.equal(canAccessTask(task({ teamId: 'sevk', assignees: ['mert@x.test'] }), s, 'mert@x.test', 'editor'), true);
});

test('yetki: ekip tanımını yalnızca o ekibin yöneticisi değiştirebilir', () => {
  const current = state({ teams: [team('sevk', ['ece@x.test', 'mert@x.test'], ['ece@x.test'])] });
  const proposed = structuredClone(current);
  proposed.teams[0].name = 'Sevkiyat';
  assert.throws(() => assertPermittedChanges(current, proposed, 'mert@x.test', 'editor'), /yöneticisi olduğunuz ekibin/);
  assert.doesNotThrow(() => assertPermittedChanges(current, proposed, 'ece@x.test', 'editor'));
  assert.doesNotThrow(() => assertPermittedChanges(current, proposed, 'mert@x.test', 'owner'));
});

test('revizyon: termin değişince sayaçlar artar, ilk termin korunur', () => {
  const previous = task({ dueAt: '2026-11-10T15:00:00.000Z', originalDueAt: '2026-11-10T15:00:00.000Z' });
  const next = task({ dueAt: '2026-11-12T15:00:00.000Z' });
  const result = stampTaskMetadata(next, previous, 'ece@x.test', Date.parse('2026-11-09T07:00:00Z'));
  assert.equal(next.dueRevisionCount, 1);
  assert.equal(next.revisionCount, 1);
  assert.equal(next.originalDueAt, '2026-11-10T15:00:00.000Z');
  assert.ok(result.changes.some((c) => c.field === 'dueAt'));
});
