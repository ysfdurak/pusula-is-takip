# Şirket içi pilot ihtiyaçları

**Hedef:** Pusula'yı 1–2 ekipte (örneğin Sevkiyat ve Stok Kontrol), 5–10 kişiyle, 3–4 hafta boyunca gerçek günlük işlerde denemek.

**Kısa cevap:** Arayüz hazır. Çok kullanıcılı çalışma için eksik olan üç şey var: **sunucu (API ve veritabanı), şirket hesabıyla giriş ve şirket içinde barındırma**. Bunlara ek olarak BT/KVKK onayı ve pilot ekibin kurulumu gerekir.

## Mevcut durum

| Gereken | Durum |
|---|---|
| Arayüz (panolar, iş, engel, proje, roller, bildirim ekranı) | ✅ Hazır |
| Sunucu moduna alınmış arayüz | ✅ `npm run build:pilot` → `pilot/index.html` |
| Oturum (401) ve eşzamanlı düzenleme çakışması (409) ekranları | ✅ Arayüzde var |
| API sözleşmesi | ✅ Belgelendi: [MIMARI_VE_SINIRLAR.md](MIMARI_VE_SINIRLAR.md) |
| `/api/workspace` sunucusu ve veritabanı | ❌ Yok |
| Şirket hesabıyla giriş (SSO) | ❌ Yok |
| Barındırma, HTTPS, yedekleme | ❌ Yok |
| E-posta / Teams bildirimi | ❌ Yok (yalnızca uygulama içi) |
| BT güvenlik ve KVKK onayı | ❌ Alınmadı |

## 1. Pilot başlamadan zorunlu olanlar

### 1.1 Sunucu (en büyük iş)
- `/api/workspace` için GET ve POST uç noktaları, sözleşmedeki tüm `action` türleriyle.
- Veritabanı: pilot ölçeğinde **SQLite** yeterli. Tablolar: çalışma alanı durumu ve `revision`, üyeler ve roller, yorumlar, işlem geçmişi, süre kayıtları, bildirimler.
- **Doğrulama ve yetki sunucuda yapılmalı.** Görüntüleyici hiçbir şeyi değiştiremez, yalnızca yönetici üye ve kural düzenler, kullanıcı yalnızca yetkili olduğu işleri görür. Tarayıcıdaki kontroller güvenlik sağlamaz.
- `save` işleminde `revision` kontrolü (iyimser kilit) ve uyuşmazlıkta 409.
- Her değişiklikte işlem geçmişi kaydı ve ilgili kişilere bildirim.
- Başvuru kaynağı: tarayıcı içi sahte sunucu bu kuralların tamamını içeriyor, ancak derlenmiş kod olduğu için okunarak yeniden yazılmalı.

### 1.2 Giriş (kimlik doğrulama)
- Şirketin kullandığı sağlayıcıyla tek oturum açma (SSO): **Microsoft Entra ID** (Office 365 kullanılıyorsa) veya **Google Workspace**, OpenID Connect ile.
- `/auth/login` (arayüzdeki giriş düğmesi buraya gider), `/auth/callback`, `/auth/logout`.
- Oturum çerezi `HttpOnly`, `Secure` ve `SameSite=Lax` olmalı. Oturum yoksa API 401 döner.
- Yalnızca üye listesindeki e-postalar girebilmeli. Üye listesi Pusula'nın "Ekipler" ekranından yönetilir.

### 1.3 Barındırma
- Şirket iç ağında bir sanal makine ya da şirketin bulut hesabında tek bir konteyner (Node.js ve SQLite) yeterli.
- **HTTPS zorunlu.** Arayüz ile API aynı alan adında olmalı (örnek: `pusula.sirket.local`).
- Günlük otomatik yedek ve geri yükleme denemesi. Uygulamadaki JSON dışa aktarma ek güvence sağlar.
- Basit izleme: sunucu ayakta mı, hata kayıtları.

### 1.4 Veri, KVKK ve BT onayı
- Sistem kişisel veri işler: ad, e-posta, bölüm, iş geçmişi. Bu yüzden pilot için **aydınlatma metni**, veri sorumlusu, saklama süresi ve pilot sonunda silme ya da taşıma kararı gerekir.
- BT birimiyle şunlar netleşmeli: barındırma yeri, SSO kaydı, erişim kimde olacak, yedeklerin konumu.
- Pilot kuralı olarak müşteri bilgisi, fiyat, sözleşme gibi ticari açıdan hassas içerik girilmemeli.

### 1.5 Çalışma alanının kurulması
- Gerçek ekipler, kişiler ve roller. Sunucu boş çalışma alanıyla başlamalı; örnek veriler pilota taşınmaz.
- Ekibin rutin işleri için 5–10 iş şablonu (vardiya kapanışı, sayım, sevkiyat kontrolü vb.).
- İş türleri, proje listesi ve termin kuralları (Ayarlar → Termin kuralları).

