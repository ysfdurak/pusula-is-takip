// "Benim panom" MCP App'inin görünüm mantığı (src/mcp-app/panom.js): veriden bölümleri ve her kartta hangi düğmelerin
// olacağını hesaplar. DOM'a dokunmaz; sunucu da (metin özeti) kullanır. Node'da test edilir (tests/unit/mcpBoard.test.js).

export const SECTIONS = [
  { key: 'geciken', title: 'Geciken', tone: 'late', empty: 'Geciken işin yok.' },
  { key: 'bugun', title: 'Bugün', tone: 'today', empty: 'Bugün termini olan işin yok.' },
  { key: 'buHafta', title: 'Bu hafta', tone: 'week', empty: 'Bu hafta termini olan işin yok.' },
  { key: 'sorumluBekleyenEkipIsleri', title: 'Ekibinde sorumlu bekleyen', tone: 'pool', empty: '' },
];

export const PRIORITY = { urgent: 'Acil', high: 'Yüksek', normal: '', low: 'Düşük' };

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "2026-11-20" → "20 Kas" */
export function shortDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
}

/** Bir kartta gösterilecek düğmeler. Sahipsiz ekip işi için durum düğmesi yok, "Üstlen" var. */
export function actionsFor(task, sectionKey, me) {
  if (sectionKey === 'sorumluBekleyenEkipIsleri') {
    return [{ label: 'Üstlen', tool: 'sorumlu_ata', args: { isId: task.id, sorumlular: [me] } }];
  }
  const actions = [];
  if (task.durum === 'todo') actions.push({ label: 'Başla', tool: 'durum_degistir', args: { isId: task.id, durum: 'doing' } });
  actions.push({ label: 'Tamamla', tool: 'durum_degistir', args: { isId: task.id, durum: 'done' }, primary: true });
  return actions;
}

/** Araç sonucundan ekranda gösterilecek bölümler; boş "sorumlu bekleyen" bölümü gizlenir. */
export function sectionsFor(data) {
  return SECTIONS.map((section) => ({
    ...section,
    items: (data?.[section.key] || []).map((task) => ({
      ...task,
      meta: [task.termin ? shortDay(task.termin) : 'Terminsiz', PRIORITY[task.oncelik], task.ekip, task.terminRevizyonu ? `${task.terminRevizyonu}× ertelendi` : '']
        .filter(Boolean)
        .join(' · '),
      actions: actionsFor(task, section.key, data?.kullanici),
    })),
  })).filter((section) => section.items.length || section.empty);
}

/** Model için kısa özet: arayüzü olmayan istemcilerde de anlamlı metin. */
export function summaryText(data) {
  const n = (key) => (data?.[key] || []).length;
  const parts = [`${n('geciken')} geciken`, `${n('bugun')} bugün`, `${n('buHafta')} bu hafta`];
  if (n('sorumluBekleyenEkipIsleri')) parts.push(`${n('sorumluBekleyenEkipIsleri')} ekipte sorumlu bekleyen`);
  const lines = SECTIONS.flatMap((s) => (data?.[s.key] || []).map((t) => `- [${s.title}] ${t.baslik} (${t.termin || 'terminsiz'}, id: ${t.id})`));
  return `Pano: ${parts.join(', ')}.` + (lines.length ? '\n' + lines.join('\n') : '');
}
