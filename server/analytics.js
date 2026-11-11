// Kullanım ölçümü ve geri bildirim: "Kaç kişi denedi, neleri kullandı, ne düşünüyor?"
//
// Neden kendi ölçümümüz (Google Analytics değil)?
//   - Arayüzün güvenlik politikası (CSP) dış script yüklemeyi kapatır; analitik için bunu açmak saldırı yüzeyini büyütür.
//   - Üçüncü taraf çerezi yok: çerez onayı (KVKK/GDPR) gerekmez, veri başka şirkete gitmez.
//   - Web ve Claude (MCP) kullanımı aynı yerde ölçülür; bir analitik aracı Claude içindeki kullanımı göremez.
//
// Gizlilik kararları:
//   - Yalnızca ZİYARETÇİ DEMO alanları ölçülür. Şirket kurulumunda çalışan takibi yapılmaz (DEMO_MODE kapalıyken hiçbir olay yazılmaz).
//   - Olaylarda e-posta yok: kişi, sunucuya özel gizli bir anahtarla üretilen takma kimlikle (HMAC) tutulur.
//     Demo alanı silindikten sonra da sayılar kalır ama kimin olduğu geri çıkarılamaz.
//   - Olay içeriği yok: "iş oluşturuldu" yazılır, işin adı yazılmaz.
//   - Olaylar ANALYTICS_RETENTION_DAYS (varsayılan 180) gün sonra silinir.
//   - Geri bildirimde e-posta YALNIZCA kişi "bana dönebilirsin" derse saklanır.
import { createHmac, randomBytes } from 'node:crypto';

const NAME = /^[a-z0-9_:-]{1,48}$/;
const DAY = 864e5;

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dayKey = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(ms));

/** Ekran ve olay adlarının Türkçe karşılıkları (yönetici sayfası için). */
export const LABELS = {
  'oturum:giris': 'Giriş',
  'oturum:demo_acildi': 'Demo alanı açıldı',
  'oturum:claude_baglandi': "Claude'a bağlandı",
  'ekran:mine': 'Ekran: Benim panom',
  'ekran:dashboard': 'Ekran: Ekip panosu',
  'ekran:tasks': 'Ekran: İş listesi',
  'ekran:team': 'Ekran: Ekipler',
  'ekran:projects': 'Ekran: Projeler',
  'ekran:decisions': 'Ekran: Kararlar',
  'ekran:blockers': 'Ekran: Engeller',
  'ekran:notifications': 'Ekran: Bildirimler',
  'ekran:settings': 'Ekran: Ayarlar',
  'ekran:claude': 'Claude',
  'gorunum:board': 'Görünüm: Statü panosu (kanban)',
  'gorunum:list': 'Görünüm: Liste',
  'is:created': 'İş oluşturdu',
  'is:status': 'Durum değiştirdi',
  'is:revision': 'İşi düzenledi',
  'is:blocker': 'Engel bildirdi / çözdü',
  'is:comment': 'Yorum yazdı',
  'is:attach': 'Dosya ekledi',
  'is:excel': "Excel'e aktardı",
  'is:geri_bildirim': 'Geri bildirim gönderdi',
};
export const label = (key) => LABELS[key] || (key.startsWith('claude:') ? 'Claude: ' + key.slice(7) : key);

/**
 * @param {object} o
 * @param {import('node:sqlite').DatabaseSync} o.db
 * @param {(email: string) => boolean} o.shouldTrack   bu kişi ölçülür mü (yalnızca demo ziyaretçileri)
 * @param {number} [o.retentionDays]
 * @param {() => number} [o.now]
 */
