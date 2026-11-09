// Sunucu modu eşitlik testi: iki pilot derlemesini, her biri kendi test API'sine bağlı olarak aynı adımlarla karşılaştırır.
// Kullanım: node parity-server.mjs <eski-pilot.html> <yeni-pilot.html> [yürüyüş] [adım] [tohum]
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const [oldHtml, newHtml] = process.argv.slice(2, 4).map((p) => resolve(p));
import { spawn } from 'node:child_process';
const API = new URL('./test-api-server.mjs', import.meta.url).pathname;
async function startApi(port, html, seed) {
  const child = spawn('node', [API, String(port), html, String(seed), String(new Date('2026-11-09T09:30:00+03:00').getTime())], {});
  await new Promise((r, j) => { child.stdout.on('data', (d) => String(d).includes('ready') && r()); child.on('exit', (c) => j(new Error('api exit ' + c))); child.stderr.on('data', (d) => process.stderr.write(d)); });
  return child;
}
const walks = Number(process.argv[4] || 10);
const steps = Number(process.argv[5] || 30);
const seed0 = Number(process.argv[6] || 1);
const FIXED = new Date('2026-11-09T09:30:00+03:00');

const initScript = (seed) => {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = rnd;
  crypto.getRandomValues = (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(rnd() * 256); return arr; };
  crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(rnd() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  // indirme ve diyalogları etkisizleştir
  URL.createObjectURL = () => 'blob:parity';
  window.confirm = () => true; window.alert = () => {}; window.prompt = () => '';
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
async function open(url, viewport, seed) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: false });
  await ctx.addInitScript(initScript, seed);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(FIXED.getTime() - 60000) }); await page.clock.pauseAt(FIXED);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(url);
  await page.waitForSelector('#root *');
  await page.waitForTimeout(150);
  return { ctx, page };
}

const snapshot = (page) => page.evaluate(() => {
  const html = document.getElementById('root').innerHTML
    .replace(/class="lucide [^"]*"/g, 'class="lucide"') // ikon sınıf adları CSS'te kullanılmıyor; SVG çizimi ayrıca birebir karşılaştırılır
    .replace(/ data-parity="\d+"/g, '');
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  const ae = document.activeElement;
  return { html, ls: JSON.stringify(ls), focus: ae ? ae.tagName + '#' + (ae.className || '') + (ae.getAttribute('aria-label') || '') : '', url: location.search };
});

const actionables = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('button, a[href], input, select, textarea, summary, [role=button], [draggable=true], label')]
    .filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.disabled && !(e.tagName === 'A' && /^https?:/.test(e.getAttribute('href') || '')); });
  els.forEach((e, i) => e.setAttribute('data-parity', String(i)));
  return els.map((e) => ({ tag: e.tagName, type: e.type || '', options: e.tagName === 'SELECT' ? e.options.length : 0 }));
});

let mismatches = 0, checked = 0;
function diff(a, b) {
  if (a === b) return null;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return `@${i}\n  eski: ${a.slice(Math.max(0, i - 120), i + 160)}\n  yeni: ${b.slice(Math.max(0, i - 120), i + 160)}`;
}

