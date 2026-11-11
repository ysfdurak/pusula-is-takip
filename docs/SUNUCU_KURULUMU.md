# Sunucu kurulumu: VPS + alan adı + Google girişi + Claude bağlantısı

Bu rehber Pusula'yı kendi sunucunda (VPS) `https://pusula.ysfdurak.com` adresinde çalıştırır ve Claude'a bağlar. Şirket içi kurulum (Microsoft girişi, IIS/nginx) için: [PILOT_KURULUM.md](PILOT_KURULUM.md).

```
Tarayıcı ─┐                         ┌─ Caddy (80/443, otomatik HTTPS)
Claude ───┼── pusula.ysfdurak.com ──┤
          │   (Cloudflare DNS)      └─▶ Pusula (Docker, yalnızca içeride 8080) ─▶ SQLite + günlük yedek
          └─ giriş: Google hesabı · Claude bağlantısı: OAuth izni (docs/MCP.md)
```

## 0. Ne lazım?

| Parça | Öneri | Not |
|---|---|---|
| VPS | 2 vCPU, 4 GB RAM, 40 GB disk, **Ubuntu 24.04** | Pusula 200-300 MB RAM kullanır; aynı sunucuya başka projeler de sığar |
| Alan adı | `ysfdurak.com` (Cloudflare) | Pusula için alt alan adı: `pusula.ysfdurak.com` |
| Google hesabı | Google Cloud Console erişimi | Giriş için OAuth istemcisi (ücretsiz) |
| Bilgisayarında | SSH (Windows'ta PowerShell'de hazır gelir) | Sunucuya bağlanmak için |

## 1. Sunucuyu güvenli hale getir

VPS sağlayıcısının panelinde sunucuyu oluştururken **SSH anahtarı** ekle (parola yerine). Bilgisayarında anahtar yoksa:

```bash
ssh-keygen -t ed25519 -C "ysfdurak-vps"      # Enter'larla geç; ~/.ssh/id_ed25519.pub dosyasını panele yapıştır
ssh root@SUNUCU_IP                            # ilk bağlantı
```

Sunucuda:

```bash
apt update && apt upgrade -y
apt install -y ufw unattended-upgrades git
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable   # yalnızca SSH ve web açık
dpkg-reconfigure -plow unattended-upgrades                                  # güvenlik güncellemeleri otomatik
adduser pusula && usermod -aG sudo pusula                                   # root yerine günlük kullanıcı
rsync --archive --chown=pusula:pusula ~/.ssh /home/pusula                   # aynı SSH anahtarıyla girsin
```

Bundan sonra `ssh pusula@SUNUCU_IP` ile bağlan. İstersen `/etc/ssh/sshd_config` içinde `PermitRootLogin no` ve `PasswordAuthentication no` yapıp `sudo systemctl restart ssh` ile root ve parola girişini kapat.

**Neden?** İnternete açılan her sunucu dakikalar içinde otomatik parola denemeleri alır. Anahtarla giriş, kapalı portlar ve otomatik güncellemeler bunların neredeyse hepsini boşa çıkarır.

## 2. Docker'ı kur

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker pusula && exit        # çıkıp yeniden bağlan
docker run --rm hello-world                   # çalışıyor mu?
```

## 3. Alan adını sunucuya yönlendir (Cloudflare)

Cloudflare → `ysfdurak.com` → **DNS** → **Kayıt ekle**:

| Tür | Ad | İçerik | Proxy |
|---|---|---|---|
| A | `pusula` | SUNUCU_IP | **Yalnızca DNS (gri bulut)** |

Gri bulut ile Caddy sertifikayı doğrudan alır. İleride Cloudflare proxy'si (turuncu bulut) açılırsa **SSL/TLS → Full (strict)** seçilmeli. Kontrol: `ping pusula.ysfdurak.com` sunucu IP'sini göstermeli (birkaç dakika sürebilir).

## 4. Google girişi için OAuth istemcisi

1. [console.cloud.google.com](https://console.cloud.google.com) → yeni proje: **Pusula**.
2. **API'ler ve Hizmetler → OAuth izin ekranı** (Google Auth Platform): Kullanıcı türü **Harici**, uygulama adı **Pusula**, destek e-postası, geliştirici iletişim e-postası. Kapsamlar: `openid`, `email`, `profile` (temel kapsamlar; Google doğrulaması gerekmez).
3. **Kitle**: Yayın durumu "Test" iken yalnızca eklediğin test kullanıcıları girebilir. Başkalarının da girebilmesi için **Uygulamayı yayınla**.
4. **Kimlik bilgileri → Kimlik bilgisi oluştur → OAuth istemci kimliği** → Uygulama türü **Web uygulaması**.
   - **Yetkili yönlendirme URI'leri:** `https://pusula.ysfdurak.com/auth/callback`
