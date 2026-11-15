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
    if (m) { const vals = []; order.forEach((idx, i) => (vals[idx] = depth < 2 ? translateText(dict, m[i + 1], depth + 1) : m[i + 1])); return fill(v, vals); }
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

// İngilizcede sayı 1 ise ardından gelen çoğul ismi tekile çevirir ("1 tasks" → "1 task").
// Türkçede sayıdan sonra isim tekil kaldığı için kaynakta bu ayrım yoktur; yalnızca İngilizce çıktıda uygulanır.
export const PLURAL = {
  tasks: 'task', records: 'record', rows: 'row', days: 'day', errors: 'error', warnings: 'warning', hours: 'hour',
  levels: 'level', windows: 'window', months: 'month', units: 'unit', departments: 'department', weeks: 'week',
  actions: 'action', 'person-days': 'person-day', people: 'person', supports: 'support', items: 'item',
  comments: 'comment', members: 'member', teams: 'team', users: 'user', minutes: 'minute', files: 'file',
  notifications: 'notification', entries: 'entry', changes: 'change', steps: 'step', reports: 'report',
  projects: 'project', workspaces: 'workspace', checks: 'check', requests: 'request', approvals: 'approval',
  blockers: 'blocker', shifts: 'shift', sites: 'site', locations: 'location', times: 'time', subtasks: 'subtask',
  attachments: 'attachment', employees: 'employee', managers: 'manager', reviews: 'review', updates: 'update', followers: 'follower', templates: 'template', postponements: 'postponement',
};
/** Metnin ilk birkaç kelimesindeki ilk çoğul ismi tekile çevirir. */
export function singularize(text, maxWords = 3) {
  const parts = String(text).split(/(\s+)/);
  let seen = 0;
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i] || /^\s+$/.test(parts[i])) continue;
    if (++seen > maxWords) break;
    const m = parts[i].match(/^([A-Za-z-]+)(.*)$/s);
    const s = m && PLURAL[m[1].toLowerCase()];
    if (s && s !== m[1].toLowerCase()) {
      parts[i] = (m[1][0] === m[1][0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s) + m[2];
      return parts.join('');
    }
  }
  return text;
}
const isOne = (v) => v !== null && v !== undefined && v !== '' && String(v).trim() === '1';
/** "{0} tasks" biçimini değerlerle doldurur; değeri 1 olan yer tutucudan sonraki çoğul ismi tekile çevirir. */
export function fill(f, vals) {
  const parts = String(f).split(/(\{\d+\})/);
  for (let i = 1; i < parts.length; i += 2) {
    const v = vals[+parts[i].slice(1, -1)];
    if (isOne(v) && i + 1 < parts.length) parts[i + 1] = singularize(parts[i + 1]);
  }
  return parts.map((p) => { const m = p.match(/^\{(\d+)\}$/); return m ? (vals[+m[1]] === undefined ? p : String(vals[+m[1]])) : p; }).join('');
}
