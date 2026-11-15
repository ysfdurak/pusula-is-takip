# İngilizce arayüz nasıl çalışıyor?

Pusula Türkçe yazılır ve Türkçe kalır. İngilizce, kaynağa dokunmadan **tek bir sözlükle** eklenir:
`src/shared/i18n/en.json` (Türkçe metin → İngilizce metin).

## Dil nasıl seçilir?

1. Adreste `?lang=en` ya da `?lang=tr` varsa o dil (portföy sitesinin “Dene” bağlantısı bunu kullanır).
2. Yoksa `pusula_dil` çerezi (dil seçilince bir yıllığına yazılır).
3. Hiçbiri yoksa Türkçe.

Kenar çubuğunda ve giriş ekranında **English / Türkçe** düğmesi var; basınca çerez değişir, sayfa yeniden yüklenir.

## Üç parça

| Parça | Dosya | Ne yapar |
| --- | --- | --- |
| Derleme eklentisi | `tools/ceviri/vite-ceviri.js` | Derlemede `src/` altındaki kodu okur. Sözlükte karşılığı olan her Türkçe metni dile göre seçilen bir çağrıya çevirir: `"Yeni iş"` → `__t("Yeni iş")`, `` `${n} iş seçildi` `` → `__tt("{0} iş seçildi", n)`, `'tr-TR'` → `__L()` (tarih biçimi). Sözlükte olmayan metne dokunmaz. |
| Çalışma anı | `src/i18n.js` | Dili belirler, `__t`, `__tt`, `__L` ve `tMessage` (sunucudan gelen hazır iletiyi çevirir) fonksiyonlarını verir. |
| Sunucu | `server/i18n.js` | Aynı sözlükle giriş, hata ve izin sayfalarını, JSON hata iletilerini çevirir; ziyaretçi demosunu seçilen dilde açar (örnek işler İngilizce gelir). |

`src/shared/i18n/translate.js` iki tarafın ortak çeviricisidir: önce birebir arar, sonra `{0}` kalıplarıyla
(ör. `"İş atandı: {0}"` → `"Task assigned: {0}"`, sunucunun ürettiği bildirim başlıkları için).

## Yeni metin eklediğimde ne yapmalıyım?

1. Kodu her zamanki gibi Türkçe yaz.
2. `node tools/ceviri/cikar.js --dosyali` sözlükte karşılığı olmayan metinleri dosyalarıyla listeler.
3. Her birinin İngilizcesini `src/shared/i18n/en.json`'a ekle (anahtar Türkçe metnin **tam** hâli; şablonlarda `{0}`, `{1}`).
4. CSS sınıfı gibi metin olmayan dizgiler listede çıkabilir; onları sözlüğe ekleme.

Sözlüğe eklenmeyen metin İngilizce arayüzde Türkçe görünür; bir şey bozulmaz.

## Dikkat edilecekler

- **Metne göre karar veren kod yazma.** Örn. `err.message.includes('Kayıt değişti')` İngilizcede çalışmaz, çünkü o dizgi de çevrilir. Durum kodu, kimlik ya da iki dili de tanıyan bir düzenli ifade kullan (`/Kayıt değişti|The record changed/`).
- Sözlükteki metin bir `aria-label` ise, onu arayan `querySelector` dizgisinin de çevirisi olmalı (ör. `[aria-label="Hızlı iş adı"]`).
- Kişi adları ve kullanıcının yazdığı içerik çevrilmez.
- MCP araçlarının yanıtları ve Claude içindeki pano (MCP App) şimdilik Türkçe; e-postalar da Türkçe.

## Test

`tests/unit/i18n.test.js`: sözlükte boş karşılık olmaması, kalıplı çeviri, sunucu sayfası çevirisi, dil seçimi ve İngilizce örnek veri (kimlik ve durum kodları değişmeden).
