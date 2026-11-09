import { useState } from 'react';

export function TeamEditor({ team, members, onChange }) {
  let [r, i] = useState('');
  return (
    <>
      <label className="form-label">
        Ekip adı
        <input
          required={true}
          maxLength={120}
          value={team.name}
          onChange={(event) =>
            onChange({
              ...team,
              name: event.target.value,
            })
          }
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={team.active}
          onChange={(event) =>
            onChange({
              ...team,
              active: event.target.checked,
            })
          }
        />
        {' Ekip aktif'}
      </label>
      <label className="form-label">
        Üyelerde ara
        <input value={r} onChange={(event) => i(event.target.value)} placeholder="İsim veya e-posta" />
      </label>
      <div className="team-members-table">
        {members
          .filter((member) => member.active || team.members.includes(member.email))
          .filter((member) =>
            (member.name + ' ' + member.email).toLocaleLowerCase('tr').includes(r.toLocaleLowerCase('tr')),
          )
          .map((member) => (
            <div key={member.email}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={team.members.includes(member.email)}
                  disabled={!member.active && !team.members.includes(member.email)}
                  onChange={(event) =>
                    onChange({
                      ...team,
                      members: event.target.checked
                        ? [...team.members, member.email]
                        : team.members.filter((e) => e !== member.email),
                      leads: event.target.checked
                        ? team.leads
                        : team.leads.filter((email) => email !== member.email),
                    })
                  }
                />
                <span>
                  {member.name || member.email}
                  <small>
                    {member.active
                      ? member.role === 'viewer'
                        ? 'Görüntüleyici'
                        : 'İş alabilir'
                      : 'Pasif kişi'}
                  </small>
                </span>
              </label>
              {member.role !== 'viewer' && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    aria-label={member.name + ' ekip yöneticisi'}
                    disabled={!team.members.includes(member.email) || !member.active}
                    checked={team.leads.includes(member.email)}
                    onChange={(event) =>
                      onChange({
                        ...team,
                        leads: event.target.checked
                          ? [...team.leads, member.email]
                          : team.leads.filter((email) => email !== member.email),
                      })
                    }
                  />
                  {' Ekip yöneticisi'}
                </label>
              )}
            </div>
          ))}
      </div>
      <label className="form-label">
        Bu ekibe yönlendirilecek iş türleri
        <textarea
          value={team.workTypes.join('\n')}
          onChange={(event) =>
            onChange({
              ...team,
              workTypes: event.target.value.split('\n'),
            })
          }
          placeholder={'Her satıra bir tür: Sevkiyat\nİade'}
        />
        <small>Tür seçilince ana ekip önerilir. Kullanıcı kayıttan önce değiştirebilir.</small>
      </label>
      <p className="form-footnote">
        Ekip yöneticileri ekip işlerini düzenler ve atar. Ekip yöneticileri kendi ekiplerinin üyeliklerini
        yönetir. Çalışma alanı yöneticisi bütün ekipleri ve genel ayarları yönetir. Görüntüleyici rolü
        düzenleme yetkisi kazanmaz.
      </p>
    </>
  );
}
