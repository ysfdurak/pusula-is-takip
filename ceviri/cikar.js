// Sözlükte karşılığı olmayan Türkçe arayüz metinlerini listeler.
// node ceviri/cikar.js            → eksik anahtarlar (JSON dizi)
// node ceviri/cikar.js --dosyali  → anahtar ve geçtiği dosyalar
import fs from 'node:fs';
import path from 'node:path';
import { candidates, isNatural } from './ortak.js';

const root = path.resolve(import.meta.dirname, '..');
const dict = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/i18n/en.json'), 'utf8'));
const files = [];
const walkDir = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== 'mcp-app' && e.name !== 'i18n') walkDir(p); }
  else if (/\.(js|jsx)$/.test(e.name) && e.name !== 'i18n.js') files.push(p);
});
walkDir(path.join(root, 'src'));
const miss = new Map();
for (const f of files) {
  for (const it of candidates(fs.readFileSync(f, 'utf8'))) {
    const probe = it.kind === 'tpl' ? it.key.replace(/\{\d+\}/g, ' ') : it.key;
    if (!isNatural(probe) || dict[it.key] !== undefined) continue;
    miss.set(it.key, (miss.get(it.key) || new Set()).add(path.relative(root, f)));
  }
}
if (process.argv.includes('--dosyali')) for (const [k, v] of miss) console.log(JSON.stringify(k), [...v].join(', '));
else console.log(JSON.stringify([...miss.keys()], null, 1));
console.error('eksik:', miss.size);
