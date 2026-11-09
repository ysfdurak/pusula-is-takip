// Çalışma alanı servisi: /api/workspace sözleşmesinin uygulaması.
// Verinin nerede saklandığını bilmez (load/persist) ve işlemi yapan kişiyi (actor) parametre olarak alır.
// Tarayıcı demosu (src/demo/demoServer.js, localStorage) ve pilot sunucusu (server/, SQLite) aynı servisi kullanır.
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
} from './workspaceModel.js';
import { recurringCopy } from './recurrence.js';
import { commentRecipients, mailStatus, statusRecipients } from './notificationRules.js';

/** İzin verilen ek dosya türleri: tür, dosya uzantısından belirlenir (istemcinin bildirdiğine güvenilmez). */
export const FILE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function memoryBlobs() {
  const map = new Map();
  return { put: (id, data) => map.set(id, data), get: (id) => map.get(id) ?? null, remove: (id) => map.delete(id) };
}

/**
 * @param {object} o
 * @param {() => object} o.load          tüm veri (workspaces, members, states, revisions, policies, notifications, comments, activities, times)
 * @param {() => void} o.persist         değişiklikleri kalıcı yap
 * @param {() => string} o.newId
 * @param {() => 'demo'|'off'|'live'} [o.mailMode]
 * @param {(email: string) => object} [o.profileFor]   yeni çalışma alanı sahibinin üye kaydı
 * @param {(email: string) => boolean} [o.canCreateWorkspace]
 * @param {string} [o.accessError]
 * @param {{put(id: string, base64: string): void, get(id: string): string|null, remove(id: string): void}} [o.blobs]  ek dosya içerikleri
 * @param {number} [o.maxFileBytes]
 */
