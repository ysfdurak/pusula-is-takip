// Ekip panosu istatistikleri: geciken, sahipsiz, engelli, onay bekleyen işler, iş yükü, 7 günlük takvim.
// Saf fonksiyon: veriyi nereden aldığını bilmez. Web arayüzü (Ekip panosu) ve MCP araçları aynı hesabı kullanır.

const istanbulDayKey = (now) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date(now));

const isActiveTask = (task) => !['done', 'cancelled'].includes(task.status);

export const dueTime = (task) =>
  task.dueAt ? Date.parse(task.dueAt) : task.date ? Date.parse(task.date + 'T23:59:59+03:00') : null;

export function buildDashboardStats(
  workspace,
  members,
  timeEntries,
  now,
  reportDays = 7,
  tasks = workspace.tasks,
) {
  let matchingTasks = workspace.tasks.filter(isActiveTask);
  let s = now - reportDays * 864e5;
  let c = istanbulDayKey(now);
  let l = matchingTasks.filter((task) => {
    let t = dueTime(task);
    return t !== null && t < now;
  });
  let u = matchingTasks.filter(
    (task) =>
      !task.assignees.some((email) =>
        members.some((member) => member.email === email && member.active === 1 && member.role !== 'viewer'),
      ),
  );
  let d = matchingTasks.filter((task) => dueTime(task) === null);
  let f = matchingTasks.filter(
    (task) =>
      workspace.blockers.some((blocker) => !blocker.resolved && blocker.task === task.id) ||
      task.depends.some((dependencyId) => tasks.find((t) => t.id === dependencyId)?.status !== 'done'),
  );
  let p = matchingTasks.filter((task) => task.requireApproval && !task.verified);
  let m = matchingTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high');
  let filteredTasks = workspace.tasks.filter(
    (task) =>
      task.status === 'done' &&
      task.completedAt &&
      Date.parse(task.completedAt) >= s &&
      Date.parse(task.completedAt) <= now,
  );
  let g = matchingTasks.filter((task) => task.originalDueAt && Date.parse(task.originalDueAt) < now);
  let _ = workspace.tasks.filter((task) => task.dueRevisionCount > 0);
  let v = filteredTasks.filter((task) => task.originalDueAt);
  let y = v.filter((e) => Date.parse(e.completedAt) <= Date.parse(e.originalDueAt));
  let b = filteredTasks.filter((task) => dueTime(task) !== null);
  let x = b.filter((e) => Date.parse(e.completedAt) <= dueTime(e));
  let lookup = new Map();
  for (let entry of timeEntries)
    lookup.set(
      entry.task,
      (lookup.get(entry.task) || 0) +
        (entry.ended ? entry.seconds : Math.max(0, (now - entry.started) / 1e3)),
    );
  let S = (e) => lookup.get(e) || 0;
  let C = members
    .filter((member) => member.active === 1 && member.role !== 'viewer')
    .map((member) => {
      let t = matchingTasks.filter((task) => task.assignees.includes(member.email));
      return {
        ...member,
        count: t.length,
        late: t.filter((e) => l.includes(e)).length,
        remainingMinutes: Math.round(
          t.reduce(
            (sum, task) =>
              sum + Math.max(0, task.estimatedMinutes - S(task.id) / 60) / Math.max(1, task.assignees.length),
            0,
          ),
        ),
        estimatedJobs: t.filter((e) => e.estimatedMinutes > 0).length,
      };
    })
    .sort((e, t) => t.count - e.count || t.late - e.late);
  let te = Date.parse(c + 'T00:00:00+03:00');
  return {
    originalLate: g,
    rescheduled: _,
    originalDated: v,
    originalOnTime: y,
    open: matchingTasks,
    late: l,
    unassigned: u,
    undated: d,
    blocked: f,
    review: p,
    urgent: m,
    completed: filteredTasks,
    datedCompleted: b,
    onTime: x,
    workload: C,
    upcoming: Array.from(
      {
        length: 7,
      },
      (e, t) => {
        let n = istanbulDayKey(te + t * 864e5);
        return {
          date: n,
          tasks: matchingTasks.filter((task) => {
            let t = dueTime(task);
            return t !== null && istanbulDayKey(t) === n;
          }),
        };
      },
    ),
    trend: Array.from(
      {
        length: 7,
      },
      (t, n) => {
        let r = istanbulDayKey(te - (6 - n) * 864e5);
        return {
          date: r,
          count: workspace.tasks.filter(
            (task) =>
              task.status === 'done' &&
              task.completedAt &&
              istanbulDayKey(Date.parse(task.completedAt)) === r,
          ).length,
        };
      },
    ),
    states: Object.fromEntries(
      ['todo', 'doing', 'done', 'cancelled'].map((t) => [
        t,
        workspace.tasks.filter((task) => task.status === t).length,
      ]),
    ),
    today: c,
  };
}
