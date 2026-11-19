# Mülakatta sorulabilecek sorular · Pusula

Bu kart, projeyi kendi ağzınla anlatabilmen için. Cevaplar kısa tutuldu; ayrıntısı belirtilen belgede. Kod yapay zekâ (Claude) ile yazıldı; kapsam, öncelik ve aşağıdaki kararlar senin. Bunu saklama, açıkça söyle: "Ürünü ve kararları ben belirledim, kodu yapay zekâyla yazdım, her kararın nedenini anlatabilirim."

**1. Bu proje ne yapıyor?**
Operasyon ekiplerinin işlerini, sorumlularını, terminlerini ve işi durduran engelleri tek ekranda izleyen Türkçe iş takip uygulaması. Web arayüzünden ve Claude sohbetinin içinden kullanılabiliyor.

**2. Benzer araçlardan farkı ne?**
Vardiyalı depo ekibi için: herkese kendi gündemi, ekip liderine tek bakışta durum, ilk termin ve her termin değişikliğinin gerekçesi saklanır, engel çözüm sorumlusuyla işin üstünde durur.

**3. Neden ilk termini saklıyorsun?**
Termin sürekli ötelenirse 'zamanında' oranı yanıltır. İlk termine göre ve güncel termine göre zamanında tamamlanma ayrı ölçülüyor.

**4. Claude bağlantısı nasıl çalışıyor?**
MCP sunucusu: Claude, kullanıcının izin verdiği 13 araçla ve kullanıcının kendi yetkileriyle çalışır. OAuth ile bağlanır, PKCE zorunlu; bağlantı 'Bağlı uygulamalar' sayfasından kaldırılır.

**5. Bağlantı kaldırılınca ne oluyor?**
Erişim anahtarı ve yenileme anahtarı geçersiz olur; kaldırılan bağlantı iş açamaz, denetim kaydına yeni yazma düşmez. Bunu uçtan uca bir test sınıyor.

**6. Neden aynı çekirdek üzerinde web ve MCP?**
Kurallar tek yerde kalsın diye. MCP araçları kural kopyalamaz, web'in kullandığı kaydetme yolunu çağırır; yetki, termin ve geçmiş kuralları tek yerde.

**7. Teknik yapı?**
Node.js sunucu, React arayüz, SQLite; VPS'te Docker ve Caddy arkasında. Sunucusuz tarayıcı demoları da var.

**8. Güvenlikte nelere dikkat ettin?**
Google ile giriş (parola tutulmaz), PKCE, kayıtlı dönüş adresi, kullanılmamış istemci kayıtlarının bir saat sonra silinmesi (yoksa betikle 500 kayıt doldurulup yeni bağlantılar kalıcı kapatılabilirdi), denetim kaydı.

**9. Erişilebilirlik?**
Soluk yazılar en az 4,6:1 karşıtlığa çekildi; axe denetimi demo alanında 0 ihlal; telefonda ana sekmeler 48 px. Büyük yazıda seçimler kırpılmasın diye üst çubuk gerektiğinde iki satıra iniyor.

**10. Neyi farklı yapardın?**
MCP araçlarını ve e-postaları da baştan iki dilli yapardım; şu an web İngilizce, MCP ve e-postalar Türkçe.


## Bu projede verdiğim kararlar (sorun → karar → bedel)

- **Kalıcı istemci kaydı sınırı:** Betik 500 sahte kayıtla Claude bağlantısını kalıcı kapatabilirdi → kullanılmamış eski kayıtlar silinir → kötü niyetli biri en fazla bir saatliğine engelleyebilir.
- **Kaldırılan bağlantı testi:** Yalnız okuma denetleniyordu → yazma da sınanıyor → test süresi uzadı.

---
Son güncelleme: 19 Kasım 2026.
