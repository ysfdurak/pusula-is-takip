// Projeler, kararlar ve engeller. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { ProjectPortfolio } from '../components/ProjectPortfolio.jsx';
import { formatDate } from '../lib/format.js';
import { ArrowUpRightIcon, LayersIcon, PlusIcon } from 'lucide-react';
import { useApp } from '../AppContext.js';

export function RecordsPage() {
  const {
    canWrite,
    navigate,
    now,
    openModal,
    openTaskDetails,
    page,
    projectName,
    setDashboardProject,
    workspace,
  } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DİĞER ARAÇLAR</span>
          <h1>{page === 'projects' ? 'Projeler.' : page === 'decisions' ? 'Kararlar.' : 'Engeller.'}</h1>
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
              openModal(page === 'projects' ? 'project' : page === 'decisions' ? 'decision' : 'blocker')
            }
            disabled={page === 'decisions' && !workspace.projects.length}
          >
            <PlusIcon size={17} />
            {page === 'projects' ? 'Proje ekle' : page === 'decisions' ? 'Karar ekle' : 'Engel ekle'}
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
                    <button className="text-button" onClick={() => openModal('decision', decision)}>
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
  );
}
