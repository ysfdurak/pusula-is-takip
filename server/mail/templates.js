// Bildirim e-postası şablonları (Outlook uyumlu: tablo düzeni, satır içi stil).
const STATUS = { todo: 'Başlanmadı', doing: 'Devam ediyor', done: 'Tamamlandı', cancelled: 'İptal' };
const PRIORITY = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatDue = (task) => {
  const iso = task.dueAt || (task.date ? task.date + 'T20:59:59Z' : '');
  if (!iso) return 'Termin yok';
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

/** Bildirimdeki işe giden bağlantı; uygulama ?workspace= ve ?task= parametreleriyle işi doğrudan açar */
export function taskLink(appUrl, workspaceId, taskId) {
  const url = new URL(appUrl);
  url.searchParams.set('workspace', workspaceId);
  url.searchParams.set('task', taskId);
  return url.toString();
}

function headline({ notification, actorName }) {
  const who = actorName || 'Bir ekip arkadaşın';
  const m = notification.meta || {};
  switch (notification.kind) {
    case 'assigned':
      return notification.title.startsWith('Ekip havuzunda')
        ? `${who} ekip havuzuna sorumlu bekleyen bir iş bıraktı.`
        : `${who} bu işi sana atadı.`;
    case 'status':
      return `${who} işin durumunu değiştirdi: ${STATUS[m.before] || m.before || '?'} → ${STATUS[m.after] || m.after || '?'}`;
    case 'completed':
      return `${who} işi tamamladı.`;
    case 'comment':
      return `${who} yorum yazdı:`;
    default:
      return notification.body || notification.title;
  }
}

/**
 * @returns {{ to: string, subject: string, html: string }}
 */
export function buildEmail({ notification, task, teams = [], workspace, actorName, recipientName, appUrl }) {
  const teamName = teams.find((t) => t.id === task.teamId)?.name || 'Genel işler';
  const link = taskLink(appUrl, notification.workspace, task.id);
  const statusNote =
    notification.kind === 'status' && notification.meta?.after ? ` (${STATUS[notification.meta.after] || notification.meta.after})` : '';
  const subject = `[Pusula] ${notification.title}${statusNote}`;
  const quote =
    notification.kind === 'comment'
      ? `<tr><td style="padding:0 24px 16px"><div style="border-left:3px solid #9cbd76;padding:8px 12px;color:#3b4a3f;white-space:pre-wrap">${escapeHtml(notification.body)}</div></td></tr>`
      : '';
  const row = (label, value) =>
    `<tr><td style="padding:4px 0;color:#5f6b62;width:110px">${label}</td><td style="padding:4px 0;color:#243c33">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f7f8f4;font-family:Segoe UI,Arial,sans-serif;font-size:14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f4;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e6eae1;border-radius:8px">
<tr><td style="padding:16px 24px;background:#193d33;color:#f6f8ed;font-weight:bold;border-radius:8px 8px 0 0">pusula. <span style="font-weight:normal;color:#bbd78d">${escapeHtml(workspace?.name || '')}</span></td></tr>
<tr><td style="padding:20px 24px 8px;color:#243c33">Merhaba ${escapeHtml(recipientName)},<br><br>${escapeHtml(headline({ notification, actorName }))}</td></tr>
${quote}
<tr><td style="padding:0 24px 8px"><div style="font-size:16px;font-weight:bold;color:#243c33">${escapeHtml(task.title)}</div></td></tr>
<tr><td style="padding:0 24px 16px"><table role="presentation" cellpadding="0" cellspacing="0">
${row('Durum', STATUS[task.status] || task.status)}${row('Ekip', teamName)}${row('Termin', formatDue(task))}${row('Öncelik', PRIORITY[task.priority] || task.priority)}
</table></td></tr>
<tr><td style="padding:0 24px 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2c6549;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">İşi Pusula'da aç</a></td></tr>
<tr><td style="padding:12px 24px;border-top:1px solid #e6eae1;color:#7d877f;font-size:12px">Bu e-postayı işin sorumlusu, takipçisi veya ekip yöneticisi olduğun için aldın. E-posta tercihlerini Pusula → Ayarlar'dan değiştirebilirsin. Bu adrese yanıt vermeyin; yorumlarını işin altına yaz.</td></tr>
</table></td></tr></table></body></html>`;
  return { to: notification.recipient, subject, html };
}

/** Sabah özeti e-postası (src/shared/digest.js çıktısından) */
export function buildDigestEmail({ workspace, member, overdue, today, week, pool, teams = [] }, appUrl) {
  const total = overdue.length + today.length + week.length;
  const subject = `[Pusula] Günün özeti: ${[
    overdue.length && `${overdue.length} geciken`,
    today.length && `${today.length} bugün`,
    week.length && `${week.length} bu hafta`,
    pool.length && `${pool.length} sorumlu bekliyor`,
  ]
    .filter(Boolean)
    .join(', ')}`;
  const teamOf = (task) => teams.find((t) => t.id === task.teamId)?.name || 'Genel işler';
  const section = (title, color, tasks) =>
    tasks.length
      ? `<tr><td style="padding:12px 24px 4px;font-weight:bold;color:${color}">${escapeHtml(title)} (${tasks.length})</td></tr>` +
        tasks
          .slice(0, 15)
          .map(
            (task) =>
              `<tr><td style="padding:4px 24px"><a href="${escapeHtml(taskLink(appUrl, workspace.id, task.id))}" style="color:#243c33;font-weight:bold;text-decoration:none">${escapeHtml(task.title)}</a><br><span style="color:#5f6b62;font-size:12px">${escapeHtml(formatDue(task))} · ${escapeHtml(teamOf(task))} · ${escapeHtml(STATUS[task.status] || task.status)}</span></td></tr>`,
          )
          .join('') +
        (tasks.length > 15 ? `<tr><td style="padding:4px 24px;color:#5f6b62;font-size:12px">ve ${tasks.length - 15} iş daha</td></tr>` : '')
      : '';
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f7f8f4;font-family:Segoe UI,Arial,sans-serif;font-size:14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f4;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e6eae1;border-radius:8px">
<tr><td style="padding:16px 24px;background:#193d33;color:#f6f8ed;font-weight:bold;border-radius:8px 8px 0 0">pusula. <span style="font-weight:normal;color:#bbd78d">${escapeHtml(workspace.name)}</span></td></tr>
<tr><td style="padding:20px 24px 4px;color:#243c33">Günaydın ${escapeHtml(member.name || member.email)},<br><br>${total ? `Sana atanmış ${total} işin termini yakın ya da geçti.` : 'Bugün sana atanmış termini yakın iş yok.'}</td></tr>
${section('Geciken', '#a14b32', overdue)}${section('Bugün', '#2c6549', today)}${section('Bu hafta', '#5f6b62', week)}${section('Ekip havuzunda sorumlu bekleyen', '#7a6b40', pool)}
<tr><td style="padding:20px 24px 24px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#2c6549;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">Pusula'yı aç</a></td></tr>
<tr><td style="padding:12px 24px;border-top:1px solid #e6eae1;color:#7d877f;font-size:12px">Sabah özetini Pusula → Ayarlar → "Sabah özeti" ile kapatabilirsin.</td></tr>
</table></td></tr></table></body></html>`;
  return { to: member.email, subject, html };
}
