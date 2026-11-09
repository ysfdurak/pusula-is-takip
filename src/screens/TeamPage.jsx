// Ekipler ve kişiler. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { Avatar } from '../components/Avatar.jsx';
import { TeamHub } from '../components/TeamHub.jsx';
import { newId } from '../lib/format.js';
import { ROLE_LABELS } from '../lib/labels.js';
import { ArrowUpRightIcon, EyeIcon, PencilIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useApp } from '../AppContext.js';

export function TeamPage() {
  const {
    activeMembers,
    isOpen,
    memberName,
    members,
    navigate,
    openModal,
    role,
    searchQuery,
    setAssigneeFilter,
    setFiltersOpen,
    setFocusView,
    setSearchQuery,
    setTeamScope,
    user,
    workspace,
  } = useApp();
  return (
    <>
      <TeamHub
        user={user}
        state={workspace}
        members={members}
        admin={role === 'owner'}
        onEdit={(e) =>
          openModal(
            'group',
            e || {
              id: newId(),
              name: '',
              members: [],
              leads: [],
              active: true,
              workTypes: [],
            },
          )
        }
        onOpen={(e) => {
          navigate('dashboard');
          setTeamScope(e);
          setFocusView('board');
        }}
      />
      <div className="page-heading">
        <div>
          <span className="eyebrow">BİRLİKTE ÇALIŞTIĞIN KİŞİLER</span>
          <h1>Kişi rehberi.</h1>
          <p>İşleri isimlerine göre ata. Kimin üzerinde ne var, kolayca gör.</p>
        </div>
        {role === 'owner' && (
          <button className="button primary" onClick={() => openModal('member')}>
            <PlusIcon size={18} />
            {' Üye ekle'}
          </button>
        )}
      </div>
      <div className="team-topline">
        <span>
          <strong>{activeMembers.length}</strong>
          {' aktif ekip üyesi'}
        </span>
        <label className="search-box">
          <SearchIcon size={16} />
          <input
            aria-label="Ekipte ara"
            placeholder="İsim veya bölüm ara"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="team-grid">
        {members
          .filter((member) =>
            [member.name, member.email, member.department]
              .join(' ')
              .toLocaleLowerCase('tr')
              .includes(searchQuery.toLocaleLowerCase('tr')),
          )
          .map((member) => {
            let n = workspace.tasks.filter(
              (task) => task.assignees.includes(member.email) && isOpen(task),
            ).length;
            return (
              <article className={'member-card ' + (member.active ? '' : 'inactive')} key={member.email}>
                <div className="member-card-head">
                  <Avatar name={memberName(member.email)} size="large" />
                  {role === 'owner' && (
                    <button
                      className="icon-button"
                      aria-label={memberName(member.email) + ' bilgilerini düzenle'}
                      onClick={() => openModal('member', member)}
                    >
                      <PencilIcon size={15} />
                    </button>
                  )}
                </div>
                <h2>
                  {memberName(member.email)}
                  {member.email === user && <span>Sen</span>}
                </h2>
                <p>{member.department || 'Bölüm belirtilmedi'}</p>
                <small>{member.email}</small>
                <div className="member-card-bottom">
                  <span className="role-badge">{member.active ? ROLE_LABELS[member.role] : 'Pasif'}</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      navigate('tasks');
                      setAssigneeFilter(member.email);
                      setFiltersOpen(true);
                    }}
                  >
                    {n}
                    {' açık iş '}
                    <ArrowUpRightIcon size={13} />
                  </button>
                </div>
              </article>
            );
          })}
        {role === 'owner' && (
          <button className="add-member-card" onClick={() => openModal('member')}>
            <span>
              <PlusIcon size={25} />
            </span>
            <strong>Ekibine birini ekle</strong>
            <small>Ad, e-posta ve bölüm yeterli.</small>
          </button>
        )}
      </div>
      <p className="footnote">
        <EyeIcon size={14} />
        {' Üye tanımı iş atamasını sağlar. Bu özel yayına giriş için site paylaşım erişimi de verilmelidir.'}
      </p>
    </>
  );
}
