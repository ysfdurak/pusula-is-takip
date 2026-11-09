import { teamName } from '../shared/workspaceModel.js';

export function WeekPlan({ state, members, onOpen }) {
  let r = new Date(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
    }).format(new Date()) + 'T00:00:00+03:00',
  ).getTime();
  let i = r + 7 * 864e5;
  let matchingTasks = state.tasks.filter(
    (task) =>
      !['done', 'cancelled'].includes(task.status) &&
      (task.dueAt || task.date) &&
      Date.parse(task.dueAt || task.date + 'T23:59:59+03:00') >= r &&
      Date.parse(task.dueAt || task.date + 'T23:59:59+03:00') < i,
  );
  return (
    <section className="week-plan">
      <h2>Önümüzdeki 7 gün · Kişi bazında teslimler</h2>
      <p>
        Terminlere göre plan görünümü. Ortak iş her sorumlunun satırında görünür; kapasite veya müsaitlik
        hesabı değildir.
      </p>
      {members
        .filter((member) => matchingTasks.some((task) => task.assignees.includes(member.email)))
        .map((member) => (
          <div className="week-person" key={member.email}>
            <strong>{member.name || member.email}</strong>
            <div>
              {matchingTasks
                .filter((task) => task.assignees.includes(member.email))
                .sort((task, b) => (task.dueAt || task.date).localeCompare(b.dueAt || b.date))
                .map((task) => (
                  <button onClick={() => onOpen(task.id)} key={task.id}>
                    <small>
                      {new Date(task.dueAt || task.date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', {
                        timeZone: 'Europe/Istanbul',
                        day: 'numeric',
                        month: 'short',
                      })}
                      {' · '}
                      {teamName(task.teamId, state)}
                    </small>
                    {task.title}
                  </button>
                ))}
            </div>
          </div>
        ))}
      {!matchingTasks.length && <p>Bu aralıkta terminli açık iş yok.</p>}
      <small>
        {
          state.tasks.filter(
            (task) => !['done', 'cancelled'].includes(task.status) && !task.dueAt && !task.date,
          ).length
        }
        {' açık iş terminsiz; bu takvimde yer almaz.'}
      </small>
    </section>
  );
}
