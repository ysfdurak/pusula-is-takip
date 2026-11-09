// Eşitlik testi için deterministik API: demoServer mantığını /api/workspace olarak sunar (yalnızca test içindir).
// Kullanım: node apiserver.mjs <port> <html> <tohum> <sabitZaman>
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const [port, htmlPath, seedArg, fixedArg] = process.argv.slice(2);
let s = Number(seedArg) >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const FIXED = Number(fixedArg);
Date.now = () => FIXED;
globalThis.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(rnd() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
const { demoGet, demoPost } = await import('../../src/demo/demoServer.js');
const html = readFileSync(htmlPath);
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/api/workspace') {
    try {
      if (req.method === 'GET') return send(200, demoGet(url.searchParams.get('id') || '', url.searchParams.get('task') || ''));
      let raw = ''; for await (const c of req) raw += c;
      return send(200, demoPost(JSON.parse(raw)));
    } catch (e) { return send(String(e.message).includes('Kayıt değişti') ? 409 : 400, { error: e.message }); }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
}).listen(Number(port), '127.0.0.1', () => console.log('ready'));
