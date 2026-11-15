// Dil desteği: sözlük, kalıplı çeviri, sunucu sayfalarının çevrilmesi ve örnek verinin dile göre açılması.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translateText, translateDeep } from '../../src/shared/i18n/translate.js';
import { translateHtml, translateSample, langOf } from '../../server/i18n.js';
import { createSampleData } from '../../src/shared/sampleData.js';

const EN = JSON.parse(readFileSync(new URL('../../src/shared/i18n/en.json', import.meta.url), 'utf8'));

test('sözlükte boş karşılık yok', () => {
  for (const [k, v] of Object.entries(EN)) assert.ok(typeof v === 'string' && v.length > 0, k);
});

test('kalıplı çeviri: değer yerleşir, bilinen değer de çevrilir', () => {
  assert.equal(translateText(EN, 'İş atandı: Raf sayımı'), 'Task assigned: Raf sayımı');
  assert.equal(translateText(EN, 'Demo alanın hazır · Pusula'), 'Your demo workspace is ready · Pusula');
  assert.equal(translateText(EN, 'Sözlükte olmayan metin'), 'Sözlükte olmayan metin');
});

test('sunucu sayfası: metinler çevrilir, kaçışlı karakterler korunur', () => {
  const html = '<html lang="tr"><h1>Sayfa bulunamadı</h1><a>Pusula&#39;ya dön →</a></html>';
  assert.equal(translateHtml('en', html), '<html lang="en"><h1>Page not found</h1><a>Back to Pusula →</a></html>');
  assert.equal(translateHtml('tr', html), html);
});

test('dil seçimi: adres, sonra çerez, yoksa Türkçe', () => {
  const req = (cookie) => ({ headers: { cookie } });
  assert.equal(langOf(req(''), new URL('http://x/?lang=en')), 'en');
  assert.equal(langOf(req('a=1; pusula_dil=en'), new URL('http://x/')), 'en');
  assert.equal(langOf(req('pusula_dil=en'), new URL('http://x/?lang=tr')), 'tr');
  assert.equal(langOf(req(''), new URL('http://x/')), 'tr');
});

test('örnek veri İngilizce açılır; kimlik ve kodlar değişmez', () => {
  const tr = createSampleData(Date.UTC(2026, 10, 15));
  const en = translateSample('en', tr);
  const tasksTr = tr.states.design.tasks, tasksEn = en.states.design.tasks;
  assert.equal(tasksEn.length, tasksTr.length);
  assert.ok(tasksEn.some((t) => t.title === 'Morning shipping check'));
  tasksEn.forEach((t, i) => { assert.equal(t.id, tasksTr[i].id); assert.equal(t.status, tasksTr[i].status); });
  assert.deepEqual(translateSample('tr', tr), tr);
  assert.deepEqual(translateDeep(EN, { status: 'done' }), { status: 'done' });
});
