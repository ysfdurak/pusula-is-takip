import { z } from 'zod';

const longText = z.string().max(4e3);

const idString = z.string().min(1).max(100);

const utcTimestamp = z
  .string()
  .max(40)
  .refine((e) => !e || (!Number.isNaN(Date.parse(e)) && /Z$/.test(e)), 'Geçerli UTC zamanı gerekli.');

export const taskSchema = z.object({
  id: idString,
  teamId: z.string().max(100).default(''),
  relatedTeamIds: z.array(idString).max(50).default([]),
  coordinator: z.string().max(254).default(''),
  workType: z.string().max(120).default(''),
  waitingReason: z.enum(['', 'information', 'dependency', 'resource']).default(''),
  waitingNote: z.string().max(1e3).default(''),
  project: z.string().max(100).default(''),
  title: longText.trim().min(1),
  description: longText.default(''),
  assignee: longText.default(''),
  assignees: z.array(z.string().email().max(254)).max(200).default([]),
  watchers: z.array(z.string().email().max(254)).max(200).default([]),
  kind: z.enum(['individual', 'shared']).default('individual'),
  date: longText.default(''),
  plannedStart: utcTimestamp.default(''),
  dueAt: utcTimestamp.default(''),
  phase: longText.default('Operasyon'),
  estimatedMinutes: z.number().int().min(0).max(144e3).default(0),
  checklist: z
    .array(
      z.object({
        id: idString,
        text: z.string().trim().min(1).max(500),
        done: z.boolean(),
        doneBy: z.string().max(254).default(''),
        doneAt: utcTimestamp.default(''),
      }),
    )
    .max(100)
    .default([]),
  checklistRequired: z.boolean().default(false),
  status: z.preprocess(
    (e) => (e === 'waiting' ? 'todo' : e === 'review' ? 'doing' : e),
    z.enum(['todo', 'doing', 'done', 'cancelled']),
  ),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  revisionCount: z.number().int().min(0).default(0),
  dueRevisionCount: z.number().int().min(0).default(0),
  originalDueAt: utcTimestamp.default(''),
  criteria: longText.default(''),
  verified: z.boolean().default(false),
  requireApproval: z.boolean().default(false),
  depends: z.array(idString).max(100).default([]),
  closedAt: utcTimestamp.default(''),
  trackTime: z.boolean().default(false),
  notifyEmail: z.boolean().default(true),
  createdBy: z.string().max(254).default(''),
  createdAt: utcTimestamp.default(''),
  startedAt: utcTimestamp.default(''),
  completedAt: utcTimestamp.default(''),
  recurrence: z.enum(['', 'daily', 'weekdays', 'weekly', 'monthly']).default(''),
  recurrenceOf: z.string().max(100).default(''),
});

const templateSchema = z.object({
  id: idString,
  name: z.string().trim().min(1).max(120),
  task: taskSchema,
});

const workspaceStateSchema = z.object({
  teams: z
    .array(
      z.object({
        id: idString,
        name: z.string().trim().min(1).max(120),
        members: z.array(z.string().email()).max(200),
        leads: z.array(z.string().email()).max(50),
        active: z.boolean().default(true),
        workTypes: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
      }),
    )
    .max(100)
    .default([]),
  workRules: z
    .object({
      maxDurationDays: z.number().int().min(0).max(3650).default(0),
      dueRequired: z.boolean().default(false),
    })
    .default({
      maxDurationDays: 0,
      dueRequired: false,
    }),
  templates: z.array(templateSchema).max(50).default([]),
  projects: z
    .array(
      z.object({
        id: idString,
        name: longText.min(1),
        goal: longText,
        scope: longText,
        excluded: longText,
        date: longText,
      }),
    )
    .max(100),
  tasks: z.array(taskSchema).max(2e3),
  decisions: z
    .array(
      z.object({
        id: idString,
        project: idString,
        title: longText.min(1),
        reason: longText,
        impact: longText,
        date: longText,
      }),
    )
    .max(1e3),
  blockers: z
    .array(
      z.object({
        id: idString,
        project: z.string().max(100),
        task: longText,
        title: longText.min(1),
        owner: longText,
        resolved: z.boolean(),
      }),
    )
    .max(1e3),
});

