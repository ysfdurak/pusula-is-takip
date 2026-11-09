import { ArrowUpRightIcon, CalendarDaysIcon, CheckIcon, FlagIcon, UserRoundIcon } from 'lucide-react';
import { WAITING_REASON_LABELS, taskTeamIds, teamName } from '../shared/workspaceModel.js';

export function FocusQueue({
  tasks,
  state,
  user,
  writable,
  busy,
  name,
  onOpen,
  onClaim,
  onStatus,
  onWait,
  mode,
}) {
  return (
    <section className="focus-queue">
      <header>
        <h2>
          {mode === 'pool'
            ? 'Ekip havuzu'
            : mode === 'shared'
              ? 'Ekipler arası işler'
              : mode === 'following'
                ? 'Takip ettiğim işler'
                : 'Bugün öncelik vereceklerim'}
        </h2>
        <span>
          {tasks.length}
          {' iş'}
        </span>
      </header>
      {mode === 'pool' && (
        <p>
          Sorumlusu olmayan açık ekip işleri. Üzerine almak statüyü değiştirmez; başlangıcı sen belirlersin.
        </p>
      )}
      {!tasks.length && (
        <div className="empty-state light">
          <CheckIcon size={26} />
          <h3>Bu görünümde iş yok.</h3>
          <p>Diğer açık işlere statü panosundan ulaşabilirsin.</p>
        </div>
      )}
      <div className="focus-queue-list">
        {tasks.map((task) => (
          <article key={task.id}>
            <div className="focus-queue-main">
              <small>
                {taskTeamIds(task)
                  .map((e) => teamName(e, state))
                  .join(' + ') || 'Genel işler'}
                {task.relatedTeamIds.length > 0 ? ' · Ortak kayıt' : ''}
              </small>
              <button className="focus-task-title" onClick={() => onOpen(task.id)}>
                {task.title}
                <ArrowUpRightIcon size={14} />
              </button>
              <span>
                {task.assignees.map(name).join(', ') || 'Sahiplenilmeyi bekliyor'}
                {task.coordinator ? ' · Koordinatör: ' + name(task.coordinator) : ''}
              </span>
              {task.waitingReason && (
                <button className="waiting-chip" onClick={() => (writable ? onWait(task) : onOpen(task.id))}>
                  <FlagIcon size={12} />
                  {WAITING_REASON_LABELS[task.waitingReason]}
                  {task.waitingNote ? ' · ' + task.waitingNote : ''}
                </button>
              )}
            </div>
            <div className="focus-queue-end">
              {writable && !task.waitingReason && !['done', 'cancelled'].includes(task.status) && (
                <button className="text-button" disabled={busy} onClick={() => onWait(task)}>
                  Bekleme bildir
                </button>
              )}
              <span className="focus-date">
                <CalendarDaysIcon size={13} />
                {task.dueAt || task.date
                  ? new Date(task.dueAt || task.date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', {
                      timeZone: 'Europe/Istanbul',
                      day: 'numeric',
                      month: 'short',
                    })
                  : 'Termin yok'}
              </span>
              {writable &&
                !['done', 'cancelled'].includes(task.status) &&
                (mode === 'pool' ? (
                  <button
                    className="button primary small-button"
                    disabled={busy}
                    onClick={() => onClaim(task)}
                  >
                    <UserRoundIcon size={14} />
                    {' Üzerime al'}
                  </button>
                ) : (
                  <button
                    className="button small-button"
                    disabled={busy}
                    onClick={() => onStatus(task, task.status === 'todo' ? 'doing' : 'done')}
                  >
                    {task.status === 'todo' ? 'Başlat' : 'Tamamla'}
                  </button>
                ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
