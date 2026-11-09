import {
  DEFAULT_NOTIFY_POLICY,
  EMPTY_STATE,
  assertPermittedChanges,
  canAccessTask,
  normalizeState,
  stampTaskMetadata,
  taskSchema,
  validateMembership,
  validateSchedule,
  validateStructure,
  visibleStateFor,
} from '../shared/workspaceModel.js';

export const DEMO_USERS = [
  {
    email: 'deniz@example.test',
    name: 'Deniz Yılmaz',
    department: 'Operasyon',
    role: 'owner',
  },
  {
    email: 'ece@example.test',
    name: 'Ece Kaya',
    department: 'Sevkiyat',
    role: 'editor',
  },
  {
    email: 'mert@example.test',
    name: 'Mert Aras',
    department: 'Stok Kontrol',
    role: 'editor',
  },
  {
    email: 'selin@example.test',
    name: 'Selin Aydın',
    department: 'Planlama',
    role: 'viewer',
  },
];

const DEMO_STORAGE_KEY = 'pusula-offline-design-v5';

const newDemoId = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (e) => e.toString(16).padStart(2, '0')).join('');

let demoCache = null;

function createDemoData() {
  let e = Date.now();
  let t = (t) => new Date(e + t * 36e5).toISOString();
  let n = DEMO_USERS[0].email;
  let r = DEMO_USERS[1].email;
  let i = DEMO_USERS[2].email;
  let a = {
    id: 'depo',
    name: 'Günlük depo operasyonu',
    goal: 'Vardiya işlerini görünür ve takip edilebilir tutmak.',
    scope: 'Sevkiyat, sayım ve vardiya kapanışı',
    excluded: 'WMS stok hareketleri',
    date: '',
  };
  let o = (e, r, task = {}) =>
    taskSchema.parse({
      id: e,
      title: r,
      status: 'todo',
      project: 'depo',
      createdBy: n,
      createdAt: t(-120),
      originalDueAt: task.dueAt || '',
      phase: 'Operasyon',
      assignees: [n],
      ...task,
    });
  let s = [
    o('d1', 'Sabah sevkiyat kontrolü', {
      assignees: [r, i],
      kind: 'shared',
      status: 'doing',
      plannedStart: t(-2),
      dueAt: t(3),
      description:
        'Sevkiyat alanındaki hazır kolileri teslimat listesiyle karşılaştır. Eksikleri bu işin yorumlarında paylaş.',
      trackTime: true,
      estimatedMinutes: 90,
      checklistRequired: true,
      checklist: [
        {
          id: 's1',
          text: 'Teslimat listesini doğrula',
          done: true,
          doneBy: r,
          doneAt: t(-1),
        },
        {
          id: 's2',
          text: 'Koli etiketlerini kontrol et',
          done: false,
        },
        {
          id: 's3',
          text: 'Eksikleri ekiple paylaş',
          done: false,
        },
      ],
    }),
    o('d2', 'Eksik koli bildirimlerini tamamla', {
      assignees: [r],
      status: 'todo',
      plannedStart: t(-100),
      dueAt: t(-22),
      originalDueAt: t(-48),
      revisionCount: 2,
      dueRevisionCount: 2,
      priority: 'high',
      description: 'Eksik koli kayıtları için operasyon dönüşü bekleniyor.',
    }),
    o('d3', 'A koridoru sayım farkını incele', {
      assignees: [i],
      status: 'doing',
      dueAt: t(-4),
      priority: 'urgent',
      estimatedMinutes: 60,
    }),
    o('d4', 'Yeni iade alanını düzenle', {
      assignees: [],
      description: 'Yeni görev: sorumlusunu ve hedef tarihini belirle.',
    }),
    o('d5', 'Vardiya kapanış raporunu doğrula', {
      assignees: [n],
      status: 'doing',
      dueAt: t(5),
      requireApproval: true,
      criteria: 'Rapor toplamı sevkiyat listesiyle aynı olmalı.',
    }),
    o('d6', 'Raf etiketlerini yenile', {
      project: 'iyilestirme',
      assignees: [i],
      dueAt: t(27),
      estimatedMinutes: 120,
    }),
    o('d7', 'İade ürünleri sınıflandır', {
      assignees: [r, i],
      kind: 'shared',
      dueAt: t(50),
      estimatedMinutes: 180,
    }),
    o('d8', 'Ekipman kontrol listesini güncelle', {
      project: 'iyilestirme',
      assignees: [n],
      dueAt: t(72),
      checklist: [
        {
          id: 's4',
          text: 'Kontrol başlıklarını gözden geçir',
          done: false,
        },
        {
          id: 's5',
          text: 'Ekiple paylaş',
          done: false,
        },
      ],
    }),
    o('d9', 'Dünkü sevkiyat kayıtlarını kapat', {
      assignees: [r],
      status: 'done',
      startedAt: t(-28),
      completedAt: t(-23),
      dueAt: t(-22),
    }),
    o('d10', 'Haftalık sayım raporunu paylaş', {
      originalDueAt: t(-60),
      dueRevisionCount: 1,
      revisionCount: 1,
      assignees: [i],
      status: 'done',
      startedAt: t(-55),
      completedAt: t(-50),
      dueAt: t(-48),
    }),
    o('d11', 'İade alanı işaretlemesini kontrol et', {
      assignees: [n],
      status: 'done',
      startedAt: t(-80),
      completedAt: t(-75),
      dueAt: t(-70),
    }),
    o('d12', 'Saha düzeni kontrol turu', {
      assignees: [r],
      status: 'cancelled',
      closedAt: t(-6),
      description: 'Vardiya planı değiştiği için bu tur iptal edildi.',
      dueAt: t(-5),
    }),
  ];
  let c = o('template-original', 'Vardiya kapanış kontrolü', {
    project: '',
    assignees: [n],
    checklistRequired: true,
    checklist: [
      {
        id: 't1',
        text: 'Açık sevkiyatları kontrol et',
        done: false,
      },
      {
        id: 't2',
        text: 'Eksik / hasarlı ürünleri kaydet',
        done: false,
      },
      {
        id: 't3',
        text: 'Vardiya notunu ekiple paylaş',
        done: false,
      },
    ],
  });
  for (let task of s) {
    task.teamId = ['d3', 'd6', 'd10'].includes(task.id) ? 'stock' : 'shipping';
    if (['d1', 'd7'].includes(task.id)) {
      task.relatedTeamIds = ['stock'];
    }
    if (task.assignees.length > 1) {
      task.coordinator = task.assignees[0];
    }
  }
  c.teamId = 'shipping';
  let state = normalizeState({
    ...EMPTY_STATE,
    teams: [
      {
        id: 'shipping',
        name: 'Sevkiyat',
        members: [n, r, 'selin@example.test'],
        leads: [r],
        active: true,
        workTypes: ['Sevkiyat', 'İade'],
      },
      {
        id: 'stock',
        name: 'Stok Kontrol',
        members: [n, i, 'selin@example.test'],
        leads: [i],
        active: true,
        workTypes: ['Sayım'],
      },
    ],
    projects: [
      a,
      {
        id: 'iyilestirme',
        name: 'Vardiya iyileştirme',
        goal: 'Etiket ve ekipman kontrolünü standartlaştırmak.',
        scope: 'Raf etiketleri ve kontrol listesi',
        excluded: 'Stok yazılımı değişiklikleri',
        date: new Date(e + 7 * 864e5).toISOString().slice(0, 10),
      },
    ],
    tasks: s,
    templates: [
      {
        id: 'template-1',
        name: 'Vardiya kapanış rutini',
        task: c,
      },
    ],
    blockers: [
      {
        id: 'b1',
        project: 'depo',
        task: 'd2',
        title: 'Taşıyıcıdan teslimat bilgisi bekleniyor',
        owner: 'Ece Kaya',
        resolved: false,
      },
    ],
  });
  return {
    actor: n,
    workspaces: [
      {
        id: 'design',
        name: 'Örnek Operasyon Merkezi',
      },
    ],
    members: {
      design: DEMO_USERS.map((e) => ({
        ...e,
        active: 1,
        mail_enabled: 1,
        notify_self: 0,
      })),
    },
    states: {
      design: state,
    },
    revisions: {
      design: 1,
    },
    policies: {
      design: DEFAULT_NOTIFY_POLICY,
    },
    notifications: [
      {
        id: 'n1',
        workspace: 'design',
        task: 'd1',
        recipient: n,
        kind: 'comment',
        title: 'Yeni yorum: Sabah sevkiyat kontrolü',
        body: 'Ece bir gelişme paylaştı.',
        created: e - 18e5,
        mail: 'disabled',
        detail: 'Tasarım demosunda gerçek e-posta gönderilmez.',
        read_at: null,
      },
    ],
    comments: [
      {
        id: 'c1',
        workspace: 'design',
        task: 'd1',
        author: r,
        body: 'Teslimat listesi doğrulandı. Etiket kontrolüne geçiyoruz.',
        created: e - 18e5,
      },
    ],
    activities: [
      {
        id: 'report-revision',
        workspace: 'design',
        task: 'd10',
        actor: i,
        kind: 'revision',
        created: e - 55 * 36e5,
        after: JSON.stringify({
          number: 1,
          reason: 'Sayım farkı doğrulaması için plan revize edildi.',
          dueChanged: true,
          changes: [
            {
              field: 'dueAt',
              label: 'Termin tarihi',
              before: t(-60),
              after: t(-48),
            },
          ],
        }),
      },
      {
        id: 'rev2',
        workspace: 'design',
        task: 'd2',
        actor: r,
        kind: 'revision',
        created: e - 864e5,
        after: JSON.stringify({
          number: 2,
          reason: 'Taşıyıcının teslimat teyidi bekleniyor.',
          dueChanged: true,
          changes: [
            {
              field: 'dueAt',
              label: 'Termin tarihi',
              before: t(-30),
              after: t(-22),
            },
          ],
        }),
      },
      {
        id: 'rev1',
        workspace: 'design',
        task: 'd2',
        actor: n,
        kind: 'revision',
        created: e - 1e8,
        after: JSON.stringify({
          number: 1,
          reason: 'Eksik koli kayıtlarının kapsamı genişledi.',
          dueChanged: true,
          changes: [
            {
              field: 'dueAt',
              label: 'Termin tarihi',
              before: t(-48),
              after: t(-30),
            },
            {
              field: 'description',
              label: 'İş tarifi',
              before: 'Eksik koli kayıtlarını kontrol et.',
              after: 'Eksik koli kayıtları için operasyon dönüşü bekleniyor.',
            },
          ],
        }),
      },
      {
        id: 'a1',
        workspace: 'design',
        task: 'd1',
        actor: n,
        kind: 'created',
        before: '',
        after: 'Sabah sevkiyat kontrolü',
        created: e - 72e5,
      },
      {
        id: 'a2',
        workspace: 'design',
        task: 'd1',
        actor: r,
        kind: 'status',
        before: 'todo',
        after: 'doing',
        created: e - 36e5,
      },
    ],
    times: [
      {
        id: 'time1',
        workspace: 'design',
        task: 'd1',
        email: r,
        started: e - 36e5,
        ended: e - 18e5,
        seconds: 1800,
        note: 'Liste doğrulama',
      },
    ],
  };
}

