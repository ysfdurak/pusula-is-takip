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

Vite geliştirme adresi terminalde gösterilir. Üretilen statik dosyalar `modern/dist/` altındadır. Kök `index.html` GitHub Pages demosu değişmez.

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

Mevcut GitHub Pages demosu `/index.html` üzerinden korunur. Modern sürümün yayını ancak özellik eşleştirme ve testlerden sonra yapılmalıdır.
