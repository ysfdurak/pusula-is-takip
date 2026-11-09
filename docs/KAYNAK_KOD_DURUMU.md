# Kaynak kodun durumu

Bu depodaki orijinal yayın yalnızca tek bir derlenmiş HTML dosyasıydı. Özgün React JSX/TSX, bileşen klasörleri ve Vite yapılandırması mevcut değildi.

## Geri kazanılan parçalar

- `src/index.template.html`: özgün HTML kabuğu, iki yer tutucu ile
- `src/styles.css`: özgün HTML içindeki CSS
- `src/app.bundle.js`: özgün HTML içindeki **derlenmiş/minify edilmiş** React JavaScript'i
- `scripts/build.mjs`: bu parçaları tekrar tek bir `index.html` dosyasında birleştirir

**Önemli:** Bu, özgün React kaynak kodunu geri getirmez. `src/app.bundle.js` kaynak JSX/TSX değil, derlenmiş pakettir. Bileşen bazında güvenli geliştirme için React uygulamasının yeniden modülerleştirilmesi gerekir. Mevcut paket yalnızca davranışı koruyan ve tekrar üretilebilir bir ara aşamadır.

## Derleme

Node.js 20.11+ kurulu olmalıdır. Dış paket kurulumu gerekmiyor.

```bash
npm run build
npm run check
```

Ardından `index.html` dosyasını tarayıcıda açın. GitHub Pages aynı dosyayı yayınlar.

## Pilot derlemesi

`npm run build:pilot`, paketteki kök bileşeni `demo:!1` ile başlatır, giriş bağlantısını `/auth/login` adresine çevirir ve CSP'yi `connect-src 'self'` yapar. Çıktı `pilot/index.html` dosyasıdır ve depoya eklenmez. Paket değişirse betik açık bir hatayla durur.

## Geliştirme kuralı

`index.html` doğrudan düzenlenmez. CSS değişiklikleri `src/styles.css` içinde yapılabilir. JavaScript dosyası derlenmiş olduğu için üzerinde değişiklik yapmak kırılgan ve risklidir; React kaynaklarını yeniden oluşturma işi ayrı bir geliştirme aşamasıdır.
