// Tekrarlanan işler: tekrar eden bir iş tamamlanınca bir sonraki kopyası açılır.
// Saatler Türkiye saatine (UTC+3, yaz saati yok) göre hesaplanır.
export const RECURRENCE_LABELS = {
  '': 'Tekrarlanmaz',
  daily: 'Her gün',
  weekdays: 'Hafta içi her gün',
  weekly: 'Her hafta',
  monthly: 'Her ay',
};

const OFFSET = 3 * 3600e3;

function step(ms, freq) {
  let local = new Date(ms + OFFSET);
  if (freq === 'monthly') {
    let day = local.getUTCDate();
    let next = new Date(local);
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    let lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
    return next.getTime() - OFFSET;
  }
  if (freq === 'weekly') {
    return ms + 7 * 864e5;
  }
  let next = ms + 864e5;
  if (freq === 'weekdays') {
    while ([0, 6].includes(new Date(next + OFFSET).getUTCDay())) {
      next += 864e5;
    }
  }
  return next;
}

/** Bir sonraki termin: şu andan sonraki ilk tekrar. Kaçırılan tekrarlar atlanır. */
export function nextDue(dueAt, freq, now) {
  let due = Date.parse(dueAt);
  let next = step(due, freq);
  for (let guard = 0; next <= now && guard < 2000; guard++) {
    next = step(next, freq);
  }
  return next;
}

/** Tamamlanan işten bir sonraki kopyayı üretir (kayıt alanları sıfırlanır). */
export function recurringCopy(task, id, createId, now) {
  let due = nextDue(task.dueAt, task.recurrence, now);
  let shift = due - Date.parse(task.dueAt);
  let start = task.plannedStart ? Date.parse(task.plannedStart) + shift : now;
  return {
    ...structuredClone(task),
    id,
    status: 'todo',
    dueAt: new Date(due).toISOString(),
    plannedStart: new Date(Math.min(start, due)).toISOString(),
    date: '',
    recurrenceOf: task.id,
    revisionCount: 0,
    dueRevisionCount: 0,
    originalDueAt: '',
    verified: false,
    waitingReason: '',
    waitingNote: '',
    depends: [],
    createdAt: '',
    createdBy: '',
    startedAt: '',
    completedAt: '',
    closedAt: '',
    checklist: task.checklist.map((item) => ({ ...item, id: createId(), done: false, doneBy: '', doneAt: '' })),
  };
}
