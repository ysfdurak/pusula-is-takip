import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// MCP App görünümü: "Benim panom" (src/mcp-app/). Tek HTML dosyası üretir; pilot sunucusu bu dosyayı
// MCP kaynağı (ui://pusula/panom.html) olarak sunar ve Claude onu yalıtılmış bir iframe'de açar.
//   npm run build:mcp-app → dist-mcp-app/panom.html
// Sayfa hiçbir ağ isteği atmaz; sunucuyla tüm iletişim host (Claude) üzerinden postMessage ile yapılır.
export default defineConfig({
  root: 'src/mcp-app',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../../dist-mcp-app',
    emptyOutDir: true,
    rollupOptions: { input: 'src/mcp-app/panom.html' },
  },
});
