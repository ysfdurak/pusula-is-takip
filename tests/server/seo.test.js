import test from 'node:test';
import assert from 'node:assert/strict';
import { withSeoHead } from '../../server/app.js';

const html = '<!doctype html><html lang="tr"><head><meta charset="utf-8" />\n    <title>Pusula — Pilot</title>\n  </head><body></body></html>';

test('demo arayüz sayfasına arama ve paylaşım etiketleri eklenir', () => {
  const out = withSeoHead(html, 'https://pusula.ysfdurak.com/').toString();
  assert.match(out, /<title>Pusula · Türkçe iş ve ekip takip uygulaması<\/title>/);
  assert.doesNotMatch(out, /Pusula — Pilot/);
  assert.match(out, /<link rel="canonical" href="https:\/\/pusula\.ysfdurak\.com\/" \/>/);
  assert.match(out, /hreflang="en" href="https:\/\/pusula\.ysfdurak\.com\/\?lang=en"/);
  assert.match(out, /og:image" content="https:\/\/ysfdurak\.com\/img\/pusula\/og\.jpg"/);
});
