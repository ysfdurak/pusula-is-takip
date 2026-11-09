import { ArrowUpRightIcon, CalendarDaysIcon, LayersIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { projectSummaries } from '../lib/taskViews.js';

const PROJECT_HEALTH_LABELS = {
  empty: 'İş eklenmedi',
  cancelled: 'Tüm işler iptal',
  done: 'Tamamlandı',
  late: 'Gecikme var',
  risk: 'Dikkat gerekiyor',
  ontrack: 'Planlı ilerliyor',
};

export function ProjectPortfolio({ state, now, onOpen, onEdit, onTask, writable }) {
  let o = projectSummaries(state, now);
  return (
    <>
      <div className="portfolio-summary">
        <span>
          <b>{o.length}</b>
          {' proje'}
        </span>
        <span className="risk">
          <b>{o.filter((e) => ['late', 'risk'].includes(e.health)).length}</b>
          {' müdahale gerekiyor'}
        </span>
        <span>
          <b>{o.filter((e) => e.health === 'done').length}</b>
          {' tamamlandı'}
        </span>
      </div>
      <div className="portfolio-grid">
        {o.map((project) => (
          <article className={'project-overview ' + project.health} key={project.id}>
            <header>
              <span className="project-symbol">
                <LayersIcon size={20} />
              </span>
              <span className={'project-health ' + project.health}>
                {PROJECT_HEALTH_LABELS[project.health]}
              </span>
              {writable && (
                <button
                  className="icon-button"
                  aria-label={project.name + ' projesini düzenle'}
                  onClick={() => onEdit(project)}
                >
                  <PencilIcon size={15} />
                </button>
              )}
            </header>
            <h2>{project.name}</h2>
            <p>{project.goal || 'Proje amacı belirtilmedi.'}</p>
            <div className="project-progress-label">
              <span>
                {project.done}/{project.total - project.cancelled}
                {' iş tamamlandı'}
              </span>
              <strong>%{project.progress}</strong>
            </div>
            <div className="project-progress">
              <i
                style={{
                  width: project.progress + '%',
                }}
              />
            </div>
            <div className="project-counters">
              <span>
                <b>{project.open}</b>
                {' Açık'}
              </span>
              <span className={project.late ? 'attention' : ''}>
                <b>{project.late}</b>
                {' Geciken'}
              </span>
              <span className={project.blocked ? 'attention' : ''}>
                <b>{project.blocked}</b>
                {' Engelli'}
              </span>
            </div>
            <div className="project-plan-note">
              <CalendarDaysIcon size={14} />
              {project.date
                ? new Date(project.date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', {
                    timeZone: 'Europe/Istanbul',
                  })
                : 'Proje hedefi belirlenmedi'}
              {project.undated > 0 && (
                <span>
                  {project.undated}
                  {' iş terminsiz'}
                </span>
              )}
            </div>
            <details>
              <summary>Kapsam ve risk gerekçesi</summary>
              <p>{project.scope || 'Kapsam belirtilmedi.'}</p>
              <small>
                {'Kapsam dışında: '}
                {project.excluded || 'Belirtilmedi'}
              </small>
              <p className="project-risk-note">
                {project.late ? `${project.late} açık iş gecikmiş. ` : ''}
                {project.blocked ? `${project.blocked} işte açık engel / ön koşul var. ` : ''}
                {project.unassigned ? `${project.unassigned} iş sorumlu bekliyor. ` : ''}
                {project.undated ? `${project.undated} açık işin termini yok. ` : ''}
                {project.health === 'late' && !project.late ? 'Projenin hedef tarihi geçti. ' : ''}
                {project.health === 'ontrack'
                  ? 'Kayıtlı işlerde gecikme veya açık engel tespit edilmedi.'
                  : ''}
              </p>
              <small>
                Durum, kayıtlı işler ve tarihlerden hesaplanır; saha gerçekleşmesini ayrıca doğrula. İptaller
                tamamlanma paydasına dahil değildir ({project.cancelled}).
              </small>
            </details>
            <footer>
              <button className="button" onClick={() => onOpen(project.id)}>
                {'İş panosunu aç '}
                <ArrowUpRightIcon size={14} />
              </button>
              {writable && (
                <button
                  className="icon-button"
                  aria-label={project.name + ' projesine iş ekle'}
                  onClick={() => onTask(project.id)}
                >
                  <PlusIcon size={17} />
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
