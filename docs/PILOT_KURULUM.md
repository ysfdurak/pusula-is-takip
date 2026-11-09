# Pilot sunucusu kurulumu

Bu belge, Pusula'yı şirket içinde 5–50 kişilik bir pilot için kurmak isteyen BT ekibi içindir. Kurulum yaklaşık bir saat sürer; Microsoft tarafındaki yetkilerin devreye girmesi buna ek olarak 2 saate kadar sürebilir.

## Ne kurulur?

| Parça | Açıklama |
|---|---|
| Uygulama | Tek bir Node.js 22 süreci (Docker imajı). Arayüzü, API'yi ve girişi sunar |
| Veritabanı | Aynı sunucuda SQLite dosyası (`/data/pusula.db`); ayrı veritabanı sunucusu gerekmez |
| Giriş | Microsoft Entra ID (şirket hesabı, tek oturum açma) |
| E-posta | İsteğe bağlı: Outlook / Microsoft Graph ([OUTLOOK_BILDIRIMLERI.md](OUTLOOK_BILDIRIMLERI.md)) |
| Yedek | Her açılışta ve 24 saatte bir `/data/backups/` altına; son 14 yedek tutulur |

**Kaynak ihtiyacı:** 1 vCPU, 1 GB RAM, 5 GB disk yeterlidir. Uygulama dışarıya yalnızca `login.microsoftonline.com` ve (e-posta açıksa) `graph.microsoft.com` adreslerine HTTPS ile çıkar.

## 1. Microsoft Entra ID uygulama kaydı

Entra yönetim merkezi → Uygulama kayıtları → Yeni kayıt:

| Alan | Değer |
|---|---|
| Ad | Pusula |
| Desteklenen hesaplar | Yalnızca bu kuruluş dizinindeki hesaplar (tek kiracı) |
| Yeniden yönlendirme URI'si | Platform **Web**: `https://pusula.sirketiniz.com.tr/auth/callback` |

Ardından:

- **Sertifikalar ve gizli anahtarlar:** Yeni bir istemci gizli anahtarı oluşturun; pilot için 6–12 ay süre uygundur.
- **API izinleri:** Varsayılan `User.Read` yeterlidir; giriş `openid profile email` kapsamlarıyla yapılır. **Graph `Mail.Send` eklemeyin.** E-posta yetkisi Exchange tarafında tek posta kutusuyla sınırlanır ([OUTLOOK_BILDIRIMLERI.md](OUTLOOK_BILDIRIMLERI.md)).
- **Zorunlu:** Kurumsal uygulamalar → Pusula → Özellikler → "Atama gerekli mi?" = **Evet**, ardından pilot kullanıcı grubunu atayın. Böylece pilot dışındaki kişiler ve misafir (B2B) hesaplar Microsoft girişini geçemez.

Sunucuya iletilecekler: Dizin (kiracı) kimliği, Uygulama (istemci) kimliği ve gizli anahtar.

> **Önemli:** Kullanıcılar Pusula'ya, Microsoft'ta giriş yaptıkları adresle (genellikle e-posta adresiyle aynıdır) eklenmelidir. Şirkette giriş adı (UPN) e-posta adresinden farklıysa BT bunu yöneticiye bildirmelidir.

## 2. Ayarlar

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun. `.env` asla GitHub'a gönderilmez.

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `APP_URL` | Evet | `https://pusula.sirketiniz.com.tr/`. Alan adının kökü olmalı ve üretimde https ile başlamalı |
| `PUSULA_ADMINS` | Evet | İlk yöneticiler, virgülle ayrılır. İlk açılışta bu kişiler için bir çalışma alanı oluşturulur |
| `PUSULA_WORKSPACE_NAME` | Hayır | İlk çalışma alanının adı (varsayılan: Pusula) |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | Evet | 1. adımdan |
| `SESSION_HOURS` | Hayır | En uzun oturum süresi (varsayılan: 10 saat) |
| `SESSION_IDLE_MINUTES` | Hayır | Bu kadar dakika işlem yapılmayan oturum kapanır (varsayılan: 120) |
| `MAIL_MODE`, `MAIL_SENDER`, `MAIL_ALLOWED_DOMAINS` | Hayır | E-posta için. Aynı uygulama kaydı kullanılır |
| `DATA_DIR`, `BACKUP_KEEP` | Hayır | Docker'da `/data`; tutulacak yedek sayısı (varsayılan: 14) |

Ayarlarda bir hata varsa sunucu açılmaz ve neyin eksik olduğunu Türkçe olarak yazar. `APP_URL` https değilse (localhost hariç) sunucu açılmaz. Geliştirme girişi (`AUTH_MODE=dev`) yalnızca localhost adresinde çalışır.

## 3. Çalıştırma

**Docker (önerilen):**

```bash
docker compose up -d --build        # docker-compose.yml: 127.0.0.1:8080, veri "pusula-data" biriminde
docker compose logs -f pusula
```

**Docker olmadan (Node.js 22.13 veya üzeri):**

```bash
npm ci && npm run build:pilot
NODE_ENV=production npm start        # .env değerleri ortam değişkeni olarak verilmeli
```

