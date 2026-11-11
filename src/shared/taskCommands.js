// İnce servis katmanı: "tek iş, tek değişiklik" komutları.
//
// Neden var? Web arayüzü değişiklikleri `save` ile tüm çalışma alanını göndererek kaydeder.
// Bu arayüz için uygun, ama MCP gibi dış istemciler için riskli: tek bir işin durumunu
// değiştirmek için bütün verinin gönderilmesi gerekir.
//
// Bu katman kural YAZMAZ. Her komut:
//   1) güncel durumu kullanıcının gözünden okur (service.get),
//   2) yalnızca hedef işi değiştirir,
//   3) sonucu yine `save` üzerinden kaydeder.
// Böylece yetki, termin, bildirim ve geçmiş kuralları tek yerde (workspaceService) kalır.
//
// MCP araçları ve ileride başka kapılar (ör. REST API) bu komutları çağırır.
import { completionIssues, taskObstacles } from './taskRules.js';
import { agendaFor } from './digest.js';
import { buildDashboardStats } from './dashboardStats.js';
import { projectSummaries } from './projectStats.js';

const STATUSES = ['todo', 'doing', 'done', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
export const STATUS_LABELS = { todo: 'Yapılacak', doing: 'Devam ediyor', done: 'Tamamlandı', cancelled: 'İptal' };
export const PRIORITY_LABELS = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };

const isOpen = (task) => !['done', 'cancelled'].includes(task.status);
const dueTime = (task) =>
  task.dueAt ? Date.parse(task.dueAt) : task.date ? Date.parse(task.date + 'T23:59:59+03:00') : null;
const istanbulDay = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(ms));

/** "2026-11-20" → gün sonu (İstanbul) UTC zamanı; uygulamanın hızlı ekleme davranışıyla aynı. */
function dueFromDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) {
    throw Error('Termin YYYY-AA-GG biçiminde olmalı (ör. 2026-11-20).');
  }
  const ms = Date.parse(day + 'T23:59:59.999+03:00');
  if (Number.isNaN(ms)) throw Error('Geçerli bir termin tarihi girin.');
  return new Date(ms).toISOString();
}

/** Dış istemcilere dönen sade iş özeti: ham veri yerine okunması kolay alanlar. */
export function summarizeTask(task, state, now = Date.now()) {
  const due = dueTime(task);
  return {
    id: task.id,
    baslik: task.title,
    durum: task.status,
    durumEtiketi: STATUS_LABELS[task.status],
    oncelik: task.priority,
    sorumlular: task.assignees,
    ekip: state.teams.find((team) => team.id === task.teamId)?.name || '',
    proje: state.projects.find((project) => project.id === task.project)?.name || '',
    termin: due === null ? '' : istanbulDay(due),
    ilkTermin: task.originalDueAt ? istanbulDay(Date.parse(task.originalDueAt)) : '',
    terminRevizyonu: task.dueRevisionCount,
    geciken: isOpen(task) && due !== null && due < now,
  };
}

/**
 * @param {ReturnType<import('./workspaceService.js').createWorkspaceService>} service
 * @param {{ newId: () => string, now?: () => number }} options
 */
