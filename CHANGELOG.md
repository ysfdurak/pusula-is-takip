# Değişiklik geçmişi

## 0.3.0 — 2026-11-09
- **Yayın:** Tek Pages akışı; tasarım demosu `/`, React prototipi `/modern/` adresinde. Önceki akış React prototipini sitenin köküne yayınlayarak tasarım demosunun yerini alıyordu.
- **Test:** Tarayıcı duman testi (açılış, hızlı iş ekleme, yenilemede kalıcılık, ana ekranlar, telefon görünümü, React prototipi). Yayın bu test geçmeden yapılmaz.
- **Okunabilirlik:** Açık zemindeki soluk yazılar WCAG AA kontrast eşiğine (4,5:1) koyulaştırıldı, 10 pikselden küçük yazılar 10 piksele çıkarıldı. Eşiğin altında kalan yazı sayısı 361'den 151'e, 10 pikselin altındaki yazı sayısı 184'ten 13'e indi.
- **Pilot:** `npm run build:pilot` arayüzü sunucu moduna alır (`/api/workspace`, CSP `connect-src 'self'`, şirket hesabıyla giriş bağlantısı).
- **Belgeler:** README yeniden yazıldı (ekran görüntüleri, demo akışı, iki sürüm). Ürün tanıtımı ve portföy metni README'ye taşındı. Demo senaryoları gerçek örnek verilere göre düzeltildi. API sözleşmesi ve pilot ihtiyaçları eklendi.

## 0.2.0 — 2026-11-09
- Derlenmiş paket `src/` altına ayrıldı ve tekrar üretilebilir derleme eklendi.
- Modüler React/Vite prototipi (`modern/`), birim testleri ve CI.

## 0.1.0 — 2026-11-09
- GitHub portföy yayını için başlangıç dokümantasyonu.
