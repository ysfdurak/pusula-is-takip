// "Benim panom" MCP App'inin görünüm mantığı (src/shared/board.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionsFor, sectionsFor, shortDay, summaryText } from '../../src/shared/board.js';

const task = (over = {}) => ({ id: 't1', baslik: 'Rampa 3 sayımı', durum: 'todo', oncelik: 'normal', ekip: '', termin: '2026-11-20', terminRevizyonu: 0, ...over });

test('tarih kısaltması', () => {
  assert.equal(shortDay('2026-11-20'), '20 Kas');
  assert.equal(shortDay('2026-01-05'), '5 Oca');
  assert.equal(shortDay(''), '');
});

test('düğmeler: yapılacak işte Başla + Tamamla, devam edende yalnızca Tamamla, havuz işinde Üstlen', () => {
  assert.deepEqual(actionsFor(task(), 'bugun', 'a@x.test').map((a) => a.label), ['Başla', 'Tamamla']);
  assert.deepEqual(actionsFor(task({ durum: 'doing' }), 'geciken', 'a@x.test').map((a) => a.label), ['Tamamla']);
  const [take] = actionsFor(task(), 'sorumluBekleyenEkipIsleri', 'a@x.test');
  assert.deepEqual([take.label, take.tool, take.args.sorumlular], ['Üstlen', 'sorumlu_ata', ['a@x.test']]);
});

test('bölümler: kart bilgisi; boş havuz bölümü gizlenir, diğer boş bölümler mesajla kalır', () => {
  const sections = sectionsFor({ kullanici: 'a@x.test', geciken: [task({ oncelik: 'urgent', ekip: 'Sevkiyat', terminRevizyonu: 2 })], bugun: [], buHafta: [], sorumluBekleyenEkipIsleri: [] });
  assert.deepEqual(sections.map((s) => s.key), ['geciken', 'bugun', 'buHafta']);
  assert.equal(sections[0].items[0].meta, '20 Kas · Acil · Sevkiyat · 2× ertelendi');
  assert.equal(sections[1].items.length, 0);
});

test('metin özeti: arayüzü olmayan istemciler için', () => {
  const text = summaryText({ geciken: [task()], bugun: [], buHafta: [], sorumluBekleyenEkipIsleri: [task({ id: 't2', baslik: 'Palet', termin: '' })] });
  assert.match(text, /^Pano: 1 geciken, 0 bugün, 0 bu hafta, 1 ekipte sorumlu bekleyen\./);
  assert.match(text, /\[Geciken\] Rampa 3 sayımı \(2026-11-20, id: t1\)/);
  assert.match(text, /Palet \(terminsiz, id: t2\)/);
});