export const EMPTY_STATE = {
  teams: [],
  workRules: {
    maxDurationDays: 0,
    dueRequired: false,
  },
  templates: [],
  projects: [],
  tasks: [],
  decisions: [],
  blockers: [],
};

export function normalizeState(state) {
  return workspaceStateSchema.parse({
    ...EMPTY_STATE,
    ...state,
    tasks: (state.tasks || []).map((task) => ({
      ...task,
      requireApproval: task.requireApproval ?? true,
      assignees:
        task.assignees || (/^\S+@\S+\.\S+$/.test(task.assignee || '') ? [task.assignee.toLowerCase()] : []),
    })),
  });
}

export function validateStructure(state) {
  if (new Set(state.teams.map((team) => team.id)).size !== state.teams.length) {
    return 'Ekip kimliği tekrarlanamaz.';
  }
  let teamIds = new Set(state.teams.map((team) => team.id));
  let workTypes = new Set();
  for (let team of state.teams) {
    if (
      new Set(team.members).size !== team.members.length ||
      new Set(team.leads).size !== team.leads.length ||
      team.leads.some((email) => !team.members.includes(email))
    ) {
      return 'Ekip yöneticileri ekip üyesi olmalı; üyeler tekrarlanamaz.';
    }
    for (let workType of team.workTypes) {
      if (workTypes.has(workType.toLocaleLowerCase('tr'))) {
        return 'Bir iş türü yalnızca bir varsayılan ekibe yönlendirilebilir.';
      }
      workTypes.add(workType.toLocaleLowerCase('tr'));
    }
  }
  for (let item of [...state.tasks, ...state.templates.map((template) => template.task)]) {
    if (
      (item.teamId && !teamIds.has(item.teamId)) ||
      item.relatedTeamIds.some((teamId) => !teamIds.has(teamId))
    ) {
      return 'Geçerli ekip seçin.';
    }
    if (
      new Set(item.relatedTeamIds).size !== item.relatedTeamIds.length ||
      item.relatedTeamIds.includes(item.teamId)
    ) {
      return 'İlgili ekipler tekrarlanamaz.';
    }
    if (item.relatedTeamIds.length && !item.teamId) {
      return 'Ortak iş için ana ekip seçin.';
    }
  }
  if (new Set(state.templates.map((template) => template.id)).size !== state.templates.length) {
    return 'Şablon kimliği tekrarlanamaz.';
  }
  let projectIds = new Set(state.projects.map((project) => project.id));
  let taskById = new Map(state.tasks.map((task) => [task.id, task]));
  if (projectIds.size !== state.projects.length || taskById.size !== state.tasks.length) {
    return 'Kayıt kimliği tekrarlanamaz.';
  }
  for (let record of [...state.tasks, ...state.decisions, ...state.blockers])
    if (record.project && !projectIds.has(record.project)) {
      return 'Geçersiz proje.';
    }
  for (let task of state.tasks) {
    if (new Set(task.checklist.map((step) => step.id)).size !== task.checklist.length) {
      return 'Adım kimliği tekrarlanamaz.';
    }
    if (task.status === 'done' && task.checklistRequired && task.checklist.some((step) => !step.done)) {
      return 'İşi tamamlamak için kontrol listesindeki tüm adımları bitirin.';
    }
    if (task.kind === 'individual' && task.assignees.length > 1) {
      return 'Bireysel işe yalnızca bir sorumlu atanabilir.';
    }
    if (new Set(task.assignees).size !== task.assignees.length) {
      return 'Sorumlular tekrarlanamaz.';
    }
    if (task.recurrence && !task.dueAt) {
      return 'Tekrarlanan iş için termin tarihi seçin.';
    }
    if (task.plannedStart && task.dueAt && task.plannedStart > task.dueAt) {
      return 'Bitiş zamanı başlangıçtan önce olamaz.';
    }
    if (
      task.depends.some(
        (dependencyId) => !taskById.has(dependencyId) || taskById.get(dependencyId).project !== task.project,
      )
    ) {
      return 'Bağımlılık aynı projede / iş grubunda olmalı.';
    }
  }
  for (let task of state.tasks) {
    if (task.waitingReason && !task.waitingNote.trim()) {
      return 'Bekleme nedeni için kısa açıklama yazın.';
    }
    if (task.status === 'done' && task.waitingReason) {
      return 'İşi tamamlamadan önce bekleme bilgisini kaldırın.';
    }
    let visited = new Set();
    let reaches = (e) =>
      e === task.id ? true : visited.has(e) ? false : (visited.add(e), taskById.get(e).depends.some(reaches));
    if (task.depends.some(reaches)) {
      return 'Döngüsel görev bağımlılığı kurulamaz.';
    }
    if (
      ['doing', 'review', 'done'].includes(task.status) &&
      task.depends.some((dependencyId) => taskById.get(dependencyId)?.status !== 'done')
    ) {
      return 'Önce bağımlı olunan görevleri tamamlayın.';
    }
    if (task.status === 'done' && task.requireApproval && (!task.criteria.trim() || !task.verified)) {
      return 'Tamamlamak için kabul ölçütü yazın ve doğrulayın.';
    }
    if (
      task.status === 'done' &&
      state.blockers.some((blocker) => blocker.task === task.id && !blocker.resolved)
    ) {
      return 'Göreve bağlı açık engeli önce çözün.';
    }
  }
  for (let blocker of state.blockers)
    if (
      blocker.task &&
      (!taskById.has(blocker.task) || taskById.get(blocker.task).project !== blocker.project)
    ) {
      return 'Engel görevi aynı projede olmalı.';
    }
  return null;
}

