import { el, clear, applyFont } from './dom.js';
import {
  COLUMN_TYPES, ALIGN_OPTIONS, FONT_FACES, SORT_MODES, SORT_TYPES,
  TOTAL_MODES, NUMBER_FORMATS, DATE_FORMATS, VIEW_STYLES, isDefaultFont, isDefaultHeader,
} from './model.js';

const TABS = [
  ['basics', 'tab.basics'],
  ['font', 'tab.font'],
  ['header', 'tab.header'],
  ['sort', 'tab.sort'],
  ['totals', 'tab.totals'],
  ['advanced', 'tab.advanced'],
];

// Header, Font and Advanced only clutter the panel while they hold no values,
// so they appear once the column actually uses them (or the header shares its font).
function columnTabs(column) {
  const tabs = [];
  for (const tab of TABS) {
    if (tab[0] === 'header' && isDefaultHeader(column.header)) continue;
    if (tab[0] === 'font' && isDefaultFont(column.font) && !column.header.useColumnFont) continue;
    if (tab[0] === 'advanced' && !column.programmaticName && !column.hideWhen) continue;
    tabs.push(tab);
  }
  return tabs;
}

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

function selectInput(value, options, onChange, t) {
  const select = el('select', { class: 'vb-select' });
  for (const option of options) {
    const optionEl = el('option', {
      value: option.value,
      text: option.labelKey ? t(option.labelKey) : option.label,
    });
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

function segmented(value, options, onChange, t) {
  const group = el('div', { class: 'vb-radio-group' });
  for (const option of options) {
    const active = option.value === value;
    const button = el('button', {
      type: 'button',
      class: 'vb-radio' + (active ? ' vb-radio-active' : ''),
      text: option.labelKey ? t(option.labelKey) : option.label,
      onclick: () => {
        if (!button.classList.contains('vb-radio-active')) onChange(option.value);
      },
    });
    group.appendChild(button);
  }
  return group;
}

function toggleButton(label, active, onToggle, className) {
  const button = el('button', {
    type: 'button',
    class: 'vb-radio' + (active ? ' vb-radio-active' : '') + (className ? ' ' + className : ''),
    text: label,
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

function formulaField(value, onEdit, hint, t) {
  const preview = el('textarea', { class: 'vb-textarea vb-formula-preview', readonly: 'readonly', rows: '3', spellcheck: 'false' });
  preview.value = value || '';
  if (!value) preview.placeholder = t('common.emptyPlaceholder');
  const button = el('button', { type: 'button', class: 'vb-btn', text: t('common.formulaButton'), onclick: onEdit });
  return field(null, el('div', { class: 'vb-formula-row' }, [preview, button]), hint);
}

function fontControls(font, onChange, t) {
  const wrap = el('div');
  wrap.appendChild(field(t('field.face'), selectInput(font.face, FONT_FACES, (v) => onChange({ face: v }), t)));
  const row = el('div', { class: 'vb-inline' });
  row.appendChild(field(t('field.size'), numberInput(font.size, (v) => onChange({ size: v }), { min: 6, max: 72, step: 0.5 })));
  row.appendChild(field(t('field.color'), colorInput(font.color, (v) => onChange({ color: v }))));
  wrap.appendChild(row);
  const styles = el('div', { class: 'vb-radio-group' });
  styles.appendChild(toggleButton('B', font.bold, (v) => onChange({ bold: v }), 'vb-radio-bold'));
  styles.appendChild(toggleButton('I', font.italic, (v) => onChange({ italic: v }), 'vb-radio-italic'));
  styles.appendChild(toggleButton('U', font.underline, (v) => onChange({ underline: v }), 'vb-radio-underline'));
  wrap.appendChild(field(t('common.style'), styles));
  return wrap;
}

function previewLine(font, text, t) {
  const line = el('div', { class: 'vb-preview-line', text: text });
  applyFont(line, font);
  return field(t('common.preview'), line);
}

// --- column panel ----------------------------------------------------------

function renderColumnPanel(root, ctx, column) {
  const t = ctx.t;
  const index = ctx.design.columns.indexOf(column);

  root.appendChild(el('div', { class: 'vb-panel-header' }, [
    el('div', { class: 'vb-panel-title', text: t('canvas.columnName', { n: index + 1 }) }),
    el('div', {
      class: 'vb-panel-sub',
      dataset: { role: 'column-sub' },
      text: column.title || t('common.noTitle'),
    }),
  ]));

  const tabs = columnTabs(column);
  const activeTab = tabs.some((tab) => tab[0] === ctx.tab) ? ctx.tab : 'basics';
  ctx.tab = activeTab;

  const tabsBar = el('div', { class: 'vb-tabs' });
  for (const tab of tabs) {
    tabsBar.appendChild(el('button', {
      type: 'button',
      class: 'vb-tab' + (activeTab === tab[0] ? ' vb-tab-active' : ''),
      text: t(tab[1]),
      onclick: () => ctx.setTab(tab[0]),
    }));
  }
  root.appendChild(tabsBar);

  const body = el('div', { class: 'vb-tab-body' });
  root.appendChild(body);

  if (activeTab === 'basics') basicsTab(body, ctx, column);
  else if (activeTab === 'font') fontTab(body, ctx, column);
  else if (activeTab === 'header') headerTab(body, ctx, column);
  else if (activeTab === 'sort') sortTab(body, ctx, column);
  else if (activeTab === 'totals') totalsTab(body, ctx, column);
  else advancedTab(body, ctx, column);
}

function basicsTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('field.title'), textInput(column.title, (v) => ctx.update((c) => { c.title = v; }))));
  body.appendChild(formulaField(column.formula, () => ctx.editFormula(), t('hint.columnFormula'), t));
  body.appendChild(field(t('field.showAs'), selectInput(column.type, COLUMN_TYPES, (v) => ctx.update((c) => { c.type = v; }, { panel: true }), t)));

  const widthRow = el('div', { class: 'vb-inline' });
  widthRow.appendChild(field(t('field.width'), numberInput(column.width, (v) => ctx.update((c) => { c.width = v; }), { min: 24, max: 2000, dataset: { prop: 'width' } })));
  widthRow.appendChild(field(t('common.options'), checkboxInput(column.resizable, t('check.resizable'), (v) => ctx.update((c) => { c.resizable = v; }))));
  body.appendChild(widthRow);

  body.appendChild(field(t('field.alignment'), segmented(column.align, ALIGN_OPTIONS, (v) => ctx.update((c) => { c.align = v; }, { panel: true }), t)));
  body.appendChild(field(t('field.multiValueSeparator'), textInput(column.multiValueSeparator, (v) => ctx.update((c) => { c.multiValueSeparator = v; }))));

  if (column.type === 'number') {
    body.appendChild(field(t('field.numberFormat'), selectInput(column.numberFormat, NUMBER_FORMATS, (v) => ctx.update((c) => { c.numberFormat = v; }), t)));
  }
  if (column.type === 'datetime') {
    body.appendChild(field(t('field.dateFormat'), selectInput(column.dateFormat, DATE_FORMATS, (v) => ctx.update((c) => { c.dateFormat = v; }), t)));
  }

  body.appendChild(el('div', {
    class: 'vb-hint vb-mt',
    text: t('hint.basicsTabs'),
  }));
}

function fontTab(body, ctx, column) {
  body.appendChild(fontControls(column.font, (patch) => ctx.update((c) => Object.assign(c.font, patch)), ctx.t));
  body.appendChild(previewLine(column.font, ctx.t('preview.sampleText'), ctx.t));
}

function headerTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('tab.header'), checkboxInput(column.header.hidden, t('check.hideColumnHeader'), (v) => ctx.update((c) => { c.header.hidden = v; }))));
  body.appendChild(field(t('tab.font'), checkboxInput(column.header.useColumnFont, t('check.useColumnFont'), (v) => ctx.update((c) => { c.header.useColumnFont = v; }, { panel: true }))));
  if (column.header.useColumnFont) {
    body.appendChild(el('div', { class: 'vb-hint', text: t('hint.columnFontShared') }));
  } else {
    body.appendChild(fontControls(column.header, (patch) => ctx.update((c) => Object.assign(c.header, patch)), t));
  }
  body.appendChild(field(t('field.headerAlignment'), segmented(column.header.align, ALIGN_OPTIONS, (v) => ctx.update((c) => { c.header.align = v; }, { panel: true }), t)));
  body.appendChild(previewLine(column.header.useColumnFont ? column.font : column.header, column.title || t('canvas.columnName', { n: ctx.design.columns.indexOf(column) + 1 }), t));
}

function sortTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('tab.sort'), selectInput(column.sort, SORT_MODES, (v) => ctx.update((c) => { c.sort = v; }), t)));
  body.appendChild(field(t('field.sortType'), selectInput(column.sortType, SORT_TYPES, (v) => ctx.update((c) => { c.sortType = v; }), t)));
  body.appendChild(field(t('common.options'), checkboxInput(column.clickToSort, t('check.clickToSort'), (v) => ctx.update((c) => { c.clickToSort = v; }))));
  body.appendChild(el('div', { class: 'vb-hint', text: t('hint.sort') }));
}

function totalsTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('field.showTotals'), selectInput(column.totals, TOTAL_MODES, (v) => ctx.update((c) => {
    c.totals = v;
    if (v === 'none') c.hideDetailRows = false;
  }, { panel: true }), t)));
  body.appendChild(field(t('common.options'), checkboxInput(column.hideDetailRows, t('check.hideDetailRows'), (v) => ctx.update((c) => { c.hideDetailRows = v; }))));
  body.appendChild(el('div', { class: 'vb-hint', text: t('hint.totals') }));
}

function advancedTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('field.programmaticName'), textInput(column.programmaticName, (v) => {
    const wasVisible = !!column.programmaticName;
    ctx.update((c) => { c.programmaticName = v; }, { panel: wasVisible !== !!v });
  })));
  body.appendChild(formulaField(column.hideWhen, () => ctx.editHideWhen(), t('hint.hideWhen'), t));
  body.appendChild(el('div', { class: 'vb-section' }, [
    el('div', { class: 'vb-section-title', text: t('section.embedding') }),
    el('div', { class: 'vb-hint', text: t('hint.embedding') }),
  ]));
}

