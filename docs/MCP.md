# MCP kapısı: Pusula'yı Claude'a bağlamak

Pusula'nın pilot sunucusu, web arayüzüne ek olarak bir **MCP (Model Context Protocol) kapısı** sunar: `/mcp`. Claude gibi bir yapay zekâ istemcisi bu kapı üzerinden kullanıcının işlerini okuyabilir ve sınırlı değişiklikler yapabilir. Örneğin "Bu haftaki geciken işlerim ne?" ya da "Rampa 3 sayımını Ece'ye ata, termini cumaya al, gerekçe: araç gecikti".

> Durum: 5. adım. 13 araç, bir MCP App ("Benim panom") ve Claude bağlantısı için OAuth hazır. Sunucuya kurulum: [SUNUCU_KURULUMU.md](SUNUCU_KURULUMU.md).

## Nasıl çalışır

```
Claude ──(MCP, OAuth erişim anahtarı)──▶ /mcp ──▶ server/mcp.js ──▶ taskCommands ──▶ workspaceService (kurallar) ──▶ SQLite
Tarayıcı ──(oturum çerezi)──▶ /api/workspace ─────────────────────────────────▶ workspaceService (aynı kurallar)
```

- **Kural tek yerde.** MCP kapısı kural içermez. Yetki, termin gerekçesi, ilk terminin korunması, bildirimler ve iş geçmişi web arayüzüyle aynı koddan (`workspaceService`) çalışır.
- **Kullanıcının gözüyle.** Claude yalnızca o kişinin Pusula'da görebildiği işleri görür ve yalnızca onun yapabildiği değişiklikleri yapar. Görüntüleyici rolündeki biri MCP'den de değişiklik yapamaz.
- **İnce komutlar.** Web arayüzü tüm çalışma alanını kaydeder. MCP ise "tek iş, tek değişiklik" komutlarını kullanır (`src/shared/taskCommands.js`). Arada başka biri kaydederse komut güncel veriyle bir kez yeniden dener; kimsenin değişikliği ezilmez.
- **Durumsuz.** Her istek bağımsızdır, sunucu MCP oturumu tutmaz (yalnızca `POST /mcp`).
- **Denetim kaydı.** Her yazma işlemi `mcp:<araç>` adıyla denetim kaydına (audit) düşer.

## Araçlar

| Araç | Ne yapar | Tür |
|---|---|---|
| `calisma_alanlarim` | Çalışma alanları, rol, ekip ve proje adları | Okuma |
| `gundemim` | Geciken, bugün, bu hafta; yöneticiye sorumlu bekleyen ekip işleri (sabah özetiyle aynı hesap) | Okuma |
| `isleri_listele` | Durum, sorumlu, ekip, proje, geciken filtreleri | Okuma |
| `is_detayi` | Açıklama, kabul ölçütü, kontrol listesi, son yorumlar, tamamlamak için eksikler | Okuma |
| `ekip_durumu` | Ekip panosu: geciken, sahipsiz, engelli, onay bekleyen, zamanında oranı, iş yükü, 7 gün | Okuma |
| `engelleri_listele` | Engel ya da ön koşul yüzünden duran işler ve çözüm sorumluları | Okuma |
| `proje_durumu` | Proje sağlığı ve ilerleme | Okuma |
| `is_olustur` | Yeni iş (sorumlu, ekip, termin, öncelik, proje) | Yazma |
| `durum_degistir` | Yapılacak / devam / tamamlandı / iptal. Tamamlama koşulları sağlanmalı | Yazma |
| `sorumlu_ata` | Sorumluları verilen listeyle değiştirir | Yazma |
| `termin_degistir` | Gerekçe zorunlu; ilk termin korunur | Yazma |
| `kontrol_maddesi_isaretle` | Kontrol listesi maddesi | Yazma |
| `yorum_ekle` | Yorum; ilgililere bildirim | Yazma |

| `panom` | **MCP App:** Claude'un içinde açılan etkileşimli pano (aşağıda) | Okuma + arayüz |

**Bilerek MCP'ye açılmayanlar:** üye ve rol yönetimi, çalışma kuralları, iş silme, ek dosya. Yanlış anlaşılmanın bedeli yüksek olan bu işlemler yalnızca web arayüzünden yapılır.

## MCP App: "Benim panom"

