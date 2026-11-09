import { ArrowUpRightIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { taskTeamIds } from '../shared/workspaceModel.js';

export function TeamHub({ state, members, admin, user, onEdit, onOpen }) {
  return (
    <section className="team-hub">
      <header>
        <div>
          <span className="eyebrow">TEK ALAN · BİRDEN FAZLA EKİP</span>
          <h2>Ekipler ve iş dağılımı</h2>
          <p>
            Kişiler birden fazla ekibe katılabilir. Ortak iş tek kayıttır; şirket toplamında bir kez sayılır.
          </p>
        </div>
        {admin && (
          <button className="button primary" onClick={() => onEdit()}>
            <PlusIcon size={16} />
            {' Ekip oluştur'}
          </button>
        )}
      </header>
      <div className="team-hub-grid">
        {state.teams.map((team) => {
          let matchingTasks = state.tasks.filter(
            (task) => taskTeamIds(task).includes(team.id) && !['done', 'cancelled'].includes(task.status),
          );
          let c = matchingTasks.filter((task) =>
            task.dueAt
              ? Date.parse(task.dueAt) < Date.now()
              : task.date && Date.parse(task.date + 'T23:59:59+03:00') < Date.now(),
          );
          let l = matchingTasks.filter((task) => !task.assignees.length);
          return (
            <article className={team.active ? '' : 'inactive'} key={team.id}>
              <div>
                <span className="team-monogram">
                  <UsersIcon size={20} />
                </span>
                <span className="role-badge">{team.active ? 'Aktif' : 'Pasif'}</span>
              </div>
              <h3>{team.name}</h3>
              <p>
                {
                  team.members.filter((member) =>
                    members.some((otherMember) => otherMember.email === member && otherMember.active === 1),
                  ).length
                }
                {' aktif kişi · Yönetici: '}
                {team.leads
                  .map((email) => members.find((member) => member.email === email)?.name || email)
                  .join(', ') || 'Belirlenmedi'}
              </p>
              <div className="team-numbers">
                <span>
                  <b>{matchingTasks.length}</b>Açık
                </span>
                <span>
                  <b>{c.length}</b>Geciken
                </span>
                <span>
                  <b>{l.length}</b>Havuzda
                </span>
              </div>
              <small>
                {'Varsayılan işler: '}
                {team.workTypes.join(', ') || 'Tanımlanmadı'}
              </small>
              <footer>
                <button className="text-button" onClick={() => onOpen(team.id)}>
                  {'Panoyu aç '}
                  <ArrowUpRightIcon size={13} />
                </button>
                {(admin || team.leads.includes(user)) && (
                  <button className="text-button" onClick={() => onEdit(team)}>
                    Düzenle
                  </button>
                )}
              </footer>
            </article>
          );
        })}
        {!state.teams.length && (
          <div className="empty-state light">
            <UsersIcon size={28} />
            <h3>İlk ekibi tanımla</h3>
            <p>Üyeleri rehbere ekledikten sonra ekiplerini oluştur.</p>
          </div>
        )}
      </div>
      <p className="form-footnote">
        Görünen işler erişim yetkine göredir. Ekip toplamları ortak işler nedeniyle birbirine eklenmez. Genel
        işler, ekip atanana kadar çalışma alanı üyelerince görülür.
      </p>
    </section>
  );
}
