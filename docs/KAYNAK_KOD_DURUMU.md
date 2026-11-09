# Kaynak kodun durumu

## Kısa özet

Pusula'nın ilk sürümü yalnızca derlenmiş, tek dosyalık bir paket olarak vardı (430 KB küçültülmüş JavaScript); özgün React kaynağı yoktu. Kasım 2026'da bu paketten okunabilir bir React kaynağı üretildi. Yeni kaynağın eski paketle aynı davrandığı otomatik testle doğrulandı ve derlenmiş paket depodan kaldırıldı. Eski paket `62d3884` commit'inde durur.

Aynı dönemde ayrıca yazılmış `modern/` prototipi farklı bir veri modeli kullanıyordu ve özelliklerin küçük bir kısmını karşılıyordu. Yerini tam kaynak aldığı için o da kaldırıldı; geçmişte durur.

## Nasıl üretildi

1. **Ayırma:** Paketin ilk 255 KB'ı kütüphanelerdi. React 19.2.6, zod 3 ve 40 lucide ikonu belirlenip npm paketleriyle değiştirildi. İkonların çizimleri lucide-react 1.70.0 ile birebir eşleşiyor.
2. **JSX'e dönüştürme:** `jsx()` çağrıları JSX'e çevrildi.
3. **Okunabilirlik:** Toplam 1.005 isim verildi. Bunlardan 91 üst düzey, 122 App içi ve 62 iş kuralı ismi elle yazıldı. Ayrıca props'lar, `useState` setter'ları, geri çağrı parametreleri, döngü değişkenleri ve çağrı yerlerinden çıkarılan parametre adları otomatik adlandırıldı. Küçültücünün `a && (b(), c())` biçimli ifadeleri `if` bloklarına çevrildi. Her yeniden adlandırma, başka bir değişkeni gölgeleyip gölgelemediği denetlenerek yapıldı.
4. **Modüller:** Kod 27 modüle bölündü ve import/export satırları otomatik üretildi; döngüsel bağımlılık yok.
5. **Bilinçli değişiklikler (yalnızca sunucu modunu etkiler):** Demo/pilot modu artık derleme modundan geliyor. Giriş düğmesi de "ChatGPT ile devam et" yerine şirket hesabıyla girişe (`/auth/login`) gidiyor.

Araçlar ve yeniden çalıştırma: [tools/migration/README.md](../tools/migration/README.md)

## Eşitlik nasıl doğrulandı

Eski paket ile yeni kaynaktan alınan derleme aynı koşullarda açıldı: saat sabitlendi, rastgele sayılar aynı tohumdan üretildi. Ardından iki sürümde de aynı rastgele adımlar uygulandı: düğmeye tıklama, seçim yapma, metin ve tarih yazma, ara sıra sayfayı yenileme. Her adımda iki şey birebir karşılaştırıldı:

- uygulamanın ürettiği HTML'in tamamı (`#root`);
- tarayıcıda saklanan verinin tamamı (`localStorage`).

Eşitlenen tek ayrıntı, ikon `class` adları. Bunlar CSS'te kullanılmıyor, ikon çizimleri ise ayrıca birebir karşılaştırılıyor.

| Mod | Kapsam | Sonuç |
|---|---|---|
| Tasarım demosu | 40 rastgele yürüyüş × 60 adım; masaüstü (1440 px) ve telefon (390 px) genişliği; 2.440 durum | Fark yok |
| Sunucu (pilot) modu | 12 yürüyüş × 40 adım; her sürüm kendi test API'sine (`/api/workspace`) bağlı; 492 durum | Fark yok |

Test sırasında görülen bütün farklar test aracının zamanlamasından kaynaklandı ve araç düzeltildikten sonra kayboldu. Örneğin işlem bitmeden alınan anlık görüntü ya da durdurulmuş sahte saatte geç kurulan bir zamanlayıcı bu tür farklara yol açıyordu. Aynı tohumla yeniden çalıştırıldığında hiçbiri tekrarlanmadı.

## Neler hâlâ iyileştirilebilir

- `src/App.jsx` yaklaşık 4.900 satır. Ekranlara bölünmesi (Benim panom, İş listesi, İş ayrıntısı, Ayarlar) bakım için bir sonraki adım; bu davranışı değiştirmeyen bir yeniden düzenleme.
- Bazı kısa geri çağrı parametreleri (`e`, `t`) duruyor; dosyalar düzenlendikçe adlandırılabilir.
- Birim testleri iş kurallarını kapsıyor; arayüz için yalnızca duman testi var.

## Geliştirme kuralı

Değişiklikler doğrudan `src/` içinde yapılır. Her gönderimde birim testleri, derleme ve tarayıcı duman testi çalışır.
