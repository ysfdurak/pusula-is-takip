import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// MCP App deneme host'u (yalnızca geliştirme): Claude'a bağlanmadan "Benim panom"u tarayıcıda açar.
//   Terminal 1: npm run start:mcp-dev    (pilot sunucusu + MCP, http://localhost:8080)
//   Terminal 2: npm run mcp-host         (http://localhost:5174)
// /mcp istekleri pilot sunucusuna aktarılır; kaynak (Origin) sunucunun kendi adresi olarak gönderilir.
// Tarayıcı testi (tests/e2e/mcpApp.mjs) için tek dosya olarak da derlenir: tmp/mcp-host/index.html
export default defineConfig({
  root: 'tools/mcp-host',
  plugins: [viteSingleFile()],
  server: {
    port: 5174,
    proxy: { '/mcp': { target: 'http://localhost:8080', headers: { origin: 'http://localhost:8080' } } },
  },
  build: { outDir: '../../tmp/mcp-host', emptyOutDir: true },
});
