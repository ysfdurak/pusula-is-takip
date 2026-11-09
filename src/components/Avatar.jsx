import { initials } from '../lib/format.js';

export function Avatar({ name, size = 'normal' }) {
  let n = 0;
  for (let t of name) n += t.charCodeAt(0);
  return <span className={'avatar ' + size + ' color-' + (n % 5)}>{initials(name)}</span>;
}