5. Çıkan **İstemci kimliği** ve **İstemci gizli anahtarı**nı not et. Gizli anahtar parola gibidir: kimseyle paylaşma, GitHub'a koyma.

## 5. Pusula'yı kur ve ayarla

```bash
git clone https://github.com/ysfdurak/pusula-is-takip.git && cd pusula-is-takip
cp .env.example .env && nano .env
```

`.env` içinde değiştirilecekler:

```bash
APP_URL=https://pusula.ysfdurak.com/
PUSULA_ADMINS=senin.adresin@gmail.com        # ilk yönetici (Google'la gireceğin adres)
PUSULA_WORKSPACE_NAME=Pusula
AUTH_MODE=google
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
MCP_ENABLED=true                              # Claude bağlantısı
DEMO_MODE=true                                # ziyaretçilere kendi demo alanı (aşağıda)
MAIL_MODE=off
DATA_DIR=/data
```

`deploy/Caddyfile` içindeki alan adı farklıysa düzelt. Sonra:

```bash
cd deploy
docker compose -f docker-compose.vps.yml up -d --build    # ilk derleme birkaç dakika sürer
docker compose -f docker-compose.vps.yml logs -f          # "Pusula pilot sunucusu: https://..." satırını bekle; Ctrl+C ile çık
curl https://pusula.ysfdurak.com/healthz                  # {"ok":true}
```

Tarayıcıda `https://pusula.ysfdurak.com` → **Giriş yap** → Google hesabın. `PUSULA_ADMINS`'teki adresle girdiğinde yönetici olursun. Diğer kişileri **Ekip → Kişiler**'den eklersin; Pusula'ya eklenmemiş bir Google hesabı giremez.

### Ziyaretçi demo alanları (`DEMO_MODE=true`)

Portföy ziyaretçisi Google ile girdiğinde **kendine ait** bir çalışma alanı açılır: kurgusal bir depo ekibi (Ece, Mert, Selin) ve örnek işler; yönetici ziyaretçinin kendisidir. Kurallar:

| Kural | Neden |
|---|---|
| Herkesin alanı ayrı | Ziyaretçiler birbirinin verisini bozamaz, birbirinin e-posta adresini göremez |
| Alana yalnızca `@example.test` adresli kurgusal kişi eklenir | Ziyaretçi gerçek birini davet edemez, sunucu kimseye e-posta göndermez |
| `DEMO_TTL_DAYS` (varsayılan 7) gün sonra alan tümüyle silinir | Sunucu dolmaz; ziyaretçi verisi süresiz tutulmaz. Silinirken oturum ve Claude bağlantısı da kapanır |
| En fazla `DEMO_MAX_SANDBOXES` (varsayılan 300) alan | Kötüye kullanıma karşı; dolunca "Demo şu an dolu" sayfası |
| İlk girişte karşılama sayfası | Alanın kurgusal olduğunu, ne zaman silineceğini ve e-postanın ne için tutulduğunu açıkça söyler |
| `PUSULA_ADMINS` demo alanı almaz | Senin gerçek çalışma alanın demodan etkilenmez; ziyaretçiler onu göremez |

Ziyaretçinin e-posta adresi giriş ve güvenlik kaydı (audit) için tutulur. Kişisel sitende kısa bir gizlilik notu (hangi veri, ne kadar süre, ne için) bulundurman iyi olur.

### Kullanım ölçümü ve geri bildirim

`https://pusula.ysfdurak.com/yonetim/istatistik` (yalnızca `PUSULA_ADMINS`): kaç ziyaretçi, kaçı farklı günde geri döndü, kaçı Claude'dan kullandı, günlük grafik, huni (giriş → iş oluşturma → durum değiştirme → Claude → geri bildirim), hangi ekranları ve özellikleri web ve Claude üzerinden kullandılar, geri bildirimler ve ortalama puan. `?gun=90` ile dönem değişir; `istatistik.json` aynı veriyi JSON verir. Claude'a "demoyu kaç kişi denedi?" diye de sorabilirsin (`kullanim_istatistikleri` aracı, yalnızca yöneticide).

