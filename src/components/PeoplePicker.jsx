import { useState } from 'react';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { Avatar } from './Avatar.jsx';

export function PeoplePicker({
  members,
  selected,
  onChange,
  single = false,
  label = 'Sorumlular',
  defaultOpen = false,
  teams = [],
}) {
  let [s, c] = useState(defaultOpen);
  let [l, u] = useState('');
  let [d, f] = useState('all');
  let [p, m] = useState('all');
  let matchingMembers = members.filter(
    (member) =>
      (p === 'all' || teams.some((team) => team.id === p && team.members.includes(member.email))) &&
      (d === 'all' || member.department === d) &&
      [member.name, member.email, member.department]
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(l.toLocaleLowerCase('tr')),
  );
  let g = (t) => members.find((member) => member.email === t)?.name || t;
  return (
    <div className="people-picker">
      <div className="label-row">
        <span>{label}</span>
        <small>{single ? 'Tek kişi' : selected.length + ' kişi seçili'}</small>
      </div>
      <button
        type="button"
        className={'people-trigger ' + (s ? 'expanded' : '')}
        aria-expanded={s}
        onClick={() => c(!s)}
      >
        <span className="selection-chips">
          {selected.length ? (
            selected.slice(0, 3).map((e) => (
              <span className="person-chip" key={e}>
                <Avatar name={g(e)} size="tiny" />
                {g(e)}
              </span>
            ))
          ) : (
            <span className="placeholder">{single ? 'Kim yapacak?' : 'Ekibinden kişileri seç'}</span>
          )}
          {selected.length > 3 && <b>+{selected.length - 3}</b>}
        </span>
        <ChevronDownIcon size={16} />
      </button>
      {s && (
        <div className="people-popover">
          <div className="picker-search">
            <SearchIcon size={16} />
            <input
              autoFocus={true}
              aria-label={label + ' için kişi ara'}
              placeholder="İsim veya e-posta ara"
              value={l}
              onChange={(event) => u(event.target.value)}
            />
          </div>
          {!single && (
            <div className="picker-tools">
              {teams.length > 0 && (
                <select
                  aria-label={label + ' ekip filtresi'}
                  value={p}
                  onChange={(event) => m(event.target.value)}
                >
                  <option value="all">Tüm ekipler</option>
                  {teams
                    .filter((team) => team.active)
                    .map((team) => (
                      <option value={team.id} key={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              )}
              <select
                aria-label={label + ' bölüm filtresi'}
                value={d}
                onChange={(event) => f(event.target.value)}
              >
                <option value="all">Tüm bölümler</option>
                {[...new Set(members.map((member) => member.department).filter(Boolean))].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <button type="button" onClick={() => onChange(members.map((member) => member.email))}>
                Tümünü seç
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange([...new Set([...selected, ...matchingMembers.map((member) => member.email)])])
                }
              >
                Görünenleri seç
              </button>
              <button type="button" onClick={() => onChange([])}>
                Temizle
              </button>
            </div>
          )}
          <div className="picker-options">
            {matchingMembers.map((member) => (
              <button
                type="button"
                className={'picker-option ' + (selected.includes(member.email) ? 'chosen' : '')}
                onClick={() => {
                  onChange(
                    selected.includes(member.email)
                      ? selected.filter((t) => t !== member.email)
                      : single
                        ? [member.email]
                        : [...selected, member.email],
                  );
                  if (single) {
                    c(false);
                  }
                }}
                key={member.email}
              >
                <Avatar name={member.name || member.email} />
                <span>
                  <strong>{member.name || member.email}</strong>
                  <small>{member.department || member.email}</small>
                </span>
                <span className="select-check">
                  {selected.includes(member.email) && <CheckIcon size={13} />}
                </span>
              </button>
            ))}
            {!matchingMembers.length && <p className="mini-empty">Uygun kişi bulunamadı.</p>}
          </div>
          <p className="picker-note">
            {label === 'Takipçiler'
              ? 'Takipçiler bu işteki gelişmeleri izler.'
              : 'Yalnızca aktif yönetici ve ekip üyelerine iş atanır. Seçim, mevcut kişileri kapsar.'}
          </p>
          <button type="button" className="picker-done" onClick={() => c(false)}>
            {'Seçimi bitir '}
            <CheckIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
