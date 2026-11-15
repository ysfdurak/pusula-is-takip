// Hazır (değerleri yerleştirilmiş) bir Türkçe metni sözlükle çevirir: önce birebir, sonra {0} kalıplarıyla.
// Hem sunucu (sayfalar, hata iletileri, demo verisi) hem arayüz (sunucudan gelen iletiler) kullanır.
const cache = new WeakMap();
function patterns(dict) {
  let p = cache.get(dict);
  if (p) return p;
  p = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(k)) continue;
    const parts = k.split(/(\{\d+\})/);
    const order = [];
    const src = parts.map((x) => { const m = x.match(/^\{(\d+)\}$/); if (m) { order.push(+m[1]); return '([\\s\\S]*)'; } return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('');
    p.push({ re: new RegExp('^' + src + '$'), order, v, len: k.length });
  }
  p.sort((a, b) => b.len - a.len);
  cache.set(dict, p);
  return p;
}
export function translateText(dict, s, depth = 0) {
  if (typeof s !== 'string' || !s) return s;
  if (Object.prototype.hasOwnProperty.call(dict, s)) return dict[s];
  // Çok satırlı ileti (ör. toplu girişte satır hataları): satır satır
  if (s.includes('\n') && depth < 2) {
    const lines = s.split('\n');
    if (lines.length > 1) {
      return lines.map((l) => translateText(dict, l, depth + 1)).join('\n');
    }
  }
  for (const { re, order, v } of patterns(dict)) {
    const m = s.match(re);
    if (m) { const vals = []; order.forEach((idx, i) => (vals[idx] = depth < 2 ? translateText(dict, m[i + 1], depth + 1) : m[i + 1])); return v.replace(/\{(\d+)\}/g, (x, i) => vals[+i] ?? x); }
  }
  return s;
}
/** Nesnenin içindeki tüm dizgileri çevirir (örnek veri için). Anahtarlara dokunmaz. */
export function translateDeep(dict, o, skip = new Set()) {
  if (typeof o === 'string') return translateText(dict, o);
  if (Array.isArray(o)) return o.map((x) => translateDeep(dict, x, skip));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, skip.has(k) ? v : translateDeep(dict, v, skip)]));
  return o;
}
