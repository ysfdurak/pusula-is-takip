// Arayüz dili: tr (varsayılan) ya da en. Seçim sırası: adresteki ?lang=, "pusula_dil" çerezi, Türkçe.
// Seçim çereze yazılır; sunucu da (giriş ve hata sayfaları, demo verisi) aynı çerezi okur.
// Metinler kaynakta Türkçe durur; derlemede ceviri/vite-ceviri.js onları __t / __tt çağrılarına çevirir.
import en from './shared/i18n/en.json';
import { translateText } from './shared/i18n/translate.js';

function pick() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'tr' || q === 'en') {
      document.cookie = `pusula_dil=${q}; Path=/; Max-Age=31536000; SameSite=Lax`;
      return q;
    }
    const m = document.cookie.match(/(?:^|;\s*)pusula_dil=(tr|en)/);
    if (m) return m[1];
  } catch {}
  return 'tr';
}

export const LANG = typeof document === 'undefined' ? 'tr' : pick();
const D = LANG === 'en' ? en : null;
if (typeof document !== 'undefined') document.documentElement.lang = LANG;

/** Sabit metin */
export const __t = (s) => (D && Object.prototype.hasOwnProperty.call(D, s) ? D[s] : s);
/** Şablon: anahtar "a {0} b", değerler sırayla */
export const __tt = (key, ...v) => {
  const f = D && Object.prototype.hasOwnProperty.call(D, key) ? D[key] : key;
  return f.replace(/\{(\d+)\}/g, (m, i) => (v[+i] === undefined ? m : String(v[+i])));
};
/** Tarih/sayı biçimi için yerel ayar */
export const __L = () => (LANG === 'en' ? 'en-GB' : 'tr-TR');
/** Sunucudan gelen hazır Türkçe iletileri (hata vb.) çevirir */
export const tMessage = (s) => (D ? translateText(D, s) : s);

/** Dili değiştirip sayfayı yeniden yükler */
export function setLang(l) {
  document.cookie = `pusula_dil=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.toString());
}