export function taskFromTemplate(template, id, createId, memberEmails) {
  let allowed = new Set(memberEmails);
  return taskSchema.parse({
    ...template.task,
    id,
    assignees: template.task.assignees.filter((email) => allowed.has(email)),
    watchers: template.task.watchers.filter((email) => allowed.has(email)),
    status: 'todo',
    revisionCount: 0,
    dueRevisionCount: 0,
    originalDueAt: '',
    plannedStart: '',
    dueAt: '',
    date: '',
    createdAt: '',
    createdBy: '',
    startedAt: '',
    completedAt: '',
    closedAt: '',
    verified: false,
    waitingReason: '',
    waitingNote: '',
    coordinator: memberEmails.includes(template.task.coordinator) ? template.task.coordinator : '',
    depends: [],
    checklist: template.task.checklist.map((step) => ({
      ...step,
      id: createId(),
      done: false,
      doneBy: '',
      doneAt: '',
    })),
  });
}

export function validateSchedule(next, current) {
  for (let task of next.tasks) {
    let previous = current.tasks.find((e) => e.id === task.id);
    if (
      previous &&
      task.plannedStart === previous.plannedStart &&
      task.dueAt === previous.dueAt &&
      task.date === previous.date
    ) {
      continue;
    }
    if (next.workRules.dueRequired && !task.dueAt && !task.date) {
      return 'Bu ekipte termin tarihi zorunlu.';
    }
    let due = task.dueAt || (task.date ? task.date + 'T23:59:59+03:00' : '');
    if (!due) {
      continue;
    }
    let start = task.plannedStart || task.createdAt || new Date().toISOString();
    if (Number.isNaN(Date.parse(due))) {
      return 'Geçerli bir termin tarihi girin.';
    }
    let dayOf = (e) =>
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Istanbul',
      }).format(new Date(e));
    let durationDays =
      (Date.parse(dayOf(due) + 'T00:00:00Z') - Date.parse(dayOf(start) + 'T00:00:00Z')) / 864e5;
    if (durationDays < 0) {
      return 'Termin başlangıçtan önce olamaz.';
    }
    if (next.workRules.maxDurationDays && durationDays > next.workRules.maxDurationDays) {
      return (
        'Termin başlangıçtan en fazla ' + next.workRules.maxDurationDays + ' takvim günü sonra olabilir.'
      );
    }
  }
  return null;
}

export const WAITING_REASON_LABELS = {
  information: 'Bilgi bekleniyor',
  dependency: 'Başka iş bekleniyor',
  resource: 'Kaynak bekleniyor',
};

export const taskTeamIds = (task) => [task.teamId, ...task.relatedTeamIds].filter(Boolean);

export const teamName = (teamId, state) =>
  state.teams.find((team) => team.id === teamId)?.name || 'Genel işler';

