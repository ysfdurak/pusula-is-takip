// Benim panom ve Ekip panosu. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { DashboardInsights } from '../components/DashboardInsights.jsx';
import { FocusQueue } from '../components/FocusQueue.jsx';
import { QuickCreate } from '../components/QuickCreate.jsx';
import { TaskBoard } from '../components/TaskBoard.jsx';
import { WeekPlan } from '../components/WeekPlan.jsx';
import { DEFAULT_FOCUS_SETTINGS, EMPTY_QUICK_DRAFT } from '../lib/taskViews.js';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { useApp } from '../AppContext.js';

export function BoardsPage() {
  const {
    activeMembers,
    assignableMembers,
    assigneesForTask,
    busy,
    canWrite,
    changeAssignees,
    createQuickTask,
    dashboardProject,
    focusFilters,
    focusItems,
    focusPool,
    focusSettings,
    focusTasks,
    focusView,
    memberName,
    myTeams,
    navigate,
    now,
    openModal,
    openTaskDetails,
    page,
    personalStats,
    projectName,
    quickDrafts,
    reportDays,
    requestStatusChange,
    searchQuery,
    setDashboardProject,
    setFocusSettings,
    setFocusView,
    setReportDays,
    setSearchQuery,
    showTaskList,
    teamScope,
    user,
    workspace,
    workspaceId,
  } = useApp();
  return (
    <DashboardInsights
      compact={page === 'mine' && focusView !== 'board'}
      info={personalStats}
      personal={page === 'mine'}
      onScope={(e) => {
        navigate(e ? 'mine' : 'dashboard');
        if (e) {
          setFocusView('today');
        }
      }}
      days={reportDays}
      onDays={setReportDays}
      projects={workspace.projects}
      project={dashboardProject}
      onProject={setDashboardProject}
      onOpen={openTaskDetails}
      onDrill={showTaskList}
      onAssign={(e) => openModal('people', e)}
      onDate={(e) => openModal('reschedule', e)}
      onNew={() => openModal('task')}
      onTemplates={() => openModal('templates')}
      onProjects={() => navigate('projects')}
      name={memberName}
      writable={canWrite}
      templateCount={workspace.templates.length}
    >
      <section className="board-surface">
        {canWrite && (teamScope === 'all' || myTeams.some((team) => team.id === teamScope)) && (
          <QuickCreate
            draft={
              quickDrafts.current[
                workspaceId +
                  ':' +
                  user +
                  ':' +
                  page +
                  ':' +
                  teamScope +
                  ':' +
                  dashboardProject +
                  ':' +
                  focusSettings.person
              ] || {
                ...EMPTY_QUICK_DRAFT,
                assignment:
                  page === 'dashboard' && focusSettings.person !== 'all' ? focusSettings.person : 'me',
              }
            }
            onDraft={(e) => {
              quickDrafts.current[
                workspaceId +
                  ':' +
                  user +
                  ':' +
                  page +
                  ':' +
                  teamScope +
                  ':' +
                  dashboardProject +
                  ':' +
                  focusSettings.person
              ] = e;
            }}
            teams={myTeams}
            initialTeam={teamScope === 'all' ? '' : teamScope}
            onCreate={createQuickTask}
            members={assignableMembers}
            user={user}
            templates={workspace.templates}
            busy={busy}
            dueRequired={workspace.workRules.dueRequired}
            context={projectName(dashboardProject === 'all' ? '' : dashboardProject)}
            key={workspaceId + user + page + teamScope + dashboardProject + focusSettings.person}
          />
        )}
        {focusView === 'week' ? (
          <WeekPlan
            state={{
              ...workspace,
              tasks: focusPool,
            }}
            members={activeMembers}
            onOpen={openTaskDetails}
          />
        ) : focusView === 'board' ? (
          <>
            <div className="board-toolbar">
              <div>
                <h2>{page === 'mine' ? 'Bana atanan işler' : 'Ekibin işleri'}</h2>
                <small>
                  Üstteki özet tüm kapsamı gösterir. Aşağıdaki filtreler yalnızca iş panosuna uygulanır.
                </small>
              </div>
              <label className="search-box">
                <SearchIcon size={16} />
                <input
                  aria-label="Panoda iş ara"
                  placeholder="İş veya kişi ara"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="board-focus" aria-label="Pano hızlı filtreleri">
              {focusFilters.map(([e, t, n]) => (
                <button
                  aria-pressed={focusSettings.focus === e}
                  className={focusSettings.focus === e ? 'active' : ''}
                  onClick={() =>
                    setFocusSettings({
                      ...focusSettings,
                      focus: e,
                    })
                  }
                  key={e}
                >
                  {t}
                  <b>{n}</b>
                </button>
              ))}
            </div>
            <details className="board-options-drawer">
              <summary>
                {'Sorumlu, sıralama ve geçmiş '}
                <ChevronDownIcon size={14} />
              </summary>
              <div className="board-options">
                {page !== 'mine' && (
                  <label>
                    Sorumlu
                    <select
                      aria-label="Panoda sorumlu"
                      value={focusSettings.person}
                      onChange={(event) =>
                        setFocusSettings({
                          ...focusSettings,
                          person: event.target.value,
                        })
                      }
                    >
                      <option value="all">Tüm ekip</option>
                      {assignableMembers.map((member) => (
                        <option value={member.email} key={member.email}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Sıralama
                  <select
                    aria-label="Pano sıralaması"
                    value={focusSettings.sort}
                    onChange={(event) =>
                      setFocusSettings({
                        ...focusSettings,
                        sort: event.target.value,
                      })
                    }
                  >
                    <option value="priority">Öncelik, sonra termin</option>
                    <option value="due">En yakın termin</option>
                    <option value="created">Yeni açılan önce</option>
                    <option value="title">İş adına göre</option>
                  </select>
                </label>
                <label>
                  Kapanan işler
                  <select
                    aria-label="Panoda kapanan işler"
                    value={focusSettings.closedDays}
                    onChange={(event) =>
                      setFocusSettings({
                        ...focusSettings,
                        closedDays: Number(event.target.value),
                      })
                    }
                  >
                    <option value={7}>Son 7 günde kapanan</option>
                    <option value={30}>Son 30 günde kapanan</option>
                    <option value={0}>Tüm geçmiş</option>
                  </select>
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    setFocusSettings(DEFAULT_FOCUS_SETTINGS);
                    setSearchQuery('');
                  }}
                >
                  Sıfırla
                </button>
                <small>Tercihler bu tarayıcıda hatırlanır.</small>
              </div>
            </details>
            {!focusTasks.length && (
              <div className="board-no-results">
                <SearchIcon size={19} />
                <span>
                  Bu seçimde iş bulunamadı. Diğer statülerdeki işleri görmek için filtreleri sıfırla.
                </span>
              </div>
            )}
            <TaskBoard
              onWait={(e) => openModal('waiting', e)}
              onClaim={(e) => changeAssignees(e, [user])}
              membersFor={assigneesForTask}
              user={user}
              members={assignableMembers}
              onAssign={changeAssignees}
              onChoose={(e) => openModal('people', e)}
              state={workspace}
              tasks={focusTasks}
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
          </>
        ) : (
          <FocusQueue
            tasks={focusItems}
            state={workspace}
            user={user}
            writable={canWrite}
            busy={busy}
            name={memberName}
            onOpen={openTaskDetails}
            onClaim={(e) => changeAssignees(e, [user])}
            onStatus={requestStatusChange}
            onWait={(e) => openModal('waiting', e)}
            mode={focusView}
          />
        )}
      </section>
    </DashboardInsights>
  );
}