export function createTaskCommands(service, { newId, now = () => Date.now() }) {
  /** Çalışma alanı belirtilmemişse ve kullanıcının tek alanı varsa onu seçer. */
  function resolveWorkspace(actor, workspaceId) {
    if (workspaceId) return workspaceId;
    const { workspaces } = service.get(actor, '');
    if (workspaces.length === 1) return workspaces[0].id;
    if (!workspaces.length) throw Error('Üyesi olduğun bir çalışma alanı yok.');
    throw Error(
      'Birden fazla çalışma alanın var, birini seç: ' + workspaces.map((w) => `${w.name} (${w.id})`).join(', '),
    );
  }

  function snapshot(actor, workspaceId, taskId = '') {
    const id = resolveWorkspace(actor, workspaceId);
    return { id, ...service.get(actor, id, taskId) };
  }

  /**
   * Tek bir işi değiştirip `save` ile kaydeder. Bu arada başka biri kaydettiyse
   * (revizyon çakışması) güncel veriyle bir kez daha dener: değişiklik her seferinde
   * yeniden hesaplandığı için başkasının değişikliği ezilmez.
   */
  function mutateTask(actor, workspaceId, taskId, change, reason = '') {
    for (let attempt = 0; ; attempt++) {
      const snap = snapshot(actor, workspaceId);
      const index = snap.state.tasks.findIndex((task) => task.id === taskId);
      if (index < 0) throw Error('İş bulunamadı ya da erişimin yok.');
      const next = structuredClone(snap.state);
      next.tasks[index] = change(structuredClone(next.tasks[index]), next, snap);
      try {
        const result = service.post(actor, { action: 'save', id: snap.id, revision: snap.revision, state: next, reason });
        const saved = result.state.tasks.find((task) => task.id === taskId);
        // Değişiklik sonrası iş artık görünmüyorsa (ör. başka ekibe atandı) yalnızca onay döner.
        return saved ? summarizeTask(saved, result.state, now()) : { id: taskId, kaydedildi: true };
      } catch (error) {
        if (attempt === 0 && /Kayıt değişti/.test(error.message)) continue;
        throw error;
      }
    }
  }

  const editors = (snap) => snap.members.filter((m) => m.active && m.role !== 'viewer').map((m) => m.email);

  function normalizeAssignees(list, snap, actor) {
    const emails = [...new Set((list || []).map((e) => (e === 'ben' ? actor : String(e).trim().toLowerCase())))];
    const allowed = editors(snap);
    const unknown = emails.filter((e) => !allowed.includes(e));
    if (unknown.length) throw Error('Aktif ekip üyesi seçin: ' + unknown.join(', '));
    return emails;
  }

  return {
    resolveWorkspace,

    /** Filtreli iş listesi. `sorumlu: 'ben'` kullanıcının kendisi demektir. */
    listTasks(actor, { calismaAlani, durum, sorumlu, ekip, proje, geciken, limit = 50 } = {}) {
      const snap = snapshot(actor, calismaAlani);
      const t = now();
      const who = sorumlu === 'ben' ? actor : sorumlu?.toLowerCase();
      let tasks = snap.state.tasks.filter((task) => {
        if (durum === 'acik' ? !isOpen(task) : durum && task.status !== durum) return false;
        if (who && !task.assignees.includes(who)) return false;
        if (ekip && task.teamId !== ekip && snap.state.teams.find((x) => x.id === task.teamId)?.name !== ekip) return false;
        if (proje && task.project !== proje && snap.state.projects.find((x) => x.id === task.project)?.name !== proje) return false;
        return true;
      });
      let summaries = tasks.map((task) => summarizeTask(task, snap.state, t));
      if (geciken) summaries = summaries.filter((s) => s.geciken);
      summaries.sort((a, b) => (a.termin || '9999').localeCompare(b.termin || '9999'));
      return { toplam: summaries.length, isler: summaries.slice(0, Math.min(Math.max(1, limit), 200)) };
    },

    /** Kişinin gündemi: sabah özeti e-postasıyla aynı hesap (agendaFor). */
    myAgenda(actor, { calismaAlani } = {}) {
      const snap = snapshot(actor, calismaAlani);
      const agenda = agendaFor(snap.state, { email: actor, role: snap.role }, now());
      const list = (tasks) => tasks.map((task) => summarizeTask(task, snap.state, now()));
      return {
        geciken: list(agenda.overdue),
        bugun: list(agenda.today),
        buHafta: list(agenda.week),
        sorumluBekleyenEkipIsleri: list(agenda.pool),
      };
    },

    /** Ekip panosundaki sayılar: arayüzle aynı hesap (buildDashboardStats). Ekip verilmezse tüm görünen işler. */
    teamStatus(actor, { calismaAlani, ekip } = {}) {
      const snap = snapshot(actor, calismaAlani);
      let state = snap.state;
      if (ekip) {
        const team = state.teams.find((x) => x.id === ekip || x.name === ekip);
        if (!team) throw Error('Ekip bulunamadı: ' + ekip);
        state = { ...state, tasks: state.tasks.filter((task) => task.teamId === team.id || task.relatedTeamIds.includes(team.id)) };
      }
      const t = now();
      const stats = buildDashboardStats(state, snap.members, snap.times, t, 7, snap.state.tasks);
      const top = (tasks) => tasks.slice(0, 10).map((task) => summarizeTask(task, snap.state, t));
      const rate = (part, all) => (all.length ? Math.round((part.length / all.length) * 100) : null);
      return {
        acik: stats.open.length,
        geciken: top(stats.late),
        gecikenSayisi: stats.late.length,
        sorumluBekleyen: top(stats.unassigned),
        engelli: top(stats.blocked),
        onayBekleyen: top(stats.review),
        terminsiz: stats.undated.length,
        son7GundeTamamlanan: stats.completed.length,
        zamanindaOrani: rate(stats.onTime, stats.datedCompleted),
        ilkTermineGoreZamanindaOrani: rate(stats.originalOnTime, stats.originalDated),
        isYuku: stats.workload.map((m) => ({ kisi: m.name || m.email, eposta: m.email, acikIs: m.count, geciken: m.late })),
        onumuzdeki7Gun: stats.upcoming.map((day) => ({ gun: day.date, isSayisi: day.tasks.length })),
      };
    },

    /** Açık engeller ve bitmemiş ön koşullar yüzünden duran işler. */
    listBlockers(actor, { calismaAlani } = {}) {
      const snap = snapshot(actor, calismaAlani);
      const t = now();
      return snap.state.tasks
        .filter((task) => isOpen(task) && taskObstacles(task, snap.state).length)
        .map((task) => ({
          ...summarizeTask(task, snap.state, t),
          engeller: taskObstacles(task, snap.state),
          cozumSorumlulari: snap.state.blockers
            .filter((b) => b.task === task.id && !b.resolved)
            .map((b) => b.owner || 'Belirlenmedi'),
        }));
    },

    /** Proje sağlığı: Projeler ekranıyla aynı hesap (projectSummaries). */
    projectStatus(actor, { calismaAlani } = {}) {
      const snap = snapshot(actor, calismaAlani);
      return projectSummaries(snap.state, now()).map((p) => ({
        id: p.id,
        ad: p.name,
        hedefTarih: p.date,
        durum: p.health,
        ilerleme: p.progress,
        acik: p.open,
        geciken: p.late,
        engelli: p.blocked,
      }));
    },

    /** İşin ayrıntısı, son yorumları ve tamamlanmak için eksik kalanlar. */
    taskDetail(actor, { calismaAlani, isId }) {
      const snap = snapshot(actor, calismaAlani, isId);
      const task = snap.state.tasks.find((x) => x.id === isId);
      if (!task) throw Error('İş bulunamadı ya da erişimin yok.');
      return {
        ...summarizeTask(task, snap.state, now()),
        aciklama: task.description,
        kabulOlcutu: task.criteria,
        kontrolListesi: task.checklist.map((s) => ({ id: s.id, metin: s.text, tamam: s.done })),
        tamamlamakIcinEksikler: isOpen(task) ? completionIssues(task, snap.state) : [],
        sonYorumlar: snap.comments.slice(0, 10).map((c) => ({ yazan: c.author, metin: c.body, zaman: new Date(c.created).toISOString() })),
      };
    },

    createTask(actor, { calismaAlani, baslik, aciklama = '', ekipId = '', sorumlular = [], termin = '', oncelik = 'normal', projeId = '' }) {
      const snap = snapshot(actor, calismaAlani);
      if (!String(baslik || '').trim()) throw Error('İşin adını yaz.');
      if (!PRIORITIES.includes(oncelik)) throw Error('Öncelik şunlardan biri olmalı: ' + PRIORITIES.join(', '));
      if (ekipId && !snap.state.teams.some((team) => team.id === ekipId)) throw Error('Ekip bulunamadı.');
      if (projeId && !snap.state.projects.some((p) => p.id === projeId)) throw Error('Proje bulunamadı.');
      const assignees = normalizeAssignees(sorumlular, snap, actor);
      const id = newId();
      const next = structuredClone(snap.state);
      next.tasks.push({
        id,
        title: String(baslik).trim(),
        description: aciklama,
        status: 'todo',
        priority: oncelik,
        teamId: ekipId,
        project: projeId,
        assignees,
        kind: assignees.length > 1 ? 'shared' : 'individual',
        plannedStart: new Date(now()).toISOString(),
        dueAt: termin ? dueFromDay(termin) : '',
        date: termin || '',
        requireApproval: false,
      });
      const result = service.post(actor, { action: 'save', id: snap.id, revision: snap.revision, state: next, reason: '' });
      const saved = result.state.tasks.find((task) => task.id === id);
      return saved ? summarizeTask(saved, result.state, now()) : { id, kaydedildi: true };
    },

    /** Durum değişikliği. "Tamamlandı" için arayüzdeki kurallar burada da uygulanır. */
    changeStatus(actor, { calismaAlani, isId, durum }) {
      if (!STATUSES.includes(durum)) throw Error('Durum şunlardan biri olmalı: ' + STATUSES.join(', '));
      return mutateTask(actor, calismaAlani, isId, (task, state) => {
        if (durum === 'done') {
          const issues = completionIssues(task, state);
          if (issues.length) throw Error('Bu iş henüz tamamlanamaz: ' + issues.join(' '));
        }
        task.status = durum;
        return task;
      });
    },

    assignTask(actor, { calismaAlani, isId, sorumlular }) {
      return mutateTask(actor, calismaAlani, isId, (task, state, snap) => {
        task.assignees = normalizeAssignees(sorumlular, snap, actor);
        task.kind = task.assignees.length > 1 ? 'shared' : task.kind;
        return task;
      });
    },

    /** Termin değişikliği: gerekçe zorunlu, ilk termin ve revizyon sayısı korunur (stampTaskMetadata). */
    changeDue(actor, { calismaAlani, isId, termin, gerekce }) {
      if (!String(gerekce || '').trim()) throw Error('Termin değişikliği için kısa bir gerekçe yazın.');
      const dueAt = dueFromDay(termin);
      return mutateTask(
        actor,
        calismaAlani,
        isId,
        (task) => {
          task.dueAt = dueAt;
          task.date = termin;
          return task;
        },
        gerekce,
      );
    },

    toggleChecklistItem(actor, { calismaAlani, isId, maddeId, tamam = true }) {
      return mutateTask(actor, calismaAlani, isId, (task) => {
        const step = task.checklist.find((s) => s.id === maddeId);
        if (!step) throw Error('Kontrol maddesi bulunamadı.');
        step.done = !!tamam;
        return task;
      });
    },

    addComment(actor, { calismaAlani, isId, metin }) {
      const id = resolveWorkspace(actor, calismaAlani);
      service.post(actor, { action: 'comment', id, task: isId, body: metin, requestId: newId() });
      return { ok: true };
    },
  };
}