## 2. Pilotun tutması için güçlü öneriler

| İhtiyaç | Neden | Asgari çözüm |
|---|---|---|
| Bildirim (e-posta veya Teams) | Bildirim gelmezse kullanıcılar uygulamayı açmayı unutur | Sabah günlük özet e-postası: geciken, bugün teslim, sana atanan |
| Tekrarlayan işler | Vardiya işleri her gün yeniden açılıyor | Sunucuda zamanlanmış görevle şablondan iş üretmek |
| Fotoğraf eki | Depoda kanıt çoğunlukla fotoğraf | İlk aşamada yorumda paylaşılan bağlantı; sonra dosya yükleme |
| Telefondan kullanım | Sahada masaüstü yok | Mevcut mobil görünüm ve "Ana ekrana ekle" (PWA) |
| Eğitim | Ekranda çok seçenek var | 30 dakikalık tanıtım ve tek sayfalık rehber: hızlı iş ekle, statü değiştir, engel bildir |

**Arayüz sadeleştirmeleri** (Bekleme ve Engel'in birleştirilmesi, kanban kartlarının sadeleşmesi, yeni iş formunun kısalması) derlenmiş pakette pahalı ve riskli. Pilotta arayüz olduğu gibi kullanılmalı, geri bildirim toplanmalı ve kalıcı ürüne geçişte bu değişiklikler `modern/` kaynağında yapılmalı.

## 3. Önerilen pilot planı

| Hafta | İş |
|---|---|
| 0 | BT ve KVKK onayı, sunucu, SSO, barındırma; çalışma alanı ve şablonların kurulması; 30 dakikalık tanıtım |
| 1 | Tek ekip, yalnızca günlük işler. Ekip lideri her sabah panodan kontrol eder |
| 2–3 | İkinci ekip ve ekipler arası ortak işler, engel ve revizyon kullanımı |
| 4 | Ölçümler, anket, karar: genişlet, değiştir veya durdur |

**Roller:** pilot sahibi (ürün ve eğitim), BT irtibatı, her ekipten bir lider, 5–10 kullanıcı.

## 4. Başarı ölçütleri (öneri)

- Haftalık aktif kullanıcı oranı (hedef: kullanıcıların %80'i)
- Sorumlu ve terminle açılan işlerin oranı
- İlk termine göre zamanında tamamlama oranı (Ekip panosu bunu zaten hesaplıyor)
- Geciken işin fark edilmesine kadar geçen süre
- WhatsApp veya e-postayla takip edilen işlerde azalma (pilot öncesi ve sonrası kısa anket)
- 409 çakışma sayısı: tüm alan tek kayıtta tutulduğu için eşzamanlı düzenleme sık olursa ölçek sınırına işaret eder

## 5. Senin vermen gereken kararlar

1. **Hangi sürümle pilot?**
   - *Önerilen:* Derlenmiş arayüz ve yeni sunucu. En hızlı yol, tüm özellikler hazır. Dezavantajı: arayüzde hata çıkarsa düzeltmek zor.
   - *Alternatif:* `modern/` prototipini tamamlamak. Sürdürülebilir, ama özellik açığı büyük ve pilot haftalarca gecikir.
2. Barındırma yeri (iç ağ mı, şirket bulutu mu) ve SSO sağlayıcısı (Microsoft veya Google).
3. Pilot ekip(ler) ve pilot süresi.
4. Pilot bittiğinde verilerin silinmesi mi taşınması mı.

## 6. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Derlenmiş arayüzde hata | Düzeltme yavaş | Pilot öncesi duman testi; kritik akışların elle denenmesi |
| Tüm alanın tek kayıtta tutulması | Eşzamanlı düzenlemede 409 | 5–10 kişide kabul edilebilir; çakışma sayısını izle |
| Bildirim olmaması | Kullanım düşer | Günlük özet e-postası |
| Sunucuda eksik yetki kontrolü | Veri sızıntısı | Yetki kurallarına sunucu testleri; BT incelemesi |
| Yedek alınmaması | Veri kaybı | Günlük yedek ve bir kez geri yükleme denemesi |

## 7. Teknik kontrol listesi

- [ ] `/api/workspace` GET ve POST, tüm `action` türleri
- [ ] Sunucu tarafında şema doğrulama ve rol yetkisi; görüntüleyici için yazma reddi testleri
- [ ] `revision` kontrolü ve 409
- [ ] SSO girişi, oturum çerezi, 401 davranışı
- [ ] `npm run build:pilot` çıktısının aynı alan adından sunulması
- [ ] HTTPS ve günlük yedek
- [ ] Boş çalışma alanı, gerçek üyeler, şablonlar
- [ ] Günlük özet e-postası (önerilen)
- [ ] Aydınlatma metni ve BT onayı
- [ ] Pilot başlangıcında 2 kullanıcıyla eşzamanlı deneme: aynı işi iki kişi düzenlediğinde çakışma ekranı çıkıyor mu?
