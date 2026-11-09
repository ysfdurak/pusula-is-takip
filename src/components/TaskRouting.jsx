export function TaskRouting({ task, state, teams, members, onChange }) {
  return (
    <div className="task-routing">
      <div className="form-two">
        <label className="form-label">
          Ana ekip
          <select
            aria-label="İşin ana ekibi"
            value={task.teamId}
            onChange={(event) =>
              onChange({
                ...task,
                teamId: event.target.value,
                relatedTeamIds: task.relatedTeamIds.filter(
                  (teamId) => teamId !== event.target.value && !!event.target.value,
                ),
              })
            }
          >
            <option value="">Genel işler (alan üyeleri görür)</option>
            {teams
              .filter((team) => team.active || team.id === task.teamId)
              .map((team) => (
                <option value={team.id} key={team.id}>
                  {team.name}
                  {team.active ? '' : ' · Pasif'}
                </option>
              ))}
          </select>
        </label>
        <label className="form-label">
          İş türü
          <select
            value={task.workType}
            onChange={(event) => {
              let team = state.teams.find(
                (team) =>
                  team.active &&
                  team.workTypes.includes(event.target.value) &&
                  teams.some((t) => t.id === team.id),
              );
              onChange({
                ...task,
                workType: event.target.value,
                teamId: team?.id || task.teamId,
                relatedTeamIds: task.relatedTeamIds.filter((teamId) => teamId !== team?.id),
              });
            }}
          >
            <option value="">Seçilmedi</option>
            {[
              ...new Set(
                [
                  ...state.teams
                    .filter((team) => teams.some((t) => t.id === team.id))
                    .flatMap((team) => team.workTypes),
                  task.workType,
                ].filter(Boolean),
              ),
            ].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>
      <details className="form-details">
        <summary>Ekipler arası ortak çalışma</summary>
        <p className="form-footnote">
          İlgili ekiplerin panosunda aynı kayıt görünür. Bu ekiplerin üyeleri işe erişebilir. Üye olmadığın
          ekipleri yalnızca çalışma alanı yöneticisi ekleyebilir.
        </p>
        {task.teamId &&
          teams
            .filter((team) => team.active && team.id !== task.teamId)
            .map((team) => (
              <label className="check-label" key={team.id}>
                <input
                  type="checkbox"
                  checked={task.relatedTeamIds.includes(team.id)}
                  onChange={(event) =>
                    onChange({
                      ...task,
                      relatedTeamIds: event.target.checked
                        ? [...task.relatedTeamIds, team.id]
                        : task.relatedTeamIds.filter((teamId) => teamId !== team.id),
                    })
                  }
                />
                {team.name}
              </label>
            ))}
        <label className="form-label">
          Koordinatör (isteğe bağlı)
          <select
            value={task.coordinator}
            onChange={(event) =>
              onChange({
                ...task,
                coordinator: event.target.value,
              })
            }
          >
            <option value="">Belirlenmedi</option>
            {members
              .filter((member) => member.active && member.role !== 'viewer')
              .map((member) => (
                <option value={member.email} key={member.email}>
                  {member.name || member.email}
                </option>
              ))}
          </select>
          <small>Koordinatör işin takibini üstlenir; tek başına tamamlanma sorumlusu yerine geçmez.</small>
        </label>
      </details>
    </div>
  );
}
