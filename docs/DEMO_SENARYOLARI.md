# Demo senaryoları

Örnek çalışma alanı ("Örnek Operasyon Merkezi") uygulama ilk açıldığında otomatik oluşur. Tarihler açılış anına göre hesaplandığı için gecikme ve "bugün teslim" durumları her gün aynı görünür. Sağ üstteki sıfırlama düğmesi örnekleri baştan kurar.

## Kişiler ve ekipler

| Kişi | Rol | Ekip |
|---|---|---|
| Deniz Yılmaz | Yönetici | Operasyon |
| Ece Kaya | Ekip üyesi, Sevkiyat ekip yöneticisi | Sevkiyat |
| Mert Aras | Ekip üyesi, Stok Kontrol ekip yöneticisi | Stok Kontrol |
| Selin Aydın | Görüntüleyici | Planlama |

## Senaryolar

| Senaryo | Örnek iş | Nerede görülür | Beklenen gözlem |
|---|---|---|---|
| Geciken ve termini revize edilmiş iş | Eksik koli bildirimlerini tamamla (Ece) | Ekip panosu → Geciken, İş ayrıntısı | İlk termin, 2 revizyon ve gerekçeleri korunur; engel kartı görünür |
| Engelli iş | Eksik koli bildirimlerini tamamla | Diğer araçlar → Engeller | "Taşıyıcıdan teslimat bilgisi bekleniyor", çözüm sorumlusu Ece |
| Acil ve geciken iş | A koridoru sayım farkını incele (Mert) | İş listesi → Pano, Devam ediyor | "Acil" etiketi ve gecikme uyarısı |
| Ekipler arası ortak iş | Sabah sevkiyat kontrolü (Ece + Mert) | Benim panom → Ortak işler | Tek kayıt, iki ekipte de görünür; toplamlarda bir kez sayılır; zorunlu kontrol listesi ve süre takibi |
| Onaylı tamamlama | Vardiya kapanış raporunu doğrula (Deniz) | İş ayrıntısı | Tamamlanmadan önce doğrulama bekler; kabul ölçütü yazılıdır |
| Sahipsiz iş | Yeni iade alanını düzenle | Ekip havuzu | Sorumlu yok; "Üzerime al" ile üstlenilir |
| İptal edilen iş | Saha düzeni kontrol turu | Pano → İptal | İptal gerekçesi görünür |
| Rol farkı | Selin Aydın ile giriş | Rol menüsü | Hızlı ekleme, yeni iş ve statü düğmeleri kapanır |

## Anlatım sırası

Problem (dağınık takip) → hızlı iş ekleme → sorumlu ve termin → gecikme ve revizyon geçmişi → engel → ortak iş → onaylı tamamlama → ekip panosu özeti.