export function createAnalytics({ db, shouldTrack, retentionDays = 180, now = () => Date.now() }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, visitor TEXT NOT NULL, event TEXT NOT NULL, channel TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS analytics_events_at ON analytics_events (at);
    CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, visitor TEXT NOT NULL, email TEXT,
      rating INTEGER, message TEXT NOT NULL, screen TEXT, channel TEXT NOT NULL);
  `);
  // Takma kimlik anahtarı: sunucuya özel, ilk açılışta üretilir ve veritabanında kalır (yedekle birlikte taşınır).
  let salt = db.prepare("SELECT value FROM settings WHERE key = 'analytics_salt'").get()?.value;
  if (!salt) {
    salt = randomBytes(32).toString('base64url');
    db.prepare("INSERT INTO settings (key, value) VALUES ('analytics_salt', ?)").run(salt);
  }
  const visitorOf = (email) => createHmac('sha256', salt).update(String(email).toLowerCase()).digest('base64url').slice(0, 22);

  /** Olay kaydı. `event` "tür:ad" biçiminde (ör. "is:created", "claude:panom"). Ölçülmeyen kişide hiçbir şey yazılmaz. */
  function track(email, event, channel = 'web') {
    if (!email || !NAME.test(event) || !['web', 'claude'].includes(channel) || !shouldTrack(email)) return false;
    db.prepare('INSERT INTO analytics_events (at, visitor, event, channel) VALUES (?, ?, ?, ?)').run(now(), visitorOf(email), event, channel);
    return true;
  }

  /** Geri bildirim: herkes gönderebilir (şirket pilotunda da işe yarar); e-posta yalnızca izinle. */
  function addFeedback(email, { rating, message, screen = '', contact = false, channel = 'web' }) {
    const text = String(message || '').trim();
    const score = rating === undefined || rating === null || rating === '' ? null : Number(rating);
    if (!text && score === null) throw Error('Bir puan ver ya da birkaç kelime yaz.');
    if (text.length > 2000) throw Error('Geri bildirim en fazla 2.000 karakter olabilir.');
    if (score !== null && !(Number.isInteger(score) && score >= 1 && score <= 5)) throw Error('Puan 1 ile 5 arasında olmalı.');
    db.prepare('INSERT INTO feedback (at, visitor, email, rating, message, screen, channel) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(now(), visitorOf(email), contact ? email : null, score, text, String(screen).slice(0, 48), channel === 'claude' ? 'claude' : 'web');
    track(email, 'is:geri_bildirim', channel);
    return { ok: true };
  }

  function purge() {
    const cutoff = now() - retentionDays * DAY;
    db.prepare('DELETE FROM analytics_events WHERE at <= ?').run(cutoff);
    db.prepare('DELETE FROM feedback WHERE at <= ?').run(cutoff);
  }

  /** Yönetici özeti: ziyaretçi sayıları, günlük kullanım, özellik kullanımı, huni ve geri bildirimler. */
  function summary({ days = 30 } = {}) {
    const t = now();
    const since = t - days * DAY;
    const rows = db.prepare('SELECT at, visitor, event, channel FROM analytics_events WHERE at > ? ORDER BY at').all(since);
    const visitors = new Set(rows.map((r) => r.visitor));
    const daysByVisitor = new Map();
    for (const r of rows) (daysByVisitor.get(r.visitor) || daysByVisitor.set(r.visitor, new Set()).get(r.visitor)).add(dayKey(r.at));
    const did = (event) => new Set(rows.filter((r) => r.event === event).map((r) => r.visitor));
    const usedClaude = new Set(rows.filter((r) => r.channel === 'claude').map((r) => r.visitor));

    const daily = Array.from({ length: days }, (_, i) => {
      const key = dayKey(t - (days - 1 - i) * DAY);
      const dayRows = rows.filter((r) => dayKey(r.at) === key);
      return { gun: key, ziyaretci: new Set(dayRows.map((r) => r.visitor)).size, yeni: dayRows.filter((r) => r.event === 'oturum:demo_acildi').length };
    });

    const counts = new Map();
    for (const r of rows) {
      if (r.event.startsWith('oturum:')) continue;
      const key = `${r.event}|${r.channel}`;
      const c = counts.get(key) || { olay: r.event, ad: label(r.event), kanal: r.channel, kullanim: 0, kisi: new Set() };
      c.kullanim++;
      c.kisi.add(r.visitor);
      counts.set(key, c);
    }
    const features = [...counts.values()].map((c) => ({ ...c, kisi: c.kisi.size })).sort((a, b) => b.kisi - a.kisi || b.kullanim - a.kullanim);

    const created = did('is:created');
    const statused = did('is:status');
    const funnel = [
      { adim: 'Demoyu açtı ya da giriş yaptı', kisi: visitors.size },
      { adim: 'İş oluşturdu', kisi: created.size },
      { adim: 'İşin durumunu değiştirdi', kisi: statused.size },
      { adim: "Claude'dan kullandı", kisi: usedClaude.size },
      { adim: 'Geri bildirim verdi', kisi: did('is:geri_bildirim').size },
    ];

    const feedbackRows = db.prepare('SELECT at, email, rating, message, screen, channel FROM feedback WHERE at > ? ORDER BY at DESC').all(since);
    const rated = feedbackRows.filter((f) => f.rating);
    return {
      donem: { gun: days, baslangic: dayKey(since), bitis: dayKey(t) },
      ziyaretci: visitors.size,
      yeniDemoAlani: rows.filter((r) => r.event === 'oturum:demo_acildi').length,
      geriDonen: [...daysByVisitor.values()].filter((s) => s.size >= 2).length,
      claudeKullanan: usedClaude.size,
      claudeBaglayan: did('oturum:claude_baglandi').size,
      gunluk: daily,
      ozellikler: features,
      huni: funnel,
      geriBildirim: {
        adet: feedbackRows.length,
        ortalamaPuan: rated.length ? Math.round((rated.reduce((s, f) => s + f.rating, 0) / rated.length) * 10) / 10 : null,
        son: feedbackRows.slice(0, 50).map((f) => ({ tarih: dayKey(f.at), puan: f.rating, metin: f.message, ekran: f.screen, kanal: f.channel, iletisim: f.email || '' })),
      },
    };
  }

  /** Yönetici sayfası (sunucuda üretilen HTML; dış kaynak yok). */
  function renderPage(s, basePath = '') {
    const max = Math.max(1, ...s.gunluk.map((d) => d.ziyaretci));
    const bars = s.gunluk
      .map((d) => `<div title="${d.gun}: ${d.ziyaretci} ziyaretçi, ${d.yeni} yeni" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:120px">
