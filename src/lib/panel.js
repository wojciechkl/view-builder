import { el, clear, applyFont } from './dom.js';
import {
  COLUMN_TYPES, ALIGN_OPTIONS, FONT_FACES, SORT_MODES, SORT_TYPES,
  TOTAL_MODES, NUMBER_FORMATS, DATE_FORMATS, VIEW_STYLES,
} from './model.js';

const TABS = [
  ['basics', 'Basics'],
  ['font', 'Font'],
  ['header', 'Header'],
  ['sort', 'Sort'],
  ['totals', 'Totals'],
  ['advanced', 'Advanced'],
];

// --- small input factories -------------------------------------------------

function field(label, control, hint) {
  const wrap = el('div', { class: 'vb-field' });
  if (label) wrap.appendChild(el('label', { class: 'vb-label', text: label }));
  wrap.appendChild(control);
  if (hint) wrap.appendChild(el('div', { class: 'vb-hint', text: hint }));
  return wrap;
}

function stopEnterSubmit(input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      input.blur();
    }
  });
  return input;
}

function textInput(value, onInput, options) {
  const input = el('input', {
    class: 'vb-input',
    type: 'text',
    value: value === null || value === undefined ? '' : value,
    autocomplete: 'off',
    dataset: options && options.dataset ? options.dataset : null,
  });
  input.addEventListener('input', () => onInput(input.value));
  return stopEnterSubmit(input);
}

function numberInput(value, onInput, options) {
  const opts = options || {};
  const input = el('input', {
    class: 'vb-input',
    type: 'number',
    value: String(value),
    min: String(opts.min === undefined ? 0 : opts.min),
    max: String(opts.max === undefined ? 100000 : opts.max),
    step: String(opts.step === undefined ? 1 : opts.step),
    autocomplete: 'off',
    dataset: opts.dataset || null,
  });
  input.addEventListener('input', () => {
    const n = parseFloat(input.value);
    if (!isNaN(n)) onInput(n);
  });
  input.addEventListener('change', () => {
    let n = parseFloat(input.value);
    if (isNaN(n)) n = opts.min === undefined ? 0 : opts.min;
    n = Math.min(opts.max === undefined ? 100000 : opts.max, Math.max(opts.min === undefined ? 0 : opts.min, n));
    input.value = String(n);
    onInput(n);
  });
  return stopEnterSubmit(input);
}

function selectInput(value, options, onChange) {
  const select = el('select', { class: 'vb-select' });
  for (const option of options) {
    const optionEl = el('option', { value: option.value, text: option.label });
    if (option.value === value) optionEl.selected = true;
    select.appendChild(optionEl);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function checkboxInput(checked, label, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'vb-check' }, [input, el('span', { text: label })]);
}

function segmented(value, options, onChange) {
  const group = el('div', { class: 'vb-radio-group' });
  for (const option of options) {
    const active = option.value === value;
    const button = el('button', {
      type: 'button',
      class: 'vb-radio' + (active ? ' vb-radio-active' : ''),
      text: option.label,
      onclick: () => {
        if (!button.classList.contains('vb-radio-active')) onChange(option.value);
      },
    });
    group.appendChild(button);
  }
  return group;
}

function toggleButton(label, active, onToggle, style) {
  const button = el('button', {
    type: 'button',
    class: 'vb-radio' + (active ? ' vb-radio-active' : ''),
    text: label,
    style: style || null,
  });
  button.addEventListener('click', () => {
    const next = !button.classList.contains('vb-radio-active');
    button.classList.toggle('vb-radio-active', next);
    onToggle(next);
  });
  return button;
}

