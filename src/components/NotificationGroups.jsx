import { ArrowUpRightIcon } from 'lucide-react';

export function NotificationGroups({ items, onRead, onOpen, name }) {
  let lookup = new Map();
  for (let item of items) {
    let e = item.task || item.id;
    lookup.set(e, [...(lookup.get(e) || []), item]);
  }
  return (
    <div className="notice-groups">
      {[...lookup].map(([e, i]) => (
        <details className="notice-group" key={e}>
          <summary>
            <span>
              <strong>
                {i[0].title.replace(/^(Yeni yorum|İş atandı|İş tamamlandı|Durum değişti): /, '')}
              </strong>
              <small>
                {i.length}
                {' gelişme · '}
                {i.filter((e) => !e.read_at).length}
                {' okunmamış'}
              </small>
            </span>
            <span>
              {new Date(i[0].created).toLocaleDateString('tr-TR', {
                timeZone: 'Europe/Istanbul',
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </summary>
          <div>
            <button
              className="text-button"
              onClick={() => {
                onRead(i.map((e) => e.id));
                onOpen(i[0].task);
              }}
            >
              {'İşi aç ve bana gelenleri okundu işaretle '}
              <ArrowUpRightIcon size={13} />
            </button>
            {i.map((e) => (
              <article key={e.id}>
                <strong>{e.title}</strong>
                <p>{e.body}</p>
                <small>
                  {name(e.recipient)}
                  {' · '}
                  {new Date(e.created).toLocaleString('tr-TR', {
                    timeZone: 'Europe/Istanbul',
                  })}
                  {' · E-posta: '}
                  {{
                    disabled: 'kapalı',
                    no_config: 'bağlantı bekliyor',
                    accepted: 'sağlayıcı kabul etti',
                    queued: 'sırada',
                    self: 'kendi işlemi',
                    muted: 'tercih kapalı',
                  }[e.mail] || e.mail}
                </small>
              </article>
            ))}
          </div>
        </details>
      ))}
      {!items.length && (
        <div className="empty-state">
          <h3>Yeni gelişme yok.</h3>
        </div>
      )}
    </div>
  );
}
