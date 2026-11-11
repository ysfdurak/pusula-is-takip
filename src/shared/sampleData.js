// Örnek veri: kurgusal bir depo ekibi (Deniz, Ece, Mert, Selin) ve işleri. Tarihler oluşturulma anına göre hesaplanır.
// Kullananlar: tarayıcı demosu (src/demo/demoServer.js) ve sunucudaki ziyaretçi demo alanları (server/demo.js).
import { DEFAULT_NOTIFY_POLICY, EMPTY_STATE, normalizeState, taskSchema } from './workspaceModel.js';

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

/** Tek çalışma alanlı ('design') tam veri kümesi: workspaces, members, states, revisions, policies, notifications, comments, activities, times. */
export function createSampleData(now = Date.now()) {
  let e = now;
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
