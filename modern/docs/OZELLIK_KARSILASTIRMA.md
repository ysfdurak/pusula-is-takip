# Pusula — Eski demo / modüler React özellik karşılaştırması

Bu belge **özellik eşitliği doğrulaması değildir**. Eski minify edilmiş HTML'deki metin ve akış işaretleriyle yeni React dosyalarının uygulanmış kapsamı karşılaştırılmıştır.

| Alan | Yeni kaynak durumu | Eksik / risk |
|---|---|---|
| Benim İşlerim, Ekibim, tüm işler, takip edilenler | Temel ekran var | Yetki kapsamı ve ortak iş kuralları eşit değil |
| Görev, durum, öncelik, termin, sorumlu | Temel düzenleme var | Sürükle-bırak ve toplu düzenleme yok |
| Projeler, kararlar, engeller | Temel kayıt formları var | İlişki ve çözüm iş akışları eksik |
| Üyeler, ekipler | Temel kayıt formları var | Üyelik, ekip yöneticisi ve kapsam doğrulaması eksik |
| Kontrol listesi ve bağımlılık | Temel kural ve düzenleme var | Ayrıntılı döngü ve iş grubu senaryoları test edilmeli |
| Yorumlar, zaman kayıtları, şablonlar | Temel kayıt ekranı var | Görev ayrıntılarına bütünleşik değil |
| Bildirimler ve işlem geçmişi | Yerel temel kayıt var | Tüm olaylar, filtreleme, sunucu güvenliği eksik |
| Çalışma kuralları | Temel ayarlar var | Eski parametrelerin tümü taşınmadı |
| Yerel yedek ve sıfırlama | Temel JSON işlevi var | Bozuk kayıt koruma ve şema migrasyonu eksik |
| Çakışma kontrolü | Yok | Sunucu ve sürüm doğrulaması gerekli |
| Gerçek çok kullanıcılı çalışma | Yok | API, oturum ve ortak veritabanı gerekli |
| Eski tasarım görsel eşitliği | Yok | Ekran bazında karşılaştırma gerekli |

## Sınır
Yeni React kaynakları **özgün uygulamanın tam karşılığı değildir**. Eski GitHub Pages demosu korunmuştur. Yeni kaynakların npm build/test sonuçları ayrıca doğrulanmalıdır.
