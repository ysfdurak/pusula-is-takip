// Proje sağlığı: her proje için açık/biten/geciken/engelli iş sayıları ve durum (late, risk, ontrack, done...).
// Saf fonksiyon; Projeler ekranı ve MCP araçları aynı hesabı kullanır.
import { taskObstacles } from './taskRules.js';

const isOpenTask = (task) => !['done', 'cancelled'].includes(task.status);

const dueTimestamp = (task) =>
  task.dueAt ? Date.parse(task.dueAt) : task.date ? Date.parse(task.date + 'T23:59:59+03:00') : null;

export function projectSummaries(state, now) {
  return state.projects.map((project) => {
    let matchingTasks = state.tasks.filter((task) => task.project === project.id);
    let i = matchingTasks.filter(isOpenTask);
    let a = matchingTasks.filter((task) => task.status === 'done').length;
    let o = matchingTasks.filter((task) => task.status === 'cancelled').length;
    let s = matchingTasks.length - o;
    let c = i.filter((e) => dueTimestamp(e) !== null && dueTimestamp(e) < now).length;
    let l = i.filter((t) => taskObstacles(t, state).length).length;
    let u = i.filter((e) => dueTimestamp(e) === null).length;
    let d = i.filter((task) => !task.assignees.length).length;
    let f = !!(project.date && Date.parse(project.date + 'T23:59:59+03:00') < now && i.length);
    let p = matchingTasks.length
      ? s
        ? i.length
          ? c || f
            ? 'late'
            : l || u || d
              ? 'risk'
              : 'ontrack'
          : 'done'
        : 'cancelled'
      : 'empty';
    return {
      ...project,
      total: matchingTasks.length,
      open: i.length,
      done: a,
      cancelled: o,
      late: c,
      blocked: l,
      undated: u,
      unassigned: d,
      health: p,
      progress: s ? Math.round((a / s) * 100) : 0,
    };
  });
}
