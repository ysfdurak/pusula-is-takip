import { BoardsPage } from './screens/BoardsPage.jsx';
import { TaskListPage } from './screens/TaskListPage.jsx';
import { TeamPage } from './screens/TeamPage.jsx';
import { NotificationsPage } from './screens/NotificationsPage.jsx';
import { SettingsPage } from './screens/SettingsPage.jsx';
import { RecordsPage } from './screens/RecordsPage.jsx';
import { TaskDrawer } from './screens/TaskDrawer.jsx';
import { ModalHost } from './screens/ModalHost.jsx';
import { AppContext } from './AppContext.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRightIcon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleQuestionMarkIcon,
  CompassIcon,
  EllipsisIcon,
  FlagIcon,
  GitBranchIcon,
  LayersIcon,
  LoaderCircleIcon,
  LogOutIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { Avatar } from './components/Avatar.jsx';
import { ConflictDialog, fromLocalDateTimeInput } from './components/ConflictDialog.jsx';
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
import { formatDateTime, fromDateTimeInput, newId, toDateTimeInput, todayKey } from './lib/format.js';
import { prepareUpload } from './lib/upload.js';
import { formatBytes } from './components/TaskAttachments.jsx';
import { NAV_ITEMS, ROLE_LABELS, TASK_STATUS_LABELS } from './lib/labels.js';
import {
  DEFAULT_FOCUS_SETTINGS,
  buildQuickTask,
  completionIssues,
  filterFocusTasks,
  istanbulDay,
} from './lib/taskViews.js';
import {
  DEFAULT_NOTIFY_POLICY,
  EMPTY_STATE,
  poolTasks,
  taskFromTemplate,
  taskSchema,
  taskTeamIds,
  validateSchedule,
} from './shared/workspaceModel.js';
export function App({ demo = false, preview = false }) {
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
  let [taskFiles, setTaskFiles] = useState([]);
  let [fileCounts, setFileCounts] = useState({});
  let [maxFileBytes, setMaxFileBytes] = useState(1048576);
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
  async function fetchWorkspace(t, n = '', f = '') {
    if (demo) {
      return demoGet(t, n, f);
    }
    let task = await fetch(
      '/api/workspace' +
        (t
          ? '?id=' +
            encodeURIComponent(t) +
            (n ? '&task=' + encodeURIComponent(n) : '') +
            (f ? '&file=' + encodeURIComponent(f) : '')
          : ''),
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
      setFileCounts(nextWorkspace.fileCounts || {});
      setMaxFileBytes(nextWorkspace.maxFileBytes || 1048576);
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
        setTaskFiles(nextWorkspace.files || []);
        setFileCounts(nextWorkspace.fileCounts || {});
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
    setTaskFiles([]);
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
  async function attachFiles(list) {
    setBusy(true);
    setError('');
    let added = 0;
    try {
      for (let file of list) {
        let prepared = await prepareUpload(file);
        if (prepared.size > maxFileBytes) {
          throw Error(file.name + ': dosya en fazla ' + formatBytes(maxFileBytes) + ' olabilir.');
        }
        await postAction({
          action: 'attach',
          id: workspaceId,
          task: openTaskId,
          name: prepared.name,
          data: prepared.data,
        });
        added++;
      }
      setToast(added === 1 ? 'Dosya eklendi' : added + ' dosya eklendi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (openTaskId) {
        loadTaskDetails(openTaskId);
      }
    }
  }
  async function openAttachment(file) {
    try {
      let result = await fetchWorkspace(workspaceId, '', file.id);
      let bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      let url = URL.createObjectURL(new Blob([bytes], { type: result.file.type }));
      let link = document.createElement('a');
      link.href = url;
      link.download = result.file.name;
      if (result.file.type.startsWith('image/')) {
        link.removeAttribute('download');
        link.target = '_blank';
        link.rel = 'noopener';
      }
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60e3);
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeAttachment(file) {
    setBusy(true);
    try {
      await postAction({ action: 'detach', id: workspaceId, task: openTaskId, file: file.id });
      setToast('Dosya silindi');
      loadTaskDetails(openTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
      if (i === 'resetDemo' && preview) {
        resetDemoData();
        window.location.reload();
        return;
      } else if (i === 'resetDemo') {
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
          recurrence: r('recurrence'),
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
        digest: e === 'digest' ? checked : currentMember?.digest_enabled !== 0,
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
  const appContext = {
    preview,
    attachFiles,
    fileCounts,
    maxFileBytes,
    openAttachment,
    removeAttachment,
    taskFiles,
    activeMembers,
    activities,
    assignableMembers,
    assigneeFilter,
    assigneesForTask,
    avatarStack,
    bulkMode,
    bulkSelection,
    busy,
    canWrite,
    changeAssignees,
    closeModal,
    commentDraft,
    commentRequestId,
    comments,
    createFromTemplate,
    createQuickTask,
    currentMember,
    dashboardProject,
    demo,
    detailTab,
    detailsLoading,
    dueDayFilter,
    error,
    exportRecords,
    filtersActive,
    filtersOpen,
    focusFilters,
    focusItems,
    focusPool,
    focusSettings,
    focusTasks,
    focusView,
    groupNotifications,
    inputField,
    isLate,
    isOpen,
    isScheduleValid,
    listedTasks,
    mailConfigured,
    memberName,
    members,
    metricFilter,
    modal,
    myNotifications,
    myTeams,
    navigate,
    notificationScope,
    notifications,
    notifyPolicy,
    now,
    openModal,
    openTaskDetails,
    page,
    personalStats,
    postAction,
    projectFilter,
    projectName,
    quickDrafts,
    recordTime,
    refresh,
    remoteChanged,
    reportDays,
    requestStatusChange,
    role,
    saveAsTemplate,
    savePolicy,
    savePreference,
    scopedTasks,
    searchQuery,
    selectedTask,
    setAssigneeFilter,
    setBulkMode,
    setBulkSelection,
    setBusy,
    setCommentDraft,
    setDashboardProject,
    setDetailTab,
    setDueDayFilter,
    setError,
    setFiltersOpen,
    setFocusSettings,
    setFocusView,
    setGroupNotifications,
    setMetricFilter,
    setModal,
    setNotificationScope,
    setOpenTaskId,
    setProjectFilter,
    setReportDays,
    setSearchQuery,
    setShowTrackedTime,
    setStatusFilter,
    setTaskFilter,
    setTaskView,
    setTeamScope,
    setToast,
    showFilteredTasks,
    showTaskList,
    showTrackedTime,
    startDemoConflict,
    statusFilter,
    statusSelect,
    submitComment,
    submitModal,
    taskFilter,
    taskSummary,
    taskView,
    teamScope,
    textareaField,
    timeEntries,
    toggleChecklistItem,
    toggleWatch,
    trackedSeconds,
    unreadCount,
    user,
    withDueDate,
    workspace,
    workspaceId,
    workspaces,
  };
  return (
    <AppContext.Provider value={appContext}>
      {authRequired ? (
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
                  <a
                    className="account-logout"
                    href="/auth/logout"
                    title="Oturumu kapat"
                    aria-label="Oturumu kapat"
                  >
                    <LogOutIcon size={16} />
                  </a>
                )}
              </div>
            </div>
          </aside>
          <div className="main-shell">
            {demo && (
              <section className={'design-banner' + (preview ? ' preview' : '')}>
                <div>
                  <ShieldCheckIcon size={18} />
                  <span>
                    <strong>{preview ? 'Pilot önizlemesi' : 'Tasarım demosu'}</strong>
                    <small>
                      {preview
                        ? 'Boş başlar, örnek veri yok · Veriler yalnızca bu tarayıcıda · Gerçek pilotta Microsoft hesabıyla girilir'
                        : 'Örnek veriler · Gerçek şirket verisi girmeyin · Ortak canlı kullanım değildir'}
                    </small>
                  </span>
                </div>
                <div>
                  <label>
                    {preview ? 'Kullanıcı olarak dene' : 'Denediğin rol'}
                    <select
                      aria-label={preview ? 'Kullanıcı olarak dene' : 'Örnek kullanıcı / rol'}
                      disabled={busy}
                      value={user || DEMO_USERS[0].email}
                      onChange={(event) => switchDemoUser(event.target.value)}
                    >
                      {(preview ? members.filter((member) => member.active) : DEMO_USERS).map((member) => (
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
                    aria-label={preview ? 'Önizlemeyi sıfırla' : 'Örnek verileri sıfırla'}
                    title={preview ? 'Önizlemeyi sıfırla' : 'Örnek verileri sıfırla'}
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
                  {preview ? 'Bu tarayıcıda' : demo ? 'Yerel demo' : offline ? 'Bağlantı bekleniyor' : '20 sn’de güncellenir'}
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
                  {(page === 'dashboard' || page === 'mine') && <BoardsPage />}
                  {page === 'tasks' && <TaskListPage />}
                  {page === 'team' && <TeamPage />}
                  {page === 'notifications' && <NotificationsPage />}
                  {page === 'settings' && <SettingsPage />}
                  {['projects', 'decisions', 'blockers'].includes(page) && <RecordsPage />}
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
          {selectedTask && <TaskDrawer />}
          {modal && <ModalHost />}
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
      )}
    </AppContext.Provider>
  );
}
