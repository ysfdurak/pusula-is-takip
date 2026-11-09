import { ChevronDownIcon, UsersIcon } from 'lucide-react';

export function CardAssigneeControl({ task, members, user, name, onAssign, onChoose, disabled }) {
  let s =
    task.assignees.length === 0
      ? 'Sorumlu seç'
      : task.assignees.length === 1
        ? name(task.assignees[0])
        : task.assignees.length + ' kişi · Ortak';
  return (
    <label className="card-assignee-control">
      <UsersIcon size={13} />
      <span>{s}</span>
      <ChevronDownIcon size={12} />
      <select
        aria-label={task.title + ' sorumlularını değiştir'}
        title="Seçim mevcut sorumluların yerini alır"
        value="current"
        disabled={disabled}
        onChange={(event) => {
          let o = event.target.value;
          if (o === 'choose') {
            onChoose(task);
          } else {
            onAssign(
              task,
              o === 'me'
                ? [user]
                : o === 'all'
                  ? members.map((member) => member.email)
                  : o === 'none'
                    ? []
                    : [o],
            );
          }
        }}
      >
        <option value="current" disabled={true}>
          {s}
        </option>
        <option value="me">Bana ata</option>
        <option value="all">Tüm ekibe ata ({members.length})</option>
        <option value="choose">Birkaç kişi seç…</option>
        <option value="none">Atamayı kaldır</option>
        {members
          .filter((member) => member.email !== user)
          .map((member) => (
            <option value={member.email} key={member.email}>
              {member.name || member.email}
            </option>
          ))}
      </select>
    </label>
  );
}
