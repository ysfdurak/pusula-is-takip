// Vite eklentisi: src altındaki modüllerde sözlükte karşılığı olan Türkçe metinleri çalışma anında dile göre
// seçilen çağrılara çevirir. Kaynak Türkçe kalır; İngilizce yalnızca src/shared/i18n/en.json sözlüğündedir.
//   "Metin"          → __t("Metin")
//   <b>Metin</b>     → <b>{__t("Metin")}</b>
//   attr="Metin"     → attr={__t("Metin")}
//   `a ${x} b`       → __tt("a {0} b", x)
//   'tr-TR'          → __L()  (tarih biçimi dile göre)
// Sözlükte olmayan metne dokunulmaz.
import fs from 'node:fs';
import path from 'node:path';
import { candidates } from './ortak.js';

export function ceviri({ sozluk, runtime, include = /\/src\/.*\.(js|jsx)$/, exclude = /\/src\/(i18n\.js|mcp-app\/)/ }) {
  let dict = null;
  const load = () => (dict = new Set(Object.keys(JSON.parse(fs.readFileSync(sozluk, 'utf8')))));
  return {
    name: 'pusula-ceviri',
    enforce: 'pre',
    buildStart() { load(); this.addWatchFile?.(sozluk); },
    handleHotUpdate(ctx) { if (path.resolve(ctx.file) === path.resolve(sozluk)) load(); },
    transform(code, id) {
      const file = id.split('?')[0];
      if (!include.test(file) || exclude.test(file)) return null;
      if (!dict) load();
      let items;
      try { items = candidates(code); } catch { return null; }
      const edits = [];
      for (const it of items) {
        const n = it.node;
        if (it.kind === 'str' && it.key === 'tr-TR') { edits.push({ s: n.start, e: n.end, r: () => '__L()' }); continue; }
        if (!dict.has(it.key)) continue;
        const k = JSON.stringify(it.key);
        if (it.kind === 'str') edits.push({ s: n.start, e: n.end, r: () => `__t(${k})` });
        else if (it.kind === 'jsxattr') edits.push({ s: n.start, e: n.end, r: () => `{__t(${k})}` });
        else if (it.kind === 'jsxtext') {
          const lead = n.value.match(/^\s*/)[0], trail = n.value.match(/\s*$/)[0];
          // JSX'te satır sonu içeren baş/son boşluklar zaten atılır; tek satırlık boşluk korunur
          const keepL = /\n/.test(lead) ? '' : lead ? '{" "}' : '';
          const keepT = /\n/.test(trail) ? '' : trail ? '{" "}' : '';
          edits.push({ s: n.start, e: n.end, r: () => `${keepL}{__t(${k})}${keepT}` });
        } else if (it.kind === 'tpl') {
          edits.push({ s: n.start, e: n.end, r: (render) => `__tt(${k}${n.expressions.map((x) => ', (' + render(x.start, x.end) + ')').join('')})` });
        }
      }
      if (!edits.length) return null;
      edits.sort((a, b) => a.s - b.s || b.e - a.e);
      // Bir aralığı, içindeki düzenlemeleri (iç içe olanlar dahil) uygulayarak yazar
      const render = (from, to) => {
        let res = '', pos = from;
        for (let i = 0; i < edits.length; i++) {
          const ed = edits[i];
          if (ed.s < pos || ed.e > to || ed.s < from) continue;
          res += code.slice(pos, ed.s) + ed.r(render);
          pos = ed.e;
        }
        return res + code.slice(pos, to);
      };
      let out = render(0, code.length);
      out = `import { __t, __tt, __L } from ${JSON.stringify(runtime)};\n` + out;
      return { code: out, map: null };
    },
  };
}
