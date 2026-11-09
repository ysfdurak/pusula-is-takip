# Mimari, API sözleşmesi ve sınırlar

## Bileşenler

| Parça | Ne | Not |
|---|---|---|
| `src/app.bundle.js` | Derlenmiş React 19 arayüzü | Özgün JSX kaynağı yok; değiştirmek kırılgandır |
| `src/styles.css` | Arayüzün CSS'i | Düzenlenebilir |
| `src/index.template.html` | HTML kabuğu ve güvenlik politikası (CSP) | |
| `scripts/build.mjs` | Üç parçayı tek `index.html` dosyasında birleştirir | `--pilot` ile sunucu modunda `pilot/index.html` üretir |
| `modern/` | Ayrı, okunabilir React/Vite prototipi | Veri modeli tasarım demosundan farklıdır (aşağıda) |
| `tests/e2e/smoke.mjs` | Tarayıcı duman testi | Yayından önce CI'da çalışır |

## İki çalışma modu

Arayüz kök bileşene verilen `demo` bayrağıyla iki modda çalışır:

- **Tasarım demosu (`demo: true`, varsayılan):** Tarayıcının içinde sahte bir sunucu çalışır, veriler `localStorage` içinde (`pusula-offline-design-v5`) tutulur. CSP `connect-src 'none'` olduğu için sayfa hiçbir ağ isteği atamaz.
- **Sunucu modu (`demo: false`, `npm run build:pilot`):** Arayüz aynı alan adındaki `/api/workspace` uç noktasıyla konuşur, CSP `connect-src 'self'` olur. 401 yanıtında giriş ekranı açılır ve giriş düğmesi `/auth/login?return_to=/` adresine gider. **Bu sunucu depoda yoktur.**

## `/api/workspace` sözleşmesi

Sözleşme, derlenmiş paketteki istemci çağrılarından ve tarayıcı içi sahte sunucudan çıkarılmıştır. Sunucu yazılırken bu davranış referans alınmalıdır.

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

## Modüler React prototipiyle ilişki

`modern/` farklı bir veri modeli kullanır: statüler Türkçe metin (`Devam`), roller `admin/manager/member`, termin yalnızca tarih. Bu yüzden `modern/src/services` altındaki kurallar yukarıdaki sözleşmeyle doğrudan uyumlu değildir; sunucu tarafında yeniden kullanılmadan önce eşleştirilmesi gerekir.

## Sınırlar

- Tasarım demosunda veriler tek tarayıcıdadır; kullanıcılar arasında paylaşım yoktur. Rol menüsü kimlik doğrulama değildir.
- E-posta gönderimi yoktur; yalnızca uygulama içi bildirim çalışır.
- Dosya eki, tekrarlayan iş, @bahsetme ve Excel/CSV aktarımı yoktur.
- CSS `DM Sans` ve `Manrope` yazı tiplerini ister ama CSP font yüklemeyi kapattığı için sistem yazı tipi kullanılır.
- Duman testi temel akışları doğrular; erişilebilirlik ve güvenlik testinin yerine geçmez.
