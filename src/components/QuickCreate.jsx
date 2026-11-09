import { useEffect, useRef, useState } from 'react';
import { CalendarDaysIcon, CornerDownLeftIcon, LayersIcon, PlusIcon } from 'lucide-react';
import { EMPTY_QUICK_DRAFT, istanbulDay } from '../lib/taskViews.js';

export function QuickCreate({
  draft,
  onDraft,
  onCreate,
  members,
  user,
  templates,
  busy,
  dueRequired,
  context,
  teams,
  initialTeam,
}) {
  let [d, f] = useState(draft || EMPTY_QUICK_DRAFT);
  let [p, m] = useState('');
  let [h, g] = useState(false);
  let _ = useRef(false);
  let v = useRef(null);
  let y = useRef(false);
  useEffect(() => {
    if (y.current && !busy && !h) {
      v.current?.focus();
      y.current = false;
    }
  }, [busy, h]);
  let b = d.teamId ?? initialTeam;
  let x = b
    ? members.filter((member) => teams.some((team) => team.id === b && team.members.includes(member.email)))
    : members;
  let ee = (e) => {
    let n = {
      ...d,
      ...e,
    };
    f(n);
    onDraft(n);
    m('');
  };
  async function C(event) {
    if ((event.preventDefault(), !(_.current || busy || !d.title.trim()))) {
      _.current = true;
      g(true);
      m('');
      try {
        await onCreate(d);
        let e = {
          ...d,
          title: '',
          date: '',
        };
        f(e);
        onDraft(e);
        y.current = true;
      } catch (err) {
        m(err.message);
      } finally {
        _.current = false;
        g(false);
      }
    }
  }
  return (
    <section className="quick-create">
      <header>
        <span>
          <PlusIcon size={17} />
          <strong>Hızlı iş ekle</strong>
        </span>
        <small>
          {teams.find((team) => team.id === b)?.name || 'Genel işler'}
          {' · '}
          {context}
          {' · Başlangıç bugün'}
        </small>
      </header>
      <form onSubmit={C}>
        <fieldset disabled={busy || h}>
          <div className="quick-create-main">
            <input
              ref={v}
              aria-label="Hızlı iş adı"
              placeholder="Ne yapılacak? Yaz ve Enter’a bas…"
              value={d.title}
              onChange={(event) =>
                ee({
                  title: event.target.value,
                })
              }
              maxLength={4e3}
              required={true}
            />
            <button className="button primary" disabled={!d.title.trim() || busy || h} type="submit">
              <PlusIcon size={16} />
              {h ? 'Ekleniyor…' : 'Ekle'}
              <CornerDownLeftIcon size={13} />
            </button>
          </div>
          <details className="quick-config" open={dueRequired || undefined}>
            <summary>
              {'Ekip, sorumlu, tarih ve şablon '}
              <span>
                {teams.find((team) => team.id === b)?.name || 'Genel işler'}
                {' · '}
                {d.assignment === 'pool'
                  ? 'Ekip havuzu'
                  : d.assignment === 'me'
                    ? 'Bana ata'
                    : d.assignment === 'all'
                      ? 'Tüm ekip'
                      : d.assignment === 'none'
                        ? 'Sonra atanacak'
                        : d.assignment === 'template'
                          ? 'Şablondaki kişiler'
                          : members.find((member) => member.email === d.assignment)?.name || d.assignment}
              </span>
            </summary>
            <div className="quick-create-options">
              {teams.length > 0 && (
                <label>
                  Ekip
                  <select
                    aria-label="Hızlı iş ekibi"
                    value={b}
                    onChange={(event) =>
                      ee({
                        teamId: event.target.value,
                        assignment: event.target.value ? 'pool' : 'me',
                      })
                    }
                  >
                    <option value="">Genel işler</option>
                    {teams
                      .filter((team) => team.active)
                      .map((team) => (
                        <option value={team.id} key={team.id}>
                          {team.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {teams.some((team) => team.workTypes.length > 0) && (
                <label>
                  İş türü
                  <select
                    aria-label="Hızlı iş türü"
                    value={d.workType || ''}
                    onChange={(event) => {
                      let team = teams.find(
                        (team) => team.active && team.workTypes.includes(event.target.value),
                      );
                      ee({
                        workType: event.target.value,
                        teamId: team?.id || b,
                        assignment: team ? 'pool' : d.assignment,
                      });
                    }}
                  >
                    <option value="">Seçilmedi</option>
                    {[...new Set(teams.filter((team) => team.active).flatMap((team) => team.workTypes))].map(
                      (e) => (
                        <option key={e}>{e}</option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label>
                Sorumlu
                <select
                  aria-label="Hızlı iş sorumlusu"
                  value={d.assignment}
                  onChange={(event) =>
                    ee({
                      assignment: event.target.value,
                    })
                  }
                >
                  <option value="me">Bana ata</option>
                  <option value="all">
                    {b ? 'Tüm ekibe ata' : 'Alandaki herkese ata'}
                    {' ('}
                    {x.length})
                  </option>
                  {b && <option value="pool">Ekip havuzuna bırak</option>}
                  <option value="none">Sonra atayacağım</option>
                  {d.template && <option value="template">Şablondaki kişiler</option>}
                  {x
                    .filter((e) => e.email !== user)
                    .map((e) => (
                      <option value={e.email} key={e.email}>
                        {e.name || e.email}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>
                  <CalendarDaysIcon size={12} />
                  {dueRequired ? 'Termin gerekli' : 'Termin (isteğe bağlı)'}
                </span>
                <input
                  aria-label="Hızlı iş termini"
                  type="date"
                  value={d.date}
                  required={dueRequired}
                  onInvalid={(event) => {
                    let t = event.currentTarget.closest('details');
                    if (t) {
                      t.open = true;
                    }
                  }}
                  onChange={(event) =>
                    ee({
                      date: event.target.value,
                    })
                  }
                />
              </label>
              <div className="quick-date-buttons">
                <button
                  type="button"
                  onClick={() =>
                    ee({
                      date: istanbulDay(Date.now()),
                    })
                  }
                >
                  Bugün
                </button>
                <button
                  type="button"
                  onClick={() =>
                    ee({
                      date: istanbulDay(Date.now() + 864e5),
                    })
                  }
                >
                  Yarın
                </button>
                {d.date && !dueRequired && (
                  <button
                    type="button"
                    onClick={() =>
                      ee({
                        date: '',
                      })
                    }
                  >
                    Tarihsiz
                  </button>
                )}
              </div>
              {templates.length > 0 && (
                <label>
                  <span>
                    <LayersIcon size={12} />
                    Şablon
                  </span>
                  <select
                    aria-label="Hızlı iş şablonu"
                    value={d.template}
                    onChange={(event) => {
                      let template = templates.find((template) => template.id === event.target.value);
                      ee({
                        template: event.target.value,
                        title: template?.task.title || d.title,
                        assignment: template ? 'template' : 'me',
                        teamId: template?.task.teamId || b,
                        workType: template?.task.workType || '',
                        date: '',
                      });
                    }}
                  >
                    <option value="">Şablonsuz</option>
                    {templates.map((template) => (
                      <option value={template.id} key={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </details>
          {d.template && (
            <p className="quick-template-note">
              {templates.find((template) => template.id === d.template)?.task.checklist.length || 0}
              {' kontrol adımı şablondan gelir; önceki tarihler ve tamamlanmalar taşınmaz.'}
            </p>
          )}
          {p && (
            <p className="quick-error" role="alert">
              {p}
            </p>
          )}
        </fieldset>
      </form>
      <p className="quick-footnote">
        Açıklama ve diğer ayrıntıları sonra ekleyebilirsin. Pano değiştirip döndüğünde hızlı giriş taslağın
        korunur.
      </p>
    </section>
  );
}
