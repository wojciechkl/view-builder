import { el } from './dom.js';

export function openDialog(root, options) {
  const t = options.t;
  const overlay = el('div', { class: 'vb-overlay', tabindex: '-1' });

  const close = () => {
    if (!overlay.parentNode) return;
    overlay.parentNode.removeChild(overlay);
    if (options.onClose) options.onClose();
  };

  const card = el('div', { class: 'vb-dialog' + (options.size ? ' vb-dialog-' + options.size : '') });
  const header = el('div', { class: 'vb-dialog-header' }, [
    el('span', { text: options.title || '' }),
    el('button', { type: 'button', class: 'vb-dialog-close', text: '\u2715', title: t('common.close'), onclick: close }),
  ]);
  const body = el('div', { class: 'vb-dialog-body' }, [options.body]);
  const footer = el('div', { class: 'vb-dialog-footer' });
  for (const button of options.buttons || []) {
    footer.appendChild(el('button', {
      type: 'button',
      class: 'vb-btn' + (button.primary ? ' vb-btn-primary' : '') + (button.danger ? ' vb-btn-danger' : ''),
      text: button.label,
      onclick: () => button.onClick(close),
    }));
  }

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.stopPropagation();
      close();
    }
  });
  root.appendChild(overlay);
  overlay.focus();
  if (options.focus) options.focus();
  return close;
}

export function openFormulaDialog(root, options) {
  const t = options.t;
  const textarea = el('textarea', { class: 'vb-formula-input', spellcheck: 'false' });
  textarea.value = options.value || '';

  const insert = (text) => {
    const start = textarea.selectionStart === null ? textarea.value.length : textarea.selectionStart;
    const end = textarea.selectionEnd === null ? textarea.value.length : textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  };

  const chips = el('div', { class: 'vb-chips' });
  for (const field of options.fields || []) {
    chips.appendChild(el('button', { type: 'button', class: 'vb-chip', text: field, title: t('dialog.insertField'), onclick: () => insert(field) }));
  }
  for (const fn of options.functions || []) {
    chips.appendChild(el('button', { type: 'button', class: 'vb-chip vb-chip-fn', text: fn, title: t('dialog.insertFunction'), onclick: () => insert(fn) }));
  }

  const body = el('div', {}, [
    el('div', { class: 'vb-hint', text: options.hint || t('dialog.formulaHint') }),
    chips,
    textarea,
  ]);

  openDialog(root, {
    t: t,
    title: options.title,
    body,
    focus: () => textarea.focus(),
    buttons: [
      { label: t('common.cancel'), onClick: (close) => close() },
      {
        label: t('common.ok'),
        primary: true,
        onClick: (close) => {
          options.onSave(textarea.value);
          close();
        },
      },
    ],
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const anchor = el('a', { href: url, download: filename });
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openExportDialog(root, options) {
  const t = options.t;
  const textarea = el('textarea', { class: 'vb-xml-input', readonly: 'readonly', spellcheck: 'false' });
  textarea.value = options.xml;
  const status = el('div', { class: 'vb-hint', text: t('dialog.exportHint') });

  const body = el('div', {}, [status, textarea]);

  openDialog(root, {
    t: t,
    title: t('dialog.exportTitle'),
    size: 'lg',
    body,
    focus: () => textarea.focus(),
    buttons: [
      { label: t('dialog.downloadXml'), onClick: () => downloadText(options.filename || 'view.xml', options.xml) },
      {
        label: t('dialog.copyClipboard'),
        primary: true,
        onClick: () => {
          textarea.focus();
          textarea.select();
          try {
            const ok = document.execCommand('copy');
            status.textContent = ok ? t('dialog.copied') : t('dialog.selectionReady');
          } catch (error) {
            status.textContent = t('dialog.selectionReady');
          }
        },
      },
      { label: t('common.close'), onClick: (close) => close() },
    ],
  });
}

export function openImportDialog(root, options) {
  const t = options.t;
  const textarea = el('textarea', { class: 'vb-xml-input', spellcheck: 'false' });
  textarea.placeholder = '<view name="MyView">\n  <columns>\n    <column ...>...</column>\n  </columns>\n</view>';
  const error = el('div', { class: 'vb-error' });
  const body = el('div', {}, [
    el('div', { class: 'vb-hint', text: t('dialog.importHint') }),
    textarea,
    error,
  ]);

  openDialog(root, {
    t: t,
    title: t('dialog.importTitle'),
    size: 'lg',
    body,
    focus: () => textarea.focus(),
    buttons: [
      { label: t('common.cancel'), onClick: (close) => close() },
      {
        label: t('dialog.loadDesign'),
        primary: true,
        onClick: (close) => {
          try {
            options.onLoad(textarea.value);
            close();
          } catch (e) {
            error.textContent = e && e.message ? e.message : String(e);
          }
        },
      },
    ],
  });
}
