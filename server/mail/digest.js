// Sabah özeti gönderimi: hafta içi, ayarlanan saatten sonra (öğlene kadar) her üyeye günde bir kez.
import { digestFor, istanbulClock } from '../../src/shared/digest.js';
import { buildDigestEmail } from './templates.js';

/**
 * @param {object} o
 * @param {() => object} o.load
 * @param {() => void} o.persist
 * @param {{name: string, send: Function}} o.mailer
 * @param {string} o.appUrl
 * @param {number} o.hour               gönderim saati (Türkiye saati)
 * @param {string[]} [o.allowedDomains]
 * @param {number} [o.now]
 * @param {(msg: string) => void} [o.log]
 */
export async function runDigest({ load, persist, mailer, appUrl, hour, allowedDomains = [], now = Date.now(), log = () => {} }) {
  const clock = istanbulClock(now);
  const result = { sent: 0, skipped: 0, failed: 0 };
  if (clock.weekday === 0 || clock.weekday === 6 || clock.hour < hour || clock.hour >= 12) return result;
  const data = load();
  data.digests ||= {};
  for (const item of digestFor(data, now)) {
    const key = `${item.workspace.id}|${item.member.email}`;
    if (data.digests[key] === clock.day) {
      result.skipped++;
      continue;
    }
    const domain = item.member.email.split('@')[1]?.toLowerCase();
    if (allowedDomains.length && !allowedDomains.includes(domain)) {
      data.digests[key] = clock.day;
      result.skipped++;
      continue;
    }
    try {
      await mailer.send(buildDigestEmail(item, appUrl));
      data.digests[key] = clock.day;
      result.sent++;
    } catch (err) {
      // Geçici hatada bir sonraki turda yeniden denenir; kalıcı hatada bugün için bırakılır.
      if (!err.retryable) data.digests[key] = clock.day;
      result.failed++;
      log(`Sabah özeti gönderilemedi (${item.member.email}): ${err.message}`);
    }
  }
  persist();
  return result;
}
