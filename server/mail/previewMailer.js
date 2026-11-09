// Geliştirme için: e-postaları göndermek yerine klasöre HTML dosyası olarak yazar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createPreviewMailer(dir) {
  mkdirSync(dir, { recursive: true });
  let seq = 0;
  return {
    name: 'Önizleme',
    async send({ to, subject, html }) {
      const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${++seq}-${to.replace(/[^a-z0-9@.]/gi, '_')}.html`);
      writeFileSync(file, html.replace('<title>', `<title>Kime: ${to} · `), 'utf8');
      return { accepted: true, file };
    },
  };
}
