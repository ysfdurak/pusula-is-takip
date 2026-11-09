// Üretilen kaynağa uygulanan bilinçli değişiklikler (davranış: yalnızca sunucu modunu etkiler).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const edit = (file, pairs) => {
  const p = join(dir, file); let s = readFileSync(p, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(`${file}: bulunamadı: ${a}`); s = s.replace(a, b); }
  writeFileSync(p, s);
};
// 1) Demo/pilot modu derleme modundan gelir
edit('main.jsx', [["createRoot(document.getElementById('root')).render(<App demo={true} />);",
  "// Tasarım demosu tarayıcı içi örnek sunucuyla çalışır; pilot derlemesi (vite --mode pilot) /api/workspace ile konuşur.\nconst demo = import.meta.env.MODE !== 'pilot';\n\ncreateRoot(document.getElementById('root')).render(<App demo={demo} />);"]]);
// 2) Şirket içi pilotta giriş, şirket hesabıyla (SSO) yapılır
edit('App.jsx', [['href="/signin-with-chatgpt?return_to=%2F"', 'href="/auth/login?return_to=%2F"'], ["{'ChatGPT ile devam et '}", "{'Şirket hesabınla giriş yap '}"]]);
console.log('finalize: tamam');
