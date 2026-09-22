import { el } from './dom.js';

export function openDialog(root, options) {
  const overlay = el('div', { class: 'vb-overlay', tabindex: '-1' });

  const close = () => {
    if (!overlay.parentNode) return;
    overlay.parentNode.removeChild(overlay);
    if (options.onClose) options.onClose();
  };

  const card = el('div', { class: 'vb-dialog', style: options.width ? { width: options.width } : null });
  const header = el('div', { class: 'vb-dialog-header' }, [
    el('span', { text: options.title || '' }),
    el('button', { type: 'button', class: 'vb-dialog-close', text: '\u2715', title: 'Close', onclick: close }),
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
    chips.appendChild(el('button', { type: 'button', class: 'vb-chip', text: field, title: 'Insert field', onclick: () => insert(field) }));
  }
  for (const fn of options.functions || []) {
    chips.appendChild(el('button', { type: 'button', class: 'vb-chip vb-chip-fn', text: fn, title: 'Insert @function', onclick: () => insert(fn) }));
  }

  const body = el('div', {}, [
    el('div', { class: 'vb-hint', text: options.hint || 'Domino formula language. Click a field or function below to insert it at the cursor.' }),
    chips,
    textarea,
  ]);

  openDialog(root, {
    title: options.title,
    width: '560px',
    body,
    focus: () => textarea.focus(),
    buttons: [
      { label: 'Cancel', onClick: (close) => close() },
      {
        label: 'OK',
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
  const textarea = el('textarea', { class: 'vb-xml-input', readonly: 'readonly', spellcheck: 'false' });
  textarea.value = options.xml;
  const status = el('div', { class: 'vb-hint', text: 'This is the serialized design. Copy it or download it as an .xml file.' });

  const body = el('div', {}, [status, textarea]);

  openDialog(root, {
    title: 'Export view design as XML',
    width: '680px',
    body,
    focus: () => textarea.focus(),
    buttons: [
      { label: 'Download .xml', onClick: () => downloadText(options.filename || 'view.xml', options.xml) },
      {
        label: 'Copy to clipboard',
        primary: true,
        onClick: () => {
          textarea.focus();
          textarea.select();
          try {
            const ok = document.execCommand('copy');
            status.textContent = ok ? 'Copied to clipboard.' : 'Selection ready - press Ctrl+C to copy.';
          } catch (error) {
            status.textContent = 'Selection ready - press Ctrl+C to copy.';
          }
        },
      },
      { label: 'Close', onClick: (close) => close() },
    ],
  });
}

export function openImportDialog(root, options) {
  const textarea = el('textarea', { class: 'vb-xml-input', spellcheck: 'false' });
  textarea.placeholder = '<view name="MyView">\n  <columns>\n    <column ...>...</column>\n  </columns>\n</view>';
  const error = el('div', { class: 'vb-error' });
  const body = el('div', {}, [
    el('div', { class: 'vb-hint', text: 'Paste a view design XML produced by this editor or a Domino DXL export.' }),
    textarea,
    error,
  ]);

  openDialog(root, {
    title: 'Import view design from XML',
    width: '680px',
    body,
    focus: () => textarea.focus(),
    buttons: [
      { label: 'Cancel', onClick: (close) => close() },
      {
        label: 'Load design',
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