| Karar | Neden |
|---|---|
| Google Analytics yok, ölçüm sunucuda | Arayüzün güvenlik politikası dış scripti kapatır; üçüncü taraf çerezi ve çerez onayı gerekmez; veri başka şirkete gitmez; Claude içindeki kullanım da aynı yerde ölçülür |
| Yalnızca demo ziyaretçileri ölçülür | Şirket kurulumunda (`DEMO_MODE=false`) hiçbir olay yazılmaz: çalışan takibi yapılmaz |
| Kişi takma kimlikle (sunucuya özel gizli anahtarla HMAC) | Olaylarda e-posta yok; demo alanı silindikten sonra sayılar kalır ama kimin olduğu çıkarılamaz |
| İçerik yazılmaz | "İş oluşturdu" kaydedilir, işin adı kaydedilmez |
| İş olayları sunucuda üretilir | Arayüz yalnızca ekran adlarını bildirebilir; "iş oluşturdu" gibi olayları uyduramaz |
| Olaylar ve geri bildirim `ANALYTICS_RETENTION_DAYS` (varsayılan 180) gün sonra silinir | Veri süresiz tutulmaz |
| Geri bildirimde e-posta yalnızca "bana dönebilirsiniz" işaretlenirse | Kişi açıkça izin vermedikçe geri bildirim anonimdir |

Geri bildirim düğmesi kenar çubuğunda ve **Ayarlar**'da (telefonda) durur; şirket kurulumunda da çalışır ama orada ölçüm yapılmaz. Gizlilik notuna şunu ekle: "Demo kullanımı takma kimlikle, içerik olmadan ve 180 gün süreyle ölçülür; üçüncü taraf analitik aracı ve çerezi kullanılmaz." Kişisel sitenin sayfa ziyaretleri için çerezsiz ve ücretsiz **Cloudflare Web Analytics** kullanılabilir (Cloudflare → Analytics & Logs → Web Analytics).

## 6. Claude'a bağla

1. Claude → **Ayarlar → Bağlayıcılar (Connectors) → Özel bağlayıcı ekle**.
2. Ad: **Pusula**, adres: `https://pusula.ysfdurak.com/mcp`.
3. **Bağlan** → Pusula giriş sayfası (Google) → izin ekranında uygulama adını ve dönüş adresini (`claude.ai`) kontrol et → **İzin ver**.
4. Yeni sohbette: "Pusula'da panomu göster" ya da "Bu hafta geciken işler neler?".

Ziyaretçiler de aynı adımlarla kendi demo alanlarını Claude'a bağlayabilir: izin ekranından önce Google ile girerler, demo alanı o anda açılır.

Bağlantıyı kaldırmak için Claude'da bağlayıcıyı kaldır **ve** `https://pusula.ysfdurak.com/oauth/baglantilar` sayfasından **Kaldır**'a bas (ikincisi anahtarı sunucuda hemen geçersiz kılar). Ücretsiz Claude planında tek özel bağlayıcı eklenebilir.

## 7. Bakım

```bash
cd ~/pusula-is-takip && git pull && cd deploy && docker compose -f docker-compose.vps.yml up -d --build   # güncelleme
docker compose -f docker-compose.vps.yml exec pusula ls /data/backups                                  # yedekler (açılışta + günlük, 14 adet)
docker compose -f docker-compose.vps.yml cp pusula:/data/backups ./yedekler                            # yedekleri sunucu dışına almak için önce buraya kopyala
```

Yedekler aynı sunucuda durur; sunucu kaybolursa onlar da kaybolur. Ayda bir `scp -r pusula@SUNUCU_IP:~/pusula-is-takip/deploy/yedekler .` ile bilgisayarına indir ya da sağlayıcının yedek/anlık görüntü (snapshot) özelliğini aç.

## Sorun giderme

| Belirti | Olası neden |
|---|---|
| Tarayıcı "bağlantı güvenli değil" diyor | DNS henüz yayılmadı ya da Cloudflare turuncu bulutta. `docker compose logs caddy` |
| Google "redirect_uri_mismatch" | Google'daki yönlendirme URI'si `APP_URL` + `auth/callback` ile birebir aynı değil (sondaki `/` dahil) |
| "Pusula erişimin yok" | Bu Google adresi Pusula'ya üye olarak eklenmemiş ya da `PUSULA_ADMINS`'te değil |
| Claude "bağlanamadı" | `https://pusula.ysfdurak.com/.well-known/oauth-protected-resource` açılıyor mu? `MCP_ENABLED=true` mı? |
| Claude bağlandı ama araç yok | Sohbette bağlayıcının açık olduğunu kontrol et (araç simgesi) |

## Bilinen sınırlar

- `DEMO_MODE=false` iken yalnızca Pusula'ya eklenmiş kişiler girer.
- Demo alanı sıfırlama düğmesi yok; süre dolunca silinir, yeniden girişte yenisi açılır.
- E-posta bildirimi Google modunda kapalıdır (`MAIL_MODE=off`); Outlook gönderimi şirket kurulumu içindir.
