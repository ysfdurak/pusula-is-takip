# Mimari ve sınırlar

Mevcut `index.html` dosyası derlenmiş React arayüzünü tek HTML içinde barındırır. Yerel demo ile API destekli çok kullanıcılı pilot farklı çalışma biçimleridir.

- Yerel demo: tarayıcı üzerinden inceleme; gerçek kullanıcı senkronizasyonu garantisi yoktur.
- Pilot: `/api/workspace` benzeri uç noktalarla sunucu bağımlılığı bulunabilir; bu depoda sunucu altyapısı sağlanmamıştır.
- Veri: sentetik örnekler tercih edilir. Gerçek şirket kayıtları yayınlanmamalıdır.
- Test: statik kontroller etkileşim, erişilebilirlik veya güvenlik testlerinin yerine geçmez.

## Üretim öncesi
Kimlik doğrulama, rol bazlı yetki, veri kalıcılığı, eşzamanlı düzenleme, yedekleme, hata yönetimi, güvenlik ve erişilebilirlik testleri gereklidir.