export function canAccessTask(task, merged, actor, role) {
  return (
    role === 'owner' ||
    !taskTeamIds(task).length ||
    task.createdBy === actor ||
    task.coordinator === actor ||
    task.assignees.includes(actor) ||
    task.watchers.includes(actor) ||
    merged.teams.some(
      (team) =>
        team.active &&
        taskTeamIds(task).includes(team.id) &&
        (team.members.includes(actor) || team.leads.includes(actor)),
    )
  );
}

export function visibleStateFor(merged, actor, role) {
  let matchingTasks = merged.tasks.filter((task) => canAccessTask(task, merged, actor, role));
  let taskIds = new Set(matchingTasks.map((task) => task.id));
  return {
    ...merged,
    tasks: matchingTasks,
    templates: merged.templates.filter((template) => canAccessTask(template.task, merged, actor, role)),
    blockers: merged.blockers.filter((blocker) => !blocker.task || taskIds.has(blocker.task)),
  };
}

export function assertPermittedChanges(current, proposed, actor, role) {
  if (role !== 'owner') {
    for (let teamId of new Set([
      ...current.teams.map((team) => team.id),
      ...proposed.teams.map((team) => team.id),
    ])) {
      let currentTeam = current.teams.find((team) => team.id === teamId);
      let proposedTeam = proposed.teams.find((team) => team.id === teamId);
      if (
        JSON.stringify(currentTeam) !== JSON.stringify(proposedTeam) &&
        (!currentTeam || !proposedTeam || !currentTeam.leads.includes(actor))
      ) {
        throw Error('Yalnızca yöneticisi olduğunuz ekibin tanımını değiştirebilirsiniz.');
      }
    }
  }
  let merged = structuredClone(proposed);
  for (let collection of ['tasks', 'templates', 'blockers']) {
    let visible = visibleStateFor(current, actor, role)[collection];
    let visibleIds = new Set(visible.map((e) => e.id));
    let hidden = current[collection].filter((e) => !visibleIds.has(e.id));
    if (merged[collection].some((e) => hidden.some((t) => t.id === e.id))) {
      throw Error('Bu kaydı değiştirme yetkiniz yok.');
    }
    merged[collection] = [...merged[collection], ...hidden];
  }
  for (let task of merged.tasks) {
    let previous = current.tasks.find((e) => e.id === task.id);
    if (!(previous && !canAccessTask(previous, current, actor, role))) {
      if (!canAccessTask(task, merged, actor, role)) {
        throw Error('Yalnızca üyesi olduğunuz veya sorumlusu olduğunuz ekibe iş oluşturabilirsiniz.');
      }
      if (
        role !== 'owner' &&
        taskTeamIds(task).some(
          (e) =>
            !(previous ? taskTeamIds(previous) : []).includes(e) &&
            !merged.teams.some((team) => team.id === e && team.active && team.members.includes(actor)),
        )
      ) {
        throw Error('Yeni ilgili ekip eklemek için o ekibe üyelik veya yönetici yetkisi gerekir.');
      }
      if (
        taskTeamIds(task).some(
          (e) =>
            !merged.teams.some((team) => team.id === e && team.active) &&
            !taskTeamIds(
              previous || {
                ...task,
                teamId: '',
                relatedTeamIds: [],
              },
            ).includes(e),
        )
      ) {
        throw Error('Pasif ekibe yeni iş yönlendirilemez.');
      }
    }
  }
  return merged;
}

export function validateMembership(next, current, members) {
  let activeEmails = new Set(members.filter((member) => member.active === 1).map((member) => member.email));
  let editorEmails = new Set(
    members.filter((member) => member.active === 1 && member.role !== 'viewer').map((member) => member.email),
  );
  for (let team of next.teams) {
    let previousTeam = current.teams.find((e) => e.id === team.id);
    if (team.members.some((member) => !activeEmails.has(member) && !previousTeam?.members.includes(member))) {
      return 'Ekibe yalnızca aktif kişiler eklenebilir.';
    }
    if (team.leads.some((email) => !editorEmails.has(email) && !previousTeam?.leads.includes(email))) {
      return 'Ekip yöneticisi aktif ve düzenleme yetkili olmalı.';
    }
  }
  for (let task of next.tasks) {
    let previousTask = current.tasks.find((e) => e.id === task.id);
    if (
      task.coordinator &&
      !editorEmails.has(task.coordinator) &&
      task.coordinator !== previousTask?.coordinator
    ) {
      return 'Koordinatör aktif ve düzenleme yetkili olmalı.';
    }
  }
  return null;
}

