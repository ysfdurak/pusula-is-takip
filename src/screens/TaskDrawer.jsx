// İş ayrıntısı çekmecesi. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { Avatar } from '../components/Avatar.jsx';
import { RevisionHistory } from '../components/RevisionHistory.jsx';
import { trapFocus } from '../lib/focusTrap.js';
import { formatDate, formatDateTime, formatDuration } from '../lib/format.js';
import { TASK_STATUS_LABELS } from '../lib/labels.js';
import { taskObstacles } from '../lib/taskViews.js';
import { WAITING_REASON_LABELS, taskTeamIds, teamName } from '../shared/workspaceModel.js';
import {
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  Clock3Icon,
  CopyIcon,
  FlagIcon,
  GitBranchIcon,
  MessageSquareIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwClockIcon,
  SaveIcon,
  UserRoundIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { useApp } from '../AppContext.js';

export function TaskDrawer() {
  const {
    activities,
    avatarStack,
    busy,
    canWrite,
    changeAssignees,
    commentDraft,
    commentRequestId,
    comments,
    detailTab,
    detailsLoading,
    error,
    isLate,
    memberName,
    modal,
    now,
    openModal,
    openTaskDetails,
    projectName,
    recordTime,
    saveAsTemplate,
    selectedTask,
    setCommentDraft,
    setDetailTab,
    setError,
    setOpenTaskId,
    statusSelect,
    submitComment,
    timeEntries,
    toggleChecklistItem,
    toggleWatch,
    trackedSeconds,
    user,
    workspace,
  } = useApp();
  return (
    <div
      className="drawer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          setOpenTaskId('');
          setError('');
        }
      }}
    >
      <section
        className="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onKeyDown={trapFocus}
      >
        <header className="drawer-top">
          <span>
            <BriefcaseBusinessIcon size={15} />
            {' İş ayrıntısı'}
          </span>
          <div>
            {canWrite && (
              <button
                className="icon-button"
                aria-label="İşi şablon olarak kaydet"
                onClick={() => openModal('template', selectedTask)}
              >
                <SaveIcon size={16} />
              </button>
            )}
            {canWrite && (
              <button
                className="icon-button"
                aria-label="İşi kopyala"
                onClick={() => saveAsTemplate(selectedTask)}
              >
                <CopyIcon size={16} />
              </button>
            )}
            {canWrite && (
              <button className="button small-button" onClick={() => openModal('task', selectedTask)}>
                <PencilIcon size={14} />
                {' Düzenle'}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="İş ayrıntısını kapat"
              autoFocus={true}
              onClick={() => {
                setOpenTaskId('');
                setError('');
              }}
            >
              <XIcon size={21} />
            </button>
          </div>
        </header>
        <div className="drawer-body">
          {error && !modal && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <div className="drawer-title-row">
            <span className="kind-label">
              {selectedTask.kind === 'shared' ? <UsersIcon size={14} /> : <UserRoundIcon size={14} />}{' '}
              {selectedTask.kind === 'shared' ? 'Ortak iş' : 'Bireysel iş'}
              {selectedTask.priority === 'urgent' && <b>Acil</b>}
            </span>
            {statusSelect(selectedTask)}
          </div>
          <h2 id="drawer-title">{selectedTask.title}</h2>
          <div className="task-team-line">
            {taskTeamIds(selectedTask).map((e) => (
              <span key={e}>{teamName(e, workspace)}</span>
            ))}
            {!selectedTask.teamId && <span>Genel işler</span>}
            {selectedTask.coordinator && (
              <small>
                {'Koordinatör: '}
                {memberName(selectedTask.coordinator)}
              </small>
            )}
          </div>
          {canWrite && (
            <div className="task-quick-actions">
              <button
                className="button small-button"
                disabled={busy}
                onClick={() => toggleWatch(selectedTask)}
              >
                {selectedTask.watchers.includes(user) ? 'Takipten çık' : 'Takip et'}
              </button>
              {!selectedTask.assignees.length && selectedTask.teamId && (
                <button
                  className="button small-button"
                  disabled={busy}
                  onClick={() => changeAssignees(selectedTask, [user])}
                >
                  Üzerime al
                </button>
              )}
              <button
                className="button small-button"
                disabled={busy}
                onClick={() => openModal('waiting', selectedTask)}
              >
                {selectedTask.waitingReason
                  ? WAITING_REASON_LABELS[selectedTask.waitingReason]
                  : 'Bekleme bildir'}
              </button>
              {selectedTask.waitingReason && <small>{selectedTask.waitingNote}</small>}
            </div>
          )}
          <div className="drawer-meta">
            <div>
              <label>Sorumlular</label>
              <button
                className="drawer-people"
                disabled={!canWrite}
                onClick={() => openModal('people', selectedTask)}
              >
                {selectedTask.assignees.length ? (
                  <>
                    {avatarStack(selectedTask.assignees)}
                    <span>{selectedTask.assignees.map(memberName).join(', ')}</span>
                  </>
                ) : (
                  <span className="muted">Sorumlu seç</span>
                )}
                {canWrite && <PencilIcon size={13} />}
              </button>
            </div>
            <div>
              <label>Başlangıç</label>
              <span>
                <CalendarDaysIcon size={15} />
                {formatDateTime(selectedTask.plannedStart)}
              </span>
            </div>
            <div>
              <label>
                {'Termin '}
                {canWrite && (
                  <button className="inline-revise" onClick={() => openModal('reschedule', selectedTask)}>
                    Revize et
                  </button>
                )}
              </label>
              <span className={isLate(selectedTask) ? 'late' : ''}>
                <FlagIcon size={15} />
                {selectedTask.dueAt
                  ? formatDateTime(selectedTask.dueAt)
                  : selectedTask.date
                    ? formatDate(selectedTask.date)
                    : 'Belirlenmedi'}
              </span>
            </div>
            {selectedTask.project && (
              <div>
                <label>Proje</label>
                <span>{projectName(selectedTask.project)}</span>
              </div>
            )}
          </div>
          {selectedTask.description && (
            <div className="task-description">
              <h3>Yapılacak iş</h3>
              <p>{selectedTask.description}</p>
            </div>
          )}
          <button className="revision-summary" onClick={() => setDetailTab('history')}>
            <RotateCcwClockIcon size={18} />
            <span>
              <strong>
                {selectedTask.revisionCount}
                {' revizyon · '}
                {selectedTask.dueRevisionCount}
                {' termin değişikliği'}
              </strong>
              <small>
                {'İlk termin: '}
                {formatDateTime(selectedTask.originalDueAt)}
                {' · Kim, neyi değiştirdi?'}
              </small>
            </span>
            <ChevronRightIcon size={16} />
          </button>
          {selectedTask.checklist.length > 0 && (
            <section className="task-checklist">
              <div>
                <h3>
                  <ClipboardListIcon size={17} />
                  {' Kontrol listesi'}
                </h3>
                <span>
                  {selectedTask.checklist.filter((step) => step.done).length}/{selectedTask.checklist.length}
                </span>
              </div>
              <div className="checklist-progress">
                <i
                  style={{
                    width:
                      (selectedTask.checklist.filter((step) => step.done).length /
                        selectedTask.checklist.length) *
                        100 +
                      '%',
                  }}
                />
              </div>
              {selectedTask.checklist.map((step) => (
                <label className={step.done ? 'done' : ''} key={step.id}>
                  <input
                    type="checkbox"
                    aria-label={step.text}
                    checked={step.done}
                    disabled={!canWrite || busy}
                    onChange={() => toggleChecklistItem(selectedTask, step.id)}
                  />
                  <span>
                    {step.text}
                    {step.doneBy && (
                      <small>
                        {memberName(step.doneBy)}
                        {' · '}
                        {formatDateTime(step.doneAt)}
                      </small>
                    )}
                  </span>
                </label>
              ))}
              {selectedTask.checklistRequired && <p>Tüm adımlar bitmeden iş tamamlanamaz.</p>}
            </section>
          )}
          {selectedTask.estimatedMinutes > 0 && (
            <div className="effort-note">
              <Clock3Icon size={16} />
              <span>
                {'Planlanan toplam emek: '}
                <strong>
                  {selectedTask.estimatedMinutes}
                  {' kişi-dakika'}
                </strong>
                {selectedTask.trackTime && (
                  <small>
                    {'Kaydedilen: '}
                    {formatDuration(trackedSeconds(selectedTask.id))}
                  </small>
                )}
              </span>
            </div>
          )}
          {selectedTask.trackTime && (
            <section className="time-card">
              <div>
                <Clock3Icon size={18} />
                <span>
                  <strong>{formatDuration(trackedSeconds(selectedTask.id))}</strong>
                  <small>
                    {'Toplam kişi süresi · Benim sürem '}
                    {formatDuration(trackedSeconds(selectedTask.id, user))}
                  </small>
                </span>
              </div>
              {timeEntries.some(
                (entry) => entry.task === selectedTask.id && entry.email === user && !entry.ended,
              ) ? (
                <button
                  className="button small-button"
                  disabled={!canWrite || busy}
                  onClick={() => recordTime('timer_stop', selectedTask)}
                >
                  <PauseIcon size={14} />
                  {' Durdur'}
                </button>
              ) : (
                <button
                  className="button small-button"
                  disabled={!canWrite || busy || selectedTask.status !== 'doing'}
                  onClick={() => recordTime('timer_start', selectedTask)}
                >
                  <PlayIcon size={14} />
                  {' Sayacı başlat'}
                </button>
              )}
              <button
                className="text-button"
                disabled={!canWrite || busy || selectedTask.status !== 'doing'}
                onClick={() => openModal('time', selectedTask)}
              >
                Süre ekle
              </button>
              {selectedTask.status !== 'doing' && <p>Sayaç için işin durumunu “Devam ediyor” yap.</p>}
            </section>
          )}
          {selectedTask.requireApproval && (
            <div className="approval-note">
              <CheckCheckIcon size={17} />
              <span>
                {selectedTask.verified
                  ? 'Kabul ölçütü doğrulandı'
                  : 'Bu iş tamamlanmadan önce doğrulama bekliyor.'}
              </span>
              {canWrite && !selectedTask.verified && (
                <button className="text-button" onClick={() => openModal('task', selectedTask)}>
                  İncele
                </button>
              )}
            </div>
          )}
          <section className="drawer-blockers">
            <header>
              <h3>
                <FlagIcon size={16} />
                {' Engeller ve ön koşullar'}
              </h3>
              {canWrite && (
                <button
                  className="text-button"
                  onClick={() =>
                    openModal('blocker', {
                      project: selectedTask.project,
                      task: selectedTask.id,
                      owner: memberName(user),
                      title: '',
                      resolved: false,
                    })
                  }
                >
                  <PlusIcon size={13} />
                  {' Engel bildir'}
                </button>
              )}
            </header>
            {workspace.blockers
              .filter((blocker) => blocker.task === selectedTask.id)
              .map((blocker) => (
                <div className={blocker.resolved ? 'resolved' : ''} key={blocker.id}>
                  <FlagIcon size={14} />
                  <span>
                    <strong>{blocker.title}</strong>
                    <small>
                      {blocker.resolved ? 'Çözüldü' : 'Çözüm bekliyor'}
                      {' · '}
                      {blocker.owner || 'Çözüm sorumlusu yok'}
                    </small>
                  </span>
                  {canWrite && (
                    <button className="text-button" onClick={() => openModal('blocker', blocker)}>
                      Yönet
                    </button>
                  )}
                </div>
              ))}
            {selectedTask.depends.map((dependencyId) => {
              let task = workspace.tasks.find((task) => task.id === dependencyId);
              return (
                <button
                  className="prerequisite-link"
                  onClick={() => openTaskDetails(dependencyId)}
                  key={dependencyId}
                >
                  <GitBranchIcon size={14} />
                  <span>{task?.title || 'Ön koşul bulunamadı'}</span>
                  <small>{task ? TASK_STATUS_LABELS[task.status] : ''}</small>
                  <ChevronRightIcon size={14} />
                </button>
              );
            })}
            {!taskObstacles(selectedTask, workspace).length && (
              <p className="blockers-clear">
                <CheckIcon size={13} />
                {' Açık engel veya tamamlanmamış ön koşul yok.'}
              </p>
            )}
          </section>
          <div className="discussion">
            <div className="discussion-tabs">
              <button
                className={detailTab === 'comments' ? 'active' : ''}
                onClick={() => setDetailTab('comments')}
              >
                <MessageSquareIcon size={16} />
                {' Yorumlar '}
                <b>{comments.length}</b>
              </button>
              <button
                className={detailTab === 'history' ? 'active' : ''}
                onClick={() => setDetailTab('history')}
              >
                <RotateCcwClockIcon size={15} />
                {' Geçmiş'}
              </button>
            </div>
            {detailTab === 'comments' ? (
              <>
                {canWrite && (
                  <form className="comment-composer" onSubmit={submitComment}>
                    <Avatar name={memberName(user)} />
                    <div>
                      <textarea
                        aria-label="Yorum yaz"
                        placeholder="Ekibinle bir gelişme paylaş…"
                        rows={3}
                        value={commentDraft}
                        onChange={(event) => {
                          setCommentDraft(event.target.value);
                          commentRequestId.current = '';
                        }}
                        maxLength={4e3}
                        required={true}
                        disabled={busy}
                      />
                      <div className="composer-footer">
                        <small>İlgili kişiler bilgilendirilir.</small>
                        <button
                          className="button primary small-button"
                          disabled={busy || !commentDraft.trim()}
                        >
                          <ArrowUpRightIcon size={14} />
                          {' Paylaş'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
                {detailsLoading ? (
                  <p className="muted loading-inline">Yorumlar yükleniyor…</p>
                ) : comments.length ? (
                  comments.map((comment) => (
                    <article className="comment-item" key={comment.id}>
                      <Avatar name={memberName(comment.author)} />
                      <div>
                        <div className="comment-meta">
                          <strong>{memberName(comment.author)}</strong>
                          <time>{formatDateTime(new Date(comment.created).toISOString())}</time>
                        </div>
                        <p>{comment.body}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="no-comments">
                    <MessageSquareIcon size={23} />
                    <p>İlk gelişmeyi sen paylaş.</p>
                    <small>Konuşmalar işin altında bir arada kalır.</small>
                  </div>
                )}
              </>
            ) : detailsLoading ? (
              <p className="muted loading-inline">Geçmiş yükleniyor…</p>
            ) : (
              <RevisionHistory
                teamName={(e) => teamName(e, workspace)}
                activities={activities}
                name={memberName}
                timeLabel={formatDateTime}
              />
            )}
          </div>
          <details className="task-extra">
            <summary>
              {'Diğer bilgiler '}
              <ChevronDownIcon size={13} />
            </summary>
            <dl>
              <dt>İşi açan</dt>
              <dd>{memberName(selectedTask.createdBy) || 'Kayıt yok'}</dd>
              <dt>Gerçek başlangıç</dt>
              <dd>{formatDateTime(selectedTask.startedAt)}</dd>
              <dt>Tamamlanma</dt>
              <dd>{formatDateTime(selectedTask.completedAt)}</dd>
              <dt>Takipçiler</dt>
              <dd>{selectedTask.watchers.map(memberName).join(', ') || 'Yok'}</dd>
            </dl>
            {selectedTask.depends.length > 0 && (
              <p>
                {'Önce tamamlanacak işler: '}
                {selectedTask.depends
                  .map((dependencyId) => workspace.tasks.find((task) => task.id === dependencyId)?.title)
                  .join(', ')}
              </p>
            )}
            {selectedTask.trackTime &&
              timeEntries
                .filter((entry) => entry.task === selectedTask.id)
                .slice(0, 15)
                .map((entry) => (
                  <div className="time-log" key={entry.id}>
                    <span>{memberName(entry.email)}</span>
                    <span>
                      {formatDuration(entry.ended ? entry.seconds : Math.floor((now - entry.started) / 1e3))}
                      {entry.ended ? '' : ' · çalışıyor'}
                    </span>
                    <small>{entry.note || 'Sayaç kaydı'}</small>
                  </div>
                ))}
          </details>
        </div>
      </section>
    </div>
  );
}
