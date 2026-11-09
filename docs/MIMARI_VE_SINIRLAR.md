# Mimari, API sözleşmesi ve sınırlar

## Bileşenler

| Parça | Ne | Not |
|---|---|---|
| `src/App.jsx` | Uygulama kabuğu ve ekran durumları | En büyük dosya; ekranlara bölünmesi sonraki adım |
| `src/components/` | 17 arayüz bileşeni | Statü panosu, hızlı iş, arama, ekipler, portföy, çakışma penceresi… |
| `src/shared/workspaceModel.js` | Veri şeması (zod) ve iş kuralları | Pilot sunucusu bu kuralları aynen uygulamalı |
| `src/shared/workspaceService.js` | `/api/workspace` sözleşmesinin uygulaması | Depolamadan ve kullanıcıdan bağımsız; demo ve pilot sunucusu ortak kullanır |
| `src/demo/demoServer.js` | Tarayıcı içi örnek sunucu | Örnek veri + localStorage + örnek kullanıcı seçimi |
| `server/` | Pilot sunucusu | Entra ID girişi (OIDC + PKCE), oturum, SQLite, yedek, güvenlik başlıkları |
| `src/lib/` | Pano istatistikleri, çakışma raporu, biçimlendirme | |
| `src/styles.css` | Tüm stiller | |
| `vite.config.js` | Tek dosyalı derleme, mod ve güvenlik politikası (CSP) | `--mode pilot` sunucu modu |
| `src/shared/notificationRules.js` | Bildirim alıcıları ve e-posta durumu | Jira benzeri kurallar |
| `server/mail/` | Outlook göndericisi (Graph), şablon, gönderim kuyruğu | Yalnızca sunucuda çalışır; tarayıcı paketine girmez |
| `tools/dev-api-server.mjs` | Pilot derlemesini yerelde örnek API ile çalıştırır | Yalnızca geliştirme; giriş ve yetki yok |
| `tests/` | Birim testleri ve tarayıcı duman testi | CI'da ve yayından önce çalışır |

## İki çalışma modu

Arayüz kök bileşene verilen `demo` bayrağıyla iki modda çalışır; bayrak derleme modundan gelir (`src/main.jsx`):

- **Tasarım demosu (`demo: true`, varsayılan):** Tarayıcının içinde sahte bir sunucu çalışır, veriler `localStorage` içinde (`pusula-offline-design-v5`) tutulur. CSP `connect-src 'none'` olduğu için sayfa hiçbir ağ isteği atamaz.
- **Sunucu modu (`demo: false`, `npm run build:pilot` → `dist-pilot/index.html`):** Arayüz aynı alan adındaki `/api/workspace` uç noktasıyla konuşur, CSP `connect-src 'self'` olur. 401 yanıtında giriş ekranı açılır ve giriş düğmesi `/auth/login?return_to=/` adresine gider. Sunucu: `server/` ([PILOT_KURULUM.md](PILOT_KURULUM.md)).

## `/api/workspace` sözleşmesi

Sözleşmenin başvuru uygulaması `src/demo/demoServer.js` içindeki `demoGet` ve `demoPost` fonksiyonlarıdır; iş kuralları `src/shared/workspaceModel.js` içindedir ve birim testleriyle korunur (`tests/unit/`). Pilot sunucusu bu davranışı referans almalıdır.

### GET

| İstek | Yanıt |
|---|---|
| `GET /api/workspace` | `{ workspaces: [{id, name, role}], user }`: kullanıcının üyesi olduğu çalışma alanları |
| `GET /api/workspace?id=<alan>` | `{ state, revision, role, members, times, notifications, policy, mailConfigured }` |
| `GET /api/workspace?id=<alan>&task=<iş>` | Yukarıdakine ek olarak `comments` ve `activities` (o işin yorumları ve geçmişi) |

`state` çalışma alanının tamamıdır: `tasks`, `teams`, `projects`, `decisions`, `blockers`, `templates`, `workRules`. Kullanıcıya yalnızca görmeye yetkili olduğu işler döndürülmelidir. Arayüz 20 saniyede bir yeniden sorgular.

### POST `{ action, id, ... }`

| action | Gövde | Kural |
|---|---|---|
| `save` | `state`, `revision`, `reason` | `revision` sunucudakiyle aynı değilse **409** ("Kayıt değişti"); arayüz farkları gösterip kullanıcıya yeniden onaylatır. Sunucu durumu doğrular, rol yetkisini uygular, değişen olaylar için bildirim üretir, `revision` artırır |
| `comment` | `task`, `body`, `requestId` | `requestId` ile tekrar gönderime karşı korumalı |
| `timer_start` / `timer_stop` / `manual_time` | `task`, (`minutes`, `note`) | Kişi başına tek çalışan sayaç; iş "devam ediyor" olmalı |
| `member` | `email`, `name`, `department`, `role`, `originalEmail` | Yalnızca `owner` |
| `policy` | `policy` | Yalnızca `owner` |
| `preferences` | `mailEnabled`, `notifySelf` | Kişinin kendi tercihi |
| `read` | `notification` | Bildirimi okundu işaretler |
| `flush` | — | Bekleyen e-postaları gönderir; `{ configured, accepted }` |
| `create` | `name` | Yeni çalışma alanı; oluşturan `owner` olur |

Roller: `owner` (arayüzde "Yönetici"), `editor` ("Ekip üyesi"), `viewer` ("Görüntüleyici"; hiçbir değişiklik yapamaz). Hata yanıtları `{ error: "Türkçe mesaj" }` biçimindedir ve arayüzde aynen gösterilir.

## Sınırlar

- Tasarım demosunda veriler tek tarayıcıdadır; kullanıcılar arasında paylaşım yoktur. Rol menüsü kimlik doğrulama değildir.
- E-posta gönderimi sunucu modunda Outlook ile yapılır (`docs/OUTLOOK_BILDIRIMLERI.md`); tasarım demosunda yalnızca uygulama içi bildirim vardır.
- Dosya eki, tekrarlayan iş, @bahsetme ve Excel/CSV aktarımı yoktur.
- CSS `DM Sans` ve `Manrope` yazı tiplerini ister ama CSP font yüklemeyi kapattığı için sistem yazı tipi kullanılır.
- Duman testi temel akışları doğrular; erişilebilirlik ve güvenlik testinin yerine geçmez.
