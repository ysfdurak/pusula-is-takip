# Outlook e-posta bildirimleri

Pusula, Jira'daki bildirimlere benzer şekilde, iş atandığında, durumu değiştiğinde, tamamlandığında ve yorum yazıldığında ilgili kişilere Outlook üzerinden e-posta gönderir. Uygulama içi bildirimler her durumda oluşur; e-posta bunlara ek olarak ve kişinin tercihine göre gider.

## Hangi olayda kime e-posta gider?

| Olay | Alıcılar | E-posta konusu |
|---|---|---|
| İş atandı | Yeni eklenen sorumlular | `[Pusula] İş atandı: <iş>` |
| İş ekip havuzuna bırakıldı | Ekip yöneticileri | `[Pusula] Ekip havuzunda yeni iş: <iş>` |
| Durum değişti | İşi açan, koordinatör, sorumlular, takipçiler; kural açıksa ekip yöneticileri | `[Pusula] Durum değişti: <iş> (Devam ediyor)` |
| İş tamamlandı | Durum değişikliğiyle aynı | `[Pusula] İş tamamlandı: <iş>` |
| Yorum yazıldı | İşi açan, koordinatör, sorumlular, takipçiler ve o işe daha önce yorum yazanlar | `[Pusula] Yeni yorum: <iş>` |

| Sabah özeti (hafta içi, varsayılan 08:00) | Her kişiye kendi geciken, bugün ve bu hafta termini olan işleri; ekip yöneticisine sorumlu bekleyen havuz işleri. Boşsa gönderilmez | `[Pusula] Günün özeti: 1 geciken, 2 bugün` |

Sabah özetinin saati `DIGEST_HOUR` ile değişir (`off` kapatır). Kişi Ayarlar → "Sabah özeti" ile kendisi kapatabilir. Aynı gün aynı kişiye ikinci kez gitmez.

E-postada işlemi kimin yaptığı ("Deniz Yılmaz işin durumunu değiştirdi: Başlanmadı → Devam ediyor"), yorumun metni, işin durumu, ekibi, termini ve önceliği yer alır. "İşi Pusula'da aç" düğmesi işi doğrudan açar.

**E-posta gitmeyen durumlar** (arayüzdeki karşılığı Bildirimler ekranında görünür):

| Durum | Açıklama |
|---|---|
| Kendi işlemim | Kişinin kendi yaptığı değişiklik. Ayarlar → "Kendi işlemlerimin e-postasını da al" açılırsa gider. |
| Tercih kapalı | Kişi Ayarlar → "İş güncellemelerini e-postayla al" seçeneğini kapatmış, ekip kuralı kapalı ya da o işte e-posta bildirimi kapalı. |
| Gönderilemedi | Outlook reddetmiş ya da adres şirket dışında (bkz. `MAIL_ALLOWED_DOMAINS`). |

Yöneticiler Ayarlar → "Ekibin bildirim kuralları" bölümünden her olay türünü ayrı ayrı açıp kapatabilir. "Yöneticiler de bilgilendirilsin" seçeneği durum ve tamamlama e-postalarına ekip yöneticilerini ekler.

"Sağlayıcı kabul etti", Outlook'un e-postayı teslim almak üzere kabul ettiği anlamına gelir; alıcının kutusuna ulaştığının teyidi değildir.

## Nasıl çalışır?

Sunucu, Microsoft Graph `sendMail` ile **tek bir ortak posta kutusundan** (örnek: `pusula@sirketiniz.com.tr`) gönderir. Uygulama kullanıcı adına giriş yapmaz, uygulama izniyle çalışır. Exchange'deki **RBAC for Applications** ile uygulamanın yalnızca bu posta kutusundan gönderebileceği sınırlanır; başka hiç kimsenin adına e-posta atamaz.

SMTP ve şifreyle gönderim kullanılmaz. Microsoft bu yöntemi (SMTP AUTH Basic) kapatma sürecindedir.

## BT'den istenecekler

### 1. Ortak posta kutusu

- Örnek adres `pusula@sirketiniz.com.tr`, görünen adı "Pusula".
- Yanıtların bir yere gitmesi isteniyorsa otomatik yanıt veya yönlendirme kurulabilir. E-postalarda "bu adrese yanıt vermeyin" notu vardır.
- Lisans gereksinimini BT doğrulamalıdır.

### 2. Entra ID uygulama kaydı

Pilot sunucusunun giriş için kullandığı "Pusula" uygulama kaydı burada da kullanılabilir ([PILOT_KURULUM.md](PILOT_KURULUM.md), 1. adım).

