// Gönderim kuyruğu: "sırada" bekleyen bildirimleri e-postaya çevirip gönderir.
import { buildEmail } from './templates.js';

/**
 * @param {object} o
 * @param {() => Array} o.pending       sıradaki bildirimler ve bağlamları (demoServer.pendingMail)
 * @param {(id, mail, detail) => void} o.mark  sonucu kaydeder (demoServer.markMail)
 * @param {{name: string, send: Function}} o.mailer
 * @param {string} o.appUrl            e-postadaki bağlantının kök adresi
 * @param {number} [o.maxAttempts=3]
 * @param {string[]} [o.allowedDomains]  boş değilse yalnızca bu alan adlarına gönderilir (şirket dışına sızıntıyı önler)
 */
export async function processOutbox({ pending, mark, mailer, appUrl, maxAttempts = 3, allowedDomains = [] }) {
  const result = { accepted: 0, failed: 0, retry: 0 };
  for (const item of pending()) {
    const { notification } = item;
    if (!item.task) {
      mark(notification.id, 'failed', 'İş artık bulunmuyor.');
      result.failed++;
      continue;
    }
    const domain = notification.recipient.split('@')[1]?.toLowerCase();
    if (allowedDomains.length && !allowedDomains.includes(domain)) {
      mark(notification.id, 'failed', 'Şirket dışı adres; gönderilmedi.');
      result.failed++;
      continue;
    }
    mark(notification.id, 'sending', '');
    try {
      await mailer.send(buildEmail({ ...item, appUrl }));
      mark(notification.id, 'accepted', `${mailer.name} kabul etti`);
      result.accepted++;
    } catch (err) {
      const attempts = (notification.mail_attempts || 0) + 1;
      if (err.retryable && attempts < maxAttempts) {
        mark(notification.id, 'queued', `${err.message} · yeniden denenecek`);
        result.retry++;
      } else {
        mark(notification.id, 'failed', err.message);
        result.failed++;
      }
    }
  }
  return result;
}
