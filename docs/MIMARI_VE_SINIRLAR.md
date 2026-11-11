# Mimari, API sözleşmesi ve sınırlar

## Bileşenler

| Parça | Ne | Not |
|---|---|---|
| `src/App.jsx` | Uygulama kabuğu ve ekran durumları | En büyük dosya; ekranlara bölünmesi sonraki adım |
| `src/components/` | 17 arayüz bileşeni | Statü panosu, hızlı iş, arama, ekipler, portföy, çakışma penceresi… |
| `src/shared/workspaceModel.js` | Veri şeması (zod) ve iş kuralları | Pilot sunucusu bu kuralları aynen uygulamalı |
| `src/shared/workspaceService.js` | `/api/workspace` sözleşmesinin uygulaması | Depolamadan ve kullanıcıdan bağımsız; demo ve pilot sunucusu ortak kullanır |
| `src/demo/demoServer.js` | Tarayıcı içi örnek sunucu | Örnek veri + localStorage + örnek kullanıcı seçimi |
| `server/` | Pilot sunucusu | Microsoft (Entra ID) ya da Google girişi (OIDC + PKCE), oturum, SQLite, yedek, güvenlik başlıkları |
| `server/oauth.js` | MCP için OAuth yetkilendirme sunucusu | Claude kullanıcının normal girişiyle izin alır; [MCP.md](MCP.md) |
| `server/demo.js`, `src/shared/sampleData.js` | Ziyaretçi demo alanları ve örnek veri | `DEMO_MODE=true`; tarayıcı demosu da aynı örnek veriyi kullanır |
| `deploy/` | VPS kurulumu: Docker Compose + Caddy (otomatik HTTPS) | [SUNUCU_KURULUMU.md](SUNUCU_KURULUMU.md) |
| `src/shared/taskCommands.js` | İnce servis katmanı: tek iş, tek değişiklik komutları | Kural yazmaz; `save` üzerinden kaydeder. MCP kapısı bunu kullanır |
| `src/shared/taskRules.js`, `dashboardStats.js`, `projectStats.js` | Tamamlama kuralları, ekip panosu ve proje sağlığı hesapları | Saf fonksiyonlar; arayüz ve MCP aynı hesabı kullanır |
| `server/mcp.js` | MCP kapısı (`/mcp`) | Varsayılan kapalı; ayrıntı [MCP.md](MCP.md) |
| `src/mcp-app/`, `src/shared/board.js` | MCP App: Claude içinde açılan "Benim panom" | `npm run build:mcp-app` → `dist-mcp-app/panom.html` |
| `tools/mcp-host/` | MCP App deneme host'u | Yalnızca geliştirme ve tarayıcı testi |
| `src/lib/` | Çakışma raporu, biçimlendirme, arayüze özel görünümler | Taşınan hesaplar için eski yollar yeniden dışa aktarır |
| `src/styles.css` | Tüm stiller | |
| `vite.config.js` | Tek dosyalı derleme, mod ve güvenlik politikası (CSP) | `--mode pilot` sunucu modu |
| `src/shared/notificationRules.js` | Bildirim alıcıları ve e-posta durumu | Jira benzeri kurallar |
| `server/mail/` | Outlook göndericisi (Graph), şablon, gönderim kuyruğu | Yalnızca sunucuda çalışır; tarayıcı paketine girmez |
| `tools/dev-api-server.mjs` | Pilot derlemesini yerelde örnek API ile çalıştırır | Yalnızca geliştirme; giriş ve yetki yok |
| `tests/` | Birim testleri ve tarayıcı duman testi | CI'da ve yayından önce çalışır |

## İkili yapı: tek çekirdek, iki kapı

```
                 ┌─ web kapısı  /api/workspace  (oturum çerezi)  → React arayüzü
çekirdek ────────┤
(workspaceService,└─ MCP kapısı  /mcp            (OAuth anahtarı)  → Claude ve diğer MCP istemcileri
 kurallar, veri)      └─ ince servis katmanı (taskCommands) → aynı `save`
```

İş kuralları yalnızca çekirdekte yaşar. Kapılar kimliği belirler ve isteği çekirdeğe iletir; kural kopyalamaz. Bu yüzden ekip panosunda görünen sayı ile Claude'un söylediği sayı aynıdır.

## Çalışma modları

Arayüz kök bileşene verilen `demo` ve `preview` bayraklarıyla üç modda çalışır; bayraklar derleme modundan gelir (`src/main.jsx`):

