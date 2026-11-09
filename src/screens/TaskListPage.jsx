// İş listesi: pano, liste, filtreler, toplu işlem. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { CardAssigneeControl } from '../components/CardAssigneeControl.jsx';
import { TaskBoard } from '../components/TaskBoard.jsx';
import { formatDate, formatDuration, toDateTimeInput } from '../lib/format.js';
import { TASK_STATUS_LABELS } from '../lib/labels.js';
import {
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  Clock3Icon,
  LayersIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwClockIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { useApp } from '../AppContext.js';

export function TaskListPage() {
  const {
    activeMembers,
    assignableMembers,
    assigneeFilter,
    assigneesForTask,
    bulkMode,
    bulkSelection,
    busy,
    canWrite,
    changeAssignees,
    dueDayFilter,
    filtersActive,
    filtersOpen,
    isLate,
    listedTasks,
    memberName,
    metricFilter,
    navigate,
    now,
    openModal,
    openTaskDetails,
    projectFilter,
    projectName,
    reportDays,
    requestStatusChange,
    role,
    scopedTasks,
    searchQuery,
    setAssigneeFilter,
    setBulkMode,
    setBulkSelection,
    setDueDayFilter,
    setFiltersOpen,
    setMetricFilter,
    setProjectFilter,
    setSearchQuery,
    setShowTrackedTime,
    setStatusFilter,
    setTaskFilter,
    setTaskView,
    showFilteredTasks,
    showTrackedTime,
    statusFilter,
    statusSelect,
    taskFilter,
    taskSummary,
    taskView,
    trackedSeconds,
    user,
    workspace,
    workspaceId,
    workspaces,
  } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{workspaces.find((space) => space.id === workspaceId)?.name}</span>
          <h1>İşlerin tamamı.</h1>
          <p>İşleri filtrele, sorumlulara ve statülere göre izle.</p>
        </div>
        <div className="dashboard-heading-actions">
          <button className="button" onClick={() => openModal('templates')}>
            <LayersIcon size={16} />
            {' Şablondan'}
          </button>
          {canWrite && (
            <button className="button primary" onClick={() => openModal('task')}>
              <PlusIcon size={18} />
              {' Yeni iş'}
            </button>
          )}
        </div>
      </div>
      {assignableMembers.length < 2 && role === 'owner' && (
        <div className="setup-card">
          <span className="setup-icon">
            <UsersIcon size={23} />
          </span>
          <div>
            <strong>Önce birlikte çalışacağın kişileri ekle.</strong>
            <p>Sonra bir işi ekibinin tamamına veya seçtiğin kişilere ata.</p>
          </div>
          <button
            className="button"
            onClick={() => {
              navigate('team');
              openModal('member');
            }}
          >
            {'Ekip üyesi ekle '}
            <ArrowUpRightIcon size={15} />
          </button>
        </div>
      )}
      <div className="work-summary">
        <button
          onClick={() => showFilteredTasks('today')}
          className={taskFilter === 'today' ? 'selected' : ''}
        >
          <span className="summary-icon sage">
            <CalendarDaysIcon size={18} />
          </span>
          <span>
            <strong>{taskSummary.today}</strong>
            <small>bugün tamamlanacak</small>
          </span>
          <ChevronRightIcon size={15} />
        </button>
        <button onClick={() => showFilteredTasks('open', 'doing')}>
          <span className="summary-icon blue">
            <PlayIcon size={17} />
          </span>
          <span>
            <strong>{scopedTasks.filter((task) => task.status === 'doing').length}</strong>
            <small>devam eden iş</small>
          </span>
          <ChevronRightIcon size={15} />
        </button>
        <button onClick={() => showFilteredTasks('late')} className={taskFilter === 'late' ? 'selected' : ''}>
          <span className="summary-icon sand">
            <Clock3Icon size={18} />
          </span>
          <span>
            <strong>{taskSummary.late}</strong>
            <small>geciken iş</small>
          </span>
          <ChevronRightIcon size={15} />
        </button>
      </div>
      <section className="work-surface">
        <div className="surface-toolbar">
          <div className="work-tabs">
            {[
              ['open', 'Açık işler'],
              ['all', 'Tümü'],
              ['done', 'Tamamlanan'],
            ].map(([e, t]) => (
              <button className={taskFilter === e ? 'active' : ''} onClick={() => setTaskFilter(e)} key={e}>
                {t}
                <b>{taskSummary[e]}</b>
              </button>
            ))}
            {['today', 'late'].includes(taskFilter) && (
              <button className="active" onClick={() => setTaskFilter('open')}>
                {taskFilter === 'today' ? 'Bugün' : 'Geciken'} <XIcon size={12} />
              </button>
            )}
          </div>
          <div className="list-tools">
            <div className="view-switch">
              <button className={taskView === 'board' ? 'active' : ''} onClick={() => setTaskView('board')}>
                Pano
              </button>
              <button className={taskView === 'list' ? 'active' : ''} onClick={() => setTaskView('list')}>
                Liste
              </button>
            </div>
            {canWrite && (
              <button
                className={'button small-button bulk-mode-toggle ' + (bulkMode ? 'selected' : '')}
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setBulkSelection([]);
                  setTaskView('list');
                }}
              >
                <CheckCheckIcon size={15} />
                {bulkMode ? 'Seçimi kapat' : 'Toplu işlem'}
              </button>
            )}
            <label className="search-box">
              <SearchIcon size={16} />
              <input
                aria-label="İşlerde ara"
                placeholder="İş veya kişi ara"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  className="icon-button"
                  aria-label="Aramayı temizle"
                  onClick={() => setSearchQuery('')}
                >
                  <XIcon size={13} />
                </button>
              )}
            </label>
            <button
              className={'icon-button filter-toggle ' + (filtersOpen || filtersActive ? 'selected' : '')}
              aria-label="Filtreleri aç"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontalIcon size={17} />
              {filtersActive && <i />}
            </button>
          </div>
        </div>
        {(metricFilter !== 'all' || dueDayFilter) && (
          <div className="active-scope">
            <span>
              {dueDayFilter
                ? 'Hedef gün: ' + formatDate(dueDayFilter)
                : {
                    originalLate: 'İlk termini geçmiş açık işler',
                    rescheduled: 'Termini revize edilmiş işler',
                    unassigned: 'Aktif sorumlu bekleyen işler',
                    blocked: 'Engeli / ön koşulu olan işler',
                    review: 'Kontrol bekleyen işler',
                    undated: 'Hedef tarihi olmayan işler',
                    periodDone: 'Son ' + reportDays + ' günde tamamlanan işler',
                  }[metricFilter]}
            </span>
            <button
              className="text-button"
              onClick={() => {
                setMetricFilter('all');
                setDueDayFilter('');
              }}
            >
              {'Kaldır '}
              <XIcon size={12} />
            </button>
          </div>
        )}
        {bulkMode && (
          <div className="bulk-toolbar">
            <label className="check-label">
              <input
                type="checkbox"
                aria-label="Görünen tüm işleri seç"
                checked={
                  listedTasks.length > 0 && listedTasks.every((task) => bulkSelection.includes(task.id))
                }
                onChange={(event) =>
                  setBulkSelection(event.target.checked ? listedTasks.map((task) => task.id) : [])
                }
              />{' '}
              {bulkSelection.length}
              {' iş seçildi'}
            </label>
            <button
              className="button primary small-button"
              disabled={!bulkSelection.length || busy}
              onClick={() =>
                openModal('bulk', {
                  ids: bulkSelection,
                  mode: 'status',
                  assignees: [],
                })
              }
            >
              {'Toplu güncelle '}
              <ArrowUpRightIcon size={14} />
            </button>
          </div>
        )}
        {filtersOpen && (
          <div className="filter-bar">
            <select
              aria-label="Duruma göre filtrele"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tüm durumlar</option>
              {Object.entries(TASK_STATUS_LABELS).map(([key, value]) => (
                <option value={key} key={key}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Sorumluya göre filtrele"
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
            >
              <option value="all">Tüm sorumlular</option>
              {activeMembers.map((member) => (
                <option value={member.email} key={member.email}>
                  {memberName(member.email)}
                </option>
              ))}
            </select>
            <select
              aria-label="Projeye göre filtrele"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">Tüm işler / projeler</option>
              <option value="">Günlük operasyon</option>
              {workspace.projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <label className="check-label">
              <input
                type="checkbox"
                checked={showTrackedTime}
                onChange={(event) => setShowTrackedTime(event.target.checked)}
              />
              {' Süreyi göster'}
            </label>
            {filtersActive && (
              <button
                className="text-button"
                onClick={() => {
                  setStatusFilter('all');
                  setAssigneeFilter('all');
                  setProjectFilter('all');
                  setMetricFilter('all');
                  setDueDayFilter('');
                }}
              >
                Temizle
              </button>
            )}
          </div>
        )}
        {listedTasks.length ? (
          taskView === 'list' ? (
            <div className="task-table">
              <div className="table-heading">
                <span>İŞ</span>
                <span>SORUMLU</span>
                <span>HEDEF TARİH</span>
                <span>DURUM</span>
              </div>
              {listedTasks.map((task) => (
                <article className={'task-row ' + (task.status === 'done' ? 'completed' : '')} key={task.id}>
                  <div className="task-title-wrap">
                    {bulkMode && (
                      <input
                        type="checkbox"
                        aria-label={task.title + ' işini seç'}
                        checked={bulkSelection.includes(task.id)}
                        onChange={(event) =>
                          setBulkSelection(
                            event.target.checked
                              ? [...bulkSelection, task.id]
                              : bulkSelection.filter((t) => t !== task.id),
                          )
                        }
                      />
                    )}
                    <button className="task-title-cell" onClick={() => openTaskDetails(task.id)}>
                      <span
                        style={{
                          display: bulkMode ? 'none' : undefined,
                        }}
                        className={'task-indicator ' + task.status}
                      >
                        {task.status === 'done' && <CheckIcon size={13} />}
                      </span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.kind === 'shared' && (
                            <>
                              <UsersIcon size={11} />
                              {' Ortak iş '}
                              <span>·</span>
                            </>
                          )}
                          {task.phase || projectName(task.project)}
                          {task.dueRevisionCount > 0 && (
                            <span className="row-revision">
                              <RotateCcwClockIcon size={11} />
                              {task.dueRevisionCount}
                              {' termin revizyonu'}
                            </span>
                          )}
                          {task.checklist.length > 0 && (
                            <span className="row-checklist">
                              <ClipboardListIcon size={11} />
                              {task.checklist.filter((step) => step.done).length}/{task.checklist.length}
                            </span>
                          )}
                          {task.priority === 'urgent' && <b className="urgent-flag">Acil</b>}
                        </small>
                      </span>
                    </button>
                  </div>
                  <div className="assignees-cell">
                    <CardAssigneeControl
                      task={task}
                      members={assigneesForTask(task)}
                      user={user}
                      name={memberName}
                      onAssign={changeAssignees}
                      onChoose={(e) => openModal('people', e)}
                      disabled={!canWrite || busy}
                    />
                  </div>
                  <button
                    className={'date-cell ' + (isLate(task) ? 'late' : '')}
                    onClick={() => (canWrite ? openModal('reschedule', task) : openTaskDetails(task.id))}
                  >
                    <span>
                      {task.dueAt
                        ? formatDate(toDateTimeInput(task.dueAt).slice(0, 10))
                        : formatDate(task.date)}
                    </span>
                    <small>
                      {task.dueAt
                        ? toDateTimeInput(task.dueAt).slice(11)
                        : task.plannedStart
                          ? 'Başlangıç ' + formatDate(toDateTimeInput(task.plannedStart).slice(0, 10))
                          : ''}
                      {isLate(task) && ' · gecikti'}
                    </small>
                    {showTrackedTime && task.trackTime && (
                      <small>
                        <Clock3Icon size={10} /> {formatDuration(trackedSeconds(task.id))}
                      </small>
                    )}
                  </button>
                  <div className="row-status">
                    {statusSelect(task, true)}
                    <button
                      className="icon-button open-task"
                      aria-label={task.title + ' ayrıntılarını aç'}
                      onClick={() => openTaskDetails(task.id)}
                    >
                      <ChevronRightIcon size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <TaskBoard
              onWait={(e) => openModal('waiting', e)}
              onClaim={(e) => changeAssignees(e, [user])}
              membersFor={assigneesForTask}
              user={user}
              members={assignableMembers}
              onAssign={changeAssignees}
              onChoose={(e) => openModal('people', e)}
              state={workspace}
              tasks={listedTasks}
              name={memberName}
              onOpen={openTaskDetails}
              onStatus={requestStatusChange}
              onNew={(e) =>
                openModal('task', {
                  status: e,
                })
              }
              onRevise={(e) => openModal('reschedule', e)}
              writable={canWrite}
              busy={busy}
              now={now}
            />
          )
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              {taskFilter === 'done' ? <CheckCheckIcon size={30} /> : <BriefcaseBusinessIcon size={30} />}
            </span>
            <h2>
              {searchQuery || filtersActive
                ? 'Aradığın iş burada görünmüyor.'
                : taskFilter === 'done'
                  ? 'Tamamlanan işler burada birikecek.'
                  : taskFilter === 'late'
                    ? 'Geciken iş yok.'
                    : taskFilter === 'today'
                      ? 'Bugün için planlanmış iş yok.'
                      : 'İlk işi birlikte netleştirelim.'}
            </h2>
            <p>
              {searchQuery || filtersActive
                ? 'Aramayı veya filtreleri değiştirerek tekrar dene.'
                : 'Başlığını yaz, sorumlusunu seç ve ekibinle paylaş.'}
            </p>
            {canWrite && !searchQuery && !filtersActive && (
              <button className="button primary" onClick={() => openModal('task')}>
                <PlusIcon size={16} />
                {' İlk işi ekle'}
              </button>
            )}
          </div>
        )}
        <div className="surface-footer">
          <span>
            {listedTasks.length}
            {' iş gösteriliyor'}
          </span>
          <span>
            <span className="small-live" /> {busy ? 'Kaydediliyor…' : 'Kayıtlar güncel'}
          </span>
        </div>
      </section>
    </>
  );
}
