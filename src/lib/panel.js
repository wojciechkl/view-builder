import { el, clear, applyFont } from './dom.js';
import {
  COLUMN_TYPES, ALIGN_OPTIONS, FONT_FACES, SORT_MODES, SORT_TYPES,
  TOTAL_MODES, NUMBER_FORMATS, DATE_FORMATS, VIEW_STYLES, WIDTH_UNITS,
  isDefaultFont, isDefaultHeader,
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
  if (control) wrap.appendChild(control);
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

function textInput(value, onChange, options) {
  const input = el('input', {
    class: 'vb-input',
    type: 'text',
    value: value === null || value === undefined ? '' : value,
    autocomplete: 'off',
    dataset: options && options.dataset ? options.dataset : null,
  });
  let committed = input.value;
  input.addEventListener('input', () => onChange(input.value, 'input'));
  input.addEventListener('change', () => {
    if (input.value === committed) return;
    committed = input.value;
    onChange(input.value, 'commit');
  });
  return stopEnterSubmit(input);
}

function numberInput(value, onChange, options) {
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
  let committed = input.value;
  const clamp = (n) => Math.min(opts.max === undefined ? 100000 : opts.max, Math.max(opts.min === undefined ? 0 : opts.min, n));
  input.addEventListener('input', () => {
    const n = parseFloat(input.value);
    if (!isNaN(n)) onChange(n, 'input');
  });
  input.addEventListener('change', () => {
    let n = parseFloat(input.value);
    if (isNaN(n)) n = opts.min === undefined ? 0 : opts.min;
    n = clamp(n);
    input.value = String(n);
    if (input.value === committed) return;
    committed = input.value;
    onChange(n, 'commit');
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
  select.addEventListener('change', () => onChange(select.value, 'commit'));
  return select;
}

function checkboxInput(checked, label, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked, 'commit'));
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
        if (!button.classList.contains('vb-radio-active')) onChange(option.value, 'commit');
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
    onToggle(next, 'commit');
  });
  return button;
}

