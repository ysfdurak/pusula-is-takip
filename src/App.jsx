import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRightIcon, BellIcon, BriefcaseBusinessIcon, CalendarDaysIcon, CheckCheckIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CircleQuestionMarkIcon, ClipboardListIcon, Clock3Icon, CompassIcon, CopyIcon, DownloadIcon, EllipsisIcon, EyeIcon, FlagIcon, GitBranchIcon, LayersIcon, LoaderCircleIcon, LogOutIcon, MailIcon, MessageSquareIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, RefreshCwIcon, RotateCcwClockIcon, RotateCcwIcon, SaveIcon, SearchIcon, Settings2Icon, ShieldCheckIcon, SlidersHorizontalIcon, UserRoundIcon, UsersIcon, XIcon } from 'lucide-react';
import { Avatar } from './components/Avatar.jsx';
import { CardAssigneeControl } from './components/CardAssigneeControl.jsx';
import { ConflictDialog, fromLocalDateTimeInput } from './components/ConflictDialog.jsx';
import { DashboardInsights } from './components/DashboardInsights.jsx';
import { DateShortcuts } from './components/DateShortcuts.jsx';
import { FocusQueue } from './components/FocusQueue.jsx';
import { GlobalSearch } from './components/GlobalSearch.jsx';
import { NotificationGroups } from './components/NotificationGroups.jsx';
import { PeoplePicker } from './components/PeoplePicker.jsx';
import { ProjectPortfolio } from './components/ProjectPortfolio.jsx';
import { QuickCreate } from './components/QuickCreate.jsx';
import { RevisionHistory } from './components/RevisionHistory.jsx';
import { TaskBoard } from './components/TaskBoard.jsx';
import { TaskRouting } from './components/TaskRouting.jsx';
import { TeamEditor } from './components/TeamEditor.jsx';
import { TeamHub } from './components/TeamHub.jsx';
import { WeekPlan } from './components/WeekPlan.jsx';
import {
  DEMO_USERS,
  createDemoConflict,
  demoGet,
  demoPost,
  resetDemoData,
  setDemoActor,
} from './demo/demoServer.js';
import { applyConflictChoices, buildConflictReport } from './lib/conflicts.js';
import { buildDashboardStats, dueTime } from './lib/dashboardStats.js';
import { trapFocus } from './lib/focusTrap.js';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  fromDateTimeInput,
  newId,
  toDateTimeInput,
  todayKey,
} from './lib/format.js';
import { NAV_ITEMS, PRIORITY_LABELS, ROLE_LABELS, TASK_STATUS_LABELS } from './lib/labels.js';
import {
  DEFAULT_FOCUS_SETTINGS,
  EMPTY_QUICK_DRAFT,
  buildQuickTask,
  completionIssues,
  filterFocusTasks,
  istanbulDay,
  taskObstacles,
} from './lib/taskViews.js';
import {
  DEFAULT_NOTIFY_POLICY,
  EMPTY_STATE,
  WAITING_REASON_LABELS,
  poolTasks,
  taskFromTemplate,
  taskSchema,
  taskTeamIds,
  teamName,
  validateSchedule,
} from './shared/workspaceModel.js';

