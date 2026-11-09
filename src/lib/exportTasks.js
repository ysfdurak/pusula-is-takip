// İş listesini (o anki filtreyle) Excel dosyası olarak indirir.
import { buildXlsx } from './xlsx.js';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from './labels.js';
import { RECURRENCE_LABELS } from '../shared/recurrence.js';
import { teamName } from '../shared/workspaceModel.js';

const asDate = (value) => (value ? new Date(value) : null);

export function tasksWorkbook(tasks, { workspace, memberName, projectName, isLate, workspaceName }) {
  const columns = [
    { header: 'İş', width: 42 },
    { header: 'Durum', width: 14 },
    { header: 'Öncelik', width: 10 },
    { header: 'Sorumlular', width: 28 },
    { header: 'Ekip', width: 18 },
    { header: 'Proje', width: 18 },
    { header: 'Başlangıç', width: 17 },
    { header: 'Termin', width: 17 },
    { header: 'Gecikti', width: 9 },
    { header: 'Tamamlanma', width: 17 },
    { header: 'Kontrol adımı', width: 13 },
    { header: 'Revizyon', width: 10 },
    { header: 'Termin değişikliği', width: 17 },
    { header: 'Tekrar', width: 16 },
    { header: 'Bekleme / engel notu', width: 30 },
  ];
  const rows = tasks.map((task) => [
    task.title,
    TASK_STATUS_LABELS[task.status] || task.status,
    PRIORITY_LABELS[task.priority] || task.priority,
    task.assignees.map(memberName).join(', ') || (task.teamId ? 'Ekip havuzu' : ''),
    task.teamId ? teamName(task.teamId, workspace) : '',
    task.project ? projectName(task.project) : '',
    asDate(task.plannedStart),
    asDate(task.dueAt || (task.date ? task.date + 'T20:59:59Z' : '')),
    isLate(task) ? 'Evet' : '',
    asDate(task.completedAt),
    task.checklist.length ? task.checklist.filter((s) => s.done).length + '/' + task.checklist.length : '',
    task.revisionCount,
    task.dueRevisionCount,
    task.recurrence ? RECURRENCE_LABELS[task.recurrence] : '',
    task.waitingNote,
  ]);
  return buildXlsx(workspaceName || 'İşler', columns, rows);
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60e3);
}

export { safeFileName } from './xlsx.js';
