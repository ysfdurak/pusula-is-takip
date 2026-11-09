# Pusula — Modüler React Kaynağı (V1)

Bu dizin, mevcut tek dosyalı tasarım demosundan **ayrı** olarak geliştirilen, düzenlenebilir React/Vite prototipidir. Özgün minify edilmiş bileşenlerin birebir kaynak karşılığı değildir.

## Kurulum

Node.js 20.19+ veya 22.12+ önerilir.

```bash
cd modern
npm install
npm run dev
npm test
npm run build
```

Vite geliştirme adresi terminalde gösterilir. Üretilen statik dosyalar `modern/dist/` altındadır ve GitHub Pages'te `/modern/` adresinde yayınlanır; sitenin kökü tasarım demosudur.

## Kaynak düzeni

- `src/pages/App.jsx` — ana ekran ve görünümler
- `src/components/TaskBoard.jsx` — durum sütunları
- `src/components/TaskForm.jsx` — görev formu
- `src/hooks/useTasks.js` — görev yönetimi
- `src/services/storage.js` — yerel kayıt
- `src/services/taskRules.js` — doğrulama ve filtreleme
- `src/data/demo.js` — sentetik veri

## V1 kapsamı

Görev CRUD (düzenleme/oluşturma, durum değiştirme), kullanıcı ve ekip filtreleri, sentetik veri, localStorage kalıcılığı ve temel kural testleri. Silme işlevi hook'ta bulunur fakat henüz arayüze bağlanmamıştır.

## Eksikler

Özgün uygulamadaki tüm ekranlar ve iş kuralları taşınmış değildir. Gerçek kullanıcı girişi, sunucu, merkezi veritabanı, yetki kontrolü, bildirimler, işlem geçmişi ve çok kullanıcılı çakışma çözümü yoktur. Yerel kullanıcı seçici güvenlik amaçlı kimlik doğrulama değildir.

## Yayın güvenliği

Tasarım demosu sitenin kökünde (`/`), bu prototip `/modern/` altında yayınlanır. İkisi de `.github/workflows/publish-pages.yml` içinde testler ve tarayıcı duman testi geçince yayına alınır. Prototip özellik eşitliğine ulaşmadan kök adrese taşınmamalıdır.

## Genişletme (9 Kasım 2026)

Modüler sürüme operasyon panosu, geciken işler ve haftalık plan, görev ayrıntıları, kontrol listesi, bekleme nedeni, termin değişiklik geçmişi, yorum, zaman kaydı, takip, ekip havuzundan üstlenme, şablondan iş oluşturma, çoklu seçim ve toplu başlatma eklendi. Bunların bir bölümü temel akış düzeyindedir; eski derlenmiş uygulamayla birebir özellik eşitliği iddiası yoktur.

### Açık doğrulamalar

- GitHub Actions test ve derleme sonucunun incelenmesi
- Eski HTML'deki bütün kullanıcı akışlarının manuel envanteri ve birebir karşılaştırılması
- Yetki, veri bütünlüğü, bozuk kayıt kurtarma ve sürükle-bırak uçtan uca testleri
- Gerçek çok kullanıcılı sunucu, oturum, veri tabanı ve ağ güvenliği (henüz yok)

**Üretim ortamında veya şirket verisiyle kullanmayın.**
