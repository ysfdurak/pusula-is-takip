import { taskFromTemplate, taskSchema } from '../shared/workspaceModel.js';

const isOpenTask = (task) => !['done', 'cancelled'].includes(task.status);

const dueTimestamp = (task) =>
  task.dueAt ? Date.parse(task.dueAt) : task.date ? Date.parse(task.date + 'T23:59:59+03:00') : null;

export function taskObstacles(item, workspace) {
  return [
    ...workspace.blockers
      .filter((blocker) => blocker.task === item.id && !blocker.resolved)
      .map((blocker) => blocker.title),
    ...item.depends
      .filter((dependencyId) => workspace.tasks.find((task) => task.id === dependencyId)?.status !== 'done')
      .map(
        (dependencyId) =>
          'Ön koşul: ' +
          (workspace.tasks.find((task) => task.id === dependencyId)?.title || 'Bulunamayan iş'),
      ),
  ];
}

export function projectSummaries(state, now) {
  return state.projects.map((project) => {
    let matchingTasks = state.tasks.filter((task) => task.project === project.id);
    let i = matchingTasks.filter(isOpenTask);
    let a = matchingTasks.filter((task) => task.status === 'done').length;
    let o = matchingTasks.filter((task) => task.status === 'cancelled').length;
    let s = matchingTasks.length - o;
    let c = i.filter((e) => dueTimestamp(e) !== null && dueTimestamp(e) < now).length;
    let l = i.filter((t) => taskObstacles(t, state).length).length;
    let u = i.filter((e) => dueTimestamp(e) === null).length;
    let d = i.filter((task) => !task.assignees.length).length;
    let f = !!(project.date && Date.parse(project.date + 'T23:59:59+03:00') < now && i.length);
    let p = matchingTasks.length
      ? s
        ? i.length
          ? c || f
            ? 'late'
            : l || u || d
              ? 'risk'
              : 'ontrack'
          : 'done'
        : 'cancelled'
      : 'empty';
    return {
      ...project,
      total: matchingTasks.length,
      open: i.length,
      done: a,
      cancelled: o,
      late: c,
      blocked: l,
      undated: u,
      unassigned: d,
      health: p,
      progress: s ? Math.round((a / s) * 100) : 0,
    };
  });
}

export const DEFAULT_FOCUS_SETTINGS = {
  focus: 'all',
  person: 'all',
  sort: 'priority',
  closedDays: 7,
};

export function filterFocusTasks(focusPool, workspace, focusSettings, now, i) {
  let a = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  return focusPool
    .filter((task) => {
      let a = dueTimestamp(task);
      let o = isOpenTask(task);
      let s =
        a === null
          ? ''
          : new Intl.DateTimeFormat('sv-SE', {
              timeZone: 'Europe/Istanbul',
            }).format(new Date(a));
      return (focusSettings.person !== 'all' && !task.assignees.includes(focusSettings.person)) ||
        (!o &&
          focusSettings.closedDays &&
          (!(task.closedAt || task.completedAt) ||
            Date.parse(task.closedAt || task.completedAt) < now - focusSettings.closedDays * 864e5))
        ? false
        : focusSettings.focus === 'all' ||
            (focusSettings.focus === 'open' && o) ||
            (focusSettings.focus === 'late' && o && a !== null && a < now) ||
            (focusSettings.focus === 'today' && o && s === i) ||
            (focusSettings.focus === 'blocked' && o && taskObstacles(task, workspace).length > 0) ||
            (focusSettings.focus === 'unassigned' && o && !task.assignees.length) ||
            (focusSettings.focus === 'undated' && o && a === null) ||
            (focusSettings.focus === 'review' && o && task.requireApproval && !task.verified) ||
            (focusSettings.focus === 'rescheduled' && task.dueRevisionCount > 0);
    })
    .sort((e, b) =>
      focusSettings.sort === 'title'
        ? e.title.localeCompare(b.title, 'tr')
        : focusSettings.sort === 'created'
          ? b.createdAt.localeCompare(e.createdAt)
          : focusSettings.sort === 'due'
            ? (dueTimestamp(e) ?? 1 / 0) - (dueTimestamp(b) ?? 1 / 0) || a[b.priority] - a[e.priority]
            : a[b.priority] - a[e.priority] || (dueTimestamp(e) ?? 1 / 0) - (dueTimestamp(b) ?? 1 / 0),
    );
}

export const EMPTY_QUICK_DRAFT = {
  title: '',
  assignment: 'me',
  date: '',
  template: '',
};

export const istanbulDay = (e) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date(e));

export const endOfDayInDays = (e, t) =>
  new Date(istanbulDay(e + t * 864e5) + 'T23:59:59.999+03:00').toISOString();

export function buildQuickTask(e, workspace, n, user, i, a, o, s) {
  let template = workspace.templates.find((template) => template.id === e.template);
  if (e.template && !template) {
    throw Error('Şablon artık yok. Başka bir şablon seç.');
  }
  let task = template
    ? taskFromTemplate(template, a, o, n)
    : taskSchema.parse({
        id: a,
        title: e.title,
        status: 'todo',
      });
  let u =
    e.assignment === 'template'
      ? task.assignees
      : e.assignment === 'me'
        ? [user]
        : e.assignment === 'all'
          ? n
          : e.assignment === 'none'
            ? []
            : [e.assignment];
  if (u.some((e) => !n.includes(e))) {
    throw Error('Atama için aktif bir ekip üyesi seç.');
  }
  if (((task.title = e.title.trim()), !task.title)) {
    throw Error('İşin adını yaz.');
  }
  task.assignees = u;
  task.kind = u.length > 1 ? 'shared' : template?.task.kind || 'individual';
  task.plannedStart = new Date(s).toISOString();
  task.dueAt = e.date ? new Date(e.date + 'T23:59:59.999+03:00').toISOString() : '';
  task.date = e.date;
  task.project = i === null ? task.project : i;
  if (task.project && !workspace.projects.some((project) => project.id === task.project)) {
    task.project = '';
  }
  return taskSchema.parse(task);
}

export function completionIssues(item, workspace) {
  return [
    ...taskObstacles(item, workspace),
    ...(item.waitingReason ? ['Bekleme sona erdiğinde bekleme bilgisini kaldır.'] : []),
    ...(item.checklistRequired && item.checklist.some((step) => !step.done)
      ? ['Zorunlu kontrol adımlarını tamamla.']
      : []),
    ...(item.requireApproval && !item.criteria.trim() ? ['Kabul ölçütü henüz tanımlanmadı.'] : []),
    ...(item.requireApproval && !item.verified ? ['Kabul ölçütünü doğrula.'] : []),
  ];
}