export function poolTasks(workspace, user, role, teamScope = 'all') {
  return workspace.tasks.filter(
    (task) =>
      task.teamId &&
      !task.assignees.length &&
      !['done', 'cancelled'].includes(task.status) &&
      canAccessTask(task, workspace, user, role) &&
      (teamScope === 'all' || taskTeamIds(task).includes(teamScope)),
  );
}

export const FIELD_LABELS = {
  teamId: 'Ana ekip',
  relatedTeamIds: 'İlgili ekipler',
  coordinator: 'Koordinatör',
  workType: 'İş kategorisi',
  waitingReason: 'Bekleme nedeni',
  waitingNote: 'Bekleme açıklaması',
  title: 'İş başlığı',
  description: 'İş tarifi',
  assignees: 'Sorumlular',
  watchers: 'Takipçiler',
  kind: 'Atama biçimi',
  plannedStart: 'Başlangıç tarihi',
  dueAt: 'Termin tarihi',
  date: 'Hedef gün',
  status: 'Statü',
  priority: 'Öncelik',
  phase: 'Operasyon',
  project: 'Proje',
  checklist: 'Kontrol adımları',
  checklistRequired: 'Kontrol zorunluluğu',
  estimatedMinutes: 'Tahmini emek',
  criteria: 'Kabul ölçütü',
  verified: 'Doğrulama',
  requireApproval: 'Kabul zorunluluğu',
  depends: 'Ön koşullar',
  recurrence: 'Tekrar',
  trackTime: 'Süre takibi',
  notifyEmail: 'E-posta tercihi',
};

export function stampTaskMetadata(task, previous, actor, now) {
  let timestamp = new Date(now).toISOString();
  task.createdBy = previous?.createdBy || actor;
  task.createdAt = previous?.createdAt || timestamp;
  if (!previous && !task.plannedStart) {
    task.plannedStart = timestamp;
  }
  task.startedAt = previous?.startedAt || (task.status === 'doing' ? timestamp : '');
  task.completedAt =
    task.status === 'done' ? (previous?.status === 'done' ? previous.completedAt : timestamp) : '';
  task.closedAt = ['done', 'cancelled'].includes(task.status)
    ? previous && previous.status === task.status
      ? previous.closedAt || previous.completedAt || ''
      : timestamp
    : '';
  task.assignee = task.assignees[0] || '';
  for (let step of task.checklist) {
    let previousStep = previous?.checklist.find((e) => e.id === step.id);
    step.doneBy = step.done ? (previousStep?.done ? previousStep.doneBy : actor) : '';
    step.doneAt = step.done ? (previousStep?.done ? previousStep.doneAt : timestamp) : '';
  }
  let changes = previous
    ? Object.entries(FIELD_LABELS)
        .filter(([key]) => !(key === 'date' && (task.dueAt || previous.dueAt)))
        .filter(([key]) => JSON.stringify(previous[key]) !== JSON.stringify(task[key]))
        .map(([key, value]) => ({
          field: key,
          label: value,
          before: previous[key],
          after: task[key],
        }))
    : [];
  let dueChanged = !!(previous && (previous.dueAt !== task.dueAt || previous.date !== task.date));
  task.revisionCount = (previous?.revisionCount || 0) + +!!changes.length;
  task.dueRevisionCount = (previous?.dueRevisionCount || 0) + +!!dueChanged;
  task.originalDueAt = previous
    ? previous.originalDueAt ||
      previous.dueAt ||
      (previous.date
        ? previous.date + 'T20:59:59Z'
        : task.dueAt || (task.date ? task.date + 'T20:59:59Z' : ''))
    : task.dueAt || (task.date ? task.date + 'T20:59:59Z' : '');
  return {
    changes,
    dueChanged,
  };
}

export const DEFAULT_NOTIFY_POLICY = {
  assigned: true,
  status: true,
  comment: true,
  completed: true,
  managers: true,
};