// --- view panel ------------------------------------------------------------

function renderViewPanel(root, ctx) {
  const design = ctx.design;
  const t = ctx.t;

  root.appendChild(el('div', { class: 'vb-panel-header' }, [
    el('div', { class: 'vb-panel-title', text: t('panel.viewProperties') }),
    el('div', { class: 'vb-panel-sub', text: t('panel.noColumnSelected') }),
  ]));

  const body = el('div', { class: 'vb-tab-body' });
  root.appendChild(body);

  body.appendChild(field(t('field.viewName'), textInput(design.name, (v) => ctx.updateDesign((d) => { d.name = v; }))));
  body.appendChild(field(t('field.alias'), textInput(design.alias, (v) => ctx.updateDesign((d) => { d.alias = v; }))));
  body.appendChild(field(t('field.viewStyle'), selectInput(design.style, VIEW_STYLES, (v) => ctx.updateDesign((d) => { d.style = v; }), t)));

  const formulas = el('div', { class: 'vb-section' });
  formulas.appendChild(el('div', { class: 'vb-section-title', text: t('section.formulas') }));
  formulas.appendChild(formulaField(design.selectionFormula, () => ctx.editSelectionFormula(), t('hint.selectionFormula'), t));
  body.appendChild(formulas);

  const stats = el('div', { class: 'vb-section' });
  stats.appendChild(el('div', { class: 'vb-section-title', text: t('section.design') }));
  stats.appendChild(el('div', { class: 'vb-hint', text: t('panel.columnsCount', { n: design.columns.length }) }));
  const actions = el('div', { class: 'vb-inline vb-mt' });
  actions.appendChild(el('button', { type: 'button', class: 'vb-btn', text: t('toolbar.exportXml'), onclick: () => ctx.exportXml() }));
  actions.appendChild(el('button', { type: 'button', class: 'vb-btn', text: t('toolbar.importXml'), onclick: () => ctx.importXml() }));
  stats.appendChild(actions);
  stats.appendChild(el('div', { class: 'vb-hint vb-mt', text: t('hint.viewPanelFooter') }));
  body.appendChild(stats);
}

// --- entry point -----------------------------------------------------------

export function renderPanel(root, ctx) {
  clear(root);
  const column = ctx.getSelectedColumn();
  if (column) renderColumnPanel(root, ctx, column);
  else renderViewPanel(root, ctx);
}
