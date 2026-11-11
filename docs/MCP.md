# MCP kapısı: Pusula'yı Claude'a bağlamak

Pusula'nın pilot sunucusu, web arayüzüne ek olarak bir **MCP (Model Context Protocol) kapısı** sunar: `/mcp`. Claude gibi bir yapay zekâ istemcisi bu kapı üzerinden kullanıcının işlerini okuyabilir ve sınırlı değişiklikler yapabilir. Örneğin "Bu haftaki geciken işlerim ne?" ya da "Rampa 3 sayımını Ece'ye ata, termini cumaya al, gerekçe: araç gecikti".

> Durum: 4. adım. 13 araç ve bir MCP App ("Benim panom") hazır. Gerçek Claude bağlantısı için gereken OAuth girişi ve internete açık sunucu (VPS) kurulumu 5. adımda gelecek.

## Nasıl çalışır

```
Claude ──(MCP, erişim anahtarı)──▶ /mcp ──▶ server/mcp.js ──▶ taskCommands ──▶ workspaceService (kurallar) ──▶ SQLite
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

Varsayılan olarak **kapalıdır**. Şirket verisinin yapay zekâ araçlarına bağlanmaması gereken kurulumlarda kapalı kalmalıdır.

```bash
MCP_ENABLED=true
MCP_TOKENS=deniz@sirket.com.tr:<64 karakterlik anahtar>,ece@sirket.com.tr:<anahtar>
```

Anahtar üretmek için: `openssl rand -hex 32`. Anahtar, sahibinin Pusula'daki yetkileriyle çalışır. Kişi Pusula'dan çıkarılırsa anahtarı da çalışmaz. Anahtarlar sunucuda yalnızca karşılaştırma için kullanılır, kayıtlara yazılmaz.

> Kişisel anahtar geçici bir çözümdür ve yalnızca deneme içindir. claude.ai'ye bağlanmak için OAuth girişi gerekir (5. adım).

## Yerelde denemek (MCP Inspector)

```bash
npm install
npm run start:mcp-dev        # http://localhost:8080 · MCP: http://localhost:8080/mcp
```

Başka bir terminalde:

```bash
npx @modelcontextprotocol/inspector
```

Inspector'da **Transport: Streamable HTTP**, **URL: `http://localhost:8080/mcp`** seç. **Authentication** bölümünde başlık `Authorization`, değer `Bearer gelistirme-anahtari-yalnizca-yerel-deneme` olsun. **Connect** → **Tools** → `calisma_alanlarim` ile başla.

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
- `server/app.js` → `/mcp`: kapı açık mı, kaynak (Origin) kontrolü, anahtar doğrulama, üyelik kontrolü.
- `src/shared/taskCommands.js`: komutlar. Yeni bir araç eklemek için önce buraya komut, sonra `server/mcp.js`'ye tanım eklenir.
- Testler: `tests/unit/taskCommands.test.js`, `tests/unit/mcpBoard.test.js`, `tests/server/mcp.test.js` (gerçek sunucu + resmi MCP istemcisi), `tests/e2e/mcpApp.mjs` (tarayıcıda pano).