function colorInput(value, onChange) {
  const input = el('input', { type: 'color', class: 'vb-color-input', value: value || '#111111' });
  let committed = input.value.toLowerCase();
  input.addEventListener('input', () => onChange(input.value, 'input'));
  input.addEventListener('change', () => {
    const next = input.value.toLowerCase();
    if (next === committed) return;
    committed = next;
    onChange(input.value, 'commit');
  });
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
  wrap.appendChild(field(t('field.face'), selectInput(font.face, FONT_FACES, (v, phase) => onChange({ face: v }, phase), t)));
  const row = el('div', { class: 'vb-inline' });
  row.appendChild(field(t('field.size'), numberInput(font.size, (v, phase) => onChange({ size: v }, phase), { min: 6, max: 72, step: 0.5 })));
  row.appendChild(field(t('field.color'), colorInput(font.color, (v, phase) => onChange({ color: v }, phase))));
  wrap.appendChild(row);
  const styles = el('div', { class: 'vb-radio-group' });
  styles.appendChild(toggleButton('B', font.bold, (v, phase) => onChange({ bold: v }, phase), 'vb-radio-bold'));
  styles.appendChild(toggleButton('I', font.italic, (v, phase) => onChange({ italic: v }, phase), 'vb-radio-italic'));
  styles.appendChild(toggleButton('U', font.underline, (v, phase) => onChange({ underline: v }, phase), 'vb-radio-underline'));
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
      dataset: { vbAllow: '1' },
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
  body.appendChild(field(t('field.title'), textInput(column.title, (v, phase) => ctx.update((c) => { c.title = v; }, { property: 'title', phase }))));
  body.appendChild(formulaField(column.formula, () => ctx.editFormula(), t('hint.columnFormula'), t));
  body.appendChild(field(t('field.showAs'), selectInput(column.type, COLUMN_TYPES, (v) => ctx.update((c) => { c.type = v; }, { panel: true, property: 'type', phase: 'commit' }), t)));

  const widthRow = el('div', { class: 'vb-inline' });
  const widthInput = numberInput(column.width, (v, phase) => ctx.update((c) => { c.width = v; }, { property: 'width', phase }), { min: 24, max: 2000, dataset: { prop: 'width' } });
  widthInput.disabled = column.autoWidth;
  widthRow.appendChild(field(t('field.width'), widthInput));
  const unitSelect = selectInput(column.widthUnit, WIDTH_UNITS, (v) => ctx.update((c) => { c.widthUnit = v; }, { property: 'widthUnit', phase: 'commit' }), t);
  unitSelect.disabled = column.autoWidth;
  widthRow.appendChild(field(t('field.widthUnit'), unitSelect));
  body.appendChild(widthRow);

  const optionsField = field(t('common.options'));
  optionsField.appendChild(checkboxInput(column.autoWidth, t('check.autoWidth'), (v) => ctx.update((c) => { c.autoWidth = v; }, { panel: true, property: 'autoWidth', phase: 'commit' })));
  const resizableBox = checkboxInput(column.resizable, t('check.resizable'), (v) => ctx.update((c) => { c.resizable = v; }, { property: 'resizable', phase: 'commit' }));
  if (column.autoWidth) resizableBox.querySelector('input').disabled = true;
  optionsField.appendChild(resizableBox);
  body.appendChild(optionsField);

  body.appendChild(field(t('field.alignment'), segmented(column.align, ALIGN_OPTIONS, (v) => ctx.update((c) => { c.align = v; }, { panel: true, property: 'align', phase: 'commit' }), t)));
  body.appendChild(field(null, checkboxInput(column.multipleValuesAsSeparateEntries, t('check.multipleValues'), (v) => ctx.update((c) => { c.multipleValuesAsSeparateEntries = v; }, { property: 'multipleValuesAsSeparateEntries', phase: 'commit' }))));
  body.appendChild(field(t('field.multiValueSeparator'), textInput(column.multiValueSeparator, (v, phase) => ctx.update((c) => { c.multiValueSeparator = v; }, { property: 'multiValueSeparator', phase }))));

  if (column.type === 'number') {
    body.appendChild(field(t('field.numberFormat'), selectInput(column.numberFormat, NUMBER_FORMATS, (v) => ctx.update((c) => { c.numberFormat = v; }, { property: 'numberFormat', phase: 'commit' }), t)));
  }
  if (column.type === 'datetime') {
    body.appendChild(field(t('field.dateFormat'), selectInput(column.dateFormat, DATE_FORMATS, (v) => ctx.update((c) => { c.dateFormat = v; }, { property: 'dateFormat', phase: 'commit' }), t)));
  }

  body.appendChild(el('div', {
    class: 'vb-hint vb-mt',
    text: t('hint.basicsTabs'),
  }));
}

function fontTab(body, ctx, column) {
  body.appendChild(fontControls(column.font, (patch, phase) => {
    const key = Object.keys(patch)[0];
    ctx.update((c) => Object.assign(c.font, patch), { property: 'font.' + key, phase });
  }, ctx.t));
  body.appendChild(previewLine(column.font, ctx.t('preview.sampleText'), ctx.t));
}

function headerTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('tab.header'), checkboxInput(column.header.hidden, t('check.hideColumnHeader'), (v) => ctx.update((c) => { c.header.hidden = v; }, { property: 'header.hidden', phase: 'commit' }))));
  body.appendChild(field(t('tab.font'), checkboxInput(column.header.useColumnFont, t('check.useColumnFont'), (v) => ctx.update((c) => { c.header.useColumnFont = v; }, { panel: true, property: 'header.useColumnFont', phase: 'commit' }))));
  if (column.header.useColumnFont) {
    body.appendChild(el('div', { class: 'vb-hint', text: t('hint.columnFontShared') }));
  } else {
    body.appendChild(fontControls(column.header, (patch, phase) => {
      const key = Object.keys(patch)[0];
      ctx.update((c) => Object.assign(c.header, patch), { property: 'header.' + key, phase });
    }, t));
  }
  body.appendChild(field(t('field.headerAlignment'), segmented(column.header.align, ALIGN_OPTIONS, (v) => ctx.update((c) => { c.header.align = v; }, { panel: true, property: 'header.align', phase: 'commit' }), t)));
  body.appendChild(previewLine(column.header.useColumnFont ? column.font : column.header, column.title || t('canvas.columnName', { n: ctx.design.columns.indexOf(column) + 1 }), t));
}

function sortTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('tab.sort'), selectInput(column.sort, SORT_MODES, (v) => ctx.update((c) => {
    c.sort = v;
    if (v !== 'ascending') c.categorized = false;
  }, { panel: true, property: 'sort', phase: 'commit' }), t)));
  body.appendChild(field(t('field.sortType'), selectInput(column.sortType, SORT_TYPES, (v) => ctx.update((c) => { c.sortType = v; }, { property: 'sortType', phase: 'commit' }), t)));

  const options = field(t('common.options'));
  const categorized = checkboxInput(column.categorized, t('check.categorized'), (v) => ctx.update((c) => {
    c.categorized = v;
    if (v) {
      c.sort = 'ascending';
      c.clickToSort = false;
    }
  }, { panel: true, property: 'categorized', phase: 'commit' }));
  options.appendChild(categorized);
  const clickToSort = checkboxInput(column.clickToSort, t('check.clickToSort'), (v) => ctx.update((c) => { c.clickToSort = v; }, { property: 'clickToSort', phase: 'commit' }));
  clickToSort.querySelector('input').disabled = column.categorized;
  options.appendChild(clickToSort);
  body.appendChild(options);

  body.appendChild(el('div', { class: 'vb-hint', text: t('hint.sort') }));
  if (column.categorized) body.appendChild(el('div', { class: 'vb-hint', text: t('hint.categorized') }));
}

function totalsTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('field.showTotals'), selectInput(column.totals, TOTAL_MODES, (v) => ctx.update((c) => {
    c.totals = v;
    if (v === 'none') c.hideDetailRows = false;
  }, { panel: true, property: 'totals', phase: 'commit' }), t)));
  body.appendChild(field(t('common.options'), checkboxInput(column.hideDetailRows, t('check.hideDetailRows'), (v) => ctx.update((c) => { c.hideDetailRows = v; }, { property: 'hideDetailRows', phase: 'commit' }))));
  body.appendChild(el('div', { class: 'vb-hint', text: t('hint.totals') }));
}

function advancedTab(body, ctx, column) {
  const t = ctx.t;
  body.appendChild(field(t('field.programmaticName'), textInput(column.programmaticName, (v, phase) => {
    const wasVisible = !!column.programmaticName;
    ctx.update((c) => { c.programmaticName = v; }, { panel: wasVisible !== !!v, property: 'programmaticName', phase });
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

  body.appendChild(field(t('field.viewName'), textInput(design.name, (v, phase) => ctx.updateDesign((d) => { d.name = v; }, { property: 'name', phase }))));
  body.appendChild(field(t('field.alias'), textInput(design.alias, (v, phase) => ctx.updateDesign((d) => { d.alias = v; }, { property: 'alias', phase }))));
  body.appendChild(field(t('field.viewStyle'), selectInput(design.style, VIEW_STYLES, (v) => ctx.updateDesign((d) => { d.style = v; }, { property: 'style', phase: 'commit' }), t)));

  const formulas = el('div', { class: 'vb-section' });
  formulas.appendChild(el('div', { class: 'vb-section-title', text: t('section.formulas') }));
  formulas.appendChild(formulaField(design.selectionFormula, () => ctx.editSelectionFormula(), t('hint.selectionFormula'), t));
  body.appendChild(formulas);

  const stats = el('div', { class: 'vb-section' });
  stats.appendChild(el('div', { class: 'vb-section-title', text: t('section.design') }));
  stats.appendChild(el('div', { class: 'vb-hint', text: t('panel.columnsCount', { n: design.columns.length }) }));
  const actions = el('div', { class: 'vb-inline vb-mt' });
  actions.appendChild(el('button', { type: 'button', class: 'vb-btn', text: t('toolbar.exportXml'), dataset: { vbAllow: '1' }, onclick: () => ctx.exportXml() }));
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
  if (ctx.readonly) {
    const nodes = root.querySelectorAll('input, select, textarea, button');
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node.dataset && node.dataset.vbAllow === '1') continue;
      node.disabled = true;
    }
  }
}
