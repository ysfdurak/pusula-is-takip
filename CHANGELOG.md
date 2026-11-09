# Değişiklik geçmişi

## 0.6.0 — 2026-11-09
- **Pilot sunucusu (`server/`):** Microsoft Entra ID ile giriş (OpenID Connect + PKCE, tek kullanımlık state ve nonce, kiracı, hedef kitle ve süre kontrolü). Sunucu tarafı oturum (`HttpOnly`, `SameSite=Lax`, https'te `Secure`). SQLite (yerleşik `node:sqlite`). Açılışta ve günlük yedek. Güvenlik başlıkları, başka siteden gelen isteklerin reddi, istek boyutu sınırı. Denetim kaydı. İlk yöneticiler `PUSULA_ADMINS` ile tanımlanır.
- **Ortak servis:** `/api/workspace` mantığı `src/shared/workspaceService.js` içinde; tarayıcı demosu ve pilot sunucusu aynı kodu kullanıyor.
- **Arayüz:** Sunucu modunda "Oturumu kapat" düğmesi.
- **Düzeltme:** Üye e-postaları küçük harfe çevriliyor; büyük harfle eklenen kişi de Microsoft girişiyle eşleşiyor.
- **Paket:** Docker imajı ve `docker-compose.yml`, `.env.example`. CI'da imaj derlenip konteyner içinde test ediliyor.
- **Test:** 7 sunucu entegrasyon testi ve pilot tarayıcı testi (giriş, kayıt, yeniden başlatmada kalıcılık, oturum kapatma).
- **Belge:** `docs/PILOT_KURULUM.md`: BT kurulum kılavuzu.

## 0.5.0 — 2026-11-09
- **Outlook bildirimleri:** İş atama, durum değişikliği, tamamlama ve yorumda ilgili kişilere Jira benzeri e-posta. Microsoft Graph ile tek bir ortak posta kutusundan gönderim; RBAC for Applications ile yalnızca o kutuya sınırlı. Şirket dışı adres engeli, geçici hatalarda yeniden deneme.
- **Bildirim kuralları:** Ayarlar'daki ekip kuralları (olay türü, "Yöneticiler de bilgilendirilsin") artık uygulanıyor; yorumlarda önceki yorumcular da bilgilendiriliyor; kişinin kendi işlemi için e-posta gitmiyor (tercihe bağlı).
- **Geliştirme:** `npm run dev:api` e-postaları `tmp/mail-preview/` klasörüne HTML olarak yazar.
- **Belge:** `docs/OUTLOOK_BILDIRIMLERI.md` — BT için adım adım kurulum.

## 0.4.0 — 2026-11-09
- **Kaynak koda geçiş:** Uygulama artık okunabilir React kaynağından (`src/`, 27 modül) derleniyor. Derlenmiş paket (`src/app.bundle.js`) ve ayrı `modern/` prototipi kaldırıldı. Tüm özellikler, veri yapısı ve tasarım aynı; eşitlik otomatik testle doğrulandı (`docs/KAYNAK_KOD_DURUMU.md`).
- **Derleme:** Vite 7; tek dosyalı çıktı korunuyor (`dist/index.html`). Pilot derlemesi `dist-pilot/index.html`.
- **Test:** İş kuralları ve örnek sunucu için birim testleri; tarayıcı duman testine iş ayrıntısı ve görüntüleyici rolü eklendi.
- **Pilot:** `npm run dev:api` ile pilot derlemesi yerelde örnek API'yle denenebiliyor (yalnızca geliştirme).
- **Yayın:** GitHub Pages yalnızca ana uygulamayı yayınlıyor; `/modern/` adresi kaldırıldı.

## 0.3.0 — 2026-11-09
- **Yayın:** Tek Pages akışı; tasarım demosu `/`, React prototipi `/modern/` adresinde. Önceki akış React prototipini sitenin köküne yayınlayarak tasarım demosunun yerini alıyordu.
- **Test:** Tarayıcı duman testi (açılış, hızlı iş ekleme, yenilemede kalıcılık, ana ekranlar, telefon görünümü, React prototipi). Yayın bu test geçmeden yapılmaz.
- **Okunabilirlik:** Açık zemindeki soluk yazılar WCAG AA kontrast eşiğine (4,5:1) koyulaştırıldı, 10 pikselden küçük yazılar 10 piksele çıkarıldı. Eşiğin altında kalan yazı sayısı 361'den 151'e, 10 pikselin altındaki yazı sayısı 184'ten 13'e indi.
- **Pilot:** `npm run build:pilot` arayüzü sunucu moduna alır (`/api/workspace`, CSP `connect-src 'self'`, şirket hesabıyla giriş bağlantısı).
- **Belgeler:** README yeniden yazıldı (ekran görüntüleri, demo akışı, iki sürüm). Ürün tanıtımı ve portföy metni README'ye taşındı. Demo senaryoları gerçek örnek verilere göre düzeltildi. API sözleşmesi ve pilot ihtiyaçları eklendi.

## 0.2.0 — 2026-11-09
- Derlenmiş paket `src/` altına ayrıldı ve tekrar üretilebilir derleme eklendi.
- Modüler React/Vite prototipi (`modern/`), birim testleri ve CI.

## 0.1.0 — 2026-11-09
- GitHub portföy yayını için başlangıç dokümantasyonu.
