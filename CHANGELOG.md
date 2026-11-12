# Değişiklik geçmişi

## Yayınlanmamış — MCP kapısı, MCP App, Claude bağlantısı ve ziyaretçi demosu
- **İnce servis katmanı (`src/shared/taskCommands.js`):** "Tek iş, tek değişiklik" komutları: iş listele (geciken, benim, açık, ekip, proje filtreleri), iş ayrıntısı, iş oluştur, durum değiştir, sorumlu ata, termin değiştir (gerekçe zorunlu), kontrol maddesi işaretle, yorum ekle. Komutlar kural kopyalamaz; değişikliği mevcut `save` üzerinden kaydeder, böylece yetki, termin, bildirim ve geçmiş kuralları tek yerde kalır. Arada başka biri kaydederse güncel veriyle bir kez yeniden dener. MCP araçlarının temeli.
- **Tamamlama kuralları ortak katmanda (`src/shared/taskRules.js`):** "Bu iş neden henüz tamamlanamaz?" kontrolü (açık engel, bitmemiş ön koşul, zorunlu kontrol listesi, kabul ölçütü) arayüzden taşındı. Arayüz aynı fonksiyonu kullanmaya devam ediyor; komut katmanı da artık uyguluyor.
- **Okuma hesapları ortak katmanda (2. adım):** Ekip panosu istatistikleri (`src/shared/dashboardStats.js`) ve proje sağlığı (`src/shared/projectStats.js`) arayüzden taşındı; sabah özetindeki kişisel gündem `agendaFor` olarak ayrıldı. Yeni okuma komutları: gündemim, ekip durumu, engeller, proje durumu. Hepsi arayüz ve e-postayla aynı hesabı kullanır; eski içe aktarma yolları çalışmaya devam eder.
- **MCP kapısı (`/mcp`, 3. adım):** Pilot sunucusu 13 aracı MCP üzerinden sunar (7 okuma, 6 yazma; [docs/MCP.md](docs/MCP.md)). Varsayılan kapalı (`MCP_ENABLED`); şirket verisinin yapay zekâya bağlanmaması gereken kurulumlarda kapalı kalır. Kimlik şimdilik kişisel erişim anahtarıyla (`MCP_TOKENS`, en az 32 karakter, sabit sürede karşılaştırma); anahtar sahibinin Pusula yetkileriyle çalışır. Durumsuz Streamable HTTP, kaynak (Origin) kontrolü, yazma işlemleri denetim kaydına `mcp:<araç>` olarak düşer. Üye/rol yönetimi, çalışma kuralları, silme ve ekler bilerek MCP'ye açılmadı. Yerel deneme: `npm run start:mcp-dev` + MCP Inspector. Bağımlılık: `@modelcontextprotocol/sdk` 1.32.2 (`npm audit`: 0 açık).
- **MCP App "Benim panom" (4. adım):** `panom` aracı Claude'un içinde etkileşimli pano açar: geciken, bugün, bu hafta ve ekipte sorumlu bekleyen işler; Başla, Tamamla, Üstlen, Ayrıntı düğmeleri. Sayfa ağ isteği atmaz; her işlem Claude üzerinden MCP aracı olarak sunucuya gider, kurallar ve denetim kaydı aynen uygulanır. Arayüzü olmayan istemcilere metin özeti döner. Deneme host'u (`npm run mcp-host`) ile Claude'a bağlanmadan görülebilir. Bağımlılık: `@modelcontextprotocol/ext-apps` 1.7.5.
- **Google ile giriş (`AUTH_MODE=google`, 5. adım):** Microsoft girişinin yanına Google (OIDC + PKCE). Doğrulanmamış e-posta reddedilir; `GOOGLE_ALLOWED_DOMAINS` ile alan adı sınırı. Sunucunun geri kalanı hangi girişin kullanıldığını bilmez.
- **Claude bağlantısı için OAuth (`server/oauth.js`, 5. adım):** MCP standardındaki OAuth 2.1: keşif üst verileri (RFC 9728, RFC 8414), istemci kaydı (RFC 7591), izin ekranı, zorunlu PKCE, resource bağlama (RFC 8707), dönen yenileme anahtarı, özetle saklanan anahtarlar, **Bağlı uygulamalar** sayfası (`/oauth/baglantilar`). Kullanıcı Pusula'ya normal girişiyle girip izin verir; kişisel anahtar artık yalnızca deneme için (`MCP_TOKENS` isteğe bağlı).
- **VPS kurulumu (`deploy/`, [docs/SUNUCU_KURULUMU.md](docs/SUNUCU_KURULUMU.md)):** Docker Compose + Caddy (otomatik HTTPS); sunucu güvenliği, Cloudflare DNS, Google OAuth istemcisi ve Claude'a bağlama adımları.
- **Ziyaretçi demo alanları (`DEMO_MODE=true`, `server/demo.js`):** Üye olmayan biri girince kendine ait örnek verili alan açılır (yönetici kendisi, ekip kurgusal). Alanlar birbirinden yalıtılmış; yalnızca `@example.test` adresli kişi eklenebilir; `DEMO_TTL_DAYS` sonra alan, verisi, oturumu ve Claude bağlantısı silinir; `DEMO_MAX_SANDBOXES` sınırı; ilk girişte süreyi ve veri kullanımını anlatan karşılama sayfası. `PUSULA_ADMINS` eşitlemesi demo alanlarına dokunmaz. Örnek veri `src/shared/sampleData.js`'e taşındı; tarayıcı demosu da aynı veriyi kullanır.
- **Kullanım ölçümü ve geri bildirim (`server/analytics.js`):** Yalnızca demo ziyaretçileri, sunucuya özel takma kimlikle (HMAC), içeriksiz ölçülür; şirket kurulumunda hiçbir olay yazılmaz. Web (ekranlar, görünümler, iş oluşturma/durum/düzenleme/engel/yorum/ek, Excel) ve Claude (her araç) aynı yerde. Geri bildirim düğmesi (puan + metin; e-posta yalnızca izinle) kenar çubuğunda ve Ayarlar'da; Claude'dan `geri_bildirim_gonder`. Yönetici özeti `/yonetim/istatistik` (ziyaretçi, geri dönen, Claude kullanan, günlük grafik, huni, özellikler, geri bildirimler) ve `kullanim_istatistikleri` aracı. `ANALYTICS_RETENTION_DAYS` (varsayılan 180).
- **Test:** Komut katmanı için 10 birim testi (yetki, tamamlama kuralı, termin revizyonu, filtreler, çakışmada yeniden deneme, yorum, gündem, ekip durumu, engeller); pano görünüm mantığı için 4 birim testi; MCP kapısı için 5 entegrasyon testi (gerçek sunucu + resmi MCP istemcisi: kapalı kapı, yanlış anahtar, yabancı kaynak, üye olmayan anahtar sahibi, MCP App kaynağı, uçtan uca iş akışı ve denetim kaydı); MCP App tarayıcı testi (`npm run test:mcp-app`, CI'da); OAuth için 5 entegrasyon testi (resmi MCP istemcisinin yerleşik OAuth akışı; yanlış PKCE, kayıtsız dönüş adresi, başka kaynak, başkasının izin isteği, başka siteden onay, kod tekrarı, yenileme, kaldırma, üyelikten çıkarılan kişi); Google girişi için 4 birim testi; demo alanları için 6 entegrasyon testi (açılış, yalıtım, kurgusal üye kuralı, yeniden başlatma, Claude ile pano, süre sonu silme ve sınır); ölçüm ve geri bildirim için 5 entegrasyon testi (yalnızca demo, e-posta ve içerik yok, şirket kurulumunda olay yok, uydurma olay reddi, izinli e-posta, Claude kanalı, yalnızca yönetici, HTML kaçışı).

## 0.7.1 — 2026-11-09
- **Güvenlik:** zod 3 → 4.6.7 (GHSA-mrhx-c7xc-m3w5, büyük koleksiyon doğrulamasında bellek tüketimi). Yükseltme öncesi ve sonrası 248 rastgele etkileşim durumunda karşılaştırıldı, fark yok. `npm audit`: 0 açık.
- **Telefon:** README'ye demo ve pilot önizlemesi için QR kodları. Demo ile önizleme arasında banttan tek dokunuşla geçiş.
- **Proje durumu:** Portföy sürümü tamamlandı; pilot için kalan adımlar şirket tarafında.

## 0.7.0 — 2026-11-09
- **Pilot önizlemesi (`/pilot-onizleme/`):** Demodan ayrı, örnek veri olmadan boş başlayan sürüm. İlk ekranda yönetici (adın, e-postan) ve çalışma alanı adı girilir; ekipler ve kişiler yönetici tarafından kurulur. "Kullanıcı olarak dene" ile eklenen kişilerin gözünden bakılır. Veriler yalnızca o tarayıcıda, demodan ayrı tutulur; tek tıkla sıfırlanır.
- **Tekrarlanan işler:** Her gün, hafta içi, her hafta, her ay. İş tamamlanınca sıradaki tekrar aynı sorumlularla, sıfırlanmış kontrol listesiyle ve bir sonraki terminle açılır; kaçırılan tekrarlar atlanır. Termin zorunlu.
- **Ekler:** İşe fotoğraf, PDF, Office, metin ve CSV dosyası eklenebilir (pilotta 5 MB, tarayıcı sürümlerinde 1 MB). Büyük fotoğraflar tarayıcıda küçültülür. Dosyayı işi görebilen herkes açar; ekleyen kişi ya da yönetici siler. Pilotta SQLite'ta ayrı tabloda saklanır, yedeğe dahildir; silinen işin ekleri de silinir.
- **Excel'e aktarma:** İş listesindeki (filtrelenmiş) işler .xlsx olarak indirilir: durum, sorumlu, ekip, termin, gecikme, revizyon sayıları, tekrar ve bekleme notu. Ek paket kullanılmadı.
- **Sabah özeti:** Pilot sunucusu hafta içi her sabah (varsayılan 08:00, `DIGEST_HOUR`) her kişiye geciken, bugün ve bu hafta termini olan işlerini; ekip yöneticisine sorumlu bekleyen havuz işlerini tek e-postada gönderir. Kişi Ayarlar'dan kapatabilir.
- **Sadeleştirme:** "Bekleme" ve "Engel" tek "Engel / bekleme bildir" akışında birleşti. Kanban kartından açıklama ve koordinatör satırı kaldırıldı; statü, termin ve engel seçenekleri "⋯ Diğer" menüsünde. Yeni iş formunda başlangıç tarihi ve iş tarifi açılır bölümlere alındı; termin gerekçesi yalnızca termin değişince isteniyor.
- **Kod:** `App.jsx` ekranlara bölündü (`src/screens/`); bölme öncesi ve sonrası 656 rastgele etkileşim durumunda karşılaştırıldı, fark yok.
- **Test:** Tekrarlanan iş, ek dosya (sunucu entegrasyonu dahil), Excel, sabah özeti birim testleri; pilot önizlemesi tarayıcı testi.

## 0.6.0 — 2026-11-09
- **Pilot sunucusu (`server/`):** Microsoft Entra ID ile giriş (OpenID Connect + PKCE, tek kullanımlık state ve nonce, kiracı, hedef kitle ve süre kontrolü). Sunucu tarafı oturum (`HttpOnly`, `SameSite=Lax`, https'te `Secure`). SQLite (yerleşik `node:sqlite`). Açılışta ve günlük yedek. Güvenlik başlıkları, başka siteden gelen isteklerin reddi, istek boyutu sınırı. Denetim kaydı. İlk yöneticiler `PUSULA_ADMINS` ile tanımlanır.
- **Ortak servis:** `/api/workspace` mantığı `src/shared/workspaceService.js` içinde; tarayıcı demosu ve pilot sunucusu aynı kodu kullanıyor.
- **Arayüz:** Sunucu modunda "Oturumu kapat" düğmesi.
- **Düzeltme:** Üye e-postaları küçük harfe çevriliyor; büyük harfle eklenen kişi de Microsoft girişiyle eşleşiyor.
- **Paket:** Docker imajı ve `docker-compose.yml`, `.env.example`. CI'da imaj derlenip konteyner içinde test ediliyor.
- **Test:** 7 sunucu entegrasyon testi ve pilot tarayıcı testi (giriş, kayıt, yeniden başlatmada kalıcılık, oturum kapatma).
- **Belge:** `docs/PILOT_KURULUM.md`: BT kurulum kılavuzu.
- **Güvenlik incelemesi sonrası:**
  - Giriş sonrası dönüş adresinde açık yönlendirme kapatıldı (`/\evil.example`).
  - Giriş `state` değeri tarayıcı çerezine bağlandı (giriş CSRF'i).
  - Üye ilk girişte Microsoft hesap kimliğine (`oid`) bağlanıyor.
  - Hareketsiz oturum 2 saatte kapanıyor.
  - Yönetici rolünü `PUSULA_ADMINS` belirliyor.
  - Geliştirme girişi yalnızca localhost'ta çalışıyor; localhost dışında https zorunlu.
  - Kaynak bilgisi olmayan POST istekleri reddediliyor.
  - Oturum kapatma POST ile yapılıyor.
  - Oturum kimlikleri özetlenerek saklanıyor.
  - Beklenmeyen hatalar ayrıntı sızdırmıyor.
  - Rol, politika ve yorum girdilerine sınır kondu.

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
