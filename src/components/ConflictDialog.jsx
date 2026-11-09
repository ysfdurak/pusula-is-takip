import { useState } from 'react';
import { GitBranchIcon, XIcon } from 'lucide-react';
import { FIELD_LABELS } from '../shared/workspaceModel.js';

export const toLocalDateTimeInput = (e) =>
  e
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(new Date(e))
        .replace(' ', 'T')
    : '';

export function fromLocalDateTimeInput(e, dueAt, date = '') {
  return e === toLocalDateTimeInput(dueAt || (date ? date + 'T20:59:59Z' : ''))
    ? dueAt
    : e
      ? new Date(e + ':00+03:00').toISOString()
      : '';
}

export function ConflictDialog({ report, onConfirm, onCancel, working, error, name }) {
  let [o, s] = useState({});
  let c = (project, field) =>
    project === undefined
      ? 'Kayıt kaldırılmış'
      : project === null || project === ''
        ? 'Belirlenmedi'
        : typeof project == 'boolean'
          ? project
            ? 'Evet'
            : 'Hayır'
          : ['dueAt', 'plannedStart'].includes(field)
            ? new Date(project).toLocaleString('tr-TR', {
                timeZone: 'Europe/Istanbul',
              })
            : Array.isArray(project)
              ? project
                  .map((step) =>
                    typeof step == 'object'
                      ? (step.done ? '✓ ' : '○ ') + (step.text || step.title || 'Adım')
                      : ['assignees', 'watchers'].includes(field)
                        ? name(step)
                        : String(step),
                  )
                  .join('\n') || 'Yok'
              : typeof project == 'object'
                ? 'maxDurationDays' in project
                  ? 'Azami süre: ' +
                    (project.maxDurationDays ? project.maxDurationDays + ' takvim günü' : 'sınır yok') +
                    '\nTermin: ' +
                    (project.dueRequired ? 'zorunlu' : 'isteğe bağlı')
                  : [project.title || project.name || 'Kayıt', project.description || project.goal || '']
                      .filter(Boolean)
                      .join('\n')
                : {
                    todo: 'Başlanmadı',
                    doing: 'Devam ediyor',
                    done: 'Tamamlandı',
                    cancelled: 'İptal',
                    individual: 'Bireysel',
                    shared: 'Ortak',
                    normal: 'Normal',
                    high: 'Yüksek',
                    urgent: 'Acil',
                    low: 'Düşük',
                  }[project] || String(project);
  return (
    <div className="conflict-overlay">
      <section
        className="conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        onKeyDown={(event) => {
          if (
            (event.key === 'Escape' && !working && (event.stopPropagation(), onCancel()), event.key === 'Tab')
          ) {
            let t = Array.from(
              event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled)'),
            );
            if (!t.length) {
              return;
            }
            let n = t[0];
            let r = t[t.length - 1];
            if (event.shiftKey && document.activeElement === n) {
              event.preventDefault();
              r.focus();
            } else {
              if (!event.shiftKey && document.activeElement === r) {
                event.preventDefault();
                n.focus();
              }
            }
          }
        }}
      >
        <header>
          <div>
            <GitBranchIcon size={20} />
            <h2 id="conflict-title">Değişiklikleri karşılaştır</h2>
          </div>
          <button
            className="icon-button"
            autoFocus={true}
            disabled={working}
            aria-label="Karşılaştırmayı kapat"
            onClick={onCancel}
          >
            <XIcon size={20} />
          </button>
        </header>
        <p>
          Aynı alan başka biri tarafından değiştirilmiş. Hangi değerin kalacağını seç. Diğer bağımsız
          değişiklikler korunur.
        </p>
        <div className="conflict-fields">
          {report.details.map((detail, index) => (
            <section key={detail.key + detail.id + detail.field}>
              <h3>
                {detail.label}
                {detail.field !== 'record' && <small>{FIELD_LABELS[detail.field] || detail.field}</small>}
              </h3>
              <div>
                {['remote', 'local'].map((n) => (
                  <label className={(o[index] || 'remote') === n ? 'chosen' : ''} key={n}>
                    <span>
                      <input
                        type="radio"
                        name={'conflict-' + index}
                        value={n}
                        checked={(o[index] || 'remote') === n}
                        disabled={working}
                        onChange={() =>
                          s({
                            ...o,
                            [index]: n,
                          })
                        }
                      />
                      {n === 'remote' ? 'Ekipteki güncel değer' : 'Benim değişikliğim'}
                    </span>
                    <pre>{c(detail[n], detail.field)}</pre>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <footer>
          <button className="button" disabled={working} onClick={onCancel}>
            Forma dön
          </button>
          <button
            className="button primary"
            disabled={working}
            onClick={() => onConfirm(report.details.map((detail, index) => o[index] || 'remote'))}
          >
            {working ? 'Kaydediliyor…' : 'Seçimlerimle kaydet'}
          </button>
        </footer>
      </section>
    </div>
  );
}
