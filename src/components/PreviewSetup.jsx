// Pilot önizlemesinin ilk ekranı: yönetici (sen) ve çalışma alanı adı. Gerçek pilotta bu bilgiler
// Microsoft girişinden ve sunucu ayarlarından (PUSULA_ADMINS, WORKSPACE_NAME) gelir.
import { useState } from 'react';
import { CompassIcon, ShieldCheckIcon } from 'lucide-react';
import { setupPreview } from '../demo/demoServer.js';

export function PreviewSetup({ onReady }) {
  const [error, setError] = useState('');
  return (
    <main className="auth-page preview-setup">
      <span className="brand-mark">
        <CompassIcon size={30} />
      </span>
      <h1>Pilot önizlemesi</h1>
      <p>
        Pusula'yı şirket pilotundaki gibi boş bir çalışma alanıyla dene. Yönetici sensin: ekipleri ve kişileri
        sen eklersin, işleri açarsın, “Kullanıcı olarak dene” ile ekip üyesinin gözünden bakarsın.
      </p>
      <form
        className="preview-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            setupPreview({ name: form.get('name'), email: form.get('email'), workspaceName: form.get('workspace') });
            onReady();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <label className="form-label">
          Adın
          <input name="name" required maxLength={120} autoComplete="name" placeholder="Ad Soyad" />
        </label>
        <label className="form-label">
          E-posta adresin
          <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="ad.soyad@sirket.com.tr" />
          <small>Yalnızca bu tarayıcıda, kişileri ayırt etmek için kullanılır. E-posta gönderilmez.</small>
        </label>
        <label className="form-label">
          Çalışma alanı adı
          <input name="workspace" required maxLength={120} defaultValue="Pilot çalışma alanı" />
        </label>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <button className="button primary large" type="submit">
          Önizlemeyi başlat
        </button>
      </form>
      <p className="preview-note">
        <ShieldCheckIcon size={15} />
        Veriler bu tarayıcıda saklanır, başka kişiyle paylaşılmaz ve sunucuya gitmez. Gerçek şirket verisi girme.
      </p>
    </main>
  );
}
