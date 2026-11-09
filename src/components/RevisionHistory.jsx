import { RotateCcwClockIcon } from 'lucide-react';
import { RECURRENCE_LABELS } from '../shared/recurrence.js';

const HISTORY_VALUE_LABELS = {
  todo: 'Başlanmadı',
  doing: 'Devam ediyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
  waiting: 'Beklemede (eski)',
  review: 'Kontrolde (eski)',
  individual: 'Bireysel',
  shared: 'Ortak',
  normal: 'Normal',
  urgent: 'Acil',
  high: 'Yüksek',
  low: 'Düşük',
};

export function RevisionHistory({ activities, name, timeLabel, teamName: r }) {
  function i(e, i) {
    return e == null || e === ''
      ? 'Belirlenmedi'
      : typeof e == 'boolean'
        ? e
          ? 'Evet'
          : 'Hayır'
        : ['dueAt', 'plannedStart'].includes(i)
          ? timeLabel(String(e))
          : i === 'teamId'
            ? r(String(e))
            : i === 'recurrence'
              ? RECURRENCE_LABELS[String(e)] || String(e)
            : i === 'coordinator'
              ? name(String(e))
              : i === 'waitingReason'
                ? {
                    information: 'Bilgi bekleniyor',
                    dependency: 'Başka iş bekleniyor',
                    resource: 'Kaynak bekleniyor',
                  }[String(e)] || String(e)
                : Array.isArray(e)
                  ? i === 'checklist'
                    ? e.map((step) => `${step.done ? '✓' : '○'} ${step.text}`).join('\n') || 'Adım yok'
                    : i === 'relatedTeamIds'
                      ? e.map((e) => r(String(e))).join(', ') || 'Yok'
                      : e
                          .map((e) => (['assignees', 'watchers'].includes(i) ? name(String(e)) : String(e)))
                          .join(', ') || 'Yok'
                  : HISTORY_VALUE_LABELS[String(e)] || String(e);
  }
  function a(after) {
    try {
      let t = JSON.parse(after);
      return Array.isArray(t.changes) ? t : null;
    } catch {
      return null;
    }
  }
  let matchingActivities = activities.filter(
    (activity) =>
      !['status', 'assigned', 'updated'].includes(activity.kind) ||
      !activities.some(
        (e) => e.kind === 'revision' && e.actor === activity.actor && e.created === activity.created,
      ),
  );
  return (
    <div className="revision-history">
      <p className="history-explainer">
        Her kayıt bir kaydetme işlemidir. Statü ve sorumlu değişiklikleri de revizyona dahildir. Yorumlar ayrı
        tutulur.
      </p>
      {matchingActivities.map((activity) => {
        let r = activity.kind === 'revision' ? a(activity.after) : null;
        return (
          <article key={activity.id}>
            <span className="history-icon">
              <RotateCcwClockIcon size={15} />
            </span>
            <div>
              <header>
                <strong>{name(activity.actor)}</strong>
                <time>{timeLabel(new Date(activity.created).toISOString())}</time>
              </header>
              {r ? (
                <>
                  <h4>
                    Revizyon #{r.number}
                    {r.dueChanged && <b>Termin değişti</b>}
                  </h4>
                  {r.reason && <p className="revision-reason">{r.reason}</p>}
                  <div className="field-changes">
                    {r.changes.map((change) => (
                      <section key={change.field}>
                        <strong>{change.label}</strong>
                        <div>
                          <span>
                            <small>Önce</small>
                            {i(change.before, change.field)}
                          </span>
                          <span>
                            <small>Sonra</small>
                            {i(change.after, change.field)}
                          </span>
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <p>
                  {activity.kind === 'created'
                    ? 'İşi oluşturdu.'
                    : activity.kind === 'status'
                      ? i(activity.before, 'status') + ' → ' + i(activity.after, 'status')
                      : activity.kind === 'assigned'
                        ? 'Sorumlular: ' +
                          (activity.after ? activity.after.split(', ').map(name).join(', ') : 'Atanmamış')
                        : activity.after}
                </p>
              )}
            </div>
          </article>
        );
      })}
      {!matchingActivities.length && (
        <p className="muted">
          Henüz geçmiş kaydı yok. Önceki sürümde ayrıntısı kaydedilmemiş değişiklikler geriye dönük
          oluşturulamaz.
        </p>
      )}
    </div>
  );
}