function loadDemoData() {
  if (!demoCache) {
    try {
      let stored = typeof localStorage > 'u' ? null : localStorage.getItem(DEMO_STORAGE_KEY);
      demoCache = stored ? JSON.parse(stored) : createDemoData();
      if (!demoCache?.states?.design) {
        demoCache = createDemoData();
      }
    } catch {
      demoCache = createDemoData();
    }
  }
  return demoCache;
}

function persistDemoData() {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoCache));
  } catch {}
}

function demoMembership(workspaceId) {
  let demoData = loadDemoData();
  let membership = demoData.members[workspaceId]?.find(
    (member) => member.email === demoData.actor && member.active,
  );
  if (!membership) {
    throw Error('Bu örnek çalışma alanında erişimin yok.');
  }
  return membership;
}

export function setDemoActor(email) {
  if (!DEMO_USERS.some((t) => t.email === email)) {
    throw Error('Geçersiz örnek kullanıcı.');
  }
  loadDemoData().actor = email;
  persistDemoData();
}

export function resetDemoData() {
  demoCache = createDemoData();
  persistDemoData();
}

export function createDemoConflict(workspaceId) {
  let snapshot = demoGet(workspaceId);
  let target = snapshot.state.tasks.find((task) => task.id === 'd6') || snapshot.state.tasks[0];
  if (!target) {
    throw Error('Önce örnek bir iş oluştur.');
  }
  let actor = loadDemoData().actor;
  let otherEditor =
    snapshot.members.find(
      (member) =>
        member.active &&
        member.role !== 'viewer' &&
        member.email !== actor &&
        canAccessTask(target, snapshot.state, member.email, member.role),
    )?.email || actor;
  try {
    loadDemoData().actor = otherEditor;
    let space = demoGet(workspaceId);
    let copy = structuredClone(space.state);
    copy.tasks.find((task) => task.id === target.id).title = target.title + ' · ekip planı';
    demoPost({
      action: 'save',
      id: workspaceId,
      revision: space.revision,
      state: copy,
    });
  } finally {
    loadDemoData().actor = actor;
    persistDemoData();
  }
  return {
    snapshot,
    task: {
      ...target,
      title: target.title + ' · benim planım',
    },
  };
}

