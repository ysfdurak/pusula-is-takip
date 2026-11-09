import { toLocalDateTimeInput } from '../components/ConflictDialog.jsx';

export const newId = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (e) => e.toString(16).padStart(2, '0')).join('');

export const todayKey = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date());

export const toDateTimeInput = toLocalDateTimeInput;

export const fromDateTimeInput = (e) => (e ? new Date(e + ':00+03:00').toISOString() : '');

export const formatDateTime = (plannedStart) =>
  plannedStart
    ? new Date(plannedStart).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Belirlenmedi';

export const formatDate = (date) =>
  date
    ? new Date(date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Istanbul',
      })
    : 'Tarih yok';

export const formatDuration = (e) =>
  e < 60
    ? e + ' sn'
    : e < 3600
      ? Math.floor(e / 60) + ' dk'
      : Math.floor(e / 3600) + ' sa ' + Math.floor((e % 3600) / 60) + ' dk';

export const initials = (name) =>
  name
    .split(/[ @]+/)
    .slice(0, 2)
    .map((e) => e[0])
    .join('')
    .toUpperCase();