Sağlık kontrolü: `GET /healthz` → `{"ok":true}`

## 4. HTTPS ve ters vekil

Uygulama 8080 portunda düz HTTP dinler. HTTPS, önündeki ters vekil tarafından sağlanır:

- **IIS:** ARR + URL Rewrite ile `https://pusula.sirketiniz.com.tr` → `http://127.0.0.1:8080`
- **nginx:** `proxy_pass http://127.0.0.1:8080;` ve `proxy_set_header Host $host;`
- **Azure App Service / Container Apps:** Platform HTTPS'i kendisi sağlar; `APP_URL` olarak verilen adres girilir.

Gerekenler:
- İç DNS kaydı ve şirket sertifikası.
- 8080 portu dışarıya açılmamalı, yalnızca ters vekil erişmeli (`docker-compose.yml` portu yalnızca 127.0.0.1'e açar).
- Ters vekilde `/auth/login` için istek sınırı (örneğin IP başına dakikada 20) önerilir.
- Oturum çerezi `Secure`, `HttpOnly` ve `SameSite=Lax`'tır; API başka sitelerden gelen istekleri reddeder.

## 5. İlk giriş ve kullanıcılar

1. `PUSULA_ADMINS` içindeki yönetici adresi açar ve "Şirket hesabınla giriş yap" ile girer.
2. **Ekipler** ekranından ekipleri ve üyeleri ekler. Rol seçenekleri:
   - **Yönetici:** her şeyi düzenler.
   - **Ekip üyesi:** iş açar ve günceller.
   - **Görüntüleyici:** yalnızca okur.
3. Eklenen kişi kendi Microsoft hesabıyla girebilir. Eklenmemiş biri "Pusula erişimin yok" sayfasını görür. İlk girişte üye kaydı Microsoft hesabının değişmeyen kimliğine bağlanır; aynı adresle başka bir hesap giremez.

**Erişimi kaldırma:**
- **Ekip üyesi veya görüntüleyici:** Ekipler ekranından pasifleştirildiğinde açık oturumu bir sonraki istekte kapanır.
- **Yönetici rolü:** Yalnızca `PUSULA_ADMINS` ile verilir. Listeden çıkarılan kişi, uygulama yeniden başlatılınca ekip üyesine düşer; ardından pasifleştirilebilir. Bir çalışma alanının son yöneticisi düşürülmez.
- **Microsoft hesabı kapatılırsa:** Yeni giriş yapılamaz. Açık oturum en geç 2 saat hareketsizlikten sonra ya da en fazla 10 saatte kapanır. Hemen kesmek için kişiyi Pusula'da da pasifleştirin.
- **Adres başka bir çalışana geçtiyse:** Üyeyi pasifleştirip yeniden etkinleştirin; hesap bağı sıfırlanır.

## 6. Yedek ve geri yükleme

- **Otomatik yedek:** Her açılışta ve 24 saatte bir `/data/backups/pusula-<tarih>.db` oluşturulur.
- **Elle yedek:** `docker compose exec pusula npm run backup`
- **Şirket yedeklemesi:** `/data` birimi şirketin yedekleme politikasına dahil edilmelidir.
- **Geri yükleme:**
  1. Uygulamayı durdurun.
  2. İstenen yedeği `/data/pusula.db` olarak kopyalayın.
  3. Aynı klasördeki `pusula.db-wal` ve `pusula.db-shm` dosyalarını silin.
  4. Uygulamayı başlatın.
- Pilot başında geri yüklemeyi bir kez deneyin.

## 7. Kayıtlar ve izleme

- Uygulama günlükleri standart çıktıya yazılır (`docker compose logs`). Girişler, giriş retleri, e-posta sonuçları ve hatalar burada görünür.
- Veritabanındaki `audit` tablosu şunları tutar: giriş, reddedilen giriş, kayıt (gerekçesiyle), üye ve kural değişiklikleri.
- Kişisel veri içerdiği için günlük ve yedeklerin saklama süresi KVKK saklama-imha politikasına uygun belirlenmelidir.

## 8. Güncelleme

```bash
git pull
docker compose up -d --build
```

Veri `/data` biriminde kalır. Güncellemeden önce elle yedek alın.

## 9. Pilot sonu

- **Veri silinecekse:** `docker compose down -v` ile veri birimini silin ve `/data/backups` yedeklerini imha edin.
- **Uygulama kaydını kapatın:** Entra'daki uygulama kaydını devre dışı bırakın ya da silin ve gizli anahtarı iptal edin.
- **Veri taşınacaksa:** Yönetici Ayarlar → "Kayıtları dışa aktar" ile JSON alabilir.

## Bilinen sınırlar (pilot)

- Tek sunucu, tek süreç. Yük dengeleme ve birden çok kopya desteklenmez.
- Bir çalışma alanının tüm iş kayıtları tek belge olarak tutulur. Aynı anda düzenleme sık olursa "Kayıt değişti" çakışma ekranı görülebilir.
- Dosya eki, tekrarlayan iş ve günlük özet e-postası henüz yok.
- Bağımsız bir güvenlik incelemesi (sızma testi) yapılmadı. Pilot öncesinde BT'nin değerlendirmesi önerilir.
