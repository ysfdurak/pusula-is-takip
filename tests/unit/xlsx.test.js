// Excel dışa aktarma: geçerli ZIP yapısı, başlık, tarih ve özel karakterler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx, safeFileName } from '../../src/lib/xlsx.js';

test('xlsx: ZIP imzası, beklenen parçalar, kaçışlı metin ve Excel tarihi', async () => {
  const blob = buildXlsx('İşler', [{ header: 'İş' }, { header: 'Termin' }, { header: 'Sayı' }], [
    ['Koli <A> & "B"', new Date('2026-11-09T14:00:00Z'), 3],
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) assert.ok(text.includes(part), part);
  assert.ok(text.includes('Koli &lt;A&gt; &amp; &quot;B&quot;'));
  // 9 Kasım 2026 17:00 TSİ = 46335 + 17/24
  assert.match(text, /<v>46335\.708333/);
  assert.ok(text.includes('<autoFilter ref="A1:C2"/>'));
});

test('dosya adı: Türkçe harfler sadeleşir', () => {
  assert.equal(safeFileName('pusula-Örnek Şube Çalışma-2026-11-09'), 'pusula-ornek-sube-calisma-2026-11-09');
});
