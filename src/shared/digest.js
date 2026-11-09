// Sabah özeti: her üyeye kendi işlerinden geciken, bugün termini olan ve bu hafta termini olanlar.
// Saatler Türkiye saatine göre hesaplanır.
import { canAccessTask, normalizeState } from './workspaceModel.js';

const dayKey = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(ms));
const dueOf = (task) => task.dueAt || (task.date ? task.date + 'T20:59:59Z' : '');

/** Türkiye saatine göre tarih (YYYY-AA-GG), saat ve hafta günü (0 pazar) */
export function istanbulClock(now) {
  const local = new Date(now + 3 * 3600e3);
  return { day: dayKey(now), hour: local.getUTCHours(), weekday: local.getUTCDay() };
}

/**
 * @returns {{workspace, member, overdue: object[], today: object[], week: object[], pool: object[], teams}[]}
 */
export function digestFor(data, now) {
  const today = dayKey(now);
  const weekEnd = dayKey(now + 7 * 864e5);
  const result = [];
  for (const workspace of data.workspaces) {
    const state = normalizeState(data.states[workspace.id] || {});
    for (const member of data.members[workspace.id] || []) {
      if (!member.active || !member.mail_enabled || member.digest_enabled === 0) continue;
      const open = state.tasks.filter(
        (task) => !['done', 'cancelled'].includes(task.status) && canAccessTask(task, state, member.email, member.role),
      );
      const mine = open.filter((task) => task.assignees.includes(member.email));
      const withDue = mine.filter((task) => dueOf(task)).sort((a, b) => dueOf(a).localeCompare(dueOf(b)));
      const overdue = withDue.filter((task) => Date.parse(dueOf(task)) < now);
      const todays = withDue.filter((task) => Date.parse(dueOf(task)) >= now && dayKey(Date.parse(dueOf(task))) === today);
      const week = withDue.filter((task) => {
        const day = dayKey(Date.parse(dueOf(task)));
        return day > today && day <= weekEnd;
      });
      // Ekip yöneticisine, ekibinin havuzunda sorumlu bekleyen işler
      const ledTeams = state.teams.filter((team) => team.active && team.leads.includes(member.email)).map((t) => t.id);
      const pool = open.filter((task) => !task.assignees.length && ledTeams.includes(task.teamId));
      if (overdue.length + todays.length + week.length + pool.length === 0) continue;
      result.push({ workspace, member, overdue, today: todays, week, pool, teams: state.teams });
    }
  }
  return result;
}