export function demoGet(workspaceId, taskId = '') {
  let demoData = loadDemoData();
  let spaces = demoData.workspaces
    .filter((space) =>
      demoData.members[space.id]?.some((member) => member.email === demoData.actor && member.active),
    )
    .map((space) => ({
      ...space,
      role: demoData.members[space.id].find((e) => e.email === demoData.actor).role,
    }));
  if (!workspaceId) {
    return structuredClone({
      workspaces: spaces,
      user: demoData.actor,
    });
  }
  let membership = demoMembership(workspaceId);
  let visible = visibleStateFor(
    normalizeState(demoData.states[workspaceId]),
    demoData.actor,
    membership.role,
  );
  let taskIds = new Set(visible.tasks.map((task) => task.id));
  if (taskId && !taskIds.has(taskId)) {
    throw Error('Bu işe erişimin yok.');
  }
  return structuredClone({
    workspaces: spaces,
    user: demoData.actor,
    state: visible,
    revision: demoData.revisions[workspaceId],
    role: membership.role,
    members: demoData.members[workspaceId],
    times: demoData.times.filter((entry) => entry.workspace === workspaceId && taskIds.has(entry.task)),
    notifications: demoData.notifications
      .filter(
        (notification) =>
          notification.workspace === workspaceId &&
          (!notification.task || taskIds.has(notification.task)) &&
          (membership.role === 'owner' || notification.recipient === demoData.actor),
      )
      .slice(0, 100),
    comments: demoData.comments
      .filter((comment) => comment.workspace === workspaceId && comment.task === taskId)
      .sort((a, b) => b.created - a.created),
    activities: demoData.activities
      .filter((activity) => activity.workspace === workspaceId && activity.task === taskId)
      .sort((a, b) => b.created - a.created),
    policy: demoData.policies[workspaceId],
    mailConfigured: false,
  });
}