`panom` aracı, sonucunu Claude'un içinde açılan etkileşimli bir panoyla gösterir: geciken, bugün ve bu hafta termini olan işler, ekip yöneticisine sorumlu bekleyen ekip işleri. Kartlarda **Başla**, **Tamamla**, **Üstlen** ve **Ayrıntı** düğmeleri var.

```
Claude ── panom aracını çağırır ──▶ sunucu: veri (structuredContent) + "ui://pusula/panom.html"
Claude ── sayfayı okur ve yalıtılmış iframe'de açar ──▶ pano çizilir
Kullanıcı "Tamamla" ── sayfa → Claude (postMessage) → durum_degistir aracı → sunucu (kurallar) ──▶ pano yenilenir
                                                  └─ Claude'a "kullanıcı X'i tamamladı" bilgisi (updateModelContext)
Kullanıcı "Ayrıntı" ── sohbete kullanıcı adına mesaj → Claude is_detayi ile cevaplar
```

- **Sayfa sunucuya doğrudan gitmez.** Ağ isteği atamaz (izin verilen alan adı yok). Her işlem Claude üzerinden bir MCP aracı çağrısıdır, bu yüzden yetki, kurallar ve denetim kaydı aynen uygulanır. Örneğin kontrol listesi bitmemiş iş için "Tamamla" basılırsa sunucunun hatası kartın altında görünür.
- **Veri tek hesaptan gelir.** Pano, `gundemim` ve sabah özeti e-postası aynı fonksiyonu (`agendaFor`) kullanır.
- **Arayüzü olmayan istemciler** aynı aracı çağırdığında pano yerine metin özeti alır.
- **Güvenlik:** İş adları kullanıcı girdisidir; sayfa bunları yalnızca metin olarak yazar (`textContent`, `innerHTML` yok).
- Kod: `src/mcp-app/panom.html` ve `panom.js` (arayüz), `src/shared/board.js` (hangi kartta hangi düğme, metin özeti; test edilebilir), `server/mcp.js` → `registerBoard`. Derleme: `npm run build:mcp-app` → `dist-mcp-app/panom.html` (tek dosya; MCP Apps kütüphanesiyle birlikte ~110 KB sıkıştırılmış).

## Açma ve kapama

Varsayılan olarak **kapalıdır**. Şirket verisinin yapay zekâ araçlarına bağlanmaması gereken kurulumlarda kapalı kalmalıdır. Açmak için `.env` içinde `MCP_ENABLED=true` yeterli.

## Claude nasıl bağlanır: OAuth

claude.ai'deki özel bağlayıcı sabit anahtar kabul etmez; MCP standardındaki OAuth 2.1 akışını kullanır. Pusula bunun için kendi yetkilendirme sunucusunu içerir (`server/oauth.js`). Kullanıcı ayrı bir parola oluşturmaz: Pusula'ya her zamanki gibi (Google ya da Microsoft) girer ve izin verir.

```
1  Claude → /mcp (anahtarsız)                 ← 401 + "yetki bilgisi şurada" (WWW-Authenticate: resource_metadata)
2  Claude → /.well-known/oauth-protected-resource   ← "yetkilendirme sunucusu: bu site"
3  Claude → /.well-known/oauth-authorization-server ← uç noktalar
4  Claude → /oauth/register                    ← Claude kendini istemci olarak kaydeder (RFC 7591)
5  Kullanıcı → /oauth/authorize                → Pusula girişi (Google) → izin ekranı → "İzin ver"
6  Claude → /oauth/token (kod + PKCE)          ← erişim anahtarı (1 saat) + yenileme anahtarı (30 gün)
7  Claude → /mcp (Authorization: Bearer …)     ← araçlar
```