- **Ad:** Pusula E-posta
- **Kimlik bilgisi:** Pilot için süreli bir istemci gizli anahtarı (client secret) yeterlidir. Kalıcı kullanımda sertifika önerilir.
- **İzin: Entra'da Graph `Mail.Send` izni VERİLMEMELİ.** Verilirse uygulama herkesin adına gönderebilir ve aşağıdaki kısıtlama işe yaramaz. Yetki 3. adımda yalnızca Exchange üzerinden tanımlanır.
- BT'nin sunucuya iletmesi gerekenler: Dizin (kiracı) kimliği, uygulama (istemci) kimliği ve gizli anahtar. Ayrıca 3. adım için Kurumsal uygulamalar (Enterprise applications) sayfasındaki **nesne kimliği** gerekir.

### 3. Uygulamayı yalnızca Pusula posta kutusuyla sınırla (Exchange Online PowerShell)

Bu adımı Exchange yöneticisi yapar.

```powershell
Connect-ExchangeOnline

# Kurumsal uygulama kimlikleriyle (App registrations değil)
New-ServicePrincipal -AppId <Uygulama (istemci) kimliği> -ObjectId <Kurumsal uygulama nesne kimliği> -DisplayName "Pusula E-posta"

# Yalnızca Pusula ortak posta kutusunu kapsayan alan
New-ManagementScope -Name "Pusula gönderici" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'pusula@sirketiniz.com.tr'"

# Bu alanda e-posta gönderme yetkisi
New-ManagementRoleAssignment -App <Uygulama (istemci) kimliği> -Role "Application Mail.Send" -CustomResourceScope "Pusula gönderici"

# Kontrol: Pusula kutusu için True, başka bir kutu için False dönmeli
Test-ServicePrincipalAuthorization -Identity <Uygulama (istemci) kimliği> -Resource pusula@sirketiniz.com.tr
Test-ServicePrincipalAuthorization -Identity <Uygulama (istemci) kimliği> -Resource baska.biri@sirketiniz.com.tr
```

Yetki değişikliklerinin canlı isteklere yansıması 2 saate kadar sürebilir. `Test-…` komutu bu önbelleği beklemez.

### 4. Sunucuya girilecek ayarlar

Gizli anahtar koda veya GitHub'a yazılmaz; sunucunun ortam değişkenlerinde ya da şirketin gizli anahtar kasasında tutulur.

| Değişken | Örnek |
|---|---|
| `MAIL_MODE` | `outlook` |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | Giriş için kullanılan uygulama kaydı e-posta için de kullanılır ([PILOT_KURULUM.md](PILOT_KURULUM.md)). Ayrı bir kayıt istenirse `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` verilir |
| `MAIL_SENDER` | `pusula@sirketiniz.com.tr` |
| `MAIL_ALLOWED_DOMAINS` | `sirketiniz.com.tr`: şirket dışına e-posta gitmesini engeller |
| `APP_URL` | `https://pusula.sirketiniz.com.tr/`: e-postadaki bağlantının adresi |

Ağ: Sunucunun dışarıya `login.microsoftonline.com` ve `graph.microsoft.com` adreslerine HTTPS (443) ile çıkabilmesi gerekir.

## Denemek

Outlook kurulmadan önce e-postaların nasıl görüneceği yerelde denenebilir:

```bash
npm run build:pilot
npm run dev:api          # varsayılan MAIL_MODE=preview → e-postalar tmp/mail-preview/ klasörüne HTML olarak yazılır
```

Outlook ile deneme için, 4. adımdaki değişkenlerle `MAIL_MODE=outlook npm run dev:api` çalıştırılır ve Ekipler ekranından gerçek şirket adresiyle bir üye eklenir. Geliştirme sunucusunda giriş yoktur; bu yüzden yalnızca BT'nin onay verdiği bir test ortamında kullanılmalıdır.

## Kod

| Dosya | İş |
|---|---|
| `src/shared/notificationRules.js` | Kime bildirim gider, e-posta gönderilir mi |
| `server/mail/graphMailer.js` | Outlook / Microsoft Graph göndericisi |
| `server/mail/templates.js` | E-posta şablonu |
| `server/mail/outbox.js` | Gönderim kuyruğu: sırayla gönderim, şirket dışı engeli, geçici hatada 3 denemeye kadar tekrar |
| `tests/unit/notifications.test.js`, `tests/unit/mail.test.js` | Kurallar, şablon, gönderici ve kuyruk testleri |
