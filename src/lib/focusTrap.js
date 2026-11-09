export function trapFocus(event) {
  if (event.key !== 'Tab') {
    return;
  }
  let t = Array.from(
    event.currentTarget.querySelectorAll(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
    ),
  ).filter((e) => e.offsetParent !== null);
  if (!t.length) {
    return;
  }
  let n = t[0];
  let r = t[t.length - 1];
  if (event.shiftKey && document.activeElement === n) {
    event.preventDefault();
    r.focus();
  } else {
    if (!event.shiftKey && document.activeElement === r) {
      event.preventDefault();
      n.focus();
    }
  }
}
