# Pusula | İş ve Ekip Takip Sistemi

Pusula, operasyon ekiplerinin işlerini, sorumlularını, terminlerini ve işi durduran engelleri tek ekranda izlemesi için tasarlanmış Türkçe bir iş takip uygulamasıdır. Depo, sevkiyat ve stok kontrol gibi vardiyalı ekipler düşünülerek hazırlandı.

**Canlı demo:** https://ysfdurak.github.io/pusula-is-takip/

> Tasarım demosudur. Veriler sentetiktir ve yalnızca sizin tarayıcınızda saklanır. Gerçek şirket verisi girmeyin.

![Benim panom](docs/img/benim-panom.png)

## Ne çözer?

Operasyon ekiplerinde işler WhatsApp, e-posta ve Excel arasında dağılır. Kimin neyi üstlendiği belirsizleşir, geciken iş ancak iş işten geçince fark edilir. Pusula bunun için:

- **Herkese kendi gündemini** gösterir: bugün neye öncelik vereceğini, geciken ve bugün teslim olan işleri.
- **Ekip liderine tek bakışta durumu** verir: açık, geciken ve sahipsiz işler, 7 günlük teslim takvimi.
- **İlk termini kaybetmez:** termin revize edilse bile ilk hedef tarih ve her değişikliğin gerekçesi saklanır. "İlk termine göre zamanında tamamlanan" ile "güncel termine göre" oranı ayrı ölçülür.
- **Engeli görünür kılar:** işi durduran konu, çözüm sorumlusuyla birlikte işin üstünde durur.

## Özellikler

| Alan | Neler var |
|---|---|
| Panolar | Benim panom, Ekip panosu, 7 günlük plan, ekip havuzu, ortak işler, takip edilenler |
| İş | Hızlı ekleme (yaz + Enter), şablondan iş, bireysel / ortak iş, tek veya çoklu sorumlu, öncelik, termin ve revizyon gerekçesi, kontrol listesi, onay (doğrulama) adımı, süre takibi |
| Görünümler | Statü panosu (sürükle-bırak kanban), liste, toplu işlem, arama (Ctrl/⌘ K), filtreler |
| Kayıtlar | Projeler, engeller, kararlar, yorumlar, işlem geçmişi |
| Ekip | Birden fazla ekip, kişi rehberi, roller (yönetici, ekip üyesi, görüntüleyici) |
| Bildirim | Uygulama içi bildirimler ve Jira benzeri Outlook e-postaları: atama, durum, tamamlama, yorum ([kurulum](docs/OUTLOOK_BILDIRIMLERI.md)) |
| Veri | JSON dışa aktarma, örnek verileri sıfırlama |

<p>
<img src="docs/img/is-listesi-pano.png" width="49%" alt="Statü panosu">
<img src="docs/img/is-ayrintisi.png" width="49%" alt="İş ayrıntısı">
</p>
<p><img src="docs/img/ekip-panosu.png" width="49%" alt="Ekip panosu"> <img src="docs/img/mobil.png" width="20%" alt="Telefon görünümü"></p>

## 5 dakikalık demo

1. **Benim panom:** Sağ üstteki "Denediğin rol" menüsünden Deniz Yılmaz (yönetici) ile başla. Hızlı iş kutusuna bir iş yazıp Enter'a bas.
2. **Ekip panosu:** 2 geciken işi ve "İlk planı da takip et" kutusunu gör. Termini iki kez revize edilmiş *Eksik koli bildirimlerini tamamla* işini aç.
3. **İş listesi → Pano:** Bir kartı sürükleyerek statüsünü değiştir. *Vardiya kapanış raporunu doğrula* işini açıp tamamlanmadan önce doğrulama beklediğini gör.
4. **Rol değiştir:** Selin Aydın (görüntüleyici) ile aynı ekranlara bak; düzenleme hakları kapanır.

Ayrıntılı senaryolar: [docs/DEMO_SENARYOLARI.md](docs/DEMO_SENARYOLARI.md)

## Kaynak kod ve geliştirme

Uygulama React 19 + Vite ile yazılmıştır; derleme tek bir HTML dosyası üretir ve internetsiz açılabilir.

```bash
npm install
npm run dev            # geliştirme sunucusu
npm test               # iş kuralı birim testleri
npm run build          # dist/index.html  → tasarım demosu
npm run build:pilot    # dist-pilot/index.html → sunucu modu (/api/workspace)
npm run dev:api        # pilot derlemesini yerelde örnek API ile çalıştırır; e-postalar tmp/mail-preview/ (yalnızca geliştirme)
```

| Klasör | İçerik |
|---|---|
| `src/App.jsx` | Uygulama kabuğu: gezinme, panolar, iş ayrıntısı, formlar |
| `src/components/` | Statü panosu, hızlı iş ekleme, genel arama, ekipler, proje portföyü, çakışma penceresi vb. (17 bileşen) |
| `src/shared/workspaceModel.js` | Veri şeması (zod) ve iş kuralları: görünürlük, yetki, termin, revizyon |
| `src/demo/demoServer.js` | Tarayıcı içi örnek sunucu; `/api/workspace` sözleşmesinin başvuru uygulaması |
| `src/lib/` | Pano istatistikleri, çakışma raporu, tarih biçimleri, etiketler |
| `server/mail/` | Outlook (Microsoft Graph) e-posta bildirimleri: gönderici, şablon, kuyruk |
| `tests/` | Birim testleri ve tarayıcı duman testi |

İlk sürüm yalnızca derlenmiş bir paket olarak vardı. Bugünkü kaynak o paketten üretildi ve iki sürümün aynı davrandığı otomatik testle doğrulandı. Ayrıntı: [docs/KAYNAK_KOD_DURUMU.md](docs/KAYNAK_KOD_DURUMU.md).

`main` dalına her gönderimde GitHub Actions birim testlerini, derlemeyi ve tarayıcı duman testini çalıştırır; hepsi geçerse GitHub Pages güncellenir.

## Şirket içi pilot

Arayüz bir sunucuyla çalışmaya hazırdır (`/api/workspace`, oturum ve çakışma ekranları uygulamada var) ve sunucunun uygulaması gereken kurallar `src/shared/` ile `src/demo/` altında okunabilir durumda. Gerçek sunucu, şirket hesabıyla giriş ve veritabanı ise henüz yok. Birkaç kullanıcıyla deneme için gerekenler: [docs/PILOT_IHTIYACLARI.md](docs/PILOT_IHTIYACLARI.md)

## Belgeler

- [Demo senaryoları](docs/DEMO_SENARYOLARI.md)
- [Mimari, API sözleşmesi ve sınırlar](docs/MIMARI_VE_SINIRLAR.md)
- [Pilot ihtiyaçları](docs/PILOT_IHTIYACLARI.md)
- [Outlook e-posta bildirimleri ve BT kurulumu](docs/OUTLOOK_BILDIRIMLERI.md)
- [Kaynak kodun durumu](docs/KAYNAK_KOD_DURUMU.md)
- [Yayın kontrol listesi](docs/YAYIN_KONTROL.md)

## Portföy notu

**Gösterilen yetkinlikler:** operasyon süreç analizi, iş kuralı tasarımı (sorumluluk, termin revizyonu, onay, engel), kullanıcı akışları, prototipleme, test senaryosu ve yayın otomasyonu.
**Kapsam sınırı:** Portföy demosudur; çok kullanıcılı canlı kurumsal kullanım için sunucu, kimlik doğrulama ve güvenlik çalışması gerekir.
