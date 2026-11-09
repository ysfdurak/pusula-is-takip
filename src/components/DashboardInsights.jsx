import { useState } from 'react';
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  Clock3Icon,
  LayersIcon,
  LayoutDashboardIcon,
  PlusIcon,
  RotateCcwClockIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';

const DASHBOARD_STATUS_LABELS = {
  todo: 'Başlanmadı',
  doing: 'Devam ediyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
};

export function DashboardInsights(e) {
  let [t, n] = useState('count');
  let r = e.info;
  let i = (row) => (t === 'count' ? row.count : row.remainingMinutes);
  let a = Math.max(1, ...r.workload.map(i));
  let o = Object.values(r.states).reduce((sum, t) => sum + t, 0);
  let s = r.upcoming[0]?.tasks.length || 0;
  let c = 0;
  let l = ['#b6c5d2', '#4784bb', '#3c8967', '#a4a8ae'];
  let u = Object.entries(r.states)
    .map(([key, value], n) => {
      let r = c;
      c += o ? (value / o) * 360 : 0;
      return l[n] + ' ' + r + 'deg ' + c + 'deg';
    })
    .join(',');
  return (
    <>
      <div className="scope-switch" aria-label="Pano kapsamı">
        <button className={e.personal ? 'active' : ''} onClick={() => e.onScope(true)}>
          <UserRoundIcon size={17} />
          {' Benim panom'}
        </button>
        <button className={e.personal ? '' : 'active'} onClick={() => e.onScope(false)}>
          <UsersIcon size={18} />
          {' Ekip panosu'}
        </button>
      </div>
      <div className="page-heading ops-heading">
        <div>
          <span className="eyebrow">{e.personal ? 'BANA ATANAN TÜM İŞLER' : 'ORTAK ÇALIŞMA ALANI'}</span>
          <h1>{e.personal ? 'Bugün benim gündemim.' : 'Ekibin bir bakışta.'}</h1>
          <p>
            {e.personal
              ? 'Bireysel ve ortak işlerde sana atanan sorumluluklar.'
              : 'Ekibin tüm bireysel ve ortak işleri; tek bir akışta.'}
          </p>
        </div>
        <div className="dashboard-heading-actions">
          {!e.personal && (
            <button className="button" onClick={e.onProjects}>
              <LayersIcon size={16} />
              {' Proje özeti'}
            </button>
          )}
          <button className="button" onClick={e.onTemplates}>
            <LayersIcon size={16} />
            {' Şablondan'}
          </button>
          {e.writable && (
            <button className="button primary" onClick={e.onNew}>
              <PlusIcon size={17} />
              {' Yeni iş'}
            </button>
          )}
        </div>
      </div>
      {e.compact && e.children}
      <div className={'dashboard-controls ' + (e.compact ? 'daily-secondary' : '')}>
        <div>
          <select
            aria-label="Dashboard proje filtresi"
            value={e.project}
            onChange={(event) => e.onProject(event.target.value)}
          >
            <option value="all">Tüm operasyon</option>
            <option value="">Günlük operasyon</option>
            {e.projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Tamamlanma raporu dönemi"
            value={e.days}
            onChange={(event) => e.onDays(Number(event.target.value))}
          >
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
          </select>
        </div>
        <small>
          {e.personal ? 'Sadece bana atananlar' : 'Tüm ekip'}
          {' · Tamamlananlar seçili döneme göre'}
        </small>
      </div>
      <section className={'ops-kpis ' + (e.compact ? 'daily-compact-kpis' : '')}>
        <button onClick={() => e.onDrill('open')}>
          <span>
            <LayoutDashboardIcon size={17} />
            {' Açık iş'}
          </span>
          <strong>{r.open.length}</strong>
          <small>
            {r.states.doing}
            {' devam ediyor '}
            <ArrowUpRightIcon size={13} />
          </small>
        </button>
        <button className="late-kpi" onClick={() => e.onDrill('late')}>
          <span>
            <Clock3Icon size={17} />
            {' Geciken'}
          </span>
          <strong>{r.late.length}</strong>
          <small>
            {'Gecikmenin nedenini incele '}
            <ArrowUpRightIcon size={13} />
          </small>
        </button>
        <button onClick={() => e.onDrill('due', '', r.today)}>
          <span>
            <CalendarDaysIcon size={17} />
            {' Bugün teslim'}
          </span>
          <strong>{s}</strong>
          <small>
            {'Bugün hedeflenen açık işler '}
            <ArrowUpRightIcon size={13} />
          </small>
        </button>
        <button className="completed-kpi" onClick={() => e.onDrill('periodDone')}>
          <span>
            <CheckCheckIcon size={17} />
            {' Tamamlanan'}
          </span>
          <strong>{r.completed.length}</strong>
          <small>
            {'Son '}
            {e.days}
            {' günde '}
            <ArrowUpRightIcon size={13} />
          </small>
        </button>
      </section>
      {(r.late.length > 0 || r.unassigned.length > 0) && (
        <div className="ops-attention">
          <Clock3Icon size={18} />
          <span>
            {r.late.length > 0 ? (
              <>
                <strong>
                  {r.late.length}
                  {' geciken iş'}
                </strong>
                {' var. İlk hedef tarih ve tüm revizyonlar korunur.'}
              </>
            ) : (
              <>
                <strong>
                  {r.unassigned.length}
                  {' iş'}
                </strong>
                {' sorumlu bekliyor.'}
              </>
            )}
          </span>
          <button onClick={() => e.onDrill(r.late.length ? 'late' : 'unassigned')}>
            {'İşleri incele '}
            <ChevronRightIcon size={15} />
          </button>
        </div>
      )}
      <div className={'baseline-summary ' + (e.compact ? 'daily-secondary' : '')}>
        <span>
          <RotateCcwClockIcon size={16} />
          <strong>İlk planı da takip et</strong>
        </span>
        <button onClick={() => e.onDrill('originalLate')}>
          <b>{r.originalLate.length}</b>
          {' açık iş ilk termini geçti '}
          <ArrowUpRightIcon size={13} />
        </button>
        <button onClick={() => e.onDrill('rescheduled')}>
          <b>{r.rescheduled.length}</b>
          {' işte termin değişti '}
          <ArrowUpRightIcon size={13} />
        </button>
      </div>
      {!e.compact && e.children}
      <details className="ops-analytics" open={!e.personal}>
        <summary>
          {'Dağılım ve teslim takvimi '}
          <ChevronRightIcon size={17} />
        </summary>
        <div className="ops-insight-grid">
          <section className="ops-insight">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">STATÜ DAĞILIMI</span>
                <h2>İşlerin genel görünümü</h2>
              </div>
            </div>
            <div className="donut-layout">
              <div
                className="ops-donut"
                style={{
                  background: o ? 'conic-gradient(' + u + ')' : '#e9eef1',
                }}
                role="img"
                aria-label={Object.entries(r.states)
                  .map(([key, value]) => DASHBOARD_STATUS_LABELS[key] + ': ' + value)
                  .join(', ')}
              >
                <span>
                  <strong>{o}</strong>
                  <small>toplam iş</small>
                </span>
              </div>
              <div className="donut-legend">
                {Object.entries(r.states).map(([key, value], r) => (
                  <button onClick={() => e.onDrill('status:' + key)} key={key}>
                    <i
                      style={{
                        background: l[r],
                      }}
                    />
                    <span>{DASHBOARD_STATUS_LABELS[key]}</span>
                    <b>{value}</b>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="ops-insight">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ÖNÜMÜZDEKİ 7 GÜN</span>
                <h2>Teslim takvimi</h2>
              </div>
              <CalendarDaysIcon size={18} />
            </div>
            <div className="ops-due-week">
              {r.upcoming.map((day, index) => (
                <button
                  className={day.tasks.length ? 'has-tasks' : ''}
                  onClick={() => e.onDrill('due', '', day.date)}
                  key={day.date}
                >
                  <small>
                    {index === 0
                      ? 'Bugün'
                      : new Date(day.date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', {
                          weekday: 'short',
                          timeZone: 'Europe/Istanbul',
                        })}
                  </small>
                  <strong>{day.date.slice(-2)}</strong>
                  <b>{day.tasks.length}</b>
                </button>
              ))}
            </div>
            <p className="chart-footnote">
              {r.undated.length}
              {' açık işte termin yok. '}
              <button onClick={() => e.onDrill('undated')}>Görüntüle</button>
            </p>
            <div className="delivery-comparison">
              <span>
                {'Zamanında tamamlanan '}
                <small>
                  {'Son '}
                  {e.days}
                  {' gün · Termin verisi olan işler'}
                </small>
              </span>
              <div>
                <span>
                  İlk termine göre
                  <strong>
                    {r.originalDated.length ? r.originalOnTime.length + '/' + r.originalDated.length : '—'}
                  </strong>
                </span>
                <span>
                  Güncel termine göre
                  <strong>
                    {r.datedCompleted.length ? r.onTime.length + '/' + r.datedCompleted.length : '—'}
                  </strong>
                </span>
              </div>
              <small>
                {'İlk tarihi bilinmeyen '}
                {r.completed.length - r.originalDated.length}
                {' iş ilk termin hesabına katılmadı.'}
              </small>
            </div>
          </section>
          {!e.personal && (
            <section className="ops-insight workload-compact">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">AÇIK İŞLER</span>
                  <h2>Ekipte iş dağılımı</h2>
                </div>
                <UsersIcon size={18} />
              </div>
              <label className="workload-metric">
                Ölçüm
                <select aria-label="İş dağılımı ölçümü" value={t} onChange={(event) => n(event.target.value)}>
                  <option value="count">Açık iş sayısı</option>
                  <option value="effort">Kalan tahmini emek</option>
                </select>
              </label>
              {r.workload.map((row) => (
                <button className="load-line" onClick={() => e.onDrill('open', row.email)} key={row.email}>
                  <span>
                    <strong>{row.name || row.email}</strong>
                    <small>{row.late ? row.late + ' geciken' : 'Geciken iş yok'}</small>
                  </span>
                  <i>
                    <b
                      style={{
                        width: (i(row) / a) * 100 + '%',
                      }}
                    />
                  </i>
                  <strong>
                    {t === 'count' ? row.count : row.estimatedJobs ? row.remainingMinutes : '—'}
                  </strong>
                </button>
              ))}
              <p className="chart-footnote">
                {t === 'count'
                  ? 'Ortak iş, her sorumluda bir iş sayılır.'
                  : 'Kişi-dakika. Toplam tahmin ortak işte eşit bölünür; kaydedilen emek düşülür. Tahmini olmayan işler hesaba katılmaz. Bu görünüm müsaitlik / kapasite hesabı değildir.'}
              </p>
            </section>
          )}
        </div>
      </details>
    </>
  );
}
