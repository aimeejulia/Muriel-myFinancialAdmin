const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function openDialog() {
  return [...document.querySelectorAll('.modal-backdrop')].find((dialog) => !dialog.hidden) || null;
}

function focusableIn(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter((element) => !element.closest('[hidden]'));
}

// Makes the modals work with the keyboard: focus moves into a modal when it opens and goes back when it
// closes, Tab stays in the modal, and Escape closes it with its close button.
export function attachDialogHandlers() {
  let lastFocusOutside = null;
  const returnFocus = new Map();

  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('.modal-backdrop')) lastFocusOutside = event.target;
  });

  document.querySelectorAll('.modal-backdrop').forEach((dialog) => {
    new MutationObserver(() => {
      if (!dialog.hidden) {
        returnFocus.set(dialog, lastFocusOutside);
        if (!dialog.contains(document.activeElement)) focusableIn(dialog)[0]?.focus();
        return;
      }
      const previous = returnFocus.get(dialog);
      returnFocus.delete(dialog);
      if (previous?.isConnected) previous.focus();
    }).observe(dialog, { attributes: true, attributeFilter: ['hidden'] });
  });

  document.addEventListener('keydown', (event) => {
    const dialog = openDialog();
    if (!dialog) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.querySelector('[data-dialog-close]')?.click();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = focusableIn(dialog);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}
