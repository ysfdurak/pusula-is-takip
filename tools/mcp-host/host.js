// MCP App deneme host'u (yalnızca geliştirme): Claude'un bir MCP App'i nasıl açtığını taklit eder.
//   1) MCP sunucusuna bağlan (Pusula /mcp, erişim anahtarıyla)
//   2) `panom` aracının işaret ettiği ui:// kaynağını oku → HTML
//   3) HTML'i yalıtılmış iframe'de aç (sandbox="allow-scripts": sayfa host'un çerezlerine ve DOM'una erişemez)
//   4) AppBridge: iframe ile postMessage üzerinden konuşur; iframe'in araç çağrılarını sunucuya iletir
//   5) Aracı çağır ve sonucunu iframe'e gönder → pano çizilir
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppBridge, PostMessageTransport, getToolUiResourceUri } from '@modelcontextprotocol/ext-apps/app-bridge';

const $log = document.getElementById('log');
const log = (text) => $log.prepend(Object.assign(document.createElement('div'), { textContent: text }));

async function main() {
  const token = document.getElementById('token').value.trim();
  const client = new Client({ name: 'pusula-deneme-host', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL('/mcp', location.origin), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
  );

  const { tools } = await client.listTools();
  const uri = getToolUiResourceUri(tools.find((t) => t.name === 'panom'));
  const resource = await client.readResource({ uri });
  const html = resource.contents[0].text;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('title', 'Benim panom');
  iframe.style.height = '420px';
  document.getElementById('frame').append(iframe);

  const bridge = new AppBridge(
    client,
    { name: 'pusula-deneme-host', version: '1.0.0' },
    { serverTools: {}, updateModelContext: { text: {} }, message: { text: {} } },
    { hostContext: { theme: 'light', locale: 'tr-TR', timeZone: 'Europe/Istanbul', platform: 'web' } },
  );
  bridge.onmessage = async ({ content }) => {
    log('Arayüz sohbete mesaj gönderdi → ' + content.map((c) => c.text).join(' '));
    return {};
  };
  bridge.onupdatemodelcontext = async ({ content }) => {
    log('Arayüz Claude\'a bilgi verdi → ' + (content || []).map((c) => c.text).join(' '));
    return {};
  };
  bridge.onsizechange = ({ height }) => {
    if (height) iframe.style.height = Math.min(height, 900) + 'px';
  };
  bridge.oninitialized = async () => {
    const result = await client.callTool({ name: 'panom', arguments: {} });
    await bridge.sendToolInput({ arguments: {} });
    await bridge.sendToolResult(result);
    log('panom aracı çağrıldı → ' + (result.content?.[0]?.text || '').split('\n')[0]);
  };

  await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
  iframe.srcdoc = html;
}

main().catch((err) => log('Hata: ' + (err?.message || err)));