export function createWorkspaceService({
  load,
  persist,
  newId,
  mailMode = () => 'demo',
  profileFor = (email) => ({ email, name: email.split('@')[0], department: '' }),
  canCreateWorkspace = () => true,
  accessError = 'Bu çalışma alanına erişimin yok.',
  blobs = memoryBlobs(),
  maxFileBytes = 5 * 1024 * 1024,
}) {
  function requireMember(demoData, actor, workspaceId) {
    let found = demoData.members[workspaceId]?.find((member) => member.email === actor && member.active);
    if (!found) {
      throw Error(accessError);
    }
    return found;
  }

  function get(actor, workspaceId, taskId = '', fileId = '') {
    let demoData = load();
    demoData.files ||= [];
    let spaces = demoData.workspaces
      .filter((space) =>
        demoData.members[space.id]?.some((member) => member.email === actor && member.active),
      )
      .map((space) => ({
        ...space,
        role: demoData.members[space.id].find((e) => e.email === actor).role,
      }));
    if (!workspaceId) {
      return structuredClone({
        workspaces: spaces,
        user: actor,
      });
    }
    let membership = requireMember(demoData, actor, workspaceId);
    let visible = visibleStateFor(normalizeState(demoData.states[workspaceId]), actor, membership.role);
    let taskIds = new Set(visible.tasks.map((task) => task.id));
    if (taskId && !taskIds.has(taskId)) {
      throw Error('Bu işe erişimin yok.');
    }
    if (fileId) {
      let file = demoData.files.find((f) => f.id === fileId && f.workspace === workspaceId);
      let data = file && taskIds.has(file.task) ? blobs.get(file.id) : null;
      if (!data) {
        throw Error('Dosya bulunamadı ya da erişimin yok.');
      }
      return { file: structuredClone(file), data };
    }
    return structuredClone({
      workspaces: spaces,
      user: actor,
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
            (membership.role === 'owner' || notification.recipient === actor),
        )
        .slice(0, 100),
      comments: demoData.comments
        .filter((comment) => comment.workspace === workspaceId && comment.task === taskId)
        .sort((a, b) => b.created - a.created),
      activities: demoData.activities
        .filter((activity) => activity.workspace === workspaceId && activity.task === taskId)
        .sort((a, b) => b.created - a.created),
      files: taskId
        ? demoData.files.filter((f) => f.workspace === workspaceId && f.task === taskId).sort((a, b) => b.created - a.created)
        : [],
      fileCounts: Object.fromEntries(
        Object.entries(
          demoData.files
            .filter((f) => f.workspace === workspaceId && taskIds.has(f.task))
            .reduce((acc, f) => ((acc[f.task] = (acc[f.task] || 0) + 1), acc), {}),
        ),
      ),
      maxFileBytes,
      policy: demoData.policies[workspaceId],
      mailConfigured: mailMode() === 'live',
    });
  }

  function post(actor, request) {
    let demoData = load();
    demoData.files ||= [];
    let now = Date.now();
    if (request.action === 'create') {
      if (!canCreateWorkspace(actor)) {
        throw Error('Yeni çalışma alanını yalnızca Pusula yöneticisi oluşturabilir.');
      }
      if (!request.name?.trim()) {
        throw Error('Çalışma alanı adını yaz.');
      }
      let spaceId = newId();
      demoData.workspaces.push({
        id: spaceId,
        name: request.name,
      });
      demoData.members[spaceId] = [
        {
          ...profileFor(actor),
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
      persist();
      return {
        id: spaceId,
      };
    }
    let membership = requireMember(demoData, actor, request.id);
    let current = normalizeState(demoData.states[request.id]);
    if (request.action === 'read') {
      let notification = demoData.notifications.find(
        (t) => t.id === request.notification && t.recipient === actor,
      );
      if (notification) {
        notification.read_at = now;
      }
      persist();
      return {
        ok: true,
      };
    }
    if (request.action === 'preferences') {
      membership.mail_enabled = +!!request.mailEnabled;
      membership.notify_self = +!!request.notifySelf;
      persist();
      return {
        ok: true,
      };
    }
    if (request.action === 'policy') {
      if (membership.role !== 'owner') {
        throw Error('Bu ayarı yalnızca yönetici değiştirebilir.');
      }
      // Yalnızca tanımlı kurallar, açık/kapalı olarak saklanır
      demoData.policies[request.id] = Object.fromEntries(
        Object.keys(DEFAULT_NOTIFY_POLICY).map((key) => [key, request.policy?.[key] !== false]),
      );
      persist();
      return {
        ok: true,
      };
    }
    if (request.action === 'member') {
      if (membership.role !== 'owner') {
        throw Error('Üyeleri yalnızca yönetici düzenleyebilir.');
      }
      // E-posta adresleri küçük harfle tutulur; girişte Microsoft'tan gelen adresle eşleşmesi için.
      request = { ...request, email: String(request.email || '').trim().toLowerCase() };
      if (!['editor', 'viewer', 'owner'].includes(request.role)) {
        throw Error('Geçersiz rol.');
      }
      if (String(request.name).length > 120 || String(request.department || '').length > 120) {
        throw Error('Ad veya bölüm çok uzun.');
      }
      const currentRole = demoData.members[request.id].find((m) => m.email === request.email)?.role;
      if (request.role === 'owner' && currentRole !== 'owner') {
        throw Error('Yönetici rolü yalnızca Pusula ayarlarıyla (PUSULA_ADMINS) verilir.');
      }
      if (!request.name?.trim() || !/^\S+@\S+\.\S+$/.test(request.email)) {
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
        // Pasif üye yeniden etkinleştirilince Microsoft hesap bağı (oid) sıfırlanır: adres başka bir kişiye geçmiş olabilir.
        oid: existingMember?.active || !request.active ? existingMember?.oid : undefined,
      };
      if (existingMember) {
        Object.assign(existingMember, memberRecord);
      } else {
        demoData.members[request.id].push(memberRecord);
      }
      persist();
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
    let notify = (task, kind, title, body, recipients, meta = {}) => {
      const policy = demoData.policies[request.id];
      for (let email of new Set(recipients.filter(Boolean))) {
        let member = demoData.members[request.id].find((m) => m.email === email && m.active);
        if (
          !member ||
          !canAccessTask(task, normalizeState(demoData.states[request.id]), email, member.role)
        ) {
          continue;
        }
        const mail = mailStatus({ mode: mailMode(), kind, recipient: email, actor, member, policy, task });
        demoData.notifications.unshift({
          id: newId(),
          workspace: request.id,
          task: task.id,
          recipient: email,
          actor,
          kind,
          title,
          body,
          meta,
          created: now,
          mail,
          detail: mailMode() === 'demo' ? 'Örnek bildirim. Gerçek e-posta gönderilmez.' : '',
          read_at: null,
        });
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
      // Tekrarlanan iş tamamlanınca bir sonraki kopyası açılır (aynı iş için bir kez).
      for (let task of [...merged.tasks]) {
        let previous = current.tasks.find((e) => e.id === task.id);
        if (
          task.recurrence &&
          task.dueAt &&
          task.status === 'done' &&
          previous &&
          previous.status !== 'done' &&
          !merged.tasks.some((other) => other.recurrenceOf === task.id) &&
          merged.tasks.length < 2e3
        ) {
          merged.tasks.push(taskSchema.parse(recurringCopy(task, newId(), newId, now)));
        }
      }
      for (let task of merged.tasks) {
        let previous = current.tasks.find((e) => e.id === task.id);
        if (previous && (previous.dueAt !== task.dueAt || previous.date !== task.date) && !reason) {
          throw Error('Termin değişikliği için kısa bir gerekçe yazın.');
        }
        let editors = demoData.members[request.id]
          .filter((e) => e.active && e.role !== 'viewer')
          .map((e) => e.email);
        if (
          task.assignees.some((email) => !editors.includes(email) && !previous?.assignees.includes(email))
        ) {
          throw Error('Aktif ekip üyesi seçin.');
        }
      }
      for (let task of merged.tasks) {
        let previousTask = current.tasks.find((e) => e.id === task.id);
        let stamped = stampTaskMetadata(task, previousTask, actor, now);
        if (stamped.changes.length) {
          demoData.activities.unshift({
            id: newId(),
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
            id: newId(),
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
              id: newId(),
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
              statusRecipients(task, merged, demoData.policies[request.id]),
              { before: previousTask.status, after: task.status },
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
            id: newId(),
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
      // Silinen işlerin ek dosyaları da silinir
      let remaining = new Set(merged.tasks.map((task) => task.id));
      for (let file of demoData.files.filter((f) => f.workspace === request.id && !remaining.has(f.task))) {
        blobs.remove(file.id);
      }
      demoData.files = demoData.files.filter((f) => f.workspace !== request.id || remaining.has(f.task));
      persist();
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
      if (request.body.length > 5000 || String(request.requestId || '').length > 100) {
        throw Error('Yorum çok uzun (en fazla 5.000 karakter).');
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
        const previousCommenters = demoData.comments
          .filter((c) => c.workspace === request.id && c.task === targetTask.id && c.id !== request.requestId)
          .map((c) => c.author);
        notify(
          targetTask,
          'comment',
          'Yeni yorum: ' + targetTask.title,
          request.body,
          commentRecipients(targetTask, previousCommenters),
        );
      }
      persist();
      return {
        ok: true,
      };
    }
    if (request.action === 'attach') {
      let name = String(request.name || '').trim().replace(/[\\/\u0000-\u001f]/g, '_');
      let ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
      let type = FILE_TYPES[ext];
      if (!name || name.length > 150) {
        throw Error('Dosya adı 1–150 karakter olmalı.');
      }
      if (!type) {
        throw Error('Bu dosya türü eklenemez. Resim, PDF, Office, metin veya CSV dosyası seç.');
      }
      let data = String(request.data || '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || !data) {
        throw Error('Dosya okunamadı.');
      }
      let size = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
      if (size > maxFileBytes) {
        throw Error('Dosya en fazla ' + Math.round(maxFileBytes / 1048576) + ' MB olabilir.');
      }
      if (demoData.files.filter((f) => f.workspace === request.id && f.task === targetTask.id).length >= 20) {
        throw Error('Bir işe en fazla 20 dosya eklenebilir.');
      }
      let file = {
        id: newId(),
        workspace: request.id,
        task: targetTask.id,
        name,
        type,
        size,
        author: actor,
        created: now,
      };
      blobs.put(file.id, data);
      demoData.files.unshift(file);
      demoData.activities.unshift({
        id: newId(),
        workspace: request.id,
        task: targetTask.id,
        actor,
        kind: 'file',
        before: '',
        after: 'Dosya eklendi: ' + name,
        created: now,
      });
      persist();
      return { ok: true, file };
    }
    if (request.action === 'detach') {
      let file = demoData.files.find(
        (f) => f.id === request.file && f.workspace === request.id && f.task === targetTask.id,
      );
      if (!file) {
        throw Error('Dosya bulunamadı.');
      }
      if (file.author !== actor && membership.role !== 'owner') {
        throw Error('Dosyayı yalnızca ekleyen kişi ya da yönetici silebilir.');
      }
      demoData.files = demoData.files.filter((f) => f !== file);
      blobs.remove(file.id);
      demoData.activities.unshift({
        id: newId(),
        workspace: request.id,
        task: targetTask.id,
        actor,
        kind: 'file',
        before: file.name,
        after: 'Dosya silindi: ' + file.name,
        created: now,
      });
      persist();
      return { ok: true };
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
            id: newId(),
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
            id: newId(),
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
      persist();
      return {
        ok: true,
      };
    }
    throw Error('Bu işlem tasarım demosunda bulunmuyor.');
  }

  // E-posta kuyruğu (pilot / geliştirme sunucusu). Tarayıcı demosunda kullanılmaz.

  /** Gönderilmeyi bekleyen bildirimler ve e-posta şablonu için gereken bağlam */
  function pendingMail(limit = 50) {
    const demoData = load();
    return demoData.notifications
      .filter((n) => n.mail === 'queued')
      .slice(0, limit)
      .map((notification) => {
        const state = normalizeState(demoData.states[notification.workspace]);
        const members = demoData.members[notification.workspace] || [];
        const nameOf = (email) => members.find((m) => m.email === email)?.name || email;
        return {
          notification,
          workspace: demoData.workspaces.find((w) => w.id === notification.workspace),
          task: state.tasks.find((t) => t.id === notification.task),
          teams: state.teams,
          recipientName: nameOf(notification.recipient),
          actorName: notification.actor ? nameOf(notification.actor) : '',
        };
      });
  }

  /** Gönderim sonucunu bildirime işler: accepted | failed | queued (yeniden denenecek) */
  function markMail(id, mail, detail = '') {
    const demoData = load();
    const n = demoData.notifications.find((x) => x.id === id);
    if (!n) return;
    n.mail = mail;
    n.detail = detail;
    if (mail === 'queued' || mail === 'failed') n.mail_attempts = (n.mail_attempts || 0) + 1;
    persist();
  }

  return { get, post, pendingMail, markMail };
}