function colorInput(value, onChange) {
  const input = el('input', { type: 'color', class: 'vb-color-input', value: value || '#111111' });
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function formulaField(value, onEdit, hint) {
  const preview = el('textarea', { class: 'vb-textarea vb-formula-preview', readonly: 'readonly', rows: '3', spellcheck: 'false' });
  preview.value = value || '';
  if (!value) preview.placeholder = '(empty)';
  const button = el('button', { type: 'button', class: 'vb-btn', text: 'Formula...', onclick: onEdit });
  return field(null, el('div', { class: 'vb-formula-row' }, [preview, button]), hint);
}

function fontControls(font, onChange) {
  const wrap = el('div');
  wrap.appendChild(field('Face', selectInput(font.face, FONT_FACES, (v) => onChange({ face: v }))));
  const row = el('div', { class: 'vb-inline' });
  row.appendChild(field('Size (pt)', numberInput(font.size, (v) => onChange({ size: v }), { min: 6, max: 72, step: 0.5 })));
  row.appendChild(field('Color', colorInput(font.color, (v) => onChange({ color: v }))));
  wrap.appendChild(row);
  const styles = el('div', { class: 'vb-radio-group' });
  styles.appendChild(toggleButton('B', font.bold, (v) => onChange({ bold: v }), { fontWeight: '700' }));
  styles.appendChild(toggleButton('I', font.italic, (v) => onChange({ italic: v }), { fontStyle: 'italic' }));
  styles.appendChild(toggleButton('U', font.underline, (v) => onChange({ underline: v }), { textDecoration: 'underline' }));
  wrap.appendChild(field('Style', styles));
  return wrap;
}

function previewLine(font, text) {
  const line = el('div', { class: 'vb-preview-line', text: text });
  applyFont(line, font);
  return field('Preview', line);
}

// --- column panel ----------------------------------------------------------

function renderColumnPanel(root, ctx, column) {
  const index = ctx.design.columns.indexOf(column);

  root.appendChild(el('div', { class: 'vb-panel-header' }, [
    el('div', { class: 'vb-panel-title', text: 'Column ' + (index + 1) }),
    el('div', {
      class: 'vb-panel-sub',
      dataset: { role: 'column-sub' },
      text: column.title || '(no title)',
    }),
  ]));

  const tabs = el('div', { class: 'vb-tabs' });
  for (const tab of TABS) {
    tabs.appendChild(el('button', {
      type: 'button',
      class: 'vb-tab' + (ctx.tab === tab[0] ? ' vb-tab-active' : ''),
      text: tab[1],
      onclick: () => ctx.setTab(tab[0]),
    }));
  }
  root.appendChild(tabs);

  const body = el('div', { class: 'vb-tab-body' });
  root.appendChild(body);

  if (ctx.tab === 'basics') basicsTab(body, ctx, column);
  else if (ctx.tab === 'font') fontTab(body, ctx, column);
  else if (ctx.tab === 'header') headerTab(body, ctx, column);
  else if (ctx.tab === 'sort') sortTab(body, ctx, column);
  else if (ctx.tab === 'totals') totalsTab(body, ctx, column);
  else advancedTab(body, ctx, column);
}

function basicsTab(body, ctx, column) {
  body.appendChild(field('Title', textInput(column.title, (v) => ctx.update((c) => { c.title = v; }))));
  body.appendChild(formulaField(column.formula, () => ctx.editFormula(),
    'Formula that computes the column value. Double-click the column header in the preview to edit it.'));
  body.appendChild(field('Show as', selectInput(column.type, COLUMN_TYPES, (v) => ctx.update((c) => { c.type = v; }, { panel: true }))));

  const widthRow = el('div', { class: 'vb-inline' });
  widthRow.appendChild(field('Width (px)', numberInput(column.width, (v) => ctx.update((c) => { c.width = v; }), { min: 24, max: 2000, dataset: { prop: 'width' } })));
  widthRow.appendChild(field('Options', checkboxInput(column.resizable, 'Resizable', (v) => ctx.update((c) => { c.resizable = v; }))));
  body.appendChild(widthRow);

  body.appendChild(field('Alignment', segmented(column.align, ALIGN_OPTIONS, (v) => ctx.update((c) => { c.align = v; }, { panel: true }))));
  body.appendChild(field('Multi-value separator', textInput(column.multiValueSeparator, (v) => ctx.update((c) => { c.multiValueSeparator = v; }))));

  if (column.type === 'number') {
    body.appendChild(field('Number format', selectInput(column.numberFormat, NUMBER_FORMATS, (v) => ctx.update((c) => { c.numberFormat = v; }))));
  }
  if (column.type === 'datetime') {
    body.appendChild(field('Date format', selectInput(column.dateFormat, DATE_FORMATS, (v) => ctx.update((c) => { c.dateFormat = v; }))));
  }
}

function fontTab(body, ctx, column) {
  body.appendChild(fontControls(column.font, (patch) => ctx.update((c) => Object.assign(c.font, patch))));
  body.appendChild(previewLine(column.font, 'Sample text 123'));
}

function headerTab(body, ctx, column) {
  body.appendChild(field('Header', checkboxInput(column.header.hidden, 'Hide column header', (v) => ctx.update((c) => { c.header.hidden = v; }))));
  body.appendChild(field('Font', checkboxInput(column.header.useColumnFont, 'Use column font', (v) => ctx.update((c) => { c.header.useColumnFont = v; }, { panel: true }))));
  if (!column.header.useColumnFont) {
    body.appendChild(fontControls(column.header, (patch) => ctx.update((c) => Object.assign(c.header, patch))));
  }
  body.appendChild(field('Header alignment', segmented(column.header.align, ALIGN_OPTIONS, (v) => ctx.update((c) => { c.header.align = v; }, { panel: true }))));
  body.appendChild(previewLine(column.header.useColumnFont ? column.font : column.header, column.title || 'Column ' + (ctx.design.columns.indexOf(column) + 1)));
}

function sortTab(body, ctx, column) {
  body.appendChild(field('Sort', selectInput(column.sort, SORT_MODES, (v) => ctx.update((c) => { c.sort = v; }))));
  body.appendChild(field('Sort type', selectInput(column.sortType, SORT_TYPES, (v) => ctx.update((c) => { c.sortType = v; }))));
  body.appendChild(field('Options', checkboxInput(column.clickToSort, 'Click on column header to sort', (v) => ctx.update((c) => { c.clickToSort = v; }))));
  body.appendChild(el('div', { class: 'vb-hint', text: 'Sorted columns show an arrow in the preview header. Only the first sorted column is used by Domino as the primary sort.' }));
}

function totalsTab(body, ctx, column) {
  body.appendChild(field('Show totals', selectInput(column.totals, TOTAL_MODES, (v) => ctx.update((c) => {
    c.totals = v;
    if (v === 'none') c.hideDetailRows = false;
  }, { panel: true }))));
  body.appendChild(field('Options', checkboxInput(column.hideDetailRows, 'Hide detail rows', (v) => ctx.update((c) => { c.hideDetailRows = v; }))));
  body.appendChild(el('div', { class: 'vb-hint', text: 'Totals are calculated over the sample documents and shown in the footer row of the preview.' }));
}

function advancedTab(body, ctx, column) {
  body.appendChild(field('Programmatic name', textInput(column.programmaticName, (v) => ctx.update((c) => { c.programmaticName = v; }))));
  body.appendChild(formulaField(column.hideWhen, () => ctx.editHideWhen(),
    'Hide-when formula: the column is hidden when this formula evaluates to True.'));
  body.appendChild(el('div', { class: 'vb-section' }, [
    el('div', { class: 'vb-section-title', text: 'Embedding' }),
    el('div', { class: 'vb-hint', text: 'Use ViewBuilder.mount(host, { design: ViewBuilder.deserialize(xml) }) to embed this editor in an XPages page.' }),
  ]));
}

// --- view panel ------------------------------------------------------------

function renderViewPanel(root, ctx) {
  const design = ctx.design;

  root.appendChild(el('div', { class: 'vb-panel-header' }, [
    el('div', { class: 'vb-panel-title', text: 'View properties' }),
    el('div', { class: 'vb-panel-sub', text: 'No column selected' }),
  ]));

  const body = el('div', { class: 'vb-tab-body' });
  root.appendChild(body);

  body.appendChild(field('View name', textInput(design.name, (v) => ctx.updateDesign((d) => { d.name = v; }))));
  body.appendChild(field('Alias', textInput(design.alias, (v) => ctx.updateDesign((d) => { d.alias = v; }))));
  body.appendChild(field('View style', selectInput(design.style, VIEW_STYLES, (v) => ctx.updateDesign((d) => { d.style = v; }))));
  body.appendChild(field('Display', checkboxInput(design.alternateRows, 'Alternating row colors', (v) => ctx.updateDesign((d) => { d.alternateRows = v; }))));

  const formulas = el('div', { class: 'vb-section' });
  formulas.appendChild(el('div', { class: 'vb-section-title', text: 'Formulas' }));
  formulas.appendChild(formulaField(design.selectionFormula, () => ctx.editSelectionFormula(),
    'View selection formula: determines which documents appear in the view.'));
  formulas.appendChild(formulaField(design.formFormula, () => ctx.editFormFormula(),
    'Form formula: form used to open documents from the view.'));
  body.appendChild(formulas);

  const stats = el('div', { class: 'vb-section' });
  stats.appendChild(el('div', { class: 'vb-section-title', text: 'Design' }));
  stats.appendChild(el('div', { class: 'vb-hint', text: 'Columns: ' + design.columns.length }));
  const actions = el('div', { class: 'vb-inline', style: { marginTop: '8px' } });
  actions.appendChild(el('button', { type: 'button', class: 'vb-btn', text: 'Export XML', onclick: () => ctx.exportXml() }));
  actions.appendChild(el('button', { type: 'button', class: 'vb-btn', text: 'Import XML', onclick: () => ctx.importXml() }));
  stats.appendChild(actions);
  stats.appendChild(el('div', { class: 'vb-hint', style: { marginTop: '8px' }, text: 'Select a column header in the preview to edit column properties.' }));
  body.appendChild(stats);
}

// --- entry point -----------------------------------------------------------

export function renderPanel(root, ctx) {
  clear(root);
  const column = ctx.getSelectedColumn();
  if (column) renderColumnPanel(root, ctx, column);
  else renderViewPanel(root, ctx);
}
