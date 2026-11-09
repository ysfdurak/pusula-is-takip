import { useRef, useState } from 'react';
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  GripVerticalIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwClockIcon,
  RotateCcwIcon,
  UsersIcon,
} from 'lucide-react';
import { RECURRENCE_LABELS } from '../shared/recurrence.js';
import { CardAssigneeControl } from './CardAssigneeControl.jsx';
import { completionIssues, taskObstacles } from '../lib/taskViews.js';
import { WAITING_REASON_LABELS, taskTeamIds, teamName } from '../shared/workspaceModel.js';

export const STATUS_LABELS = {
  todo: 'Başlanmadı',
  doing: 'Devam ediyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
};

export function TaskBoard(e) {
  let [t, n] = useState('');
  let [r, i] = useState('');
  let [a, o] = useState({});
  let s = useRef(null);
  let c = useRef(null);
  let l = (task) =>
    !['done', 'cancelled'].includes(task.status) &&
    !!(task.dueAt
      ? Date.parse(task.dueAt) < e.now
      : task.date && Date.parse(task.date + 'T23:59:59+03:00') < e.now);
  let u = (task) =>
    task.dueAt
      ? new Date(task.dueAt).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Europe/Istanbul',
        })
      : task.date
        ? new Date(task.date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            timeZone: 'Europe/Istanbul',
          })
        : 'Termin yok';
  let d = (t, boardStatus) => {
    let task = e.tasks.find((task) => task.id === t);
    i('');
    n('');
    if (task && task.status !== boardStatus && e.writable && !e.busy) {
      e.onStatus(task, boardStatus);
    }
  };
  function f(event) {
    event.stopPropagation();
    let t = s.current;
    if (!t || (Math.hypot(event.clientX - t.x, event.clientY - t.y) > 6 && (t.moved = true), !t.moved)) {
      return;
    }
    n(t.id);
    let r = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-board-status]');
    i(r?.dataset.boardStatus || '');
    let a = c.current?.getBoundingClientRect();
    if (a && c.current) {
      if (event.clientX > a.right - 45) {
        c.current.scrollLeft += 12;
      }
      if (event.clientX < a.left + 45) {
        c.current.scrollLeft -= 12;
      }
    }
  }
  function p(event) {
    event.stopPropagation();
    let t = s.current;
    if (((s.current = null), !t)) {
      return;
    }
    let r = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-board-status]');
    if (t.moved && r?.dataset.boardStatus) {
      d(t.id, r.dataset.boardStatus);
    } else {
      n('');
      i('');
    }
  }
  return (
    <>
      <p className="board-help">
        {e.writable
          ? 'Kartı veya tutamacını sürükleyerek statüyü değiştir. Telefonda statü menüsünü de kullanabilirsin.'
          : 'İşleri statülerine göre izleyebilirsin.'}
        <span>
          {e.tasks.length}
          {' iş'}
        </span>
      </p>
      <div className="board-status-jumps" aria-label="Statü sütununa git">
        {Object.entries(STATUS_LABELS).map(([key, value]) => (
          <button
            onClick={() => {
              let e = c.current?.querySelector('[data-board-status="' + key + '"]');
              if (e && c.current) {
                c.current.scrollTo({
                  left: e.offsetLeft,
                  behavior: 'smooth',
                });
              }
            }}
            key={key}
          >
            {value}
            <b>{e.tasks.filter((task) => task.status === key).length}</b>
          </button>
        ))}
      </div>
      <div className="ops-board" ref={c} aria-label="Statülere göre iş panosu">
        {Object.entries(STATUS_LABELS).map(([key, value]) => {
          let matchingTasks = e.tasks.filter((task) => task.status === key);
          return (
            <section
              data-board-status={key}
              className={'ops-column ' + key + (r === key ? ' drop-target' : '')}
              onDragOver={(event) => {
                if (e.writable && !e.busy) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  i(key);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                d(event.dataTransfer.getData('text/pusula-task') || t, key);
              }}
              key={key}
            >
              <header>
                <span className="column-dot" />
                <h3>{value}</h3>
                <b>{matchingTasks.length}</b>
                {e.writable && (
                  <button
                    className="icon-button"
                    aria-label={value + ' statüsünde iş ekle'}
                    onClick={() => e.onNew(key)}
                  >
                    <PlusIcon size={15} />
                  </button>
                )}
              </header>
              <div className="column-cards">
                {matchingTasks.slice(0, a[key] || 12).map((task) => {
                  let a = ['done', 'cancelled'].includes(task.status) ? [] : taskObstacles(task, e.state);
                  return (
                    <article
                      data-task-id={task.id}
                      className={
                        'ops-task ' +
                        (a.length ? 'has-blocker ' : '') +
                        (l(task) ? 'overdue ' : '') +
                        (t === task.id ? 'dragging' : '')
                      }
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      onPointerDown={(t) => {
                        if (!(
                          !e.writable ||
                          e.busy ||
                          t.button !== 0 ||
                          t.pointerType === 'touch' ||
                          t.target.closest('button,select,input,textarea,summary,details,a')
                        )) {
                          t.preventDefault();
                          t.currentTarget.setPointerCapture(t.pointerId);
                          s.current = {
                            id: task.id,
                            x: t.clientX,
                            y: t.clientY,
                            moved: false,
                          };
                        }
                      }}
                      onPointerMove={f}
                      onPointerUp={p}
                      onPointerCancel={() => {
                        s.current = null;
                        n('');
                        i('');
                      }}
                      key={task.id}
                    >
                      <div className="ops-task-top">
                        <span className={'priority-tag ' + task.priority}>
                          {
                            {
                              urgent: 'Acil',
                              high: 'Yüksek',
                              normal: 'Normal',
                              low: 'Düşük',
                            }[task.priority]
                          }
                        </span>
                        <span className="card-assignment">
                          {task.kind === 'shared' ? <UsersIcon size={12} /> : null}
                          {task.assignees.length > 1 ? task.assignees.length + ' kişi' : 'Bireysel'}
                        </span>
                        {e.writable && (
                          <button
                            className="drag-handle"
                            aria-label={task.title + ' kartını sürükle'}
                            title="Sürükle veya aşağıdaki statü menüsünü kullan"
                            disabled={e.busy}
                            onPointerDown={(e) => {
                              if (e.button === 0) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.setPointerCapture(e.pointerId);
                                s.current = {
                                  id: task.id,
                                  x: e.clientX,
                                  y: e.clientY,
                                  moved: false,
                                };
                              }
                            }}
                            onPointerMove={f}
                            onPointerUp={p}
                            onPointerCancel={() => {
                              s.current = null;
                              n('');
                              i('');
                            }}
                          >
                            <GripVerticalIcon size={16} />
                          </button>
                        )}
                      </div>
                      <button className="ops-task-title" onClick={() => e.onOpen(task.id)}>
                        {task.title}
                        <ArrowUpRightIcon size={14} />
                      </button>
                      {a.length > 0 && (
                        <button
                          className="card-blocker"
                          title={a.join(' · ')}
                          onClick={() => e.onOpen(task.id)}
                        >
                          <span>!</span> {a.length}
                          {' engel / ön koşul'}
                          <small>{a[0]}</small>
                        </button>
                      )}
                      {task.requireApproval && !task.verified && task.status !== 'done' && (
                        <span className="card-approval">Doğrulama gerekli</span>
                      )}
                      <div className="card-team-tags">
                        {taskTeamIds(task).map((t) => (
                          <span key={t}>{teamName(t, e.state)}</span>
                        ))}
                      </div>
                      {task.waitingReason && (
                        <button
                          className="waiting-chip"
                          onClick={() => (e.writable ? e.onWait(task) : e.onOpen(task.id))}
                        >
                          <span>◷</span>
                          {WAITING_REASON_LABELS[task.waitingReason]}
                        </button>
                      )}
                      <CardAssigneeControl
                        task={task}
                        members={e.membersFor(task)}
                        user={e.user}
                        name={e.name}
                        onAssign={e.onAssign}
                        onChoose={e.onChoose}
                        disabled={!e.writable || e.busy}
                      />
                      {task.checklist.length > 0 && (
                        <div className="card-progress">
                          <span>
                            <i
                              style={{
                                width:
                                  (task.checklist.filter((step) => step.done).length /
                                    task.checklist.length) *
                                    100 +
                                  '%',
                              }}
                            />
                          </span>
                          <small>
                            {task.checklist.filter((step) => step.done).length}/{task.checklist.length}
                            {' adım'}
                          </small>
                        </div>
                      )}
                      <div className={'card-deadline ' + (l(task) ? 'late' : '')}>
                        <CalendarDaysIcon size={13} />
                        <span>
                          {u(task)}
                          {l(task) ? ' · gecikti' : ''}
                          {task.recurrence ? ' · ' + RECURRENCE_LABELS[task.recurrence].toLocaleLowerCase('tr') : ''}
                        </span>
                        {e.writable && l(task) && (
                          <button aria-label={task.title + ' terminini revize et'} onClick={() => e.onRevise(task)}>
                            Revize et
                          </button>
                        )}
                      </div>
                      {task.revisionCount > 0 && (
                        <button className="card-revisions" onClick={() => e.onOpen(task.id)}>
                          <RotateCcwClockIcon size={12} />
                          {task.dueRevisionCount > 0 ? task.dueRevisionCount + ' kez ertelendi' : task.revisionCount + ' revizyon'}
                        </button>
                      )}
                      {e.writable &&
                        !task.assignees.length &&
                        task.teamId &&
                        !['done', 'cancelled'].includes(task.status) && (
                          <button
                            className="button small-button claim-card"
                            disabled={e.busy}
                            onClick={() => e.onClaim(task)}
                          >
                            Üzerime al
                          </button>
                        )}
                      {e.writable && (
                        <button
                          className={'card-primary-action ' + task.status}
                          disabled={e.busy}
                          onClick={() =>
                            e.onStatus(
                              task,
                              task.status === 'todo' ? 'doing' : task.status === 'doing' ? 'done' : 'todo',
                            )
                          }
                        >
                          {task.status === 'todo' ? (
                            <PlayIcon size={13} />
                          ) : task.status === 'doing' ? (
                            <CheckCheckIcon size={14} />
                          ) : (
                            <RotateCcwIcon size={13} />
                          )}{' '}
                          {task.status === 'todo'
                            ? 'Başlat'
                            : task.status === 'doing'
                              ? completionIssues(task, e.state).length
                                ? 'Kontrol et ve tamamla'
                                : 'Tamamla'
                              : 'Yeniden aç'}
                        </button>
                      )}
                      {e.writable && (
                        <details className="card-more">
                          <summary aria-label={task.title + ' için diğer işlemler'}>⋯ Diğer</summary>
                          <div>
                            <select
                              className="card-status-menu"
                              aria-label={task.title + ' statüsünü değiştir'}
                              value={task.status}
                              disabled={e.busy}
                              onChange={(event) => e.onStatus(task, event.target.value)}
                            >
                              {Object.entries(STATUS_LABELS).map(([e, t]) => (
                                <option value={e} key={e}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            {!l(task) && (
                              <button className="text-button" disabled={e.busy} onClick={() => e.onRevise(task)}>
                                Termini değiştir
                              </button>
                            )}
                            {!['done', 'cancelled'].includes(task.status) && (
                              <button className="text-button card-wait-action" disabled={e.busy} onClick={() => e.onWait(task)}>
                                Engel / bekleme bildir
                              </button>
                            )}
                          </div>
                        </details>
                      )}
                    </article>
                  );
                })}
                {matchingTasks.length > (a[key] || 12) && (
                  <button
                    className="board-show-more"
                    onClick={() =>
                      o({
                        ...a,
                        [key]: (a[key] || 12) + 12,
                      })
                    }
                  >
                    {matchingTasks.length - (a[key] || 12)}
                    {' iş daha · Göster'}
                  </button>
                )}
                {!matchingTasks.length && (
                  <div className="column-empty">
                    {t ? 'Buraya bırak' : 'Bu statüde iş yok'}
                    {e.writable && (
                      <button onClick={() => e.onNew(key)}>
                        <PlusIcon size={13} />
                        {' İş ekle'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
