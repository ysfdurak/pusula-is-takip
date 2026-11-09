import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const html = read('src/index.template.html')
  .replace('__PUSULA_CSS__', read('src/styles.css'))
  .replace('__PUSULA_JS__', read('src/app.bundle.js'));
if (html.includes('__PUSULA_CSS__') || html.includes('__PUSULA_JS__')) throw new Error('Unresolved template placeholder');
writeFileSync(resolve(root, 'index.html'), html, 'utf8');
console.log('Built index.html from src/');
