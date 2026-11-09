# Derlenmiş paketten kaynak koda geçiş

Pusula'nın ilk sürümü yalnızca derlenmiş tek bir HTML dosyası olarak vardı (`src/app.bundle.js`, 430 KB). Özgün React kaynağı yoktu.
Bu klasördeki araçlar o paketten bugünkü `src/` kaynağını üretti ve iki sürümün aynı davrandığını doğruladı.
Eski paket `62d3884` commit'inde durur.

## Adımlar

| Araç | Ne yapar |
|---|---|
| `convert.mjs` | Paketten uygulama kodunu ayırır; React, react-dom, zod ve 40 lucide ikonunu npm import'larına çevirir; `jsx()` çağrılarını JSX'e dönüştürür |
| `refine.mjs` + `names.json` | Güvenli yeniden adlandırma (gölgeleme kontrolü), props ve `useState` setter isimleri, küçültmeyi geri alma (`a && b()` → `if`), bağlamdan isim çıkarımı, 27 modüle bölme ve import/export üretimi |
| `finalize.mjs` | Bilinçli iki değişiklik: demo/pilot modunun derleme modundan gelmesi ve giriş bağlantısının `/auth/login` olması |
| `parity.mjs` | Tasarım demosu eşitliği: iki derleme aynı sabit saat ve rastgele sayı tohumuyla açılır; rastgele tıklama/yazma yürüyüşlerinde her adımda `#root` HTML'i ve localStorage karşılaştırılır |
| `parity-server.mjs` + `test-api-server.mjs` | Sunucu (pilot) modu eşitliği: iki pilot derlemesi, her biri deterministik bir `/api/workspace` örneğine bağlanarak karşılaştırılır |

Karşılaştırmada yalnızca iki şey eşitlenir: lucide ikonlarının `class` adları (CSS'te kullanılmıyor, ikon çizimleri ayrıca birebir karşılaştırılır) ve test aracının eklediği `data-parity` işaretleri.

## Sonuçlar (9 Kasım 2026)

- Tasarım demosu: 40 yürüyüş × 60 adım, masaüstü ve telefon genişliği, 2.440 durum; fark yok.
- Sunucu modu: 12 yürüyüş × 40 adım, 492 durum; fark yok.

Ayrıntı: `docs/KAYNAK_KOD_DURUMU.md`.

## Yeniden çalıştırma

```bash
npm i --no-save @babel/parser @babel/traverse @babel/generator @babel/types prettier@3 playwright@1
git show 62d3884:src/app.bundle.js > /tmp/app.bundle.js
git show 62d3884:index.html > /tmp/eski.html
node tools/migration/convert.mjs /tmp/app.bundle.js /tmp/app.raw.jsx
node tools/migration/refine.mjs /tmp/app.raw.jsx tools/migration/names.json /tmp/out
node tools/migration/finalize.mjs /tmp/out
npm run build
node tools/migration/parity.mjs /tmp/eski.html dist/index.html 10 40 1
```
