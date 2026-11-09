// Bildirim kuralları (Jira'daki bildirim şemasına benzer).
// Kime uygulama içi bildirim gider ve bu bildirim için e-posta gönderilir mi?
// Hem tarayıcı içi örnek sunucu hem pilot sunucusu bu kuralları kullanır.
import { taskTeamIds } from './workspaceModel.js';

/** Bildirim türleri ve Ayarlar → "Ekibin bildirim kuralları" anahtarları */
export const POLICY_KEY = { assigned: 'assigned', status: 'status', completed: 'completed', comment: 'comment' };

/** İşle ilgilenen herkes: işi açan, koordinatör, sorumlular ve takipçiler */
export function involvedPeople(task) {
  return [task.createdBy, task.coordinator, ...task.assignees, ...task.watchers];
}

/** İşin ana ve ilgili ekiplerinin aktif yöneticileri */
export function teamLeads(task, state) {
  const ids = taskTeamIds(task);
  return state.teams.filter((team) => team.active && ids.includes(team.id)).flatMap((team) => team.leads);
}

/** Durum değişikliği / tamamlama: ilgililer + (kural açıksa) ekip yöneticileri */
export function statusRecipients(task, state, policy) {
  return unique([...involvedPeople(task), ...(policy?.managers ? teamLeads(task, state) : [])]);
}

/** Yorum: ilgililer + o işe daha önce yorum yazanlar */
export function commentRecipients(task, previousCommenters = []) {
  return unique([...involvedPeople(task), ...previousCommenters]);
}

export function unique(emails) {
  return [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
}

/**
 * Bir bildirimin e-posta durumu (arayüzdeki karşılıkları NotificationGroups'ta):
 *   disabled  → tasarım demosu, e-posta yok
 *   no_config → sunucuda e-posta bağlantısı kurulmamış
 *   self      → kişinin kendi işlemi ve "kendi işlemlerimin e-postasını da al" kapalı
 *   muted     → kişi e-postayı kapatmış, ekip kuralı kapalı ya da işte e-posta bildirimi kapalı
 *   queued    → gönderilecek
 */
export function mailStatus({ mode, kind, recipient, actor, member, policy, task }) {
  if (mode === 'demo') return 'disabled';
  if (mode !== 'live') return 'no_config';
  if (recipient === actor && !member?.notify_self) return 'self';
  if (!member?.mail_enabled) return 'muted';
  const key = POLICY_KEY[kind];
  if (key && policy && policy[key] === false) return 'muted';
  if (task && task.notifyEmail === false) return 'muted';
  return 'queued';
}
