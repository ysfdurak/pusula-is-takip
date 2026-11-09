import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const expected = read('src/index.template.html')
  .replace('__PUSULA_CSS__', read('src/styles.css'))
  .replace('__PUSULA_JS__', read('src/app.bundle.js'));
if (expected !== read('index.html')) {
  console.error('index.html is out of sync; run npm run build');
  process.exitCode = 1;
} else {
  console.log('PASS: index.html matches source inputs');
}