const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
for (let w = 0; w < walks; w++) {
  const seed = seed0 + w;
  const viewport = viewports[w % viewports.length];
  const apiA = await startApi(4301, oldHtml, seed); const apiB = await startApi(4302, newHtml, seed);
  const A = await open('http://127.0.0.1:4301/', viewport, seed);
  const B = await open('http://127.0.0.1:4302/', viewport, seed);
  let rnd = seed * 9301 + 49297;
  const pick = (n) => { rnd = (rnd * 9301 + 49297) % 233280; return Math.floor((rnd / 233280) * n); };
  const log = [];
  for (let s = 0; s <= steps; s++) {
    // iki sayfa da durulana kadar bekle; fark kalıcıysa gerçek farktır
    const settle = async (page) => { let prev = await snapshot(page); for (let k = 0; k < 20; k++) { await page.waitForTimeout(50); const cur = await snapshot(page); if (cur.html === prev.html && cur.ls === prev.ls) return cur; prev = cur; } return prev; };
    let sa, sb, d;
    for (let attempt = 0; attempt < 4; attempt++) {
      [sa, sb] = [await settle(A.page), await settle(B.page)];
      d = diff(sa.html, sb.html) || diff(sa.ls, sb.ls) || (sa.url !== sb.url ? `url ${sa.url} vs ${sb.url}` : null);
      if (!d) break;
      for (const P of [A.page, B.page]) await P.clock.runFor(300);
      await A.page.waitForTimeout(250);
    }
    checked++;
    if (d) { mismatches++; console.log(`FARK yürüyüş=${w} tohum=${seed} adım=${s} ${viewport.width}px\n  adımlar: ${log.join(' → ')}\n  ${d}`); break; }
    if (s === steps) break;
    const [la, lb] = [await actionables(A.page), await actionables(B.page)];
    if (la.length !== lb.length) { mismatches++; console.log(`FARK yürüyüş=${w} adım=${s}: etkileşimli öğe sayısı ${la.length} vs ${lb.length}`); break; }
    if (!la.length) break;
    const i = pick(la.length);
    const el = la[i];
    const text = ['Sayım', 'Test işi ' + s, 'a', '', 'Ece', '2026-11-12T10:00', '5'][pick(7)];
    const act = async (page) => {
      const loc = page.locator(`[data-parity="${i}"]`);
      try {
        if (el.tag === 'SELECT') { await loc.selectOption({ index: pick.memo }, { timeout: 1500 }); }
        else if ((el.tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type)) || el.tag === 'TEXTAREA') {
          if (el.type === 'datetime-local' || el.type === 'date') await loc.fill(el.type === 'date' ? '2026-11-12' : '2026-11-12T10:00', { timeout: 1500 });
          else await loc.fill(text, { timeout: 1500 });
          if (pick.enter) await loc.press('Enter', { timeout: 1500 });
        } else if (el.type === 'file') { /* atla */ }
        else await loc.click({ timeout: 1500, force: true });
      } catch (e) { return 'hata:' + e.message.split('\n')[0].slice(0, 60); }
      return 'ok';
    };
    pick.memo = el.options ? pick(el.options) : 0;
    pick.enter = pick(3) === 0;
    const ra = await act(A.page); const rb = await act(B.page);
    log.push(`${el.tag.toLowerCase()}${el.type ? ':' + el.type : ''}[${i}]${ra !== 'ok' ? '(' + ra + ')' : ''}`);
    if (ra.startsWith('hata') !== rb.startsWith('hata')) { mismatches++; console.log(`FARK yürüyüş=${w} adım=${s}: eylem sonucu ${ra} / ${rb}`); break; }
    // Sahte saati iki sayfada eşit miktarda, küçük adımlarla ilerlet: geç kurulan zamanlayıcılar da tetiklensin
    for (let k = 0; k < 6; k++) { await A.page.clock.runFor(150); await B.page.clock.runFor(150); await A.page.waitForTimeout(30); await B.page.waitForTimeout(30); }
    if (pick(25) === 0) { // ara sıra sayfayı yenile
      await A.page.reload(); await B.page.reload(); for (const P of [A.page, B.page]) { await P.waitForSelector('#root *'); await P.clock.runFor(300); } log.push('yenile');
    }
  }
  const errs = [...A.page.errors.map((e) => 'eski: ' + e), ...B.page.errors.map((e) => 'yeni: ' + e)];
  if (errs.length) console.log(`hatalar yürüyüş=${w}:`, errs.slice(0, 3).join(' | '));
  await A.ctx.close(); await B.ctx.close(); apiA.kill(); apiB.kill(); await new Promise((r) => setTimeout(r, 150));
}
await browser.close();
console.log(`\nKontrol edilen durum: ${checked}, fark: ${mismatches}`);
process.exit(mismatches ? 1 : 0);
