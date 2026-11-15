// Sunucu tarafı dil desteği. Arayüzle aynı sözlüğü (src/shared/i18n/en.json) kullanır.
// Dil: adresteki ?lang=tr|en, yoksa "pusula_dil" çerezi (arayüz yazar), yoksa Türkçe.
// Sunucunun ürettiği sayfalar (giriş, hata, izin ekranı) ve JSON hata iletileri yanıt yazılırken çevrilir;
// kaynak kodda metinler Türkçe kalır.
import { readFileSync } from 'node:fs';
import { translateText, translateDeep } from '../src/shared/i18n/translate.js';

const EN = JSON.parse(readFileSync(new URL('../src/shared/i18n/en.json', import.meta.url), 'utf8'));
export const LANG_COOKIE = 'pusula_dil';

export function langOf(req, url) {
  const q = url?.searchParams.get('lang');
  if (q === 'tr' || q === 'en') return q;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)pusula_dil=(tr|en)/);
  return m ? m[1] : 'tr';
}

export const tx = (lang, s) => (lang === 'en' ? translateText(EN, s) : s);

/** Örnek veriyi dile çevirir (anahtar ve kimliklere dokunmaz; yalnız sözlükte karşılığı olan dizgiler değişir). */
export const translateSample = (lang, data) => (lang === 'en' ? translateDeep(EN, data, new Set(['id', 'email', 'status', 'kind', 'workspace'])) : data);

const decode = (s) => s.replace(/&(#39|quot|lt|gt|amp);/g, (m, e) => ({ '#39': "'", quot: '"', lt: '<', gt: '>', amp: '&' })[e]);
const encode = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Kodlanmış HTML metnini çevirir; karşılığı yoksa olduğu gibi bırakır. */
const tHtml = (s) => {
  const plain = decode(s);
  const out = translateText(EN, plain);
  return out === plain ? s : encode(out);
};

/** HTML belgesindeki metin parçalarını ve başlığı çevirir; etiketlere ve niteliklere (title hariç) dokunmaz. */
export function translateHtml(lang, html) {
  if (lang !== 'en') return html;
  return html
    .replace('<html lang="tr">', '<html lang="en">')
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith('<')) return part.replace(/(title|aria-label)="([^"]*)"/g, (m, a, v) => `${a}="${tHtml(v)}"`);
      const t = part.trim();
      if (!t) return part;
      const lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
      const arrow = t.match(/^([\s\S]*?)(\s*[→›])$/);
      return lead + (arrow ? tHtml(arrow[1]) + arrow[2] : tHtml(t)) + trail;
    })
    .join('');
}

/**
 * Yanıtı dile göre çevirecek şekilde sarar: HTML gövdesi ve JSON'daki "error" alanı.
 * Arayüz dosyası (tek HTML) ve yönetim sayfaları hariç tutulur (skip()).
 */
export function wrapResponse(res, lang, skip = () => false) {
  if (lang !== 'en') return;
  const end = res.end.bind(res);
  res.end = (body, ...rest) => {
    try {
      if (typeof body === 'string' && !skip()) {
        const type = String(res.getHeader('Content-Type') || '');
        if (type.startsWith('text/html')) body = translateHtml(lang, body);
        else if (type.startsWith('application/json') && body.includes('"error"')) {
          const o = JSON.parse(body);
          if (typeof o.error === 'string') { o.error = translateText(EN, o.error); body = JSON.stringify(o); }
        }
      }
    } catch {}
    return end(body, ...rest);
  };
}