export function App({ demo = false }) {
  let [workspace, setWorkspace] = useState(EMPTY_STATE);
  let [workspaces, setWorkspaces] = useState([]);
  let [workspaceId, setWorkspaceId] = useState('');
  let [members, setMembers] = useState([]);
  let [role, setRole] = useState('viewer');
  let [user, setUser] = useState('');
  let [revision, setRevision] = useState(0);
  let [timeEntries, setTimeEntries] = useState([]);
  let [notifications, setNotifications] = useState([]);
  let [notifyPolicy, setNotifyPolicy] = useState(DEFAULT_NOTIFY_POLICY);
  let [mailConfigured, setMailConfigured] = useState(false);
  let [teamScope, setTeamScope] = useState('all');
  let [focusView, setFocusView] = useState('today');
  let [groupNotifications, setGroupNotifications] = useState(true);
  let [page, setPage] = useState('mine');
  let [taskFilter, setTaskFilter] = useState('all');
  let [searchQuery, setSearchQuery] = useState('');
  let [filtersOpen, setFiltersOpen] = useState(false);
  let [statusFilter, setStatusFilter] = useState('all');
  let [assigneeFilter, setAssigneeFilter] = useState('all');
  let [projectFilter, setProjectFilter] = useState('all');
  let [taskView, setTaskView] = useState('board');
  let [showTrackedTime, setShowTrackedTime] = useState(false);
  let [moreToolsOpen, setMoreToolsOpen] = useState(false);
  let [notificationScope, setNotificationScope] = useState('mine');
  let [loading, setLoading] = useState(true);
  let [refreshing, setRefreshing] = useState(false);
  let [busy, setBusy] = useState(false);
  let [authRequired, setAuthRequired] = useState(false);
  let [error, setError] = useState('');
  let [toast, setToast] = useState('');
  let [modal, setModal] = useState(null);
  let [openTaskId, setOpenTaskId] = useState('');
  let [comments, setComments] = useState([]);
  let [activities, setActivities] = useState([]);
  let [detailsLoading, setDetailsLoading] = useState(false);
  let [commentDraft, setCommentDraft] = useState('');
  let [detailTab, setDetailTab] = useState('comments');
  let [now, setNow] = useState(Date.now());
  let [dashboardProject, setDashboardProject] = useState('all');
  let [reportDays, setReportDays] = useState(7);
  let [metricFilter, setMetricFilter] = useState('all');
  let [dueDayFilter, setDueDayFilter] = useState('');
  let [bulkMode, setBulkMode] = useState(false);
  let [bulkSelection, setBulkSelection] = useState([]);
  let [focusSettings, setFocusSettings] = useState(DEFAULT_FOCUS_SETTINGS);
  let [loadedViewKey, setLoadedViewKey] = useState('');
  let [remoteChanged, setRemoteChanged] = useState(false);
  let [offline, setOffline] = useState(false);
  let [lastSync, setLastSync] = useState(0);
  let [conflict, setConflict] = useState(null);
  let [conflictSaving, setConflictSaving] = useState(false);
  let [conflictError, setConflictError] = useState('');
  let conflictResolver = useRef(null);
  let syncGuard = useRef({
    space: '',
    revision: 0,
    protected: false,
  });
  syncGuard.current = {
    space: workspaceId,
    revision,
    protected: !!(busy || modal || openTaskId || commentDraft || bulkMode),
  };
  let quickDrafts = useRef({});
  let detailsRequestSeq = useRef(0);
  let commentRequestId = useRef('');
  let deepLinkHandled = useRef(false);
  let returnFocusRef = useRef(null);
  let canWrite = role !== 'viewer';
  let activeMembers = members.filter((member) => member.active === 1);
  let assignableMembers = activeMembers.filter((member) => member.role !== 'viewer');
  let selectedTask = workspace.tasks.find((task) => task.id === openTaskId);
  let currentMember = members.find((member) => member.email === user);
  let memberName = (email) => members.find((member) => member.email === email)?.name || email;
  let projectName = (e) => workspace.projects.find((project) => project.id === e)?.name || 'Günlük operasyon';
  let isOpen = (task) => !['done', 'cancelled'].includes(task.status);
  let isLate = (task) =>
    isOpen(task) && !!(task.dueAt ? Date.parse(task.dueAt) < now : task.date && task.date < todayKey());
  let isDueToday = (task) =>
    isOpen(task) && (task.dueAt ? toDateTimeInput(task.dueAt).slice(0, 10) : task.date) === todayKey();
  let trackedSeconds = (e, t) =>
    timeEntries
      .filter((entry) => entry.task === e && (!t || entry.email === t))
      .reduce(
        (sum, entry) =>
          sum + (entry.ended ? entry.seconds : Math.max(0, Math.floor((now - entry.started) / 1e3))),
        0,
      );
  let visibleTeams = workspace.teams.filter(
    (team) =>
      role === 'owner' ||
      team.members.includes(user) ||
      workspace.tasks.some((task) => taskTeamIds(task).includes(team.id)),
  );
  let myTeams = workspace.teams.filter((team) => role === 'owner' || team.members.includes(user));
  let inTeamScope = (task) => teamScope === 'all' || taskTeamIds(task).includes(teamScope);
  let assigneesForTask = (item) => {
    let n = taskTeamIds(item);
    return n.length
      ? assignableMembers.filter((member) =>
          workspace.teams.some(
            (team) => n.includes(team.id) && team.active && team.members.includes(member.email),
          ),
        )
      : assignableMembers;
  };
  if (!(teamScope === 'all')) {
    assignableMembers.filter((member) =>
      workspace.teams.some((team) => team.id === teamScope && team.members.includes(member.email)),
    );
  }
  let dashboardStats = useMemo(
    () => buildDashboardStats(workspace, members, timeEntries, now, reportDays),
    [workspace, members, timeEntries, Math.floor(now / 6e4), reportDays],
  );
  let personalStats = useMemo(
    () =>
      buildDashboardStats(
        {
          ...workspace,
          tasks: workspace.tasks.filter(
            (task) =>
              inTeamScope(task) &&
              (page !== 'mine' || task.assignees.includes(user)) &&
              (dashboardProject === 'all' || task.project === dashboardProject),
          ),
          blockers: workspace.blockers.filter(
            (blocker) => dashboardProject === 'all' || blocker.project === dashboardProject,
          ),
        },
        members,
        timeEntries,
        now,
        reportDays,
        workspace.tasks,
      ),
    [
      workspace,
      members,
      timeEntries,
      dashboardProject,
      page,
      user,
      teamScope,
      Math.floor(now / 6e4),
      reportDays,
    ],
  );
  function showTaskList(e, t = '', n = '') {
    let r = page === 'mine';
    navigate('tasks');
    setProjectFilter(dashboardProject);
    setAssigneeFilter(t || (r ? user : 'all'));
    if (e.startsWith('status:')) {
      setTaskFilter('all');
      setStatusFilter(e.slice(7));
    } else {
      if (e === 'periodDone') {
        setTaskFilter('done');
        setMetricFilter('periodDone');
      } else {
        if (e === 'late') {
          setTaskFilter('late');
        } else {
          if (e === 'due') {
            setDueDayFilter(n);
          } else {
            if (e !== 'open') {
              setMetricFilter(e);
            }
          }
        }
      }
    }
    setFiltersOpen(e !== 'open' || !!t || dashboardProject !== 'all');
  }
  async function toggleChecklistItem(e, n) {
    setBusy(true);
    setError('');
    try {
      await saveState({
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.id === e.id
            ? {
                ...task,
                checklist: task.checklist.map((step) =>
                  step.id === n
                    ? {
                        ...step,
                        done: !step.done,
                      }
                    : step,
                ),
              }
            : task,
        ),
      });
      await refresh();
      await loadTaskDetails(e.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function createFromTemplate(template) {
    let n = taskFromTemplate(
      template,
      newId(),
      newId,
      assignableMembers.map((member) => member.email),
    );
    if (n.project && !workspace.projects.some((project) => project.id === n.project)) {
      n.project = '';
    }
    openModal('task', {
      ...n,
      plannedStart: new Date().toISOString(),
    });
  }
  function saveAsTemplate(e) {
    createFromTemplate({
      id: newId(),
      name: e.title,
      task: e,
    });
  }
  async function switchDemoUser(e) {
    setTeamScope('all');
    setBusy(true);
    setError('');
    setOpenTaskId('');
    setModal(null);
    try {
      setDemoActor(e);
      let t = demoGet('');
      applySnapshot(t, '');
      let n = t.workspaces[0]?.id;
      if (n) {
        applySnapshot(demoGet(n), n);
      }
      navigate('dashboard');
      setToast('Örnek kullanıcı değiştirildi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  let myNotifications = notifications.filter((notification) => notification.recipient === user);
  let unreadCount = myNotifications.filter((notification) => !notification.read_at).length;
  async function fetchWorkspace(t, n = '') {
    if (demo) {
      return demoGet(t, n);
    }
    let task = await fetch(
      '/api/workspace' +
        (t ? '?id=' + encodeURIComponent(t) + (n ? '&task=' + encodeURIComponent(n) : '') : ''),
    );
    let i = await task.json();
    if (task.status === 401) {
      throw (setAuthRequired(true), Error('Lütfen oturum aç.'));
    }
    if (!task.ok) {
      throw Error(i.error || 'Veriler alınamadı.');
    }
    return i;
  }
  function applySnapshot(nextWorkspace, t) {
    if (t && t !== workspaceId) {
      setTeamScope('all');
    }
    setWorkspaces(nextWorkspace.workspaces);
    setUser(nextWorkspace.user);
    setAuthRequired(false);
    if (t) {
      setNow(Date.now());
      setRemoteChanged(false);
      setOffline(false);
      setLastSync(Date.now());
      setWorkspaceId(t);
      setWorkspace(nextWorkspace.state);
      setRevision(nextWorkspace.revision);
      setRole(nextWorkspace.role);
      setMembers(nextWorkspace.members);
      setTimeEntries(nextWorkspace.times || []);
      setNotifications(nextWorkspace.notifications || []);
      setNotifyPolicy(nextWorkspace.policy || DEFAULT_NOTIFY_POLICY);
      setMailConfigured(!!nextWorkspace.mailConfigured);
    }
  }
  async function refresh(e = workspaceId) {
    setRefreshing(true);
    try {
      applySnapshot(await fetchWorkspace(e), e);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }
  async function postAction(t) {
    if (demo) {
      try {
        return demoPost(t);
      } catch (err) {
        throw (err.message.includes('Kayıt değişti') && (err.status = 409), err);
      }
    }
    let task = await fetch('/api/workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(t),
    });
    let r = await task.json();
    if (!task.ok) {
      let otherTask = Error(r.error || 'İşlem tamamlanamadı.');
      throw ((otherTask.status = task.status), otherTask);
    }
    return r;
  }
  async function saveState(e, r = '') {
    let space;
    try {
      space = await postAction({
        action: 'save',
        id: workspaceId,
        revision,
        state: e,
        reason: r,
      });
    } catch (err) {
      if (err.status !== 409) {
        throw err;
      }
      let nextWorkspace = await fetchWorkspace(workspaceId);
      let conflictReport = buildConflictReport(workspace, e, nextWorkspace.state);
      if (conflictReport.conflicts.length) {
        setRemoteChanged(true);
        setConflictError('');
        space = await new Promise((n, i) => {
          conflictResolver.current = {
            resolve: n,
            reject: i,
          };
          setConflict({
            base: workspace,
            proposed: e,
            latest: nextWorkspace,
            report: conflictReport,
            reason: r,
          });
        });
      } else {
        space = await postAction({
          action: 'save',
          id: workspaceId,
          revision: nextWorkspace.revision,
          state: conflictReport.state,
          reason: r,
        });
      }
    }
    setNow(Date.now());
    setRemoteChanged(false);
    setWorkspace(space.state);
    setRevision(space.revision);
    setLastSync(Date.now());
    return space.state;
  }
  function cancelConflict() {
    setConflict(null);
    setConflictError('');
    conflictResolver.current?.reject(Error('Kaydetme iptal edildi. Formdaki değişikliklerin korunuyor.'));
    conflictResolver.current = null;
  }
  async function confirmConflict(e) {
    setConflictSaving(true);
    setConflictError('');
    try {
      let conflictChoices = applyConflictChoices(conflict.report, e);
      let n = await postAction({
        action: 'save',
        id: workspaceId,
        revision: conflict.latest.revision,
        state: conflictChoices,
        reason: conflict.reason,
      });
      setConflict(null);
      conflictResolver.current?.resolve(n);
      conflictResolver.current = null;
    } catch (err) {
      if (err.status === 409) {
        try {
          let nextWorkspace = await fetchWorkspace(workspaceId);
          setConflict({
            ...conflict,
            latest: nextWorkspace,
            report: buildConflictReport(conflict.base, conflict.proposed, nextWorkspace.state),
          });
          setConflictError(
            'Bu sırada yeni bir değişiklik geldi. Seçimleri güncel değerlerle tekrar kontrol et.',
          );
        } catch {
          setConflictError('Güncel kayıt alınamadı. Bağlantıyı kontrol et.');
        }
      } else {
        setConflictError(err.message);
      }
    } finally {
      setConflictSaving(false);
    }
  }
  async function loadTaskDetails(e, t = workspaceId) {
    let n = ++detailsRequestSeq.current;
    setDetailsLoading(true);
    try {
      let nextWorkspace = await fetchWorkspace(t, e);
      if (detailsRequestSeq.current === n) {
        setComments(nextWorkspace.comments || []);
        setActivities(nextWorkspace.activities || []);
      }
    } catch (err) {
      if (detailsRequestSeq.current === n) {
        setError(err.message);
      }
    } finally {
      if (detailsRequestSeq.current === n) {
        setDetailsLoading(false);
      }
    }
  }
  function openTaskDetails(e) {
    if (!workspace.tasks.some((task) => task.id === e)) {
      setError('Bu iş artık listede bulunmuyor. İşleri yenileyebilirsin.');
      return;
    }
    returnFocusRef.current = document.activeElement;
    setOpenTaskId(e);
    setComments([]);
    setActivities([]);
    setCommentDraft('');
    commentRequestId.current = '';
    setDetailTab('comments');
    setError('');
    loadTaskDetails(e);
  }
  function openModal(e, t = {}) {
    returnFocusRef.current = document.activeElement;
    setError('');
    setModal({
      type: e,
      item:
        e === 'task'
          ? taskSchema.parse({
              id: newId(),
              project: '',
              title: 'Yeni iş',
              status: 'todo',
              plannedStart: new Date().toISOString(),
              teamId: myTeams.some((team) => team.id === teamScope) ? teamScope : '',
              assignees: assignableMembers.some((member) => member.email === user) ? [user] : [],
              ...t,
            })
          : structuredClone(t),
    });
  }
  function startDemoConflict() {
    try {
      let demoConflict = createDemoConflict(workspaceId);
      applySnapshot(demoConflict.snapshot, workspaceId);
      openModal('task', demoConflict.task);
      setToast('Kurgusal çakışma hazır. Kaydet dediğinde iki başlığı karşılaştıracaksın.');
    } catch (err) {
      setError(err.message);
    }
  }
  function closeModal() {
    setModal(null);
    setError('');
    returnFocusRef.current?.focus();
  }
  function showFilteredTasks(e, t = 'all') {
    setMetricFilter('all');
    setDueDayFilter('');
    setTaskFilter(e);
    setStatusFilter(t);
    setAssigneeFilter('all');
    setProjectFilter('all');
    setSearchQuery('');
    setFiltersOpen(t !== 'all');
  }
  function navigate(e) {
    setMetricFilter('all');
    setDueDayFilter('');
    setBulkMode(false);
    setBulkSelection([]);
    setPage(e);
    setSearchQuery('');
    setTaskFilter('all');
    setStatusFilter('all');
    setAssigneeFilter('all');
    setProjectFilter('all');
    setFiltersOpen(false);
    setMoreToolsOpen(false);
    setError('');
  }
  useEffect(() => {
    (async () => {
      try {
        let e = new URLSearchParams(window.location.search);
        let nextWorkspace = await fetchWorkspace('');
        applySnapshot(nextWorkspace, '');
        let n = e.get('workspace') || nextWorkspace.workspaces[0]?.id;
        if (n) {
          let workspaceResult = await fetchWorkspace(n);
          applySnapshot(workspaceResult, n);
          let r = e.get('task');
          if (r && !deepLinkHandled.current) {
            deepLinkHandled.current = true;
            if (workspaceResult.state.tasks.some((task) => task.id === r)) {
              setOpenTaskId(r);
              loadTaskDetails(r, n);
            } else {
              setError('Bu çalışma alanında bağlantıdaki iş bulunamadı.');
            }
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if ((setLoadedViewKey(''), !workspaceId || !user)) {
      return;
    }
    let e =
      'pusula-board-v3:' +
      workspaceId +
      ':' +
      user +
      ':' +
      (page === 'mine' ? 'mine' : 'team') +
      ':' +
      teamScope;
    try {
      let t = JSON.parse(localStorage.getItem(e) || 'null');
      setFocusSettings(
        t &&
          [
            'all',
            'open',
            'today',
            'late',
            'blocked',
            'unassigned',
            'undated',
            'review',
            'rescheduled',
          ].includes(t.focus) &&
          ['priority', 'due', 'created', 'title'].includes(t.sort) &&
          [0, 7, 30].includes(t.closedDays) &&
          typeof t.person == 'string'
          ? t
          : DEFAULT_FOCUS_SETTINGS,
      );
    } catch {
      setFocusSettings(DEFAULT_FOCUS_SETTINGS);
    }
    setLoadedViewKey(e);
  }, [workspaceId, user, page === 'mine', teamScope]);
  useEffect(() => {
    let e =
      'pusula-board-v3:' +
      workspaceId +
      ':' +
      user +
      ':' +
      (page === 'mine' ? 'mine' : 'team') +
      ':' +
      teamScope;
    if (!(loadedViewKey !== e || !workspaceId || !user)) {
      try {
        localStorage.setItem(e, JSON.stringify(focusSettings));
      } catch {}
    }
  }, [focusSettings, loadedViewKey, workspaceId, user, page === 'mine', teamScope]);
  useEffect(() => {
    if (demo || !workspaceId) {
      return;
    }
    let t = false;
    let n = false;
    let r = async () => {
      if (document.visibilityState !== 'visible' || n || syncGuard.current.space !== workspaceId) {
        return;
      }
      n = true;
      let space = syncGuard.current;
      try {
        let nextWorkspace = await fetchWorkspace(workspaceId);
        if (t || syncGuard.current.space !== workspaceId || syncGuard.current.revision !== space.revision) {
          return;
        }
        setOffline(false);
        if (syncGuard.current.protected) {
          if (nextWorkspace.revision !== syncGuard.current.revision) {
            setRemoteChanged(true);
          }
        } else {
          applySnapshot(nextWorkspace, workspaceId);
        }
      } catch {
        if (!t) {
          setOffline(true);
        }
      } finally {
        n = false;
      }
    };
    let i = setInterval(r, 2e4);
    window.addEventListener('focus', r);
    return () => {
      t = true;
      clearInterval(i);
      window.removeEventListener('focus', r);
    };
  }, [workspaceId, demo]);
  useEffect(() => {
    let e = (e) => {
      if (busy || modal || conflict || commentDraft.trim()) {
        return;
      }
      let t = e.target?.closest('input,textarea,select,[contenteditable=true]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openModal('search');
      } else if (e.altKey && e.key.toLowerCase() === 'n' && canWrite && !t) {
        e.preventDefault();
        let t = document.querySelector('[aria-label="Hızlı iş adı"]');
        if (t) {
          t.focus();
        } else {
          openModal('task');
        }
      } else if (e.key === '/' && !t) {
        let t = document.querySelector('[aria-label="Panoda iş ara"],[aria-label="İşlerde ara"]');
        if (t) {
          e.preventDefault();
          t.focus();
        }
      }
    };
    window.addEventListener('keydown', e);
    return () => window.removeEventListener('keydown', e);
  }, [busy, modal, conflict, commentDraft, canWrite, workspaceId, user, page]);
  useEffect(() => {
    let e = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(e);
  }, []);
  useEffect(() => {
    if (toast) {
      let e = setTimeout(() => setToast(''), 4e3);
      return () => clearTimeout(e);
    }
  }, [toast]);
  useEffect(() => {
    if (!(modal || openTaskId)) {
      return;
    }
    let e = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let t = (event) => {
      if (event.key === 'Escape' && !busy) {
        if (modal) {
          closeModal();
        } else {
          setOpenTaskId('');
          setError('');
          returnFocusRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', t);
    return () => {
      document.body.style.overflow = e;
      window.removeEventListener('keydown', t);
    };
  }, [modal, openTaskId, busy]);
  function withDueDate(item, t) {
    return {
      ...item,
      dueAt: t,
      date: t ? istanbulDay(Date.parse(t)) : '',
    };
  }
  function isScheduleValid(item, n) {
    return !validateSchedule(
      {
        ...workspace,
        tasks: [...workspace.tasks.filter((task) => task.id !== item.id), withDueDate(item, n)],
      },
      workspace,
    );
  }
  async function changeAssignees(e, n) {
    if (!(busy || !canWrite)) {
      setBusy(true);
      setError('');
      try {
        await saveState({
          ...workspace,
          tasks: workspace.tasks.map((task) =>
            task.id === e.id
              ? {
                  ...task,
                  assignees: n,
                  kind: n.length > 1 ? 'shared' : 'individual',
                }
              : task,
          ),
        });
        await refresh();
        if (openTaskId === e.id) {
          await loadTaskDetails(e.id);
        }
        setToast('Sorumlular kaydedildi');
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }
  }
  async function toggleWatch(e) {
    setBusy(true);
    try {
      await saveState({
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.id === e.id
            ? {
                ...task,
                watchers: task.watchers.includes(user)
                  ? task.watchers.filter((email) => email !== user)
                  : [...task.watchers, user],
              }
            : task,
        ),
      });
      await refresh();
      setToast(e.watchers.includes(user) ? 'Takipten çıktın' : 'İşi takip ediyorsun');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function createQuickTask(e) {
    if (busy || !canWrite) {
      throw Error('Şu anda iş eklenemiyor.');
    }
    setBusy(true);
    setError('');
    try {
      let quickTask = buildQuickTask(
        {
          ...e,
          assignment: e.assignment === 'pool' ? 'none' : e.assignment,
        },
        workspace,
        assignableMembers.map((member) => member.email),
        user,
        dashboardProject === 'all' ? '' : dashboardProject,
        newId(),
        newId,
        Date.now(),
      );
      if (
        ((quickTask.teamId = e.teamId ?? (teamScope === 'all' ? '' : teamScope)),
        (quickTask.workType = e.workType || ''),
        e.assignment === 'all' &&
          (quickTask.assignees = quickTask.teamId
            ? assignableMembers
                .filter((member) =>
                  workspace.teams.some(
                    (team) => team.id === quickTask.teamId && team.members.includes(member.email),
                  ),
                )
                .map((member) => member.email)
            : assignableMembers.map((member) => member.email)),
        (quickTask.kind = quickTask.assignees.length > 1 ? 'shared' : 'individual'),
        e.template)
      ) {
        let template = workspace.templates.find((template) => template.id === e.template);
        if (template) {
          quickTask.relatedTeamIds = template.task.relatedTeamIds.filter(
            (teamId) => teamId !== quickTask.teamId,
          );
        }
      }
      if (e.assignment === 'pool' && !quickTask.teamId) {
        throw Error('Ekip havuzu için ekip seç.');
      }
      await saveState({
        ...workspace,
        tasks: [...workspace.tasks, quickTask],
      });
      await refresh();
      setFocusView(e.assignment === 'pool' ? 'pool' : 'board');
      setToast('İş eklendi; aynı satırdan devam edebilirsin.');
    } finally {
      setBusy(false);
    }
  }
  async function requestStatusChange(e, n) {
    if (n === 'done' && completionIssues(e, workspace).length) {
      openModal('complete', e);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveState({
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.id === e.id
            ? {
                ...task,
                status: n,
              }
            : task,
        ),
      });
      setToast('Durum güncellendi');
      await refresh();
      if (openTaskId === e.id) {
        await loadTaskDetails(e.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function recordTime(e, t, n = {}) {
    setBusy(true);
    setError('');
    try {
      await postAction({
        action: e,
        id: workspaceId,
        task: t.id,
        ...n,
      });
      await refresh();
      setToast('Süre kaydedildi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function submitComment(event) {
    if ((event.preventDefault(), !(!selectedTask || !commentDraft.trim()))) {
      setBusy(true);
      setError('');
      try {
        commentRequestId.current ||= newId();
        await postAction({
          action: 'comment',
          id: workspaceId,
          task: selectedTask.id,
          body: commentDraft,
          requestId: commentRequestId.current,
        });
        setCommentDraft('');
        commentRequestId.current = '';
        await loadTaskDetails(selectedTask.id);
        await refresh();
        setToast('Yorum paylaşıldı');
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }
  }
  async function submitModal(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    let form = new FormData(event.currentTarget);
    let r = (e) => String(form.get(e) || '');
    let { type: i, item: member } = modal;
    try {
      if (i === 'resetDemo') {
        resetDemoData();
        let e = demoGet('');
        applySnapshot(e, '');
        applySnapshot(demoGet(e.workspaces[0].id), e.workspaces[0].id);
        navigate('dashboard');
        setOpenTaskId('');
        setToast('Örnek çalışma alanı yenilendi');
      } else if (i === 'workspace') {
        await refresh(
          (
            await postAction({
              action: 'create',
              name: r('name'),
            })
          ).id,
        );
        setToast('Çalışma alanın hazır');
      } else if (i === 'member') {
        await postAction({
          action: 'member',
          id: workspaceId,
          originalEmail: member.email || '',
          email: r('email'),
          name: r('name'),
          department: r('department'),
          role: member.role === 'owner' ? 'owner' : r('role') || 'editor',
          active: member.role === 'owner' || form.get('active') === 'on',
        });
        await refresh();
        setToast('Ekip üyesi kaydedildi');
      } else if (i === 'group') {
        let e = {
          ...member,
          name: member.name.trim(),
          workTypes: [...new Set(member.workTypes.map((type) => type.trim()).filter(Boolean))],
        };
        await saveState({
          ...workspace,
          teams: workspace.teams.some((team) => team.id === e.id)
            ? workspace.teams.map((team) => (team.id === e.id ? e : team))
            : [...workspace.teams, e],
        });
        await refresh();
        setToast('Ekip tanımı kaydedildi');
      } else if (i === 'waiting') {
        await saveState({
          ...workspace,
          tasks: workspace.tasks.map((task) =>
            task.id === member.id
              ? {
                  ...task,
                  waitingReason: member.waitingReason,
                  waitingNote: member.waitingReason ? member.waitingNote : '',
                }
              : task,
          ),
        });
        await refresh();
        if (openTaskId === member.id) {
          await loadTaskDetails(member.id);
        }
        setToast(member.waitingReason ? 'Bekleme nedeni kaydedildi' : 'Bekleme bilgisi kaldırıldı');
      } else if (i === 'template') {
        await saveState({
          ...workspace,
          templates: [
            ...workspace.templates,
            {
              id: newId(),
              name: r('name'),
              task: member,
            },
          ],
        });
        setToast('Şablon kaydedildi');
      } else if (i === 'workRules') {
        await saveState({
          ...workspace,
          workRules: {
            maxDurationDays: Number(r('maxDurationDays') || 0),
            dueRequired: form.get('dueRequired') === 'on',
          },
        });
        await refresh();
        setToast('Çalışma kuralları kaydedildi');
      } else if (i === 'reschedule') {
        let foundTask = workspace.tasks.find((task) => task.id === member.id);
        let n = fromLocalDateTimeInput(r('dueAt'), member.dueAt, member.date);
        await saveState(
          {
            ...workspace,
            tasks: workspace.tasks.map((task) =>
              task.id === foundTask.id
                ? {
                    ...task,
                    dueAt: n,
                    date:
                      r('dueAt') ===
                      toDateTimeInput(
                        foundTask.dueAt || (foundTask.date ? foundTask.date + 'T20:59:59Z' : ''),
                      )
                        ? foundTask.date
                        : r('dueAt').slice(0, 10),
                  }
                : task,
            ),
          },
          r('reason'),
        );
        await refresh();
        if (openTaskId === member.id) {
          await loadTaskDetails(member.id);
        }
        setToast('Termin revizyonu kaydedildi');
      } else if (i === 'bulk') {
        let seen = new Set(member.ids);
        let n = workspace.tasks.map((task) =>
          seen.has(task.id)
            ? member.mode === 'status'
              ? {
                  ...task,
                  status: r('status'),
                }
              : member.mode === 'assignees'
                ? {
                    ...task,
                    assignees: member.assignees,
                    kind: member.assignees.length > 1 ? 'shared' : task.kind,
                  }
                : {
                    ...task,
                    dueAt: fromDateTimeInput(r('dueAt')),
                    date: r('dueAt').slice(0, 10),
                  }
            : task,
        );
        await saveState(
          {
            ...workspace,
            tasks: n,
          },
          r('reason'),
        );
        await refresh();
        setBulkSelection([]);
        setBulkMode(false);
        setToast(seen.size + ' iş güncellendi');
      } else if (i === 'task') {
        let seen = new Set();
        let i = r('checklistText')
          .split('\n')
          .map((e) => e.trim())
          .filter(Boolean)
          .map((t) => {
            let step = member.checklist.find((step) => step.text === t && !seen.has(step.id));
            return step
              ? (seen.add(step.id), step)
              : {
                  id: newId(),
                  text: t,
                  done: false,
                  doneBy: '',
                  doneAt: '',
                };
          });
        let a = {
          ...member,
          checklist: i,
          checklistRequired: form.get('checklistRequired') === 'on',
          estimatedMinutes: Number(r('estimatedMinutes') || 0),
          title: r('title'),
          description: r('description'),
          kind: member.kind,
          assignees: member.assignees,
          watchers: member.watchers,
          plannedStart: fromLocalDateTimeInput(r('plannedStart'), member.plannedStart),
          dueAt: fromLocalDateTimeInput(r('dueAt'), member.dueAt, member.date),
          date:
            r('dueAt') === toDateTimeInput(member.dueAt || (member.date ? member.date + 'T20:59:59Z' : ''))
              ? member.date
              : r('dueAt').slice(0, 10),
          project: r('project'),
          phase: r('phase'),
          priority: r('priority'),
          trackTime: form.get('trackTime') === 'on',
          notifyEmail: form.get('notifyEmail') === 'on',
          criteria: r('criteria'),
          verified: form.get('verified') === 'on',
          requireApproval: form.get('requireApproval') === 'on',
          depends: form.getAll('depends').map(String),
        };
        let s = workspace.tasks.some((task) => task.id === a.id);
        await saveState(
          {
            ...workspace,
            tasks: s ? workspace.tasks.map((task) => (task.id === a.id ? a : task)) : [...workspace.tasks, a],
          },
          r('reason'),
        );
        await refresh();
        if (openTaskId === a.id) {
          loadTaskDetails(a.id);
        }
        setToast(s ? 'İş güncellendi' : 'Yeni iş eklendi');
      } else if (i === 'people') {
        let foundTask = workspace.tasks.find((task) => task.id === member.id);
        await saveState({
          ...workspace,
          tasks: workspace.tasks.map((task) =>
            task.id === member.id
              ? {
                  ...foundTask,
                  assignees: member.assignees,
                  kind: member.assignees.length > 1 ? 'shared' : foundTask.kind,
                }
              : task,
          ),
        });
        await refresh();
        await loadTaskDetails(member.id);
        setToast('Sorumlular güncellendi');
      } else if (i === 'complete') {
        let foundTask = workspace.tasks.find((task) => task.id === member.id);
        await saveState({
          ...workspace,
          tasks: workspace.tasks.map((task) =>
            task.id === member.id
              ? {
                  ...foundTask,
                  status: 'done',
                  checklist: member.checklist,
                  verified: member.verified,
                  waitingReason: member.waitingReason,
                  waitingNote: member.waitingReason ? member.waitingNote : '',
                }
              : task,
          ),
        });
        await refresh();
        if (openTaskId === member.id) {
          await loadTaskDetails(member.id);
        }
        setToast('İş tamamlandı');
      } else if (i === 'time') {
        await postAction({
          action: 'manual_time',
          id: workspaceId,
          task: member.id,
          minutes: Number(r('minutes')),
          note: r('note'),
        });
        await refresh();
        setToast('Süre kaydedildi');
      } else {
        let e = i === 'project' ? 'projects' : i === 'decision' ? 'decisions' : 'blockers';
        let a =
          i === 'project'
            ? {
                id: member.id || newId(),
                name: r('name'),
                goal: r('goal'),
                scope: r('scope'),
                excluded: r('excluded'),
                date: r('date'),
              }
            : i === 'decision'
              ? {
                  id: member.id || newId(),
                  project: r('project'),
                  title: r('title'),
                  reason: r('reason'),
                  impact: r('impact'),
                  date: member.date || todayKey(),
                }
              : {
                  id: member.id || newId(),
                  project: r('project'),
                  task: r('task'),
                  title: r('title'),
                  owner: r('owner'),
                  resolved: form.get('resolved') === 'on',
                };
        let s = workspace[e];
        await saveState({
          ...workspace,
          [e]: s.some((e) => e.id === a.id) ? s.map((e) => (e.id === a.id ? a : e)) : [...s, a],
        });
        await refresh();
        if (i === 'blocker' && openTaskId) {
          await loadTaskDetails(openTaskId);
        }
        setToast('Kaydedildi');
      }
      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function savePreference(e, checked) {
    setBusy(true);
    try {
      await postAction({
        action: 'preferences',
        id: workspaceId,
        mailEnabled: e === 'mailEnabled' ? checked : !!currentMember?.mail_enabled,
        notifySelf: e === 'notifySelf' ? checked : !!currentMember?.notify_self,
      });
      await refresh();
      setToast('Tercihin kaydedildi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function savePolicy(e, checked) {
    setBusy(true);
    try {
      let n = {
        ...notifyPolicy,
        [e]: checked,
      };
      await postAction({
        action: 'policy',
        id: workspaceId,
        policy: n,
      });
      setNotifyPolicy(n);
      setToast('Bildirim kuralı kaydedildi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function exportRecords() {
    let e = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              workspace: workspaces.find((space) => space.id === workspaceId)?.name,
              exportedAt: new Date().toISOString(),
              ...workspace,
            },
            null,
            2,
          ),
        ],
        {
          type: 'application/json',
        },
      ),
    );
    let n = document.createElement('a');
    n.href = e;
    n.download = 'pusula-isler.json';
    n.click();
    setTimeout(() => URL.revokeObjectURL(e), 1e3);
  }
  let scopedTasks = workspace.tasks.filter(
    (task) => inTeamScope(task) && (page !== 'mine' || task.assignees.includes(user)),
  );
  let taskSummary = {
    open: scopedTasks.filter(isOpen).length,
    today: scopedTasks.filter(isDueToday).length,
    late: scopedTasks.filter(isLate).length,
    done: scopedTasks.filter((task) => task.status === 'done').length,
    all: scopedTasks.length,
  };
  let listedTasks = scopedTasks
    .filter(
      (task) =>
        (metricFilter === 'all' ||
          (metricFilter === 'periodDone'
            ? dashboardStats.completed
            : dashboardStats[metricFilter] || []
          ).some((t) => t.id === task.id)) &&
        (!dueDayFilter ||
          (dueTime(task) !== null &&
            toDateTimeInput(new Date(dueTime(task)).toISOString()).slice(0, 10) === dueDayFilter)) &&
        (taskFilter === 'all' ||
          (taskFilter === 'open' && isOpen(task)) ||
          (taskFilter === 'today' && isDueToday(task)) ||
          (taskFilter === 'late' && isLate(task)) ||
          (taskFilter === 'done' && task.status === 'done')) &&
        (statusFilter === 'all' || task.status === statusFilter) &&
        (assigneeFilter === 'all' || task.assignees.includes(assigneeFilter)) &&
        (projectFilter === 'all' || task.project === projectFilter) &&
        [task.title, task.description, task.phase, ...task.assignees.map(memberName)]
          .join(' ')
          .toLocaleLowerCase('tr')
          .includes(searchQuery.toLocaleLowerCase('tr')),
    )
    .sort(
      (a, b) => Number(isLate(b)) - Number(isLate(a)) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999'),
    );
  let filtersActive =
    statusFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    projectFilter !== 'all' ||
    metricFilter !== 'all' ||
    !!dueDayFilter;
  let focusPool = workspace.tasks.filter(
    (task) =>
      inTeamScope(task) &&
      (page !== 'mine' || task.assignees.includes(user)) &&
      (dashboardProject === 'all' || task.project === dashboardProject),
  );
  let focusTasks = filterFocusTasks(focusPool, workspace, focusSettings, now, todayKey()).filter((task) =>
    [task.title, task.description, ...task.assignees.map(memberName)]
      .join(' ')
      .toLocaleLowerCase('tr')
      .includes(searchQuery.toLocaleLowerCase('tr')),
  );
  let focusFilters = [
    ['all', 'Tümü'],
    ['open', 'Açık'],
    ['today', 'Bugün'],
    ['late', 'Geciken'],
    ['blocked', 'Engelli'],
    ['unassigned', 'Sahipsiz'],
    ['review', 'Doğrulama'],
    ['rescheduled', 'Termin değişen'],
  ].map(([e, n]) => [
    e,
    n,
    filterFocusTasks(
      focusPool,
      workspace,
      {
        ...focusSettings,
        focus: e,
      },
      now,
      todayKey(),
    ).length,
  ]);
  let focusItems = (
    focusView === 'pool'
      ? poolTasks(workspace, user, role, teamScope)
      : focusView === 'shared'
        ? focusPool.filter((e) => e.relatedTeamIds.length && isOpen(e))
        : focusView === 'following'
          ? workspace.tasks.filter(
              (task) => inTeamScope(task) && task.watchers.includes(user) && isOpen(task),
            )
          : focusPool.filter(
              (task) => isOpen(task) && (isDueToday(task) || isLate(task) || task.status === 'doing'),
            )
  ).sort(
    (a, b) => Number(isLate(b)) - Number(isLate(a)) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999'),
  );
  let inputField = (e, t, n = 'text', title = '', dueRequired = false) => (
    <label className="form-label">
      {e}
      <input
        name={t}
        type={n}
        defaultValue={title}
        required={dueRequired}
        maxLength={n === 'text' ? 4e3 : undefined}
      />
    </label>
  );
  let textareaField = (e, t, description = '', r = false) => (
    <label className="form-label">
      {e}
      <textarea name={t} defaultValue={description} rows={3} required={r} maxLength={4e3} />
    </label>
  );
  let statusSelect = (task, t = false) => (
    <label className={'status-select ' + task.status + (t ? ' compact' : '')}>
      <span className="status-dot" />
      <select
        aria-label={task.title + ' durumu'}
        value={task.status}
        disabled={!canWrite || busy}
        onChange={(event) => requestStatusChange(task, event.target.value)}
      >
        {Object.entries(TASK_STATUS_LABELS).map(([key, value]) => (
          <option value={key} key={key}>
            {value}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={13} />
    </label>
  );
  let avatarStack = (assignees) => (
    <span className="avatar-stack">
      {assignees.slice(0, 3).map((email) => (
        <Avatar name={memberName(email)} size="small" key={email} />
      ))}
      {assignees.length > 3 && <span className="extra-avatar">+{assignees.length - 3}</span>}
    </span>
  );
  return authRequired ? (
    <main className="auth-page">
      <span className="brand-mark">
        <CompassIcon size={32} />
      </span>
      <h1>
        İşler bir arada.
        <br />
        Ekibin aynı sayfada.
      </h1>
      <p>Pusula’ya giriş yap ve kaldığın yerden devam et.</p>
      <a className="button primary large" href="/auth/login?return_to=%2F" target="_top">
        {'Şirket hesabınla giriş yap '}
        <ArrowUpRightIcon size={17} />
      </a>
    </main>
  ) : (
    <div className="shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(event) => {
            if (demo) {
              event.preventDefault();
              navigate('dashboard');
            }
          }}
        >
          <span className="brand-mark">
            <CompassIcon size={24} />
          </span>
          pusula<span>.</span>
        </a>
        <div className="workspace-box">
          <span>ÇALIŞMA ALANI</span>
          <select
            aria-label="Çalışma alanı"
            value={workspaceId}
            onChange={(event) => {
              setOpenTaskId('');
              navigate('tasks');
              refresh(event.target.value);
            }}
          >
            {workspaces.length ? (
              workspaces.map((space) => (
                <option value={space.id} key={space.id}>
                  {space.name}
                </option>
              ))
            ) : (
              <option value="">Ekibini oluştur</option>
            )}
          </select>
        </div>
        <button className="new-workspace" onClick={() => openModal('workspace')}>
          <PlusIcon size={13} />
          {' Çalışma alanı ekle'}
        </button>
        <nav>
          {NAV_ITEMS.map(([e, n, CR]) => (
            <button className={page === e ? 'active' : ''} onClick={() => navigate(e)} key={e}>
              <CR size={18} />
              <span>{n}</span>
              {e === 'mine' && (
                <b>
                  {workspace.tasks.filter((task) => task.assignees.includes(user) && isOpen(task)).length}
                </b>
              )}
              {e === 'notifications' && unreadCount > 0 && <b className="nav-unread">{unreadCount}</b>}
            </button>
          ))}
        </nav>
        <button
          className="more-nav"
          onClick={() => setMoreToolsOpen(!moreToolsOpen)}
          aria-expanded={moreToolsOpen}
        >
          {'Diğer araçlar '}
          <ChevronDownIcon size={13} />
        </button>
        {moreToolsOpen && (
          <div className="secondary-nav">
            {[
              ['projects', 'Projeler', LayersIcon],
              ['decisions', 'Kararlar', GitBranchIcon],
              ['blockers', 'Engeller', FlagIcon],
            ].map(([e, t, CN]) => (
              <button className={page === e ? 'active' : ''} onClick={() => navigate(e)} key={e}>
                <CN size={16} />
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-live" />
            {' Ekibinin ortak çalışma alanı'}
            <p>Bir iş. Doğru kişiler. Net ilerleme.</p>
          </div>
          <button
            className={'settings-link ' + (page === 'settings' ? 'active' : '')}
            onClick={() => navigate('settings')}
          >
            <Settings2Icon size={17} />
            {' Ayarlar'}
          </button>
          <div className="account">
            <Avatar name={memberName(user) || 'P'} />
            <span>
              <strong>{memberName(user) || 'Pusula'}</strong>
              <small>{ROLE_LABELS[role]}</small>
            </span>
            {!demo && (
              <a className="account-logout" href="/auth/logout" title="Oturumu kapat" aria-label="Oturumu kapat">
                <LogOutIcon size={16} />
              </a>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        {demo && (
          <section className="design-banner">
            <div>
              <ShieldCheckIcon size={18} />
              <span>
                <strong>Tasarım demosu</strong>
                <small>Örnek veriler · Gerçek şirket verisi girmeyin · Ortak canlı kullanım değildir</small>
              </span>
            </div>
            <div>
              <label>
                Denediğin rol
                <select
                  aria-label="Örnek kullanıcı / rol"
                  disabled={busy}
                  value={user || DEMO_USERS[0].email}
                  onChange={(event) => switchDemoUser(event.target.value)}
                >
                  {DEMO_USERS.map((member) => (
                    <option value={member.email} key={member.email}>
                      {member.name}
                      {' · '}
                      {ROLE_LABELS[member.role]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button"
                aria-label="Örnek verileri sıfırla"
                disabled={busy}
                onClick={() => openModal('resetDemo')}
              >
                <RotateCcwIcon size={16} />
              </button>
            </div>
          </section>
        )}
        <header className="topbar">
          <div className="topbar-path">
            <span>Çalışma alanı</span>
            <ChevronRightIcon size={14} />
            <strong>
              {NAV_ITEMS.find((e) => e[0] === page)?.[1] ||
                {
                  settings: 'Ayarlar',
                  projects: 'Projeler',
                  decisions: 'Kararlar',
                  blockers: 'Engeller',
                }[page]}
            </strong>
          </div>
          <div className="mobile-brand">
            <CompassIcon size={24} />
            <select
              aria-label="Mobil çalışma alanı"
              value={workspaceId}
              onChange={(event) => {
                setOpenTaskId('');
                setModal(null);
                navigate('dashboard');
                refresh(event.target.value);
              }}
            >
              {workspaces.length ? (
                workspaces.map((space) => (
                  <option value={space.id} key={space.id}>
                    {space.name}
                  </option>
                ))
              ) : (
                <option value="">Pusula</option>
              )}
            </select>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button global-search-trigger"
              aria-label="Genel aramayı aç"
              title="İş ve proje ara · Ctrl / ⌘ K"
              onClick={() => openModal('search')}
            >
              <SearchIcon size={18} />
            </button>
            <button
              className="icon-button help-trigger"
              aria-label="Kullanım rehberini aç"
              onClick={() => openModal('guide')}
            >
              <CircleQuestionMarkIcon size={18} />
            </button>
            <span
              className={'sync-indicator ' + (offline ? 'offline' : '')}
              title={lastSync ? 'Son kontrol: ' + formatDateTime(new Date(lastSync).toISOString()) : ''}
            >
              {demo ? 'Yerel demo' : offline ? 'Bağlantı bekleniyor' : '20 sn’de güncellenir'}
            </span>
            <span className="today-label">
              {new Date().toLocaleDateString('tr-TR', {
                timeZone: 'Europe/Istanbul',
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <button
              className={'icon-button ' + (refreshing ? 'spinning' : '')}
              aria-label="İşleri yenile"
              disabled={refreshing || busy || !!modal || !!commentDraft}
              onClick={() => refresh()}
            >
              <RefreshCwIcon size={17} />
            </button>
            <button
              className="icon-button mobile-settings"
              aria-label="Diğer araçlar ve ayarlar"
              onClick={() => setMoreToolsOpen(!moreToolsOpen)}
            >
              <EllipsisIcon size={21} />
            </button>
            <button
              className="icon-button bell-button"
              aria-label="Bildirimleri aç"
              onClick={() => navigate('notifications')}
            >
              <BellIcon size={19} />
              {unreadCount > 0 && <i />}
            </button>
          </div>
        </header>
        {moreToolsOpen && (
          <div className="mobile-more">
            {[
              ['projects', 'Projeler'],
              ['decisions', 'Kararlar'],
              ['blockers', 'Engeller'],
              ['settings', 'Ayarlar'],
            ].map(([e, t]) => (
              <button onClick={() => navigate(e)} key={e}>
                {t}
                <ChevronRightIcon size={14} />
              </button>
            ))}
            <button
              onClick={() => {
                setMoreToolsOpen(false);
                openModal('workspace');
              }}
            >
              {'Çalışma alanı ekle '}
              <PlusIcon size={14} />
            </button>
          </div>
        )}
        <main className={'content ' + (page === 'mine' && focusView !== 'board' ? 'personal-focus' : '')}>
          {remoteChanged && (
            <div className="sync-notice" role="status">
              <RefreshCwIcon size={17} />
              <span>
                {'Ekipte yeni değişiklik var. '}
                {syncGuard.current.protected
                  ? 'Açık düzenlemen korunuyor; bağımsız alanlar kayıtta birleştirilir.'
                  : 'Güncel kayıtları alabilirsin.'}
              </span>
              <button
                className="button small-button"
                disabled={syncGuard.current.protected}
                onClick={() => refresh()}
              >
                Güncellemeleri al
              </button>
            </div>
          )}
          {error && !modal && !selectedTask && (
            <div className="error-banner" role="alert">
              {error}
              <button className="icon-button" aria-label="Uyarıyı kapat" onClick={() => setError('')}>
                <XIcon size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-screen">
              <LoaderCircleIcon className="spin" size={25} />
              {' Çalışma alanın hazırlanıyor…'}
            </div>
          ) : workspaceId ? (
            <>
              {['mine', 'dashboard', 'tasks'].includes(page) && (
                <section className="team-context">
                  <div>
                    <label>
                      <UsersIcon size={15} />
                      {' Ekip kapsamı'}
                      <select
                        aria-label="Ekip kapsamı"
                        value={teamScope}
                        disabled={busy}
                        onChange={(event) => {
                          setTeamScope(event.target.value);
                          setBulkSelection([]);
                          setFocusSettings(DEFAULT_FOCUS_SETTINGS);
                          setSearchQuery('');
                        }}
                      >
                        <option value="all">
                          {page === 'mine' ? 'Tüm ekiplerim' : 'Erişebildiğim tüm ekipler'}
                        </option>
                        {visibleTeams.map((team) => (
                          <option value={team.id} key={team.id}>
                            {team.name}
                            {team.active ? '' : ' · Pasif'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <small>
                      {page === 'mine'
                        ? 'Sana atanan bireysel ve ortak işler tek yerde.'
                        : 'Yetkili olduğun işler gösterilir; ortak kayıt toplamda bir kez sayılır.'}
                    </small>
                  </div>
                  {page !== 'tasks' && (
                    <div className="queue-tabs" aria-label="İş görünümü">
                      {[
                        ['today', 'Bugün'],
                        ['board', 'Statü panosu'],
                        ['pool', 'Ekip havuzu'],
                        ['shared', 'Ortak işler'],
                        ['following', 'Takip ettiklerim'],
                        ['week', '7 günlük plan'],
                      ].map(([e, n]) => (
                        <button
                          className={focusView === e ? 'active' : ''}
                          aria-pressed={focusView === e}
                          onClick={() => {
                            if (e === 'pool' && page === 'mine') {
                              navigate('dashboard');
                            }
                            setFocusView(e);
                            setSearchQuery('');
                          }}
                          key={e}
                        >
                          {n}
                          {e === 'pool' && <b>{poolTasks(workspace, user, role, teamScope).length}</b>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {(page === 'dashboard' || page === 'mine') && (
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
                              page === 'dashboard' && focusSettings.person !== 'all'
                                ? focusSettings.person
                                : 'me',
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
                              Üstteki özet tüm kapsamı gösterir. Aşağıdaki filtreler yalnızca iş panosuna
                              uygulanır.
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
                              Bu seçimde iş bulunamadı. Diğer statülerdeki işleri görmek için filtreleri
                              sıfırla.
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
              )}
              {page === 'tasks' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {workspaces.find((space) => space.id === workspaceId)?.name}
                      </span>
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
                    <button
                      onClick={() => showFilteredTasks('late')}
                      className={taskFilter === 'late' ? 'selected' : ''}
                    >
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
                          <button
                            className={taskFilter === e ? 'active' : ''}
                            onClick={() => setTaskFilter(e)}
                            key={e}
                          >
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
                          <button
                            className={taskView === 'board' ? 'active' : ''}
                            onClick={() => setTaskView('board')}
                          >
                            Pano
                          </button>
                          <button
                            className={taskView === 'list' ? 'active' : ''}
                            onClick={() => setTaskView('list')}
                          >
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
                          className={
                            'icon-button filter-toggle ' + (filtersOpen || filtersActive ? 'selected' : '')
                          }
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
                              listedTasks.length > 0 &&
                              listedTasks.every((task) => bulkSelection.includes(task.id))
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
                            <article
                              className={'task-row ' + (task.status === 'done' ? 'completed' : '')}
                              key={task.id}
                            >
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
                                          {task.checklist.filter((step) => step.done).length}/
                                          {task.checklist.length}
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
                                onClick={() =>
                                  canWrite ? openModal('reschedule', task) : openTaskDetails(task.id)
                                }
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
                                      ? 'Başlangıç ' +
                                        formatDate(toDateTimeInput(task.plannedStart).slice(0, 10))
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
                          {taskFilter === 'done' ? (
                            <CheckCheckIcon size={30} />
                          ) : (
                            <BriefcaseBusinessIcon size={30} />
                          )}
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
              )}
              {page === 'team' && (
                <>
                  <TeamHub
                    user={user}
                    state={workspace}
                    members={members}
                    admin={role === 'owner'}
                    onEdit={(e) =>
                      openModal(
                        'group',
                        e || {
                          id: newId(),
                          name: '',
                          members: [],
                          leads: [],
                          active: true,
                          workTypes: [],
                        },
                      )
                    }
                    onOpen={(e) => {
                      navigate('dashboard');
                      setTeamScope(e);
                      setFocusView('board');
                    }}
                  />
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">BİRLİKTE ÇALIŞTIĞIN KİŞİLER</span>
                      <h1>Kişi rehberi.</h1>
                      <p>İşleri isimlerine göre ata. Kimin üzerinde ne var, kolayca gör.</p>
                    </div>
                    {role === 'owner' && (
                      <button className="button primary" onClick={() => openModal('member')}>
                        <PlusIcon size={18} />
                        {' Üye ekle'}
                      </button>
                    )}
                  </div>
                  <div className="team-topline">
                    <span>
                      <strong>{activeMembers.length}</strong>
                      {' aktif ekip üyesi'}
                    </span>
                    <label className="search-box">
                      <SearchIcon size={16} />
                      <input
                        aria-label="Ekipte ara"
                        placeholder="İsim veya bölüm ara"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="team-grid">
                    {members
                      .filter((member) =>
                        [member.name, member.email, member.department]
                          .join(' ')
                          .toLocaleLowerCase('tr')
                          .includes(searchQuery.toLocaleLowerCase('tr')),
                      )
                      .map((member) => {
                        let n = workspace.tasks.filter(
                          (task) => task.assignees.includes(member.email) && isOpen(task),
                        ).length;
                        return (
                          <article
                            className={'member-card ' + (member.active ? '' : 'inactive')}
                            key={member.email}
                          >
                            <div className="member-card-head">
                              <Avatar name={memberName(member.email)} size="large" />
                              {role === 'owner' && (
                                <button
                                  className="icon-button"
                                  aria-label={memberName(member.email) + ' bilgilerini düzenle'}
                                  onClick={() => openModal('member', member)}
                                >
                                  <PencilIcon size={15} />
                                </button>
                              )}
                            </div>
                            <h2>
                              {memberName(member.email)}
                              {member.email === user && <span>Sen</span>}
                            </h2>
                            <p>{member.department || 'Bölüm belirtilmedi'}</p>
                            <small>{member.email}</small>
                            <div className="member-card-bottom">
                              <span className="role-badge">
                                {member.active ? ROLE_LABELS[member.role] : 'Pasif'}
                              </span>
                              <button
                                className="text-button"
                                onClick={() => {
                                  navigate('tasks');
                                  setAssigneeFilter(member.email);
                                  setFiltersOpen(true);
                                }}
                              >
                                {n}
                                {' açık iş '}
                                <ArrowUpRightIcon size={13} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    {role === 'owner' && (
                      <button className="add-member-card" onClick={() => openModal('member')}>
                        <span>
                          <PlusIcon size={25} />
                        </span>
                        <strong>Ekibine birini ekle</strong>
                        <small>Ad, e-posta ve bölüm yeterli.</small>
                      </button>
                    )}
                  </div>
                  <p className="footnote">
                    <EyeIcon size={14} />
                    {
                      ' Üye tanımı iş atamasını sağlar. Bu özel yayına giriş için site paylaşım erişimi de verilmelidir.'
                    }
                  </p>
                </>
              )}
              {page === 'notifications' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">EKİBİNDEN HABERLER</span>
                      <h1>Gözünden kaçmasın.</h1>
                      <p>Atamalar, yorumlar ve durum değişiklikleri.</p>
                    </div>
                    <button className="button" onClick={() => navigate('settings')}>
                      <Settings2Icon size={16} />
                      {' Bildirim ayarları'}
                    </button>
                  </div>
                  <section className="work-surface">
                    <div className="surface-toolbar">
                      <div className="work-tabs">
                        <button
                          className={notificationScope === 'mine' ? 'active' : ''}
                          onClick={() => setNotificationScope('mine')}
                        >
                          {'Bana gelenler '}
                          <b>{myNotifications.length}</b>
                        </button>
                        {role === 'owner' && (
                          <button
                            className={notificationScope === 'all' ? 'active' : ''}
                            onClick={() => setNotificationScope('all')}
                          >
                            Ekipteki tüm bildirimler
                          </button>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <span className="muted small">
                          {unreadCount}
                          {' okunmamış'}
                        </span>
                      )}
                    </div>
                    <div className="notice-view-toggle">
                      <button
                        className="text-button"
                        onClick={() => setGroupNotifications(!groupNotifications)}
                      >
                        {groupNotifications ? 'Tek tek olayları göster' : 'İşe göre birleştir'}
                      </button>
                    </div>
                    {groupNotifications ? (
                      <NotificationGroups
                        items={notificationScope === 'all' ? notifications : myNotifications}
                        name={memberName}
                        onOpen={openTaskDetails}
                        onRead={async (e) => {
                          try {
                            for (let t of e.filter((e) =>
                              myNotifications.some(
                                (notification) => notification.id === e && !notification.read_at,
                              ),
                            ))
                              await postAction({
                                action: 'read',
                                id: workspaceId,
                                notification: t,
                              });
                            await refresh();
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      />
                    ) : (notificationScope === 'all' ? notifications : myNotifications).length ? (
                      (notificationScope === 'all' ? notifications : myNotifications).map((notification) => (
                        <button
                          className={
                            'notification-row ' +
                            (!notification.read_at && notification.recipient === user ? 'unread' : '')
                          }
                          onClick={async () => {
                            if (notification.recipient === user) {
                              await postAction({
                                action: 'read',
                                id: workspaceId,
                                notification: notification.id,
                              });
                              refresh();
                            }
                            openTaskDetails(notification.task);
                          }}
                          key={notification.id}
                        >
                          <span className={'notice-symbol ' + notification.kind}>
                            {notification.kind === 'comment' ? (
                              <MessageSquareIcon size={18} />
                            ) : notification.kind === 'completed' ? (
                              <CheckCheckIcon size={18} />
                            ) : notification.kind === 'assigned' ? (
                              <UserRoundIcon size={18} />
                            ) : (
                              <RefreshCwIcon size={17} />
                            )}
                          </span>
                          <span>
                            <strong>{notification.title}</strong>
                            <small>
                              {notificationScope === 'all' ? memberName(notification.recipient) + ' · ' : ''}
                              {new Date(notification.created).toLocaleString('tr-TR', {
                                timeZone: 'Europe/Istanbul',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </small>
                            <small className="mail-state">
                              {
                                {
                                  no_config: 'E-posta bağlantısı bekliyor',
                                  queued: 'E-posta sırada',
                                  sending: 'E-posta gönderiliyor',
                                  accepted: 'E-posta sağlayıcısı kabul etti',
                                  failed: 'E-posta gönderilemedi',
                                  disabled: 'Bu olayın e-postası kapalı',
                                  muted: 'E-posta tercihi kapalı',
                                  self: 'Kendi işlemimin e-postası kapalı',
                                  cancelled: 'E-posta iptal edildi',
                                  unknown: 'Gönderim kontrol edilmeli',
                                }[notification.mail]
                              }
                            </small>
                          </span>
                          <ChevronRightIcon size={17} />
                        </button>
                      ))
                    ) : (
                      <div className="empty-state">
                        <span className="empty-icon">
                          <BellIcon size={28} />
                        </span>
                        <h2>Şimdilik her şey güncel.</h2>
                        <p>Sana iş atandığında ve ilgili işlerde gelişme olduğunda burada göreceksin.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {page === 'settings' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">ÇALIŞMA ALANI</span>
                      <h1>Sana göre çalışsın.</h1>
                      <p>Bildirimleri ve çalışma tercihlerini buradan yönet.</p>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <section className="settings-card">
                      <h2>
                        <CalendarDaysIcon size={19} />
                        {' Termin kuralları'}
                      </h2>
                      <p>
                        {'Termin '}
                        {workspace.workRules.dueRequired ? 'zorunlu' : 'isteğe bağlı'}
                        {'. '}
                        {workspace.workRules.maxDurationDays
                          ? 'Başlangıçtan en fazla ' + workspace.workRules.maxDurationDays + ' takvim günü.'
                          : 'Azami süre sınırı yok.'}
                      </p>
                      {role === 'owner' && (
                        <button className="button" onClick={() => openModal('workRules')}>
                          Kuralları düzenle
                        </button>
                      )}
                      <small>
                        İşleri yönetici ve ekip üyeleri oluşturabilir, herkese veya seçili kişilere
                        atayabilir.
                      </small>
                    </section>
                    <section className="settings-card">
                      <h2>
                        <BellIcon size={19} />
                        {' Bana gelen e-postalar'}
                      </h2>
                      <p>Uygulama içi bildirimlerin her zaman saklanır.</p>
                      <label className="switch-row">
                        <span>
                          İş güncellemelerini e-postayla al
                          <small>Atama, yorum ve durum değişiklikleri.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={!!currentMember?.mail_enabled}
                          disabled={busy}
                          onChange={(event) => savePreference('mailEnabled', event.target.checked)}
                        />
                      </label>
                      <label className="switch-row">
                        <span>
                          Kendi işlemlerimin e-postasını da al
                          <small>Kapalıysa yalnızca başkalarının güncellemeleri.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={!!currentMember?.notify_self}
                          disabled={busy}
                          onChange={(event) => savePreference('notifySelf', event.target.checked)}
                        />
                      </label>
                    </section>
                    <section className="settings-card">
                      <h2>
                        <MailIcon size={19} />
                        {' E-posta bağlantısı'}
                      </h2>
                      <span className={'connection-status ' + (mailConfigured ? 'ready' : '')}>
                        {mailConfigured ? 'Bağlantı yapılandırıldı' : 'Bağlantı henüz kurulmadı'}
                      </span>
                      <p>
                        {mailConfigured
                          ? 'Gönderim durumunu Bildirimler ekranından izleyebilirsin. Sağlayıcı kabulü teslim teyidi değildir.'
                          : 'Şu anda uygulama içi bildirimler çalışıyor. Gerçek e-posta gönderimi için gönderim servisi bağlanmalı.'}
                      </p>
                      {role === 'owner' && mailConfigured && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await postAction({
                                action: 'flush',
                                id: workspaceId,
                              });
                              await refresh();
                              setToast('Bekleyen gönderimler işlendi');
                            } catch (err) {
                              setError(err.message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Bekleyen e-postaları gönder
                        </button>
                      )}
                    </section>
                    <section className="settings-card">
                      <h2>
                        <SlidersHorizontalIcon size={19} />
                        {' Ekibin bildirim kuralları'}
                      </h2>
                      <p>Sorumlular, işi açan kişi, takipçiler ve önceki yorumcular bilgilendirilir.</p>
                      {[
                        ['assigned', 'Yeni iş atandığında'],
                        ['status', 'İşin durumu değiştiğinde'],
                        ['comment', 'Yorum yazıldığında'],
                        ['completed', 'İş tamamlandığında'],
                        ['managers', 'Yöneticiler de bilgilendirilsin'],
                      ].map(([e, t]) => (
                        <label className="switch-row" key={e}>
                          <span>{t}</span>
                          <input
                            type="checkbox"
                            disabled={role !== 'owner' || busy}
                            checked={notifyPolicy[e]}
                            onChange={(event) => savePolicy(e, event.target.checked)}
                          />
                        </label>
                      ))}
                      <small className="muted">Bu kurallar sonraki gelişmelere uygulanır.</small>
                    </section>
                    <section className="settings-card">
                      <h2>
                        <DownloadIcon size={19} />
                        {' Verilerin'}
                      </h2>
                      <p>Çalışma alanındaki işleri ve proje kayıtlarını JSON dosyası olarak indir.</p>
                      <button className="button" onClick={exportRecords}>
                        <DownloadIcon size={16} />
                        {' Kayıtları dışa aktar'}
                      </button>
                      <hr />
                      <h2>
                        <CompassIcon size={19} />
                        {' Çalışma alanları'}
                      </h2>
                      <p>
                        Şirket içindeki ekipleri Ekip ekranından tanımla. Ayrı çalışma alanları birbirinden
                        bağımsızdır; kişisel pano yalnızca seçili alandaki ekipleri birleştirir.
                      </p>
                      <button className="button" onClick={() => openModal('workspace')}>
                        <PlusIcon size={16} />
                        {' Yeni çalışma alanı'}
                      </button>
                    </section>
                  </div>
                </>
              )}
              {['projects', 'decisions', 'blockers'].includes(page) && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">DİĞER ARAÇLAR</span>
                      <h1>
                        {page === 'projects' ? 'Projeler.' : page === 'decisions' ? 'Kararlar.' : 'Engeller.'}
                      </h1>
                      <p>
                        {page === 'projects'
                          ? 'İstersen ilişkili işleri bir proje altında topla.'
                          : page === 'decisions'
                            ? 'Kararları gerekçeleriyle birlikte sakla.'
                            : 'İşi durduran konuları görünür kıl.'}
                      </p>
                    </div>
                    {canWrite && (
                      <button
                        className="button primary"
                        onClick={() =>
                          openModal(
                            page === 'projects' ? 'project' : page === 'decisions' ? 'decision' : 'blocker',
                          )
                        }
                        disabled={page === 'decisions' && !workspace.projects.length}
                      >
                        <PlusIcon size={17} />
                        {page === 'projects'
                          ? 'Proje ekle'
                          : page === 'decisions'
                            ? 'Karar ekle'
                            : 'Engel ekle'}
                      </button>
                    )}
                  </div>
                  {page === 'projects' ? (
                    <ProjectPortfolio
                      state={workspace}
                      now={now}
                      onOpen={(e) => {
                        navigate('dashboard');
                        setDashboardProject(e);
                      }}
                      onEdit={(e) => openModal('project', e)}
                      onTask={(e) =>
                        openModal('task', {
                          project: e,
                        })
                      }
                      writable={canWrite}
                    />
                  ) : (
                    <div className="records-grid">
                      {page === 'decisions'
                        ? workspace.decisions.map((decision) => (
                            <article className="record-card" key={decision.id}>
                              <small>
                                {projectName(decision.project)}
                                {' · '}
                                {formatDate(decision.date)}
                              </small>
                              <h2>{decision.title}</h2>
                              <p>{decision.reason}</p>
                              <p className="muted">
                                {'Etkisi: '}
                                {decision.impact}
                              </p>
                              {canWrite && (
                                <button
                                  className="text-button"
                                  onClick={() => openModal('decision', decision)}
                                >
                                  Düzenle
                                </button>
                              )}
                            </article>
                          ))
                        : workspace.blockers.map((blocker) => (
                            <article className="record-card" key={blocker.id}>
                              <span className={'record-tag ' + (blocker.resolved ? 'resolved' : '')}>
                                {blocker.resolved ? 'Çözüldü' : 'Çözüm bekliyor'}
                              </span>
                              <h2>{blocker.title}</h2>
                              <p>
                                {projectName(blocker.project)}
                                {' · '}
                                {blocker.owner || 'Sorumlu atanmadı'}
                              </p>
                              {blocker.task && (
                                <button className="text-button" onClick={() => openTaskDetails(blocker.task)}>
                                  {'Bağlı işi aç '}
                                  <ArrowUpRightIcon size={13} />
                                </button>
                              )}
                              {canWrite && (
                                <button className="text-button" onClick={() => openModal('blocker', blocker)}>
                                  Düzenle
                                </button>
                              )}
                            </article>
                          ))}
                    </div>
                  )}
                  {(page === 'projects'
                    ? workspace.projects
                    : page === 'decisions'
                      ? workspace.decisions
                      : workspace.blockers
                  ).length === 0 && (
                    <div className="empty-state light">
                      <span className="empty-icon">
                        <LayersIcon size={28} />
                      </span>
                      <h2>Henüz kayıt yok.</h2>
                      <p>Gerektiğinde bu alandan yeni bir kayıt ekleyebilirsin.</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <section className="welcome">
              <span className="welcome-symbol">
                <CompassIcon size={48} />
              </span>
              <span className="eyebrow">PUSULA’YA HOŞ GELDİN</span>
              <h1>
                Ekibinin işlerini
                <br />
                bir araya getir.
              </h1>
              <p>Bir çalışma alanı aç, ekibini ekle ve ilk işi paylaş.</p>
              <button className="button primary large" onClick={() => openModal('workspace')}>
                {'Çalışma alanı oluştur '}
                <ArrowUpRightIcon size={17} />
              </button>
              <div className="welcome-steps">
                <span>
                  <b>1</b>
                  {' Ekibini ekle'}
                </span>
                <span>
                  <b>2</b>
                  {' İşi ata'}
                </span>
                <span>
                  <b>3</b>
                  {' Birlikte takip et'}
                </span>
              </div>
            </section>
          )}
        </main>
      </div>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(([e, t, CN]) => (
          <button className={page === e ? 'active' : ''} onClick={() => navigate(e)} key={e}>
            <span>
              <CN size={20} />
              {e === 'notifications' && unreadCount > 0 && <i />}
            </span>
            <small>
              {e === 'dashboard'
                ? 'Ekip panosu'
                : e === 'tasks'
                  ? 'İş listesi'
                  : e === 'mine'
                    ? 'Benim panom'
                    : t}
            </small>
          </button>
        ))}
      </nav>
      {selectedTask && (
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
                      {selectedTask.checklist.filter((step) => step.done).length}/
                      {selectedTask.checklist.length}
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
                          {formatDuration(
                            entry.ended ? entry.seconds : Math.floor((now - entry.started) / 1e3),
                          )}
                          {entry.ended ? '' : ' · çalışıyor'}
                        </span>
                        <small>{entry.note || 'Sayaç kaydı'}</small>
                      </div>
                    ))}
              </details>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              closeModal();
            }
          }}
        >
          <section
            className={'modal ' + (modal.type === 'task' ? 'task-form-modal' : '')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onKeyDown={trapFocus}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">{modal.type === 'task' ? 'İŞİ NETLEŞTİR' : 'PUSULA'}</span>
                <h2 id="modal-title">
                  {modal.type === 'task'
                    ? workspace.tasks.some((task) => task.id === modal.item.id)
                      ? 'İşi düzenle'
                      : 'Yeni iş oluştur'
                    : modal.type === 'member'
                      ? modal.item.email
                        ? 'Ekip üyesini düzenle'
                        : 'Ekibine birini ekle'
                      : modal.type === 'group'
                        ? 'Ekip tanımı'
                        : modal.type === 'waiting'
                          ? 'Bekleme nedeni'
                          : modal.type === 'search'
                            ? 'Bul ve devam et'
                            : modal.type === 'complete'
                              ? 'İşi tamamla'
                              : modal.type === 'guide'
                                ? 'Pusula nasıl kullanılır?'
                                : modal.type === 'resetDemo'
                                  ? 'Örnekleri başa al'
                                  : modal.type === 'templates'
                                    ? 'İş şablonları'
                                    : modal.type === 'template'
                                      ? 'Şablon olarak kaydet'
                                      : modal.type === 'workRules'
                                        ? 'Termin kuralları'
                                        : modal.type === 'reschedule'
                                          ? 'Termini revize et'
                                          : modal.type === 'bulk'
                                            ? 'Seçilen işleri güncelle'
                                            : modal.type === 'workspace'
                                              ? 'Çalışma alanı oluştur'
                                              : modal.type === 'people'
                                                ? 'Kimler yapacak?'
                                                : modal.type === 'time'
                                                  ? 'Harcanan süreyi ekle'
                                                  : modal.type === 'project'
                                                    ? 'Proje çerçevesi'
                                                    : modal.type === 'decision'
                                                      ? 'Karar kaydı'
                                                      : 'Engel kaydı'}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Formu kapat"
                autoFocus={modal.type !== 'task'}
                disabled={busy}
                onClick={closeModal}
              >
                <XIcon size={20} />
              </button>
            </header>
            <form
              onSubmit={(e) => {
                if (modal.type === 'search') {
                  e.preventDefault();
                  return;
                }
                submitModal(e);
              }}
            >
              <fieldset disabled={busy}>
                {remoteChanged && (
                  <p className="form-sync-note">
                    Ekipte yeni değişiklik var. Formun korunuyor; kaydederken güncel değerlerle
                    karşılaştırılacak.
                  </p>
                )}
                {modal.type === 'group' && (
                  <TeamEditor
                    team={modal.item}
                    members={members}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        item: e,
                      })
                    }
                  />
                )}
                {modal.type === 'waiting' && (
                  <>
                    <p className="form-intro">
                      {modal.item.title}
                      {' · Ana statü değişmez; bekleme bilgisi ayrıca izlenir.'}
                    </p>
                    <label className="form-label">
                      Neden
                      <select
                        aria-label="Bekleme nedeni"
                        value={modal.item.waitingReason}
                        onChange={(event) =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              waitingReason: event.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Beklemiyor / bekleme bitti</option>
                        {Object.entries(WAITING_REASON_LABELS).map(([key, value]) => (
                          <option value={key} key={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    {modal.item.waitingReason && (
                      <label className="form-label">
                        Kısa açıklama
                        <textarea
                          required={true}
                          maxLength={1e3}
                          value={modal.item.waitingNote}
                          onChange={(event) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                waitingNote: event.target.value,
                              },
                            })
                          }
                          placeholder="Kimden ne bekleniyor?"
                        />
                      </label>
                    )}
                  </>
                )}
                {modal.type === 'search' && (
                  <GlobalSearch
                    state={workspace}
                    name={memberName}
                    writable={canWrite}
                    onTask={(e) => {
                      closeModal();
                      openTaskDetails(e);
                    }}
                    onProject={(e) => {
                      closeModal();
                      setOpenTaskId('');
                      navigate('dashboard');
                      setDashboardProject(e);
                    }}
                    onNavigate={(e) => {
                      closeModal();
                      setOpenTaskId('');
                      navigate(e);
                    }}
                    onNew={() => openModal('task')}
                  />
                )}
                {modal.type === 'complete' && (
                  <div className="complete-review">
                    <p className="form-intro">{modal.item.title}</p>
                    {taskObstacles(modal.item, workspace).length > 0 && (
                      <div className="completion-blockers">
                        <strong>Önce çözülmesi gerekenler</strong>
                        {taskObstacles(modal.item, workspace).map((e, t) => (
                          <p key={t}>{e}</p>
                        ))}
                      </div>
                    )}
                    {modal.item.checklist.length > 0 && (
                      <section>
                        <h3>
                          {'Kontrol adımları '}
                          {modal.item.checklistRequired ? '(zorunlu)' : '(isteğe bağlı)'}
                        </h3>
                        {modal.item.checklist.map((step) => (
                          <label className="check-label" key={step.id}>
                            <input
                              type="checkbox"
                              checked={step.done}
                              onChange={(event) =>
                                setModal({
                                  ...modal,
                                  item: {
                                    ...modal.item,
                                    checklist: modal.item.checklist.map((n) =>
                                      n.id === step.id
                                        ? {
                                            ...n,
                                            done: event.target.checked,
                                          }
                                        : n,
                                    ),
                                  },
                                })
                              }
                            />
                            {step.text}
                          </label>
                        ))}
                      </section>
                    )}
                    {modal.item.waitingReason && (
                      <label className="check-label">
                        <input
                          type="checkbox"
                          onChange={(event) => {
                            if (event.target.checked) {
                              setModal({
                                ...modal,
                                item: {
                                  ...modal.item,
                                  waitingReason: '',
                                  waitingNote: '',
                                },
                              });
                            }
                          }}
                        />
                        {' Bekleme sona erdi'}
                      </label>
                    )}
                    {modal.item.requireApproval && (
                      <section>
                        <h3>Kabul kontrolü</h3>
                        <p>{modal.item.criteria || 'Bu işin kabul ölçütü henüz tanımlanmadı.'}</p>
                        {modal.item.criteria && (
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={modal.item.verified}
                              onChange={(event) =>
                                setModal({
                                  ...modal,
                                  item: {
                                    ...modal.item,
                                    verified: event.target.checked,
                                  },
                                })
                              }
                            />
                            {' Kabul ölçütünü doğruladım'}
                          </label>
                        )}
                      </section>
                    )}
                    {completionIssues(modal.item, workspace).length > 0 && (
                      <p className="completion-hint">{completionIssues(modal.item, workspace).join(' ')}</p>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        let e = modal.item.id;
                        closeModal();
                        openTaskDetails(e);
                      }}
                    >
                      {'İşin ayrıntısına git '}
                      <ArrowUpRightIcon size={14} />
                    </button>
                  </div>
                )}
                {modal.type === 'guide' && (
                  <div className="usage-guide">
                    <p className="form-intro">Günlük işlerini bu sırayla yürütebilirsin.</p>
                    {[
                      [
                        '1',
                        'Ekibini tanımla',
                        'İsim, e-posta ve bölüm ekle. İş atayacağın kişileri rehberden seç.',
                        'team',
                      ],
                      [
                        '2',
                        'İşi netleştir',
                        'Başlığı yaz, tek veya ortak sorumluları seç, gerekiyorsa tarih ve kontrol adımları ekle.',
                        'tasks',
                      ],
                      [
                        '3',
                        'Birlikte ilerlet',
                        'İşin yan panelinde durumunu değiştir, yorum paylaş ve kontrol adımlarını tamamla.',
                        'mine',
                      ],
                      [
                        '4',
                        'Operasyonu izle',
                        'Panodan geciken, sahipsiz ve kontrol bekleyen işlere müdahale et.',
                        'dashboard',
                      ],
                      [
                        '5',
                        'Gelişmeleri kaçırma',
                        'Atama, yorum ve durum bildirimlerini Bildirimler ekranından izle.',
                        'notifications',
                      ],
                    ].map(([e, t, n, r]) => (
                      <button
                        className="guide-step"
                        type="button"
                        onClick={() => {
                          closeModal();
                          navigate(r);
                        }}
                        key={e}
                      >
                        <b>{e}</b>
                        <span>
                          <strong>{t}</strong>
                          <small>{n}</small>
                        </span>
                        <ChevronRightIcon size={16} />
                      </button>
                    ))}
                    <>
                      {demo && canWrite && (
                        <button
                          type="button"
                          className="button demo-conflict-trigger"
                          onClick={startDemoConflict}
                        >
                          <GitBranchIcon size={16} />
                          {' Örnek düzenleme çakışmasını dene'}
                        </button>
                      )}
                    </>
                    <div className="guide-note">
                      <ShieldCheckIcon size={17} />
                      <span>
                        {demo
                          ? 'Bu dosya tasarımı denemek içindir. Rol değiştirme, aynı tarayıcıda örnek senaryo gösterir; birden fazla cihazı eşzamanlı bağlamaz.'
                          : 'Bu yayının gerçek veri ve çok kullanıcılı kurulum sınırlarını ekip yöneticisiyle netleştir.'}
                      </span>
                    </div>
                  </div>
                )}
                {modal.type === 'resetDemo' && (
                  <p className="form-intro">
                    Yalnızca bu tasarım demosunda yaptığın değişiklikler silinir ve kurgusal örnek işler
                    yeniden yüklenir. Gerçek çalışma alanına işlem yapılmaz.
                  </p>
                )}
                {modal.type === 'templates' && (
                  <div className="template-library">
                    <p className="form-intro">
                      Aynı işi yeniden tarif etme. Bir şablon seç, kişileri ve tarihleri düzenleyerek aç.
                    </p>
                    {workspace.templates.map((template) => (
                      <button
                        type="button"
                        className="template-card"
                        disabled={!canWrite}
                        onClick={() => createFromTemplate(template)}
                        key={template.id}
                      >
                        <span className="template-icon">
                          <LayersIcon size={21} />
                        </span>
                        <span>
                          <strong>{template.name}</strong>
                          <small>
                            {template.task.checklist.length}
                            {' kontrol adımı · '}
                            {template.task.kind === 'shared' ? 'Ortak iş' : 'Bireysel iş'}
                          </small>
                        </span>
                        <ArrowUpRightIcon size={17} />
                      </button>
                    ))}
                    {!workspace.templates.length && (
                      <div className="empty-state">
                        <LayersIcon size={28} />
                        <h2>Tekrarlanan işler için bir başlangıç.</h2>
                        <p>
                          Bir işi aç, üstteki kaydet simgesinden şablona dönüştür. Şablonlar yorumları, eski
                          tarihleri ve tamamlanmış adımları yeni işe taşımaz.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {modal.type === 'template' && (
                  <>
                    <p className="form-intro">
                      {modal.item.title}
                      {' işinin açıklaması, kontrol listesi ve tercihleri tekrar kullanılacak.'}
                    </p>
                    {inputField('Şablon adı', 'name', 'text', modal.item.title, true)}
                  </>
                )}
                {modal.type === 'workRules' && (
                  <>
                    <p className="form-intro">
                      Yeni işlere ve tarih revizyonlarına uygulanır. Mevcut tarihler kendiliğinden
                      değiştirilmez.
                    </p>
                    <label className="form-label">
                      En fazla kaç takvim günü?
                      <input
                        name="maxDurationDays"
                        type="number"
                        min="0"
                        max="3650"
                        defaultValue={workspace.workRules.maxDurationDays}
                      />
                      <small>Başlangıç gününden itibaren. 0 = sınır yok.</small>
                    </label>
                    <label className="check-label">
                      <input
                        name="dueRequired"
                        type="checkbox"
                        defaultChecked={workspace.workRules.dueRequired}
                      />
                      {' Termin tarihi zorunlu olsun'}
                    </label>
                    <p className="form-footnote">
                      Zorunluluk kapalıysa süre sınırı tanımlı olsa da terminsiz iş kaydedilebilir.
                    </p>
                  </>
                )}
                {modal.type === 'reschedule' && (
                  <>
                    <p className="form-intro">{modal.item.title}</p>
                    <div className="revision-context">
                      <span>
                        Mevcut termin
                        <strong>
                          {formatDateTime(
                            modal.item.dueAt || (modal.item.date ? modal.item.date + 'T20:59:59Z' : ''),
                          )}
                        </strong>
                      </span>
                      <span>
                        Termin değişikliği
                        <strong>
                          {modal.item.dueRevisionCount || 0}
                          {' kez'}
                        </strong>
                      </span>
                    </div>
                    <label className="form-label">
                      Yeni termin (Türkiye saati)
                      <input
                        type="datetime-local"
                        name="dueAt"
                        value={toDateTimeInput(
                          modal.item.dueAt || (modal.item.date ? modal.item.date + 'T20:59:59Z' : ''),
                        )}
                        required={workspace.workRules.dueRequired}
                        onChange={(event) =>
                          setModal({
                            ...modal,
                            item: withDueDate(modal.item, fromDateTimeInput(event.target.value)),
                          })
                        }
                      />
                    </label>
                    <DateShortcuts
                      required={workspace.workRules.dueRequired}
                      allowed={(e) => isScheduleValid(modal.item, e)}
                      onSelect={(e) =>
                        setModal({
                          ...modal,
                          item: withDueDate(modal.item, e),
                        })
                      }
                    />
                    {textareaField('Revizyon gerekçesi', 'reason', '', true)}
                    <p className="form-footnote">
                      Tarihi boş bırakarak termini kaldırabilirsin (ekip kuralı izin veriyorsa). Eski ve yeni
                      tarih, kişi, zaman ve gerekçe geçmişte saklanır.
                      {workspace.workRules.maxDurationDays > 0
                        ? ' En fazla ' + workspace.workRules.maxDurationDays + ' takvim günü.'
                        : ''}
                    </p>
                  </>
                )}
                {modal.type === 'bulk' && (
                  <>
                    <p className="form-intro">
                      {modal.item.ids.length}
                      {' işe aynı değişiklik uygulanacak. Bir işte kural ihlali varsa hiçbir iş kaydedilmez.'}
                    </p>
                    <label className="form-label">
                      Ne güncellensin?
                      <select
                        value={modal.item.mode}
                        onChange={(event) =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              mode: event.target.value,
                            },
                          })
                        }
                      >
                        <option value="status">İş durumu</option>
                        <option value="assignees">Sorumlular</option>
                        <option value="due">Hedef bitiş</option>
                      </select>
                    </label>
                    {modal.item.mode === 'status' ? (
                      <label className="form-label">
                        Yeni durum
                        <select name="status">
                          {Object.entries(TASK_STATUS_LABELS).map(([key, value]) => (
                            <option value={key} key={key}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : modal.item.mode === 'assignees' ? (
                      <>
                        <PeoplePicker
                          defaultOpen={modal.type === 'people'}
                          teams={workspace.teams}
                          members={assignableMembers}
                          selected={modal.item.assignees}
                          onChange={(e) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                assignees: e,
                              },
                            })
                          }
                        />
                        <p className="form-footnote">
                          Mevcut sorumlular bu seçimle değiştirilir. Boş seçim işleri sahipsiz bırakır.
                        </p>
                      </>
                    ) : (
                      <>
                        {inputField(
                          'Yeni termin (Türkiye saati)',
                          'dueAt',
                          'datetime-local',
                          '',
                          workspace.workRules.dueRequired,
                        )}
                        {textareaField('Revizyon gerekçesi', 'reason', '', true)}
                      </>
                    )}
                  </>
                )}
                {modal.type === 'workspace' && (
                  <>
                    <p className="form-intro">Aynı işleri paylaşacağın ekip için bir isim belirle.</p>
                    {inputField('Ekip / şirket adı', 'name', 'text', '', true)}
                  </>
                )}
                {modal.type === 'member' && (
                  <>
                    {inputField('Ad soyad', 'name', 'text', modal.item.name || '', true)}
                    <label className="form-label">
                      E-posta
                      <input
                        type="email"
                        name="email"
                        defaultValue={modal.item.email || ''}
                        readOnly={!!modal.item.email}
                        required={true}
                        maxLength={254}
                      />
                      <small>Üye bu e-posta adresiyle giriş yapacak.</small>
                    </label>
                    {inputField('Bölüm (isteğe bağlı)', 'department', 'text', modal.item.department || '')}
                    <details className="form-details">
                      <summary>
                        {'Yetki ve erişim '}
                        <ChevronDownIcon size={14} />
                      </summary>
                      <label className="form-label">
                        Yetki
                        <select name="role" defaultValue={modal.item.role || 'editor'}>
                          {modal.item.role === 'owner' ? (
                            <option value="owner">Yönetici</option>
                          ) : (
                            <>
                              <option value="editor">Ekip üyesi — iş alır ve günceller</option>
                              <option value="viewer">Görüntüleyici — işleri izler</option>
                            </>
                          )}
                        </select>
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={modal.item.active ?? true}
                          disabled={modal.item.role === 'owner'}
                        />
                        {' Aktif ekip üyesi'}
                      </label>
                    </details>
                    <p className="form-footnote">
                      Bu tanım davet e-postası göndermez. Siteye giriş erişimi ayrıca açılmalı.
                    </p>
                  </>
                )}
                {modal.type === 'task' && (
                  <>
                    <label className="form-label title-input">
                      Ne yapılacak?
                      <input
                        name="title"
                        placeholder="Örn. Sevkiyat öncesi koli kontrolü"
                        autoFocus={true}
                        defaultValue={
                          modal.item.title === 'Yeni iş' &&
                          !workspace.tasks.some((task) => task.id === modal.item.id)
                            ? ''
                            : modal.item.title
                        }
                        required={true}
                        maxLength={4e3}
                      />
                    </label>
                    <TaskRouting
                      task={modal.item}
                      state={workspace}
                      teams={workspace.teams.filter(
                        (team) =>
                          myTeams.some((t) => t.id === team.id) || taskTeamIds(modal.item).includes(team.id),
                      )}
                      members={members}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          item: e,
                        })
                      }
                    />
                    <div className="type-switch">
                      <button
                        type="button"
                        className={modal.item.kind === 'individual' ? 'active' : ''}
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              kind: 'individual',
                              assignees: modal.item.assignees.slice(0, 1),
                            },
                          })
                        }
                      >
                        <UserRoundIcon size={15} />
                        {' Bir kişiye'}
                      </button>
                      <button
                        type="button"
                        className={modal.item.kind === 'shared' ? 'active' : ''}
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              kind: 'shared',
                            },
                          })
                        }
                      >
                        <UsersIcon size={16} />
                        {' Seçili kişilere'}
                      </button>
                      <button
                        type="button"
                        className={
                          modal.item.kind === 'shared' &&
                          modal.item.assignees.length === assignableMembers.length
                            ? 'active'
                            : ''
                        }
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              kind: 'shared',
                              assignees: assigneesForTask(modal.item).map((e) => e.email),
                            },
                          })
                        }
                      >
                        <UsersIcon size={16} />
                        {' Seçili ekiplerin tamamına'}
                      </button>
                      <button
                        type="button"
                        disabled={!modal.item.teamId}
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              assignees: [],
                              coordinator: '',
                              kind: 'individual',
                            },
                          })
                        }
                      >
                        Ekip havuzuna
                      </button>
                    </div>
                    <PeoplePicker
                      defaultOpen={modal.type === 'people'}
                      teams={workspace.teams}
                      members={assignableMembers}
                      selected={modal.item.assignees}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            assignees: e,
                          },
                        })
                      }
                      single={modal.item.kind === 'individual'}
                    />
                    {assignableMembers.length < 2 && role === 'owner' && (
                      <p className="form-footnote">
                        Yeni kişiler eklemek için Ekip ekranındaki “Üye ekle” düğmesini kullan.
                      </p>
                    )}
                    <div className="form-two">
                      <label className="form-label">
                        Başlangıç
                        <input
                          type="datetime-local"
                          name="plannedStart"
                          value={toDateTimeInput(modal.item.plannedStart)}
                          onChange={(event) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                plannedStart: fromDateTimeInput(event.target.value),
                              },
                            })
                          }
                        />
                        <small>Yeni işte bugün otomatik doldurulur.</small>
                      </label>
                      <label className="form-label">
                        {'Termin '}
                        <span className="optional">
                          {workspace.workRules.dueRequired ? 'zorunlu' : 'isteğe bağlı'}
                        </span>
                        <input
                          type="datetime-local"
                          name="dueAt"
                          value={toDateTimeInput(
                            modal.item.dueAt || (modal.item.date ? modal.item.date + 'T20:59:59Z' : ''),
                          )}
                          required={workspace.workRules.dueRequired}
                          onChange={(event) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                dueAt: fromDateTimeInput(event.target.value),
                                date: event.target.value.slice(0, 10),
                              },
                            })
                          }
                        />
                        <small>
                          {workspace.workRules.maxDurationDays
                            ? 'En fazla ' + workspace.workRules.maxDurationDays + ' takvim günü.'
                            : 'Terminsiz de kaydedebilirsin.'}
                        </small>
                      </label>
                    </div>
                    <DateShortcuts
                      required={workspace.workRules.dueRequired}
                      allowed={(e) => isScheduleValid(modal.item, e)}
                      onSelect={(e) =>
                        setModal({
                          ...modal,
                          item: withDueDate(modal.item, e),
                        })
                      }
                    />
                    {textareaField('İş tarifi (isteğe bağlı)', 'description', modal.item.description)}
                    {workspace.tasks.some((task) => task.id === modal.item.id) &&
                      textareaField('Revizyon gerekçesi (termin değişiyorsa zorunlu)', 'reason', '')}
                    <details className="form-details">
                      <summary>
                        {'Kontrol listesi ekle '}
                        <span>
                          {modal.item.checklist.length}
                          {' adım'}
                        </span>
                        <ChevronDownIcon size={14} />
                      </summary>
                      {textareaField(
                        'Her satıra bir kontrol adımı yaz',
                        'checklistText',
                        modal.item.checklist.map((step) => step.text).join('\n'),
                      )}
                      <label className="check-label">
                        <input
                          type="checkbox"
                          name="checklistRequired"
                          defaultChecked={modal.item.checklistRequired}
                        />
                        {' Tüm adımlar bitmeden iş kapanmasın'}
                      </label>
                    </details>
                    <details className="form-details">
                      <summary>
                        {'Diğer seçenekler '}
                        <span>Süre, öncelik, proje ve takipçiler</span>
                        <ChevronDownIcon size={14} />
                      </summary>
                      <div className="form-two">
                        <label className="form-label">
                          Öncelik
                          <select name="priority" defaultValue={modal.item.priority}>
                            {Object.entries(PRIORITY_LABELS).map(([key, value]) => (
                              <option value={key} key={key}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                        {inputField('Bölüm / operasyon', 'phase', 'text', modal.item.phase)}
                      </div>
                      {inputField(
                        'Planlanan toplam emek (kişi-dakika, isteğe bağlı)',
                        'estimatedMinutes',
                        'number',
                        String(modal.item.estimatedMinutes || ''),
                      )}
                      <p className="form-footnote">
                        Ortak işte toplam tahmin, iş dağılımı görünümünde sorumlular arasında eşit bölünür.
                      </p>
                      <label className="form-label">
                        Proje
                        <select
                          name="project"
                          value={modal.item.project}
                          onChange={(event) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                project: event.target.value,
                                depends: [],
                              },
                            })
                          }
                        >
                          <option value="">Günlük operasyon</option>
                          {workspace.projects.map((project) => (
                            <option value={project.id} key={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="check-label option-card">
                        <input type="checkbox" name="trackTime" defaultChecked={modal.item.trackTime} />
                        <span>
                          Harcanan süreyi takip et
                          <small>Kişiler bu iş için sayaç veya manuel süre kullanabilir.</small>
                        </span>
                      </label>
                      <label className="check-label option-card">
                        <input type="checkbox" name="notifyEmail" defaultChecked={modal.item.notifyEmail} />
                        <span>
                          Bu işin e-posta bildirimleri açık olsun
                          <small>
                            {mailConfigured
                              ? 'Gönderimler ekip kurallarına göre yapılır.'
                              : 'Gönderim servisi bağlanana kadar uygulama içi bildirimler çalışır.'}
                          </small>
                        </span>
                      </label>
                      <PeoplePicker
                        label="Takipçiler"
                        members={activeMembers}
                        selected={modal.item.watchers}
                        onChange={(e) =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              watchers: e,
                            },
                          })
                        }
                      />
                      <details className="form-details nested">
                        <summary>
                          {'Bağımlılıklar ve kabul kontrolü '}
                          <ChevronDownIcon size={13} />
                        </summary>
                        <label className="form-label">
                          Önce tamamlanması gereken işler
                          <select multiple={true} name="depends" size={3} defaultValue={modal.item.depends}>
                            {workspace.tasks
                              .filter(
                                (task) => task.id !== modal.item.id && task.project === modal.item.project,
                              )
                              .map((task) => (
                                <option value={task.id} key={task.id}>
                                  {task.title}
                                </option>
                              ))}
                          </select>
                        </label>
                        {textareaField('Kabul ölçütü', 'criteria', modal.item.criteria)}
                        <label className="check-label">
                          <input
                            name="requireApproval"
                            type="checkbox"
                            defaultChecked={modal.item.requireApproval}
                          />
                          {' Kapanmadan önce doğrulama zorunlu olsun'}
                        </label>
                        <label className="check-label">
                          <input name="verified" type="checkbox" defaultChecked={modal.item.verified} />
                          {' Kabul ölçütünü doğruladım'}
                        </label>
                      </details>
                    </details>
                  </>
                )}
                {modal.type === 'people' && (
                  <>
                    <p className="form-intro">{modal.item.title}</p>
                    <div className="assignment-shortcuts">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              assignees: [user],
                            },
                          })
                        }
                      >
                        Bana ata
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              assignees: assigneesForTask(modal.item).map((e) => e.email),
                            },
                          })
                        }
                      >
                        Seçili ekiplerin tamamına ata
                      </button>
                      <button
                        type="button"
                        disabled={!modal.item.teamId}
                        onClick={() =>
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              assignees: [],
                              coordinator: '',
                            },
                          })
                        }
                      >
                        Ekip havuzuna bırak
                      </button>
                    </div>
                    <PeoplePicker
                      defaultOpen={modal.type === 'people'}
                      teams={workspace.teams}
                      members={assignableMembers}
                      selected={modal.item.assignees}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            assignees: e,
                          },
                        })
                      }
                    />
                  </>
                )}
                {modal.type === 'time' && (
                  <>
                    <p className="form-intro">
                      {modal.item.title}
                      {' — süre senin adına kaydedilir.'}
                    </p>
                    {inputField('Harcanan dakika', 'minutes', 'number', '', true)}
                    {textareaField('Yapılan çalışma', 'note', '', true)}
                  </>
                )}
                {modal.type === 'project' && (
                  <>
                    {inputField('Proje adı', 'name', 'text', modal.item.name, true)}
                    {textareaField('Amaç ve beklenen sonuç', 'goal', modal.item.goal, true)}
                    <details className="form-details">
                      <summary>
                        {'Kapsam ayrıntıları '}
                        <ChevronDownIcon size={14} />
                      </summary>
                      {textareaField('Kapsam', 'scope', modal.item.scope)}
                      {textareaField('Kapsam dışında kalanlar', 'excluded', modal.item.excluded)}
                    </details>
                    {inputField('Hedef tarih', 'date', 'date', modal.item.date)}
                  </>
                )}
                {['decision', 'blocker'].includes(modal.type) && (
                  <>
                    <label className="form-label">
                      Proje
                      <select
                        name="project"
                        defaultValue={modal.item.project || ''}
                        required={modal.type === 'decision'}
                      >
                        <option value="">
                          {modal.type === 'decision' ? 'Proje seç' : 'Günlük operasyon'}
                        </option>
                        {workspace.projects.map((project) => (
                          <option value={project.id} key={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {inputField(
                      modal.type === 'decision' ? 'Alınan karar' : 'Engel / beklenen bilgi',
                      'title',
                      'text',
                      modal.item.title,
                      true,
                    )}
                    {modal.type === 'decision' ? (
                      <>
                        {textareaField('Gerekçe', 'reason', modal.item.reason, true)}
                        {textareaField('Etkilenen işler / kapsam', 'impact', modal.item.impact, true)}
                      </>
                    ) : (
                      <>
                        {inputField('Çözüm sorumlusu', 'owner', 'text', modal.item.owner)}
                        <label className="form-label">
                          Bağlı iş
                          <select name="task" defaultValue={modal.item.task || ''}>
                            <option value="">İş seç (isteğe bağlı)</option>
                            {workspace.tasks.map((task) => (
                              <option value={task.id} key={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="check-label">
                          <input type="checkbox" name="resolved" defaultChecked={modal.item.resolved} />
                          {' Engel çözüldü'}
                        </label>
                      </>
                    )}
                  </>
                )}
                {error && (
                  <div className="error-banner" role="alert">
                    {error}
                  </div>
                )}
                <div
                  className="modal-footer"
                  style={{
                    display: ['templates', 'guide', 'search'].includes(modal.type) ? 'none' : undefined,
                  }}
                >
                  <button type="button" className="button quiet" disabled={busy} onClick={closeModal}>
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={
                      busy ||
                      (modal.type === 'complete' && completionIssues(modal.item, workspace).length > 0)
                    }
                  >
                    {busy ? <LoaderCircleIcon size={16} className="spin" /> : <CheckIcon size={16} />}{' '}
                    {busy
                      ? 'Kaydediliyor…'
                      : modal.type === 'complete'
                        ? 'Tamamla'
                        : modal.type === 'resetDemo'
                          ? 'Örnekleri sıfırla'
                          : modal.type === 'task' &&
                              !workspace.tasks.some((task) => task.id === modal.item.id)
                            ? 'İşi oluştur'
                            : modal.type === 'member' && !modal.item.email
                              ? 'Üyeyi ekle'
                              : 'Kaydet'}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
      {conflict && (
        <ConflictDialog
          report={conflict.report}
          onConfirm={confirmConflict}
          onCancel={cancelConflict}
          working={conflictSaving}
          error={conflictError}
          name={memberName}
          key={conflict.latest.revision}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckIcon size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