<div style="background:#2c6549;border-radius:3px 3px 0 0;height:${Math.round((d.ziyaretci / max) * 100)}%;min-height:${d.ziyaretci ? 2 : 0}px"></div></div>`)
      .join('');
    const card = (value, text) => `<div style="background:#fff;border:1px solid #e6eae1;border-radius:10px;padding:14px 16px"><div style="font-size:26px;font-weight:700">${value}</div><div style="color:#5d6f66;font-size:12px">${text}</div></div>`;
    const first = s.huni[0].kisi || 1;
    const funnel = s.huni
      .map((h) => `<tr><td>${escapeHtml(h.adim)}</td><td style="text-align:right">${h.kisi}</td><td style="width:45%"><div style="background:#d6edbd;height:10px;border-radius:5px;width:${Math.round((h.kisi / first) * 100)}%"></div></td></tr>`)
      .join('');
    const features = s.ozellikler.length
      ? s.ozellikler.map((f) => `<tr><td>${escapeHtml(f.ad)}</td><td>${f.kanal === 'claude' ? 'Claude' : 'Web'}</td><td style="text-align:right">${f.kisi}</td><td style="text-align:right">${f.kullanim}</td></tr>`).join('')
      : '<tr><td colspan="4" style="color:#5d6f66">Henüz kullanım yok.</td></tr>';
    const fb = s.geriBildirim.son.length
      ? s.geriBildirim.son
          .map((f) => `<li style="border-top:1px solid #eef0ea;padding:10px 0"><div style="font-size:12px;color:#5d6f66">${f.tarih} · ${f.kanal === 'claude' ? 'Claude' : 'Web'}${f.ekran ? ' · ' + escapeHtml(label('ekran:' + f.ekran).replace('Ekran: ', '')) : ''}${f.puan ? ' · ' + '★'.repeat(f.puan) + '☆'.repeat(5 - f.puan) : ''}${f.iletisim ? ' · <b>' + escapeHtml(f.iletisim) + '</b>' : ''}</div>${f.metin ? `<div style="white-space:pre-wrap">${escapeHtml(f.metin)}</div>` : ''}</li>`)
          .join('')
      : '<li style="color:#5d6f66">Henüz geri bildirim yok.</li>';
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kullanım · Pusula</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f7f8f4;color:#243c33;margin:0}main{max-width:900px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:4px 0}h2{font-size:15px;margin:26px 0 10px}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e6eae1;border-radius:10px;font-size:13px}td,th{padding:8px 10px;border-top:1px solid #eef0ea;text-align:left}th{color:#5d6f66;font-weight:600;border-top:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}a{color:#2c6549}</style></head>
<body><main><p style="font-weight:bold;margin:0">pusula.</p><h1>Demo kullanımı</h1>
<p style="color:#5d6f66;margin:0">Son ${s.donem.gun} gün (${s.donem.baslangic} – ${s.donem.bitis}). Yalnızca ziyaretçi demo alanları ölçülür; kişiler takma kimlikle sayılır. <a href="${basePath}/yonetim/istatistik.json">JSON</a></p>
<h2>Özet</h2><div class="grid">${card(s.ziyaretci, 'ziyaretçi')}${card(s.yeniDemoAlani, 'yeni demo alanı')}${card(s.geriDonen, 'farklı günde geri dönen')}${card(s.claudeKullanan, "Claude'dan kullanan")}${card(s.geriBildirim.ortalamaPuan ?? '–', `ortalama puan (${s.geriBildirim.adet} geri bildirim)`)}</div>
<h2>Günlük ziyaretçi</h2><div style="background:#fff;border:1px solid #e6eae1;border-radius:10px;padding:12px;display:flex;gap:3px;align-items:flex-end">${bars}</div>
<h2>Huni: ziyaretçiler nereye kadar geldi?</h2><table>${funnel}</table>
<h2>Neleri denediler?</h2><table><tr><th>Özellik</th><th>Kanal</th><th style="text-align:right">Kişi</th><th style="text-align:right">Kullanım</th></tr>${features}</table>
<h2>Geri bildirimler</h2><ul style="list-style:none;margin:0;padding:4px 14px;background:#fff;border:1px solid #e6eae1;border-radius:10px">${fb}</ul>
<p style="margin-top:20px"><a href="${basePath}/">Pusula'ya dön</a></p></main></body></html>`;
  }

  return { track, addFeedback, summary, renderPage, purge, visitorOf };
}
