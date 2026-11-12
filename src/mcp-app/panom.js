// "Benim panom" MCP App'i: Claude'un içinde açılan etkileşimli pano.
//
// Akış:
//   1) Claude `panom` aracını çağırır → host bu sayfayı yalıtılmış bir iframe'de açar.
//   2) Aracın sonucu (structuredContent) `ontoolresult` ile gelir → pano çizilir.
//   3) Kullanıcı "Tamamla"ya basar → sayfa sunucuya DOĞRUDAN gitmez; host üzerinden
//      `durum_degistir` aracını çağırır (app.callServerTool). Yetki ve kurallar sunucuda uygulanır.
//   4) Başarılıysa pano yenilenir ve Claude'a ne olduğu bildirilir (updateModelContext).
//
// Güvenlik: iş adları kullanıcı girdisidir; DOM'a yalnızca textContent ile yazılır (innerHTML yok).
import { App, PostMessageTransport, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { sectionsFor } from '../shared/board.js';

const app = new App({ name: 'Pusula · Benim panom', version: '1.0.0' }, {});
const $board = document.getElementById('board');
const $status = document.getElementById('status');
const $who = document.getElementById('who');
let current = null;

function setStatus(text, isError = false) {
  $status.textContent = text;
  $status.className = isError ? 'error' : '';
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function render(data) {
  current = data;
  $who.textContent = data.kullanici || '';
  $board.replaceChildren(
    ...sectionsFor(data).map((section) =>
      el('section', {}, [
        el('h2', {}, [
          el('span', { className: 'dot ' + section.tone }),
          el('span', { text: section.title }),
          el('span', { className: 'count', text: String(section.items.length) }),
        ]),
        ...(section.items.length
          ? section.items.map((task) => card(task))
          : [el('p', { className: 'empty', text: section.empty })]),
      ]),
    ),
  );
  setStatus('');
}

function card(task) {
  const msg = el('div', { className: 'msg' });
  const buttons = task.actions.map((action) => {
    const button = el('button', { type: 'button', className: action.primary ? 'primary' : '', text: action.label });
    button.addEventListener('click', () => run(action, task, button, msg));
    return button;
  });
  const detail = el('button', { type: 'button', className: 'link', text: 'Ayrıntı' });
  // Ayrıntıyı sohbete sor: Claude is_detayi aracıyla cevaplar (kullanıcı adına mesaj gönderilir)
  detail.addEventListener('click', () =>
    app.sendMessage({ role: 'user', content: [{ type: 'text', text: `Pusula'daki "${task.baslik}" işinin ayrıntısını göster (id: ${task.id}).` }] }),
  );
  return el('div', { className: 'card' }, [
    el('div', { className: 'title', text: task.baslik }),
    el('div', { className: 'meta', text: task.meta }),
    el('div', { className: 'row' }, [...buttons, detail]),
    msg,
  ]);
}

async function run(action, task, button, msg) {
  const all = [...$board.querySelectorAll('button')];
  all.forEach((b) => (b.disabled = true));
  msg.textContent = '';
  try {
    const result = await app.callServerTool({ name: action.tool, arguments: { calismaAlani: current.calismaAlani, ...action.args } });
    if (result.isError) {
      // İş kuralı hatası (ör. "Zorunlu kontrol adımlarını tamamla") kartın altında gösterilir
      msg.textContent = result.content?.[0]?.text || 'İşlem yapılamadı.';
      return;
    }
    await app.updateModelContext({
      content: [{ type: 'text', text: `Kullanıcı panodan "${task.baslik}" işi için "${action.label}" işlemini yaptı.` }],
    });
    await refresh();
  } catch (err) {
    msg.textContent = 'Bağlantı hatası: ' + (err?.message || err);
  } finally {
    all.forEach((b) => (b.disabled = false));
  }
}

async function refresh() {
  setStatus('Yenileniyor…');
  try {
    const result = await app.callServerTool({ name: 'panom', arguments: { calismaAlani: current?.calismaAlani } });
    if (result.isError) return setStatus(result.content?.[0]?.text || 'Pano yüklenemedi.', true);
    render(result.structuredContent);
  } catch (err) {
    setStatus('Pano yüklenemedi: ' + (err?.message || err), true);
  }
}

function applyHost(context) {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
}

// Olay dinleyicileri bağlanmadan ÖNCE kurulmalı; aksi halde ilk sonuç kaçabilir.
app.ontoolresult = (result) => {
  if (result.isError) return setStatus(result.content?.[0]?.text || 'Pano yüklenemedi.', true);
  if (result.structuredContent) render(result.structuredContent);
};
app.onhostcontextchanged = applyHost;
document.getElementById('refresh').addEventListener('click', refresh);

app
  .connect(new PostMessageTransport(window.parent, window.parent))
  .then(() => applyHost(app.getHostContext()))
  .catch((err) => setStatus('Claude ile bağlantı kurulamadı: ' + (err?.message || err), true));
