// Tüm formlar ve pencereler (yeni iş, revizyon, engel, üye…). App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { DateShortcuts } from '../components/DateShortcuts.jsx';
import { GlobalSearch } from '../components/GlobalSearch.jsx';
import { PeoplePicker } from '../components/PeoplePicker.jsx';
import { TaskRouting } from '../components/TaskRouting.jsx';
import { TeamEditor } from '../components/TeamEditor.jsx';
import { trapFocus } from '../lib/focusTrap.js';
import { formatDateTime, fromDateTimeInput, toDateTimeInput } from '../lib/format.js';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '../lib/labels.js';
import { completionIssues, taskObstacles } from '../lib/taskViews.js';
import { WAITING_REASON_LABELS, taskTeamIds } from '../shared/workspaceModel.js';
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GitBranchIcon,
  LayersIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { useApp } from '../AppContext.js';

export function ModalHost() {
  const {
    activeMembers,
    assignableMembers,
    assigneesForTask,
    busy,
    canWrite,
    closeModal,
    createFromTemplate,
    demo,
    error,
    inputField,
    isScheduleValid,
    mailConfigured,
    memberName,
    members,
    modal,
    myTeams,
    navigate,
    openModal,
    openTaskDetails,
    remoteChanged,
    role,
    setDashboardProject,
    setModal,
    setOpenTaskId,
    startDemoConflict,
    submitModal,
    textareaField,
    user,
    withDueDate,
    workspace,
  } = useApp();
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          closeModal();
        }
      }}
    >
      <section
        className={'modal ' + (modal.type === 'task' ? 'task-form-modal' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={trapFocus}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">{modal.type === 'task' ? 'İŞİ NETLEŞTİR' : 'PUSULA'}</span>
            <h2 id="modal-title">
              {modal.type === 'task'
                ? workspace.tasks.some((task) => task.id === modal.item.id)
                  ? 'İşi düzenle'
                  : 'Yeni iş oluştur'
                : modal.type === 'member'
                  ? modal.item.email
                    ? 'Ekip üyesini düzenle'
                    : 'Ekibine birini ekle'
                  : modal.type === 'group'
                    ? 'Ekip tanımı'
                    : modal.type === 'waiting'
                      ? 'Bekleme nedeni'
                      : modal.type === 'search'
                        ? 'Bul ve devam et'
                        : modal.type === 'complete'
                          ? 'İşi tamamla'
                          : modal.type === 'guide'
                            ? 'Pusula nasıl kullanılır?'
                            : modal.type === 'resetDemo'
                              ? 'Örnekleri başa al'
                              : modal.type === 'templates'
                                ? 'İş şablonları'
                                : modal.type === 'template'
                                  ? 'Şablon olarak kaydet'
                                  : modal.type === 'workRules'
                                    ? 'Termin kuralları'
                                    : modal.type === 'reschedule'
                                      ? 'Termini revize et'
                                      : modal.type === 'bulk'
                                        ? 'Seçilen işleri güncelle'
                                        : modal.type === 'workspace'
                                          ? 'Çalışma alanı oluştur'
                                          : modal.type === 'people'
                                            ? 'Kimler yapacak?'
                                            : modal.type === 'time'
                                              ? 'Harcanan süreyi ekle'
                                              : modal.type === 'project'
                                                ? 'Proje çerçevesi'
                                                : modal.type === 'decision'
                                                  ? 'Karar kaydı'
                                                  : 'Engel kaydı'}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Formu kapat"
            autoFocus={modal.type !== 'task'}
            disabled={busy}
            onClick={closeModal}
          >
            <XIcon size={20} />
          </button>
        </header>
        <form
          onSubmit={(e) => {
            if (modal.type === 'search') {
              e.preventDefault();
              return;
            }
            submitModal(e);
          }}
        >
          <fieldset disabled={busy}>
            {remoteChanged && (
              <p className="form-sync-note">
                Ekipte yeni değişiklik var. Formun korunuyor; kaydederken güncel değerlerle karşılaştırılacak.
              </p>
            )}
            {modal.type === 'group' && (
              <TeamEditor
                team={modal.item}
                members={members}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    item: e,
                  })
                }
              />
            )}
            {modal.type === 'waiting' && (
              <>
                <p className="form-intro">
                  {modal.item.title}
                  {' · Ana statü değişmez; bekleme bilgisi ayrıca izlenir.'}
                </p>
                <label className="form-label">
                  Neden
                  <select
                    aria-label="Bekleme nedeni"
                    value={modal.item.waitingReason}
                    onChange={(event) =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          waitingReason: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Beklemiyor / bekleme bitti</option>
                    {Object.entries(WAITING_REASON_LABELS).map(([key, value]) => (
                      <option value={key} key={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                {modal.item.waitingReason && (
                  <label className="form-label">
                    Kısa açıklama
                    <textarea
                      required={true}
                      maxLength={1e3}
                      value={modal.item.waitingNote}
                      onChange={(event) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            waitingNote: event.target.value,
                          },
                        })
                      }
                      placeholder="Kimden ne bekleniyor?"
                    />
                  </label>
                )}
              </>
            )}
            {modal.type === 'search' && (
              <GlobalSearch
                state={workspace}
                name={memberName}
                writable={canWrite}
                onTask={(e) => {
                  closeModal();
                  openTaskDetails(e);
                }}
                onProject={(e) => {
                  closeModal();
                  setOpenTaskId('');
                  navigate('dashboard');
                  setDashboardProject(e);
                }}
                onNavigate={(e) => {
                  closeModal();
                  setOpenTaskId('');
                  navigate(e);
                }}
                onNew={() => openModal('task')}
              />
            )}
            {modal.type === 'complete' && (
              <div className="complete-review">
                <p className="form-intro">{modal.item.title}</p>
                {taskObstacles(modal.item, workspace).length > 0 && (
                  <div className="completion-blockers">
                    <strong>Önce çözülmesi gerekenler</strong>
                    {taskObstacles(modal.item, workspace).map((e, t) => (
                      <p key={t}>{e}</p>
                    ))}
                  </div>
                )}
                {modal.item.checklist.length > 0 && (
                  <section>
                    <h3>
                      {'Kontrol adımları '}
                      {modal.item.checklistRequired ? '(zorunlu)' : '(isteğe bağlı)'}
                    </h3>
                    {modal.item.checklist.map((step) => (
                      <label className="check-label" key={step.id}>
                        <input
                          type="checkbox"
                          checked={step.done}
                          onChange={(event) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                checklist: modal.item.checklist.map((n) =>
                                  n.id === step.id
                                    ? {
                                        ...n,
                                        done: event.target.checked,
                                      }
                                    : n,
                                ),
                              },
                            })
                          }
                        />
                        {step.text}
                      </label>
                    ))}
                  </section>
                )}
                {modal.item.waitingReason && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      onChange={(event) => {
                        if (event.target.checked) {
                          setModal({
                            ...modal,
                            item: {
                              ...modal.item,
                              waitingReason: '',
                              waitingNote: '',
                            },
                          });
                        }
                      }}
                    />
                    {' Bekleme sona erdi'}
                  </label>
                )}
                {modal.item.requireApproval && (
                  <section>
                    <h3>Kabul kontrolü</h3>
                    <p>{modal.item.criteria || 'Bu işin kabul ölçütü henüz tanımlanmadı.'}</p>
                    {modal.item.criteria && (
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={modal.item.verified}
                          onChange={(event) =>
                            setModal({
                              ...modal,
                              item: {
                                ...modal.item,
                                verified: event.target.checked,
                              },
                            })
                          }
                        />
                        {' Kabul ölçütünü doğruladım'}
                      </label>
                    )}
                  </section>
                )}
                {completionIssues(modal.item, workspace).length > 0 && (
                  <p className="completion-hint">{completionIssues(modal.item, workspace).join(' ')}</p>
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    let e = modal.item.id;
                    closeModal();
                    openTaskDetails(e);
                  }}
                >
                  {'İşin ayrıntısına git '}
                  <ArrowUpRightIcon size={14} />
                </button>
              </div>
            )}
            {modal.type === 'guide' && (
              <div className="usage-guide">
                <p className="form-intro">Günlük işlerini bu sırayla yürütebilirsin.</p>
                {[
                  [
                    '1',
                    'Ekibini tanımla',
                    'İsim, e-posta ve bölüm ekle. İş atayacağın kişileri rehberden seç.',
                    'team',
                  ],
                  [
                    '2',
                    'İşi netleştir',
                    'Başlığı yaz, tek veya ortak sorumluları seç, gerekiyorsa tarih ve kontrol adımları ekle.',
                    'tasks',
                  ],
                  [
                    '3',
                    'Birlikte ilerlet',
                    'İşin yan panelinde durumunu değiştir, yorum paylaş ve kontrol adımlarını tamamla.',
                    'mine',
                  ],
                  [
                    '4',
                    'Operasyonu izle',
                    'Panodan geciken, sahipsiz ve kontrol bekleyen işlere müdahale et.',
                    'dashboard',
                  ],
                  [
                    '5',
                    'Gelişmeleri kaçırma',
                    'Atama, yorum ve durum bildirimlerini Bildirimler ekranından izle.',
                    'notifications',
                  ],
                ].map(([e, t, n, r]) => (
                  <button
                    className="guide-step"
                    type="button"
                    onClick={() => {
                      closeModal();
                      navigate(r);
                    }}
                    key={e}
                  >
                    <b>{e}</b>
                    <span>
                      <strong>{t}</strong>
                      <small>{n}</small>
                    </span>
                    <ChevronRightIcon size={16} />
                  </button>
                ))}
                <>
                  {demo && canWrite && (
                    <button
                      type="button"
                      className="button demo-conflict-trigger"
                      onClick={startDemoConflict}
                    >
                      <GitBranchIcon size={16} />
                      {' Örnek düzenleme çakışmasını dene'}
                    </button>
                  )}
                </>
                <div className="guide-note">
                  <ShieldCheckIcon size={17} />
                  <span>
                    {demo
                      ? 'Bu dosya tasarımı denemek içindir. Rol değiştirme, aynı tarayıcıda örnek senaryo gösterir; birden fazla cihazı eşzamanlı bağlamaz.'
                      : 'Bu yayının gerçek veri ve çok kullanıcılı kurulum sınırlarını ekip yöneticisiyle netleştir.'}
                  </span>
                </div>
              </div>
            )}
            {modal.type === 'resetDemo' && (
              <p className="form-intro">
                Yalnızca bu tasarım demosunda yaptığın değişiklikler silinir ve kurgusal örnek işler yeniden
                yüklenir. Gerçek çalışma alanına işlem yapılmaz.
              </p>
            )}
            {modal.type === 'templates' && (
              <div className="template-library">
                <p className="form-intro">
                  Aynı işi yeniden tarif etme. Bir şablon seç, kişileri ve tarihleri düzenleyerek aç.
                </p>
                {workspace.templates.map((template) => (
                  <button
                    type="button"
                    className="template-card"
                    disabled={!canWrite}
                    onClick={() => createFromTemplate(template)}
                    key={template.id}
                  >
                    <span className="template-icon">
                      <LayersIcon size={21} />
                    </span>
                    <span>
                      <strong>{template.name}</strong>
                      <small>
                        {template.task.checklist.length}
                        {' kontrol adımı · '}
                        {template.task.kind === 'shared' ? 'Ortak iş' : 'Bireysel iş'}
                      </small>
                    </span>
                    <ArrowUpRightIcon size={17} />
                  </button>
                ))}
                {!workspace.templates.length && (
                  <div className="empty-state">
                    <LayersIcon size={28} />
                    <h2>Tekrarlanan işler için bir başlangıç.</h2>
                    <p>
                      Bir işi aç, üstteki kaydet simgesinden şablona dönüştür. Şablonlar yorumları, eski
                      tarihleri ve tamamlanmış adımları yeni işe taşımaz.
                    </p>
                  </div>
                )}
              </div>
            )}
            {modal.type === 'template' && (
              <>
                <p className="form-intro">
                  {modal.item.title}
                  {' işinin açıklaması, kontrol listesi ve tercihleri tekrar kullanılacak.'}
                </p>
                {inputField('Şablon adı', 'name', 'text', modal.item.title, true)}
              </>
            )}
            {modal.type === 'workRules' && (
              <>
                <p className="form-intro">
                  Yeni işlere ve tarih revizyonlarına uygulanır. Mevcut tarihler kendiliğinden değiştirilmez.
                </p>
                <label className="form-label">
                  En fazla kaç takvim günü?
                  <input
                    name="maxDurationDays"
                    type="number"
                    min="0"
                    max="3650"
                    defaultValue={workspace.workRules.maxDurationDays}
                  />
                  <small>Başlangıç gününden itibaren. 0 = sınır yok.</small>
                </label>
                <label className="check-label">
                  <input
                    name="dueRequired"
                    type="checkbox"
                    defaultChecked={workspace.workRules.dueRequired}
                  />
                  {' Termin tarihi zorunlu olsun'}
                </label>
                <p className="form-footnote">
                  Zorunluluk kapalıysa süre sınırı tanımlı olsa da terminsiz iş kaydedilebilir.
                </p>
              </>
            )}
            {modal.type === 'reschedule' && (
              <>
                <p className="form-intro">{modal.item.title}</p>
                <div className="revision-context">
                  <span>
                    Mevcut termin
                    <strong>
                      {formatDateTime(
                        modal.item.dueAt || (modal.item.date ? modal.item.date + 'T20:59:59Z' : ''),
                      )}
                    </strong>
                  </span>
                  <span>
                    Termin değişikliği
                    <strong>
                      {modal.item.dueRevisionCount || 0}
                      {' kez'}
                    </strong>
                  </span>
                </div>
                <label className="form-label">
                  Yeni termin (Türkiye saati)
                  <input
                    type="datetime-local"
                    name="dueAt"
                    value={toDateTimeInput(
                      modal.item.dueAt || (modal.item.date ? modal.item.date + 'T20:59:59Z' : ''),
                    )}
                    required={workspace.workRules.dueRequired}
                    onChange={(event) =>
                      setModal({
                        ...modal,
                        item: withDueDate(modal.item, fromDateTimeInput(event.target.value)),
                      })
                    }
                  />
                </label>
                <DateShortcuts
                  required={workspace.workRules.dueRequired}
                  allowed={(e) => isScheduleValid(modal.item, e)}
                  onSelect={(e) =>
                    setModal({
                      ...modal,
                      item: withDueDate(modal.item, e),
                    })
                  }
                />
                {textareaField('Revizyon gerekçesi', 'reason', '', true)}
                <p className="form-footnote">
                  Tarihi boş bırakarak termini kaldırabilirsin (ekip kuralı izin veriyorsa). Eski ve yeni
                  tarih, kişi, zaman ve gerekçe geçmişte saklanır.
                  {workspace.workRules.maxDurationDays > 0
                    ? ' En fazla ' + workspace.workRules.maxDurationDays + ' takvim günü.'
                    : ''}
                </p>
              </>
            )}
            {modal.type === 'bulk' && (
              <>
                <p className="form-intro">
                  {modal.item.ids.length}
                  {' işe aynı değişiklik uygulanacak. Bir işte kural ihlali varsa hiçbir iş kaydedilmez.'}
                </p>
                <label className="form-label">
                  Ne güncellensin?
                  <select
                    value={modal.item.mode}
                    onChange={(event) =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          mode: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="status">İş durumu</option>
                    <option value="assignees">Sorumlular</option>
                    <option value="due">Hedef bitiş</option>
                  </select>
                </label>
                {modal.item.mode === 'status' ? (
                  <label className="form-label">
                    Yeni durum
                    <select name="status">
                      {Object.entries(TASK_STATUS_LABELS).map(([key, value]) => (
                        <option value={key} key={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : modal.item.mode === 'assignees' ? (
                  <>
                    <PeoplePicker
                      defaultOpen={modal.type === 'people'}
                      teams={workspace.teams}
                      members={assignableMembers}
                      selected={modal.item.assignees}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            assignees: e,
                          },
                        })
                      }
                    />
                    <p className="form-footnote">
                      Mevcut sorumlular bu seçimle değiştirilir. Boş seçim işleri sahipsiz bırakır.
                    </p>
                  </>
                ) : (
                  <>
                    {inputField(
                      'Yeni termin (Türkiye saati)',
                      'dueAt',
                      'datetime-local',
                      '',
                      workspace.workRules.dueRequired,
                    )}
                    {textareaField('Revizyon gerekçesi', 'reason', '', true)}
                  </>
                )}
              </>
            )}
            {modal.type === 'workspace' && (
              <>
                <p className="form-intro">Aynı işleri paylaşacağın ekip için bir isim belirle.</p>
                {inputField('Ekip / şirket adı', 'name', 'text', '', true)}
              </>
            )}
            {modal.type === 'member' && (
              <>
                {inputField('Ad soyad', 'name', 'text', modal.item.name || '', true)}
                <label className="form-label">
                  E-posta
                  <input
                    type="email"
                    name="email"
                    defaultValue={modal.item.email || ''}
                    readOnly={!!modal.item.email}
                    required={true}
                    maxLength={254}
                  />
                  <small>Üye bu e-posta adresiyle giriş yapacak.</small>
                </label>
                {inputField('Bölüm (isteğe bağlı)', 'department', 'text', modal.item.department || '')}
                <details className="form-details">
                  <summary>
                    {'Yetki ve erişim '}
                    <ChevronDownIcon size={14} />
                  </summary>
                  <label className="form-label">
                    Yetki
                    <select name="role" defaultValue={modal.item.role || 'editor'}>
                      {modal.item.role === 'owner' ? (
                        <option value="owner">Yönetici</option>
                      ) : (
                        <>
                          <option value="editor">Ekip üyesi — iş alır ve günceller</option>
                          <option value="viewer">Görüntüleyici — işleri izler</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={modal.item.active ?? true}
                      disabled={modal.item.role === 'owner'}
                    />
                    {' Aktif ekip üyesi'}
                  </label>
                </details>
                <p className="form-footnote">
                  Bu tanım davet e-postası göndermez. Siteye giriş erişimi ayrıca açılmalı.
                </p>
              </>
            )}
            {modal.type === 'task' && (
              <>
                <label className="form-label title-input">
                  Ne yapılacak?
                  <input
                    name="title"
                    placeholder="Örn. Sevkiyat öncesi koli kontrolü"
                    autoFocus={true}
                    defaultValue={
                      modal.item.title === 'Yeni iş' &&
                      !workspace.tasks.some((task) => task.id === modal.item.id)
                        ? ''
                        : modal.item.title
                    }
                    required={true}
                    maxLength={4e3}
                  />
                </label>
                <TaskRouting
                  task={modal.item}
                  state={workspace}
                  teams={workspace.teams.filter(
                    (team) =>
                      myTeams.some((t) => t.id === team.id) || taskTeamIds(modal.item).includes(team.id),
                  )}
                  members={members}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      item: e,
                    })
                  }
                />
                <div className="type-switch">
                  <button
                    type="button"
                    className={modal.item.kind === 'individual' ? 'active' : ''}
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          kind: 'individual',
                          assignees: modal.item.assignees.slice(0, 1),
                        },
                      })
                    }
                  >
                    <UserRoundIcon size={15} />
                    {' Bir kişiye'}
                  </button>
                  <button
                    type="button"
                    className={modal.item.kind === 'shared' ? 'active' : ''}
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          kind: 'shared',
                        },
                      })
                    }
                  >
                    <UsersIcon size={16} />
                    {' Seçili kişilere'}
                  </button>
                  <button
                    type="button"
                    className={
                      modal.item.kind === 'shared' && modal.item.assignees.length === assignableMembers.length
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          kind: 'shared',
                          assignees: assigneesForTask(modal.item).map((e) => e.email),
                        },
                      })
                    }
                  >
                    <UsersIcon size={16} />
                    {' Seçili ekiplerin tamamına'}
                  </button>
                  <button
                    type="button"
                    disabled={!modal.item.teamId}
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          assignees: [],
                          coordinator: '',
                          kind: 'individual',
                        },
                      })
                    }
                  >
                    Ekip havuzuna
                  </button>
                </div>
                <PeoplePicker
                  defaultOpen={modal.type === 'people'}
                  teams={workspace.teams}
                  members={assignableMembers}
                  selected={modal.item.assignees}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      item: {
                        ...modal.item,
                        assignees: e,
                      },
                    })
                  }
                  single={modal.item.kind === 'individual'}
                />
                {assignableMembers.length < 2 && role === 'owner' && (
                  <p className="form-footnote">
                    Yeni kişiler eklemek için Ekip ekranındaki “Üye ekle” düğmesini kullan.
                  </p>
                )}
                <div className="form-two">
                  <label className="form-label">
                    Başlangıç
                    <input
                      type="datetime-local"
                      name="plannedStart"
                      value={toDateTimeInput(modal.item.plannedStart)}
                      onChange={(event) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            plannedStart: fromDateTimeInput(event.target.value),
                          },
                        })
                      }
                    />
                    <small>Yeni işte bugün otomatik doldurulur.</small>
                  </label>
                  <label className="form-label">
                    {'Termin '}
                    <span className="optional">
                      {workspace.workRules.dueRequired ? 'zorunlu' : 'isteğe bağlı'}
                    </span>
                    <input
                      type="datetime-local"
                      name="dueAt"
                      value={toDateTimeInput(
                        modal.item.dueAt || (modal.item.date ? modal.item.date + 'T20:59:59Z' : ''),
                      )}
                      required={workspace.workRules.dueRequired}
                      onChange={(event) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            dueAt: fromDateTimeInput(event.target.value),
                            date: event.target.value.slice(0, 10),
                          },
                        })
                      }
                    />
                    <small>
                      {workspace.workRules.maxDurationDays
                        ? 'En fazla ' + workspace.workRules.maxDurationDays + ' takvim günü.'
                        : 'Terminsiz de kaydedebilirsin.'}
                    </small>
                  </label>
                </div>
                <DateShortcuts
                  required={workspace.workRules.dueRequired}
                  allowed={(e) => isScheduleValid(modal.item, e)}
                  onSelect={(e) =>
                    setModal({
                      ...modal,
                      item: withDueDate(modal.item, e),
                    })
                  }
                />
                {textareaField('İş tarifi (isteğe bağlı)', 'description', modal.item.description)}
                {workspace.tasks.some((task) => task.id === modal.item.id) &&
                  textareaField('Revizyon gerekçesi (termin değişiyorsa zorunlu)', 'reason', '')}
                <details className="form-details">
                  <summary>
                    {'Kontrol listesi ekle '}
                    <span>
                      {modal.item.checklist.length}
                      {' adım'}
                    </span>
                    <ChevronDownIcon size={14} />
                  </summary>
                  {textareaField(
                    'Her satıra bir kontrol adımı yaz',
                    'checklistText',
                    modal.item.checklist.map((step) => step.text).join('\n'),
                  )}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="checklistRequired"
                      defaultChecked={modal.item.checklistRequired}
                    />
                    {' Tüm adımlar bitmeden iş kapanmasın'}
                  </label>
                </details>
                <details className="form-details">
                  <summary>
                    {'Diğer seçenekler '}
                    <span>Süre, öncelik, proje ve takipçiler</span>
                    <ChevronDownIcon size={14} />
                  </summary>
                  <div className="form-two">
                    <label className="form-label">
                      Öncelik
                      <select name="priority" defaultValue={modal.item.priority}>
                        {Object.entries(PRIORITY_LABELS).map(([key, value]) => (
                          <option value={key} key={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    {inputField('Bölüm / operasyon', 'phase', 'text', modal.item.phase)}
                  </div>
                  {inputField(
                    'Planlanan toplam emek (kişi-dakika, isteğe bağlı)',
                    'estimatedMinutes',
                    'number',
                    String(modal.item.estimatedMinutes || ''),
                  )}
                  <p className="form-footnote">
                    Ortak işte toplam tahmin, iş dağılımı görünümünde sorumlular arasında eşit bölünür.
                  </p>
                  <label className="form-label">
                    Proje
                    <select
                      name="project"
                      value={modal.item.project}
                      onChange={(event) =>
                        setModal({
                          ...modal,
                          item: {
                            ...modal.item,
                            project: event.target.value,
                            depends: [],
                          },
                        })
                      }
                    >
                      <option value="">Günlük operasyon</option>
                      {workspace.projects.map((project) => (
                        <option value={project.id} key={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label option-card">
                    <input type="checkbox" name="trackTime" defaultChecked={modal.item.trackTime} />
                    <span>
                      Harcanan süreyi takip et
                      <small>Kişiler bu iş için sayaç veya manuel süre kullanabilir.</small>
                    </span>
                  </label>
                  <label className="check-label option-card">
                    <input type="checkbox" name="notifyEmail" defaultChecked={modal.item.notifyEmail} />
                    <span>
                      Bu işin e-posta bildirimleri açık olsun
                      <small>
                        {mailConfigured
                          ? 'Gönderimler ekip kurallarına göre yapılır.'
                          : 'Gönderim servisi bağlanana kadar uygulama içi bildirimler çalışır.'}
                      </small>
                    </span>
                  </label>
                  <PeoplePicker
                    label="Takipçiler"
                    members={activeMembers}
                    selected={modal.item.watchers}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          watchers: e,
                        },
                      })
                    }
                  />
                  <details className="form-details nested">
                    <summary>
                      {'Bağımlılıklar ve kabul kontrolü '}
                      <ChevronDownIcon size={13} />
                    </summary>
                    <label className="form-label">
                      Önce tamamlanması gereken işler
                      <select multiple={true} name="depends" size={3} defaultValue={modal.item.depends}>
                        {workspace.tasks
                          .filter((task) => task.id !== modal.item.id && task.project === modal.item.project)
                          .map((task) => (
                            <option value={task.id} key={task.id}>
                              {task.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    {textareaField('Kabul ölçütü', 'criteria', modal.item.criteria)}
                    <label className="check-label">
                      <input
                        name="requireApproval"
                        type="checkbox"
                        defaultChecked={modal.item.requireApproval}
                      />
                      {' Kapanmadan önce doğrulama zorunlu olsun'}
                    </label>
                    <label className="check-label">
                      <input name="verified" type="checkbox" defaultChecked={modal.item.verified} />
                      {' Kabul ölçütünü doğruladım'}
                    </label>
                  </details>
                </details>
              </>
            )}
            {modal.type === 'people' && (
              <>
                <p className="form-intro">{modal.item.title}</p>
                <div className="assignment-shortcuts">
                  <button
                    type="button"
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          assignees: [user],
                        },
                      })
                    }
                  >
                    Bana ata
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          assignees: assigneesForTask(modal.item).map((e) => e.email),
                        },
                      })
                    }
                  >
                    Seçili ekiplerin tamamına ata
                  </button>
                  <button
                    type="button"
                    disabled={!modal.item.teamId}
                    onClick={() =>
                      setModal({
                        ...modal,
                        item: {
                          ...modal.item,
                          assignees: [],
                          coordinator: '',
                        },
                      })
                    }
                  >
                    Ekip havuzuna bırak
                  </button>
                </div>
                <PeoplePicker
                  defaultOpen={modal.type === 'people'}
                  teams={workspace.teams}
                  members={assignableMembers}
                  selected={modal.item.assignees}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      item: {
                        ...modal.item,
                        assignees: e,
                      },
                    })
                  }
                />
              </>
            )}
            {modal.type === 'time' && (
              <>
                <p className="form-intro">
                  {modal.item.title}
                  {' — süre senin adına kaydedilir.'}
                </p>
                {inputField('Harcanan dakika', 'minutes', 'number', '', true)}
                {textareaField('Yapılan çalışma', 'note', '', true)}
              </>
            )}
            {modal.type === 'project' && (
              <>
                {inputField('Proje adı', 'name', 'text', modal.item.name, true)}
                {textareaField('Amaç ve beklenen sonuç', 'goal', modal.item.goal, true)}
                <details className="form-details">
                  <summary>
                    {'Kapsam ayrıntıları '}
                    <ChevronDownIcon size={14} />
                  </summary>
                  {textareaField('Kapsam', 'scope', modal.item.scope)}
                  {textareaField('Kapsam dışında kalanlar', 'excluded', modal.item.excluded)}
                </details>
                {inputField('Hedef tarih', 'date', 'date', modal.item.date)}
              </>
            )}
            {['decision', 'blocker'].includes(modal.type) && (
              <>
                <label className="form-label">
                  Proje
                  <select
                    name="project"
                    defaultValue={modal.item.project || ''}
                    required={modal.type === 'decision'}
                  >
                    <option value="">{modal.type === 'decision' ? 'Proje seç' : 'Günlük operasyon'}</option>
                    {workspace.projects.map((project) => (
                      <option value={project.id} key={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                {inputField(
                  modal.type === 'decision' ? 'Alınan karar' : 'Engel / beklenen bilgi',
                  'title',
                  'text',
                  modal.item.title,
                  true,
                )}
                {modal.type === 'decision' ? (
                  <>
                    {textareaField('Gerekçe', 'reason', modal.item.reason, true)}
                    {textareaField('Etkilenen işler / kapsam', 'impact', modal.item.impact, true)}
                  </>
                ) : (
                  <>
                    {inputField('Çözüm sorumlusu', 'owner', 'text', modal.item.owner)}
                    <label className="form-label">
                      Bağlı iş
                      <select name="task" defaultValue={modal.item.task || ''}>
                        <option value="">İş seç (isteğe bağlı)</option>
                        {workspace.tasks.map((task) => (
                          <option value={task.id} key={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="check-label">
                      <input type="checkbox" name="resolved" defaultChecked={modal.item.resolved} />
                      {' Engel çözüldü'}
                    </label>
                  </>
                )}
              </>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <div
              className="modal-footer"
              style={{
                display: ['templates', 'guide', 'search'].includes(modal.type) ? 'none' : undefined,
              }}
            >
              <button type="button" className="button quiet" disabled={busy} onClick={closeModal}>
                Vazgeç
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={
                  busy || (modal.type === 'complete' && completionIssues(modal.item, workspace).length > 0)
                }
              >
                {busy ? <LoaderCircleIcon size={16} className="spin" /> : <CheckIcon size={16} />}{' '}
                {busy
                  ? 'Kaydediliyor…'
                  : modal.type === 'complete'
                    ? 'Tamamla'
                    : modal.type === 'resetDemo'
                      ? 'Örnekleri sıfırla'
                      : modal.type === 'task' && !workspace.tasks.some((task) => task.id === modal.item.id)
                        ? 'İşi oluştur'
                        : modal.type === 'member' && !modal.item.email
                          ? 'Üyeyi ekle'
                          : 'Kaydet'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
