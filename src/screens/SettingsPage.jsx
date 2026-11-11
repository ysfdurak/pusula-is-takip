// Ayarlar: tercihler, e-posta, bildirim kuralları, termin kuralları. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import {
  BellIcon,
  CalendarDaysIcon,
  CompassIcon,
  DownloadIcon,
  MailIcon,
  PlusIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useApp } from '../AppContext.js';
import { FeedbackButton } from '../components/FeedbackButton.jsx';

export function SettingsPage() {
  const {
    busy,
    currentMember,
    demo,
    exportRecords,
    mailConfigured,
    notifyPolicy,
    openModal,
    postAction,
    refresh,
    role,
    savePolicy,
    savePreference,
    setBusy,
    setError,
    setToast,
    workspace,
    workspaceId,
  } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ÇALIŞMA ALANI</span>
          <h1>Sana göre çalışsın.</h1>
          <p>Bildirimleri ve çalışma tercihlerini buradan yönet.</p>
        </div>
      </div>
      <div className="settings-grid">
        {!demo && (
          <section className="settings-card">
            <h2>{'Geri bildirim'}</h2>
            <p>Neyi beğendin, ne eksik, nerede takıldın? Görüşün Pusula'yı geliştirirken doğrudan kullanılır.</p>
            <FeedbackButton className="button" label=" Geri bildirim gönder" screen="settings" />
          </section>
        )}
        <section className="settings-card">
          <h2>
            <CalendarDaysIcon size={19} />
            {' Termin kuralları'}
          </h2>
          <p>
            {'Termin '}
            {workspace.workRules.dueRequired ? 'zorunlu' : 'isteğe bağlı'}
            {'. '}
            {workspace.workRules.maxDurationDays
              ? 'Başlangıçtan en fazla ' + workspace.workRules.maxDurationDays + ' takvim günü.'
              : 'Azami süre sınırı yok.'}
          </p>
          {role === 'owner' && (
            <button className="button" onClick={() => openModal('workRules')}>
              Kuralları düzenle
            </button>
          )}
          <small>
            İşleri yönetici ve ekip üyeleri oluşturabilir, herkese veya seçili kişilere atayabilir.
          </small>
        </section>
        <section className="settings-card">
          <h2>
            <BellIcon size={19} />
            {' Bana gelen e-postalar'}
          </h2>
          <p>Uygulama içi bildirimlerin her zaman saklanır.</p>
          <label className="switch-row">
            <span>
              İş güncellemelerini e-postayla al
              <small>Atama, yorum ve durum değişiklikleri.</small>
            </span>
            <input
              type="checkbox"
              checked={!!currentMember?.mail_enabled}
              disabled={busy}
              onChange={(event) => savePreference('mailEnabled', event.target.checked)}
            />
          </label>
          <label className="switch-row">
            <span>
              Kendi işlemlerimin e-postasını da al
              <small>Kapalıysa yalnızca başkalarının güncellemeleri.</small>
            </span>
            <input
              type="checkbox"
              checked={!!currentMember?.notify_self}
              disabled={busy}
              onChange={(event) => savePreference('notifySelf', event.target.checked)}
            />
          </label>
          <label className="switch-row">
            <span>
              Sabah özeti
              <small>
                Hafta içi her sabah 08:00'de geciken, bugün ve bu hafta termini olan işlerin tek e-postada.
              </small>
            </span>
            <input
              type="checkbox"
              checked={!!currentMember?.mail_enabled && currentMember?.digest_enabled !== 0}
              disabled={busy || !currentMember?.mail_enabled}
              onChange={(event) => savePreference('digest', event.target.checked)}
            />
          </label>
        </section>
        <section className="settings-card">
          <h2>
            <MailIcon size={19} />
            {' E-posta bağlantısı'}
          </h2>
          <span className={'connection-status ' + (mailConfigured ? 'ready' : '')}>
            {mailConfigured ? 'Bağlantı yapılandırıldı' : 'Bağlantı henüz kurulmadı'}
          </span>
          <p>
            {mailConfigured
              ? 'Gönderim durumunu Bildirimler ekranından izleyebilirsin. Sağlayıcı kabulü teslim teyidi değildir.'
              : 'Şu anda uygulama içi bildirimler çalışıyor. Gerçek e-posta gönderimi için gönderim servisi bağlanmalı.'}
          </p>
          {role === 'owner' && mailConfigured && (
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await postAction({
                    action: 'flush',
                    id: workspaceId,
                  });
                  await refresh();
                  setToast('Bekleyen gönderimler işlendi');
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Bekleyen e-postaları gönder
            </button>
          )}
        </section>
        <section className="settings-card">
          <h2>
            <SlidersHorizontalIcon size={19} />
            {' Ekibin bildirim kuralları'}
          </h2>
          <p>Sorumlular, işi açan kişi, takipçiler ve önceki yorumcular bilgilendirilir.</p>
          {[
            ['assigned', 'Yeni iş atandığında'],
            ['status', 'İşin durumu değiştiğinde'],
            ['comment', 'Yorum yazıldığında'],
            ['completed', 'İş tamamlandığında'],
            ['managers', 'Yöneticiler de bilgilendirilsin'],
          ].map(([e, t]) => (
            <label className="switch-row" key={e}>
              <span>{t}</span>
              <input
                type="checkbox"
                disabled={role !== 'owner' || busy}
                checked={notifyPolicy[e]}
                onChange={(event) => savePolicy(e, event.target.checked)}
              />
            </label>
          ))}
          <small className="muted">Bu kurallar sonraki gelişmelere uygulanır.</small>
        </section>
        <section className="settings-card">
          <h2>
            <DownloadIcon size={19} />
            {' Verilerin'}
          </h2>
          <p>Çalışma alanındaki işleri ve proje kayıtlarını JSON dosyası olarak indir.</p>
          <button className="button" onClick={exportRecords}>
            <DownloadIcon size={16} />
            {' Kayıtları dışa aktar'}
          </button>
          <hr />
          <h2>
            <CompassIcon size={19} />
            {' Çalışma alanları'}
          </h2>
          <p>
            Şirket içindeki ekipleri Ekip ekranından tanımla. Ayrı çalışma alanları birbirinden bağımsızdır;
            kişisel pano yalnızca seçili alandaki ekipleri birleştirir.
          </p>
          <button className="button" onClick={() => openModal('workspace')}>
            <PlusIcon size={16} />
            {' Yeni çalışma alanı'}
          </button>
        </section>
      </div>
    </>
  );
}
