import { useState } from 'react';
import { ArrowUpRightIcon, LayersIcon, PlusIcon, SearchIcon, UserRoundIcon, UsersIcon } from 'lucide-react';

export function GlobalSearch({ state, name, onTask, onProject, onNavigate, onNew, writable }) {
  let [s, c] = useState('');
  let l = s.toLocaleLowerCase('tr').trim();
  let u = state.tasks
    .filter((task) =>
      [task.title, task.description, ...task.assignees.map(name)]
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(l),
    )
    .sort(
      (a, b) =>
        Number(b.title.toLocaleLowerCase('tr').includes(l)) -
          Number(a.title.toLocaleLowerCase('tr').includes(l)) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 20);
  let d = state.projects.filter((project) => project.name.toLocaleLowerCase('tr').includes(l)).slice(0, 5);
  return (
    <div className="global-search">
      <label className="global-search-input">
        <SearchIcon size={19} />
        <input
          autoFocus={true}
          aria-label="Tüm işlerde ara"
          placeholder="İş, kişi veya proje adı yaz…"
          value={s}
          onChange={(event) => c(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (u[0]) {
                onTask(u[0].id);
              }
            }
          }}
        />
      </label>
      {!l && (
        <div className="search-shortcuts">
          {writable && (
            <button type="button" onClick={onNew}>
              <PlusIcon size={16} />
              {' Yeni iş '}
              <kbd>Alt N</kbd>
            </button>
          )}
          <button type="button" onClick={() => onNavigate('mine')}>
            <UserRoundIcon size={16} />
            {' Benim panom'}
          </button>
          <button type="button" onClick={() => onNavigate('dashboard')}>
            <UsersIcon size={16} />
            {' Ekip panosu'}
          </button>
        </div>
      )}
      <div className="global-search-results">
        <span className="search-group-label">{l ? 'EŞLEŞEN İŞLER' : 'SON AÇILAN İŞLER'}</span>
        {u.map((task) => (
          <button type="button" onClick={() => onTask(task.id)} key={task.id}>
            <span className={'search-state ' + task.status} />
            <span>
              <strong>{task.title}</strong>
              <small>
                {task.assignees.map(name).join(', ') || 'Sorumlu yok'}
                {' · '}
                {
                  {
                    todo: 'Başlanmadı',
                    doing: 'Devam ediyor',
                    done: 'Tamamlandı',
                    cancelled: 'İptal',
                  }[task.status]
                }
              </small>
            </span>
            <ArrowUpRightIcon size={15} />
          </button>
        ))}
        {!u.length && <p className="search-no-results">Eşleşen iş yok.</p>}
        {d.length > 0 && (
          <>
            <span className="search-group-label">PROJELER</span>
            {d.map((e) => (
              <button type="button" onClick={() => onProject(e.id)} key={e.id}>
                <LayersIcon size={17} />
                <span>
                  <strong>{e.name}</strong>
                  <small>Proje panosuna git</small>
                </span>
                <ArrowUpRightIcon size={15} />
              </button>
            ))}
          </>
        )}
      </div>
      <p className="search-help">Enter: ilk işi aç · Esc: kapat · Ctrl / ⌘ K: aramayı aç</p>
    </div>
  );
}