- **Tasarım demosu (`demo: true`, varsayılan):** Tarayıcının içinde sahte bir sunucu çalışır, veriler `localStorage` içinde (`pusula-offline-design-v5`) tutulur. CSP `connect-src 'none'` olduğu için sayfa hiçbir ağ isteği atamaz.
- **Pilot önizlemesi (`preview: true`, `npm run build:preview` → `dist-preview/index.html`, Pages'te `/pilot-onizleme/`):** Tasarım demosuyla aynı tarayıcı içi sunucu, ama örnek veri yok. İlk ekranda yönetici ve çalışma alanı adı girilir. Veriler ayrı anahtarda (`pusula-pilot-onizleme-v1`) tutulur; rol menüsü yerine çalışma alanının kendi üyeleri listelenir.
- **Sunucu modu (`demo: false`, `npm run build:pilot` → `dist-pilot/index.html`):** Arayüz aynı alan adındaki `/api/workspace` uç noktasıyla konuşur, CSP `connect-src 'self'` olur. 401 yanıtında giriş ekranı açılır ve giriş düğmesi `/auth/login?return_to=/` adresine gider. Sunucu: `server/` ([PILOT_KURULUM.md](PILOT_KURULUM.md)).

## `/api/workspace` sözleşmesi

Sözleşmenin başvuru uygulaması `src/demo/demoServer.js` içindeki `demoGet` ve `demoPost` fonksiyonlarıdır; iş kuralları `src/shared/workspaceModel.js` içindedir ve birim testleriyle korunur (`tests/unit/`). Pilot sunucusu bu davranışı referans almalıdır.

### GET

| İstek | Yanıt |
|---|---|
| `GET /api/workspace` | `{ workspaces: [{id, name, role}], user }`: kullanıcının üyesi olduğu çalışma alanları |
| `GET /api/workspace?id=<alan>` | `{ state, revision, role, members, times, notifications, policy, mailConfigured, fileCounts, maxFileBytes }` |
| `GET /api/workspace?id=<alan>&task=<iş>` | Yukarıdakine ek olarak `comments`, `activities` ve `files` (o işin yorumları, geçmişi ve ek listesi) |
| `GET /api/workspace?id=<alan>&file=<ek>` | `{ file: {id, task, name, type, size, author, created}, data }`: ekin içeriği (base64). İşi göremeyen ekini de alamaz |

`state` çalışma alanının tamamıdır: `tasks`, `teams`, `projects`, `decisions`, `blockers`, `templates`, `workRules`. Kullanıcıya yalnızca görmeye yetkili olduğu işler döndürülmelidir. Arayüz 20 saniyede bir yeniden sorgular.

### POST `{ action, id, ... }`

| action | Gövde | Kural |
|---|---|---|
| `save` | `state`, `revision`, `reason` | `revision` sunucudakiyle aynı değilse **409** ("Kayıt değişti"); arayüz farkları gösterip kullanıcıya yeniden onaylatır. Sunucu durumu doğrular, rol yetkisini uygular, değişen olaylar için bildirim üretir, `revision` artırır. Tekrarlanan bir iş tamamlanınca sıradaki tekrarı sunucu açar (yanıttaki `state` içinde gelir); silinen işlerin ekleri silinir |
| `comment` | `task`, `body`, `requestId` | `requestId` ile tekrar gönderime karşı korumalı |
| `timer_start` / `timer_stop` / `manual_time` | `task`, (`minutes`, `note`) | Kişi başına tek çalışan sayaç; iş "devam ediyor" olmalı |
| `member` | `email`, `name`, `department`, `role`, `originalEmail` | Yalnızca `owner` |
| `policy` | `policy` | Yalnızca `owner` |
| `preferences` | `mailEnabled`, `notifySelf`, `digest` | Kişinin kendi tercihi (`digest`: sabah özeti) |
| `attach` | `task`, `name`, `data` (base64) | Ekip üyesi ve yönetici. Tür dosya uzantısından belirlenir (resim, PDF, Office, metin, CSV); boyut sınırı sunucuda |
| `detach` | `task`, `file` | Ekleyen kişi ya da yönetici |
| `read` | `notification` | Bildirimi okundu işaretler |
| `flush` | — | Bekleyen e-postaları gönderir; `{ configured, accepted }` |
| `create` | `name` | Yeni çalışma alanı; oluşturan `owner` olur |

Roller: `owner` (arayüzde "Yönetici"), `editor` ("Ekip üyesi"), `viewer` ("Görüntüleyici"; hiçbir değişiklik yapamaz). Hata yanıtları `{ error: "Türkçe mesaj" }` biçimindedir ve arayüzde aynen gösterilir.

## Sınırlar

- Tasarım demosunda veriler tek tarayıcıdadır; kullanıcılar arasında paylaşım yoktur. Rol menüsü kimlik doğrulama değildir.
- E-posta gönderimi sunucu modunda Outlook ile yapılır (`docs/OUTLOOK_BILDIRIMLERI.md`); tasarım demosunda yalnızca uygulama içi bildirim vardır.
- @bahsetme yoktur. Ekler pilot sunucusunda veritabanında tutulur; virüs taraması yapılmaz. Tarayıcı sürümlerinde (demo, önizleme) ek sınırı 1 MB, tarayıcı depolama kotası birkaç MB'tır.
- CSS `DM Sans` ve `Manrope` yazı tiplerini ister ama CSP font yüklemeyi kapattığı için sistem yazı tipi kullanılır.
- Duman testi temel akışları doğrular; erişilebilirlik ve güvenlik testinin yerine geçmez.