| Karar | Neden |
|---|---|
| PKCE (S256) zorunlu | Dönüş adresindeki kod ele geçirilse bile doğrulayıcı olmadan anahtara çevrilemez |
| Dönüş adresi kayıttakiyle birebir aynı, yalnızca https (ya da localhost) | Kodun saldırganın sitesine gönderilmesini engeller; kayıtsız adrese hiç yönlendirilmez |
| İzin ekranı uygulama adını **ve dönüş adresini** gösterir | Herkes "Claude" adıyla istemci kaydedebilir; asıl güvence dönüş adresidir |
| Anahtarlar veritabanında SHA-256 özetiyle | Veritabanı ya da yedek sızsa bile anahtarlar kullanılamaz |
| Yenileme anahtarı her kullanımda değişir | Çalınan eski bir yenileme anahtarı işe yaramaz |
| Anahtar yalnızca bu sunucunun `/mcp` adresi için (resource, RFC 8707) | Başka bir hizmete karşı kullanılamaz |
| Her istekte üyelik kontrolü | Pusula'dan çıkarılan kişinin anahtarı hemen çalışmaz |
| Bağlı uygulamalar sayfası (`/oauth/baglantilar`) | Kullanıcı bağlantıyı kendisi kaldırır; anahtar sunucuda hemen geçersiz olur |
| İzin ve kaldırma denetim kaydında (`oauth_grant`, `oauth_revoke`) | Kim, hangi uygulamaya, ne zaman izin verdi |

**Kişisel erişim anahtarı (yalnızca deneme):** MCP Inspector ya da yerel testler için `MCP_TOKENS="eposta:anahtar"` (en az 32 karakter, `openssl rand -hex 32`) tanımlanabilir. Üretimde gerekmez.

## Yerelde denemek (MCP Inspector)

```bash
npm install
npm run start:mcp-dev        # http://localhost:8080 · MCP: http://localhost:8080/mcp
```

Başka bir terminalde:

```bash
npx @modelcontextprotocol/inspector
```

Inspector'da **Transport: Streamable HTTP**, **URL: `http://localhost:8080/mcp`** seç. İki yol var:

- **Kişisel anahtarla:** **Authentication** bölümünde başlık `Authorization`, değer `Bearer gelistirme-anahtari-yalnizca-yerel-deneme`. **Connect** → **Tools** → `calisma_alanlarim` ile başla.
- **OAuth ile (Claude'un yolu):** Authentication'ı boş bırak, **Open Auth Settings → Quick OAuth Flow**. Tarayıcıda geliştirme girişi ve izin ekranı açılır; "İzin ver" sonrası Inspector anahtarı alır.

Web arayüzünü aynı anda `http://localhost:8080` adresinde aç (`deneme@sirket.test` olarak gir). MCP'den açtığın iş arayüzde de görünür, çünkü veri ve kurallar ortaktır.

## Panoyu Claude'a bağlamadan görmek (deneme host'u)

`tools/mcp-host/` Claude'un bir MCP App'i nasıl açtığını taklit eden küçük bir sayfadır: `panom` aracını çağırır, arayüzü iframe'de açar ve arayüzün araç çağrılarını sunucuya iletir. Arayüzün Claude'a gönderdiği bilgiler sayfanın altında listelenir.

```bash
npm run start:mcp-dev     # terminal 1: pilot sunucusu + MCP (http://localhost:8080)
npm run mcp-host          # terminal 2: http://localhost:5174 adresini aç
```

Web arayüzünde (`http://localhost:8080`) iş açıp termini bugüne ver, sonra deneme host'unda **↻ Yenile**'ye bas.

Otomatik tarayıcı testi aynı host'u kullanır: `npm run test:mcp-app` (kurallar, düğmeler, Claude'a giden bilgi, denetim kaydı).

## Kodda nereye bakmalı

- `server/mcp.js`: araç tanımları (ad, açıklama, girdi şeması) ve MCP sunucusu. Araç açıklamaları Claude'un doğru aracı seçmesi için ayrıntılı yazıldı.
- `server/app.js` → `/mcp`: kapı açık mı, kaynak (Origin) kontrolü, anahtar doğrulama (kişisel ya da OAuth), üyelik kontrolü.
- `server/oauth.js`: OAuth yetkilendirme sunucusu (keşif, kayıt, izin ekranı, anahtar, bağlı uygulamalar).
- `src/shared/taskCommands.js`: komutlar. Yeni bir araç eklemek için önce buraya komut, sonra `server/mcp.js`'ye tanım eklenir.
- Testler: `tests/unit/taskCommands.test.js`, `tests/unit/mcpBoard.test.js`, `tests/server/mcp.test.js` (gerçek sunucu + resmi MCP istemcisi), `tests/server/oauth.test.js` (resmi istemcinin OAuth akışı ve saldırı denemeleri), `tests/e2e/mcpApp.mjs` (tarayıcıda pano).
