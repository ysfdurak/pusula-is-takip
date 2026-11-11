// Geri bildirim: 1-5 puan + kısa metin. Sunucu modunda herkese görünür (demo ziyaretçisi ve şirket pilotu).
// E-posta yalnızca kişi "bana dönebilirsiniz" kutusunu işaretlerse saklanır (server/analytics.js).
import { useEffect, useRef, useState } from 'react';
import { MessageSquareHeartIcon, XIcon } from 'lucide-react';

export function FeedbackButton({ className = 'settings-link', label = ' Geri bildirim', screen = '' }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const textRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    textRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && state !== 'sending' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, state]);

  function close() {
    setOpen(false);
    if (state === 'done') {
      setRating(0);
      setMessage('');
      setContact(false);
      setState('idle');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating || null, message, contact, screen }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gönderilemedi.');
      setState('done');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <MessageSquareHeartIcon size={17} />
        {label}
      </button>
      {open && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && state !== 'sending' && close()}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <header className="modal-header">
              <div>
                <span className="eyebrow">PUSULA</span>
                <h2 id="feedback-title">{state === 'done' ? 'Teşekkürler!' : 'Ne düşünüyorsun?'}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Kapat" onClick={close}>
                <XIcon size={18} />
              </button>
            </header>
            {state === 'done' ? (
              <form onSubmit={(e) => (e.preventDefault(), close())}>
                <p className="form-intro">Geri bildirimin iletildi. Pusula'yı geliştirirken doğrudan kullanılıyor.</p>
                <footer className="modal-footer">
                  <button type="submit" className="button primary">Kapat</button>
                </footer>
              </form>
            ) : (
              <form onSubmit={submit}>
                <p className="form-intro">Neyi beğendin, ne eksik, nerede takıldın? Kısa olsa da çok işe yarar.</p>
                <div className="form-label" role="group" aria-label="Puan">
                  Genel puanın <span className="optional">İsteğe bağlı</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={'button small-button' + (rating === n ? ' primary' : '')}
                        aria-pressed={rating === n}
                        aria-label={`${n} / 5`}
                        onClick={() => setRating(rating === n ? 0 : n)}
                      >
                        {'★'.repeat(n)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="form-label">
                  Görüşün
                  <textarea ref={textRef} rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>
                <label className="check-label">
                  <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} />
                  Bu konuda bana e-postayla dönebilirsiniz (e-posta adresim geri bildirimle birlikte saklanır)
                </label>
                {error && <p className="late small">{error}</p>}
                <footer className="modal-footer">
                  <button type="button" className="button quiet" onClick={close}>Vazgeç</button>
                  <button type="submit" className="button primary" disabled={state === 'sending' || (!rating && !message.trim())}>
                    {state === 'sending' ? 'Gönderiliyor…' : 'Gönder'}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
