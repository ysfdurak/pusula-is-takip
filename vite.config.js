import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Derleme çıktısı tek bir HTML dosyasıdır; internetsiz açılabilir.
//   npm run build        → dist/index.html        (tasarım demosu, tarayıcı içi örnek sunucu)
//   npm run build:preview→ dist-preview/index.html (pilot önizlemesi: boş başlar, veriler tarayıcıda)
//   npm run build:pilot  → dist-pilot/index.html  (sunucu modu, aynı alan adındaki /api/workspace)
// Güvenlik politikası (CSP) yalnızca derlemede eklenir; geliştirme sunucusunu engellememesi için.
const csp = (connect) =>
  `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src ${connect}; font-src 'none'; base-uri 'none'; form-action 'none'`;

export default defineConfig(({ mode }) => {
  const pilot = mode === 'pilot';
  const preview = mode === 'preview';
  return {
    plugins: [
      react(),
      viteSingleFile(),
      {
        name: 'pusula-csp',
        apply: 'build',
        transformIndexHtml(html) {
          const meta = `<meta http-equiv="Content-Security-Policy" content="${csp(pilot ? "'self'" : "'none'")}" />`;
          return html
            .replace('<title>', `${meta}\n    <title>`)
            .replace('İnternetsiz Tasarım Demosu', pilot ? 'Pilot' : preview ? 'Pilot Önizlemesi' : 'İnternetsiz Tasarım Demosu');
        },
      },
    ],
    build: { outDir: pilot ? 'dist-pilot' : preview ? 'dist-preview' : 'dist' },
  };
});
