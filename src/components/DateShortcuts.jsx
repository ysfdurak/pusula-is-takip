import { endOfDayInDays } from '../lib/taskViews.js';

export function DateShortcuts({ onSelect, allowed = () => true, required = false }) {
  return (
    <div className="date-shortcuts" aria-label="Hazır termin seçimi">
      {[
        [0, 'Bugün'],
        [1, 'Yarın'],
        [7, '1 hafta sonra'],
      ].map(([n, r]) => {
        let i = endOfDayInDays(Date.now(), Number(n));
        return (
          <button
            type="button"
            disabled={!allowed(i)}
            title={allowed(i) ? String(r) + ' gün sonu' : 'Başlangıç veya azami süre kuralına uymuyor'}
            onClick={() => onSelect(i)}
            key={n}
          >
            {r}
          </button>
        );
      })}
      {!required && (
        <button type="button" onClick={() => onSelect('')}>
          Termini kaldır
        </button>
      )}
    </div>
  );
}