export function demoPost(request) {
  let demoData = loadDemoData();
  let now = Date.now();
  let actor = demoData.actor;
  if (request.action === 'create') {
    if (!request.name?.trim()) {
      throw Error('Çalışma alanı adını yaz.');
    }
    let spaceId = newDemoId();
    demoData.workspaces.push({
      id: spaceId,
      name: request.name,
    });
    demoData.members[spaceId] = [
      {
        ...DEMO_USERS.find((e) => e.email === actor),
        role: 'owner',
        active: 1,
        mail_enabled: 1,
        notify_self: 0,
      },
    ];
    demoData.states[spaceId] = structuredClone(EMPTY_STATE);
    demoData.revisions[spaceId] = 0;
    demoData.policies[spaceId] = {
      ...DEFAULT_NOTIFY_POLICY,
    };
    persistDemoData();
    return {
      id: spaceId,
    };
  }
  let membership = demoMembership(request.id);
  let current = normalizeState(demoData.states[request.id]);
  if (request.action === 'read') {
    let notification = demoData.notifications.find(
      (t) => t.id === request.notification && t.recipient === actor,
    );
    if (notification) {
      notification.read_at = now;
    }
    persistDemoData();
    return {
      ok: true,
    };
  }
  if (request.action === 'preferences') {
    membership.mail_enabled = +!!request.mailEnabled;
    membership.notify_self = +!!request.notifySelf;
    persistDemoData();
    return {
      ok: true,
    };
  }
  if (request.action === 'policy') {
    if (membership.role !== 'owner') {
      throw Error('Bu ayarı yalnızca yönetici değiştirebilir.');
    }
    demoData.policies[request.id] = request.policy;
    persistDemoData();
    return {
      ok: true,
    };
  }
  if (request.action === 'member') {
    if (membership.role !== 'owner') {
      throw Error('Üyeleri yalnızca yönetici düzenleyebilir.');
    }
    if (!request.name?.trim() || !/^\S+@\S+\.\S+$/.test(request.email || '')) {
      throw Error('Ad ve geçerli e-posta gerekli.');
    }
    let existingMember = demoData.members[request.id].find((t) => t.email === request.email);
    let memberRecord = {
      email: request.email,
      name: request.name,
      department: request.department || '',
      role: existingMember?.role === 'owner' ? 'owner' : request.role,
      active: existingMember?.role === 'owner' ? 1 : +!!request.active,
      mail_enabled: existingMember?.mail_enabled ?? 1,
      notify_self: existingMember?.notify_self ?? 0,
    };
    if (existingMember) {
      Object.assign(existingMember, memberRecord);
    } else {
      demoData.members[request.id].push(memberRecord);
    }
    persistDemoData();
    return {
      ok: true,
    };
  }
  if (request.action === 'flush') {
    return {
      configured: false,
      accepted: 0,
    };
  }
  if (membership.role === 'viewer') {
    throw Error('Görüntüleme rolünde değişiklik yapamazsın.');
  }
  let notify = (task, i, a, body, addedAssignees) => {
    for (let email of new Set(addedAssignees)) {
      let s = demoData.members[request.id].find((member) => member.email === email && member.active);
      if (!(!s || !canAccessTask(task, normalizeState(demoData.states[request.id]), email, s.role))) {
        demoData.notifications.unshift({
          id: newDemoId(),
          workspace: request.id,
          task: task.id,
          recipient: email,
          kind: i,
          title: a,
          body: body,
          created: now,
          mail: 'disabled',
          detail: 'Örnek bildirim. Gerçek e-posta gönderilmez.',
          read_at: null,
        });
      }
    }
  };
  if (request.action === 'save') {
    if (request.revision !== demoData.revisions[request.id]) {
      throw Error('Kayıt değişti. Yenileyerek tekrar dene.');
    }
    let merged = assertPermittedChanges(current, normalizeState(request.state), actor, membership.role);
    let membershipError = validateMembership(merged, current, demoData.members[request.id]);
    if (membershipError) {
      throw Error(membershipError);
    }
    if (
      membership.role !== 'owner' &&
      JSON.stringify(merged.workRules) !== JSON.stringify(current.workRules)
    ) {
      throw Error('Çalışma kurallarını yalnızca yönetici değiştirebilir.');
    }
    let reason = typeof request.reason == 'string' ? request.reason.trim() : '';
    if (reason.length > 1e3) {
      throw Error('Gerekçe en fazla 1000 karakter olabilir.');
    }
    for (let eachTask of merged.tasks) {
      if (!current.tasks.some((task) => task.id === eachTask.id) && !eachTask.plannedStart) {
        eachTask.plannedStart = new Date(now).toISOString();
      }
    }
    let error = validateStructure(merged) || validateSchedule(merged, current);
    if (error) {
      throw Error(error);
    }
    for (let task of merged.tasks) {
      let previous = current.tasks.find((e) => e.id === task.id);
      if (previous && (previous.dueAt !== task.dueAt || previous.date !== task.date) && !reason) {
        throw Error('Termin değişikliği için kısa bir gerekçe yazın.');
      }
      let editors = demoData.members[request.id]
        .filter((e) => e.active && e.role !== 'viewer')
        .map((e) => e.email);
      if (task.assignees.some((email) => !editors.includes(email) && !previous?.assignees.includes(email))) {
        throw Error('Aktif ekip üyesi seçin.');
      }
    }
    for (let task of merged.tasks) {
      let previousTask = current.tasks.find((e) => e.id === task.id);
      let stamped = stampTaskMetadata(task, previousTask, actor, now);
      if (stamped.changes.length) {
        demoData.activities.unshift({
          id: newDemoId(),
          workspace: request.id,
          task: task.id,
          actor,
          kind: 'revision',
          before: '',
          after: JSON.stringify({
            number: task.revisionCount,
            reason,
            changes: stamped.changes,
            dueChanged: stamped.dueChanged,
          }),
          created: now,
        });
      }
      if (!previousTask) {
        demoData.activities.unshift({
          id: newDemoId(),
          workspace: request.id,
          task: task.id,
          actor,
          kind: 'created',
          before: '',
          after: task.title,
          created: now,
        });
      }
      let addedAssignees = task.assignees.filter((email) => !previousTask?.assignees.includes(email));
      if (
        (addedAssignees.length &&
          notify(task, 'assigned', 'İş atandı: ' + task.title, 'Yeni iş ataması.', addedAssignees),
        task.teamId &&
          !task.assignees.length &&
          (!previousTask || previousTask.assignees.length > 0 || previousTask.teamId !== task.teamId) &&
          notify(
            task,
            'assigned',
            'Ekip havuzunda yeni iş: ' + task.title,
            'Sorumlu bekleyen iş ekip havuzuna bırakıldı.',
            merged.teams.find((team) => team.id === task.teamId)?.leads || [],
          ),
        previousTask &&
          previousTask.status !== task.status &&
          (demoData.activities.unshift({
            id: newDemoId(),
            workspace: request.id,
            task: task.id,
            actor,
            kind: 'status',
            before: previousTask.status,
            after: task.status,
            created: now,
          }),
          notify(
            task,
            task.status === 'done' ? 'completed' : 'status',
            (task.status === 'done' ? 'İş tamamlandı: ' : 'Durum değişti: ') + task.title,
            'Durum güncellendi.',
            [task.createdBy, task.coordinator, ...task.assignees, ...task.watchers],
          )),
        task.status !== 'doing' || !task.trackTime)
      ) {
        for (let entry of demoData.times.filter(
          (t) => t.workspace === request.id && t.task === task.id && !t.ended,
        )) {
          entry.ended = now;
          entry.seconds = Math.max(0, Math.floor((now - entry.started) / 1e3));
        }
      }
    }
    for (let blocker of merged.blockers) {
      let previousBlocker = current.blockers.find((e) => e.id === blocker.id);
      if (blocker.task && JSON.stringify(previousBlocker) !== JSON.stringify(blocker)) {
        demoData.activities.unshift({
          id: newDemoId(),
          workspace: request.id,
          task: blocker.task,
          actor,
          kind: 'blocker',
          before: previousBlocker?.title || '',
          after:
            (blocker.resolved
              ? 'Engel çözüldü: '
              : previousBlocker
                ? 'Engel güncellendi: '
                : 'Engel bildirildi: ') +
            blocker.title +
            ' · Çözüm sorumlusu: ' +
            (blocker.owner || 'Belirlenmedi'),
          created: now,
        });
      }
    }
    demoData.states[request.id] = merged;
    demoData.revisions[request.id]++;
    persistDemoData();
    return structuredClone({
      ok: true,
      state: visibleStateFor(merged, actor, membership.role),
      revision: demoData.revisions[request.id],
    });
  }
  let targetTask = current.tasks.find((task) => task.id === request.task);
  if (!targetTask) {
    throw Error('İş bulunamadı.');
  }
  if (!canAccessTask(targetTask, current, actor, membership.role)) {
    throw Error('Bu işe erişimin yok.');
  }
  if (request.action === 'comment') {
    if (!request.body?.trim()) {
      throw Error('Yorumunu yaz.');
    }
    if (!demoData.comments.some((comment) => comment.id === request.requestId)) {
      demoData.comments.unshift({
        id: request.requestId,
        workspace: request.id,
        task: targetTask.id,
        author: actor,
        body: request.body,
        created: now,
      });
      notify(targetTask, 'comment', 'Yeni yorum: ' + targetTask.title, request.body, [
        targetTask.createdBy,
        targetTask.coordinator,
        ...targetTask.assignees,
        ...targetTask.watchers,
      ]);
    }
    persistDemoData();
    return {
      ok: true,
    };
  }
  if (['timer_start', 'timer_stop', 'manual_time'].includes(request.action)) {
    if (!targetTask.trackTime) {
      throw Error('Bu işte süre takibi kapalı.');
    }
    if (request.action === 'timer_stop') {
      for (let entry of demoData.times.filter(
        (t) => t.workspace === request.id && t.task === targetTask.id && t.email === actor && !t.ended,
      )) {
        entry.ended = now;
        entry.seconds = Math.floor((now - entry.started) / 1e3);
      }
    } else {
      if (targetTask.status !== 'doing') {
        throw Error('İşin durumu devam ediyor olmalı.');
      }
      if (!targetTask.assignees.includes(actor) && membership.role !== 'owner') {
        throw Error('Bu iş sana atanmamış.');
      }
      if (request.action === 'timer_start') {
        if (
          demoData.times.some(
            (entry) => entry.workspace === request.id && entry.email === actor && !entry.ended,
          )
        ) {
          throw Error('Önce çalışan sayacını durdur.');
        }
        demoData.times.push({
          id: newDemoId(),
          workspace: request.id,
          task: targetTask.id,
          email: actor,
          started: now,
          ended: null,
          seconds: 0,
          note: '',
        });
      } else {
        if (
          !Number.isInteger(request.minutes) ||
          request.minutes < 1 ||
          request.minutes > 1440 ||
          !request.note?.trim()
        ) {
          throw Error('1–1440 dakika ve açıklama gir.');
        }
        demoData.times.push({
          id: newDemoId(),
          workspace: request.id,
          task: targetTask.id,
          email: actor,
          started: now - request.minutes * 6e4,
          ended: now,
          seconds: request.minutes * 60,
          note: request.note,
        });
      }
    }
    persistDemoData();
    return {
      ok: true,
    };
  }
  throw Error('Bu işlem tasarım demosunda bulunmuyor.');
}
