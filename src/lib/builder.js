import { el, clear } from './dom.js';
import { createDesign, createColumn, cloneDesign, SAMPLE_FIELDS, FORMULA_FUNCTIONS, SAMPLE_ROW_COUNT } from './model.js';
import { renderCanvas } from './canvas.js';
import { renderPanel } from './panel.js';
import { openFormulaDialog, openExportDialog, openImportDialog } from './dialog.js';
import { serialize, deserialize } from './xml.js';
import { createTranslator, resolveLanguage } from './i18n.js';
import css from './styles.css?inline';

export class ViewBuilder {
  constructor(target, options) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('ViewBuilder: mount target not found');
    if (!host.dataset.vbMounted) host.dataset.vbMounted = '1';

    this.host = host;
    host.__vb = this;
    this.options = options || {};
    this.language = resolveLanguage(this.options.language);
    this.t = createTranslator(this.language);
    this.readonly = !!this.options.readonly;
    this.design = this.options.design ? cloneDesign(this.options.design) : createDesign();
    this.selectedId = this.design.columns.length ? this.design.columns[0].id : null;
    this.tab = 'basics';
    this.mode = 'design';
    this._dragId = null;
    this._listeners = Object.create(null);
    this._collapsed = new Set();
    this._destroyed = false;
    this._xmlTimer = null;
    this._xmlAppliedText = '';

    this._buildRoot();
    this._renderShell();
    this._render();
  }

  // -- setup ---------------------------------------------------------------

  _buildRoot() {
    let root;
    if (this.options.useShadow !== false && typeof this.host.attachShadow === 'function') {
      root = this.host.shadowRoot || this.host.attachShadow({ mode: 'open' });
      clear(root);
    } else {
      root = this.host;
      clear(root);
    }
    this.root = root;
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
    this.styleEl = style;
  }

  _renderShell() {
    const t = this.t;
    this.app = el('div', { class: 'vb-app' });

    const toolbar = el('div', { class: 'vb-toolbar' });
    const columnGroup = el('div', { class: 'vb-toolbar-group' });
    this.btnAdd = el('button', { type: 'button', class: 'vb-btn vb-btn-primary', onclick: () => this.addColumn() });
    this.btnDelete = el('button', { type: 'button', class: 'vb-btn', onclick: () => this.removeSelectedColumn() });
    this.btnLeft = el('button', { type: 'button', class: 'vb-btn', text: '\u2190', onclick: () => this.moveSelected(-1) });
    this.btnRight = el('button', { type: 'button', class: 'vb-btn', text: '\u2192', onclick: () => this.moveSelected(1) });
    columnGroup.appendChild(this.btnAdd);
    columnGroup.appendChild(this.btnDelete);
    columnGroup.appendChild(this.btnLeft);
    columnGroup.appendChild(this.btnRight);

    const xmlGroup = el('div', { class: 'vb-toolbar-group vb-toolbar-right' });
    this.btnXmlMode = el('button', { type: 'button', class: 'vb-btn', onclick: () => this.toggleXmlMode() });
    this.btnExport = el('button', { type: 'button', class: 'vb-btn', onclick: () => this.exportXml() });
    this.btnImport = el('button', { type: 'button', class: 'vb-btn', onclick: () => this.importXml() });
    xmlGroup.appendChild(this.btnXmlMode);
    xmlGroup.appendChild(this.btnExport);
    xmlGroup.appendChild(this.btnImport);

    toolbar.appendChild(columnGroup);
    toolbar.appendChild(xmlGroup);

    this.main = el('div', { class: 'vb-main' });
    this.canvasWrap = el('div', { class: 'vb-canvas-wrap' });
    this.panelWrap = el('div', { class: 'vb-panel' });
    this.main.appendChild(this.canvasWrap);
    this.main.appendChild(this.panelWrap);

    this.xmlEditor = this._buildXmlEditor();

    this.status = el('div', { class: 'vb-status' });

    this.app.appendChild(toolbar);
    this.app.appendChild(this.main);
    this.app.appendChild(this.xmlEditor);
    this.app.appendChild(this.status);
    this.root.appendChild(this.app);

    this._applyStaticTexts();
  }

  _applyStaticTexts() {
    const t = this.t;
    const xmlMode = this.mode === 'xml';
    this.btnAdd.textContent = t('toolbar.addColumn');
    this.btnDelete.textContent = t('toolbar.delete');
    this.btnDelete.title = t('toolbar.deleteTitle');
    this.btnLeft.title = t('toolbar.moveLeftTitle');
    this.btnRight.title = t('toolbar.moveRightTitle');
    this.btnXmlMode.textContent = xmlMode ? t('toolbar.designView') : t('toolbar.xmlEditor');
    this.btnXmlMode.title = xmlMode ? t('toolbar.designViewTitle') : t('toolbar.xmlEditorTitle');
    this.btnExport.textContent = t('toolbar.exportXml');
    this.btnImport.textContent = t('toolbar.importXml');
    this.btnApplyXml.textContent = t('xml.apply');
    this.btnApplyXml.title = t('xml.applyTitle');
    this.btnFormatXml.textContent = t('xml.format');
    this.btnFormatXml.title = t('xml.formatTitle');
    this.btnRevertXml.textContent = t('xml.revert');
    this.btnRevertXml.title = t('xml.revertTitle');
  }

  _buildXmlEditor() {
    const t = this.t;
    const wrap = el('div', { class: 'vb-xml-editor' });
    const bar = el('div', { class: 'vb-xml-toolbar' });
    this.btnApplyXml = el('button', {
      type: 'button',
      class: 'vb-btn vb-btn-primary',
      onclick: () => { this.applyXmlText(); this._updateToolbar(); },
    });
    this.btnFormatXml = el('button', {
      type: 'button',
      class: 'vb-btn',
      onclick: () => this.formatXmlText(),
    });
    this.btnRevertXml = el('button', {
      type: 'button',
      class: 'vb-btn',
      onclick: () => this.reloadXmlText(),
    });
    bar.appendChild(this.btnApplyXml);
    bar.appendChild(this.btnFormatXml);
    bar.appendChild(this.btnRevertXml);
    this.xmlStatus = el('div', { class: 'vb-xml-status' });
    bar.appendChild(this.xmlStatus);

    this.xmlInput = el('textarea', { class: 'vb-xml-editor-input', spellcheck: 'false', wrap: 'off' });
    this.xmlInput.addEventListener('input', () => {
      clearTimeout(this._xmlTimer);
      this._xmlTimer = setTimeout(() => {
        if (this.mode === 'xml') this.applyXmlText();
      }, 400);
    });
    this.xmlInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.keyCode === 83)) {
        e.preventDefault();
        this.applyXmlText();
      }
    });

    wrap.appendChild(bar);
    wrap.appendChild(this.xmlInput);
    return wrap;
  }

  // -- rendering -----------------------------------------------------------

  _render() {
    renderCanvas(this.canvasWrap, this);
    renderPanel(this.panelWrap, this);
    this._updateToolbar();
    this._updateStatus();
  }

  _renderCanvasOnly() {
    renderCanvas(this.canvasWrap, this);
    this._updateToolbar();
    this._updateStatus();
  }

  _updateToolbar() {
    const t = this.t;
    const column = this.getSelectedColumn();
    const index = column ? this.design.columns.indexOf(column) : -1;
    const xmlMode = this.mode === 'xml';
    const ro = this.readonly;
    this.btnAdd.disabled = xmlMode || ro;
    this.btnDelete.disabled = xmlMode || ro || !column;
    this.btnLeft.disabled = xmlMode || ro || index <= 0;
    this.btnRight.disabled = xmlMode || ro || index < 0 || index >= this.design.columns.length - 1;
    this.btnXmlMode.disabled = ro;
    this.btnImport.disabled = ro;
    this.btnXmlMode.title = ro ? t('status.readonly') : (xmlMode ? t('toolbar.designViewTitle') : t('toolbar.xmlEditorTitle'));
    this.btnImport.title = ro ? t('status.readonly') : '';
  }

  _updateStatus() {
    const t = this.t;
    clear(this.status);
    const column = this.getSelectedColumn();
    const index = column ? this.design.columns.indexOf(column) : -1;
    this.status.appendChild(el('span', { text: this.design.name || t('caption.untitled') }));
    this.status.appendChild(el('span', { text: t('common.columnCountMany', { n: this.design.columns.length }) }));
    this.status.appendChild(el('span', { text: t('status.sampleRows', { n: SAMPLE_ROW_COUNT }) }));
    let hint;
    if (this.mode === 'xml') hint = t('status.xmlHint');
    else if (this.readonly) hint = t('status.readonly');
    else if (column) hint = t('status.selected', { n: index + 1 }) + (column.title ? ' (' + column.title + ')' : '');
    else hint = t('status.selectHint');
    this.status.appendChild(el('span', { class: 'vb-status-hint', text: hint }));
  }

  _syncPanelSub() {
    const column = this.getSelectedColumn();
    const sub = this.panelWrap.querySelector('[data-role="column-sub"]');
    if (sub && column) sub.textContent = column.title || this.t('common.noTitle');
  }

  _notify() {
    if (this._destroyed) return;
    const design = this.getDesign();
    if (this.options.onChange) this.options.onChange(design);
    if (typeof CustomEvent === 'function') {
      this.host.dispatchEvent(new CustomEvent('viewbuilder:change', { detail: { design: design }, bubbles: true }));
    }
  }

  // -- events --------------------------------------------------------------

  // Subscribe to component events. Currently emitted:
  //   'propertychange' - a design property changed; detail:
  //     { phase: 'input' | 'commit', property, path, value, previous,
  //       columnId, columnIndex, design }
  // 'input' fires while typing, dragging or picking a color; 'commit' fires
  // on blur/change (or when a dialog/API call sets the value).
  on(type, handler) {
    if (!type || typeof handler !== 'function') return this;
    const handlers = this._listeners[type] || (this._listeners[type] = new Set());
    handlers.add(handler);
    return this;
  }

  off(type, handler) {
    const handlers = this._listeners[type];
    if (!handlers) return this;
    if (handler) handlers.delete(handler);
    else delete this._listeners[type];
    return this;
  }

  _emit(type, detail) {
    if (this._destroyed) return;
    const handlers = this._listeners[type];
    if (handlers) {
      for (const handler of Array.from(handlers)) handler(detail, this);
    }
    if (typeof CustomEvent === 'function') {
      this.host.dispatchEvent(new CustomEvent('viewbuilder:' + type, { detail: detail, bubbles: true }));
    }
  }

  _readPath(target, path) {
    const parts = path.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1 && node != null; i++) node = node[parts[i]];
    return node == null ? undefined : node[parts[parts.length - 1]];
  }

  _emitPropertyChange(target, path, previous, phase) {
    const columnIndex = this.design.columns.indexOf(target);
    const isColumn = columnIndex >= 0;
    this._emit('propertychange', {
      phase: phase === 'input' ? 'input' : 'commit',
      property: path,
      path: isColumn ? 'columns.' + columnIndex + '.' + path : path,
      value: this._readPath(target, path),
      previous: previous,
      columnId: isColumn ? target.id : null,
      columnIndex: isColumn ? columnIndex : -1,
      design: this.getDesign(),
    });
  }

  // -- selection / tabs ----------------------------------------------------

  getSelectedColumn() {
    for (const column of this.design.columns) {
      if (column.id === this.selectedId) return column;
    }
    return null;
  }

  select(id) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this._render();
  }

  isCategoryCollapsed(key) {
    return this._collapsed.has(key);
  }

  toggleCategory(key) {
    if (this._collapsed.has(key)) this._collapsed.delete(key);
    else this._collapsed.add(key);
    this._renderCanvasOnly();
  }

  setTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    renderPanel(this.panelWrap, this);
  }

  setLanguage(code) {
    const language = resolveLanguage(code);
    if (language === this.language) return this;
    this.language = language;
    this.t = createTranslator(language);
    this._applyStaticTexts();
    this._render();
    return this;
  }

  getLanguage() {
    return this.language;
  }

  // Read-only mode: the design can still be selected and inspected (and
  // exported), but no UI interaction can change it.
  setReadonly(value) {
    const next = !!value;
    if (next === this.readonly) return this;
    if (next && this.mode === 'xml') {
      clearTimeout(this._xmlTimer);
      if (!this.applyXmlText()) this.reloadXmlText();
      this.mode = 'design';
      this.main.classList.remove('vb-hidden');
      this.xmlEditor.classList.remove('vb-xml-open');
      this.btnXmlMode.classList.remove('vb-btn-active');
      this._applyStaticTexts();
    }
    this._dragId = null;
    this.readonly = next;
    this._render();
    return this;
  }

  getReadonly() {
    return this.readonly;
  }

  // -- XML editor mode -----------------------------------------------------

  toggleXmlMode() {
    this.setMode(this.mode === 'xml' ? 'design' : 'xml');
  }

  setMode(mode) {
    if (this.readonly) return;
    const next = mode === 'xml' ? 'xml' : 'design';
    if (this.mode === next) return;
    clearTimeout(this._xmlTimer);

    if (next === 'xml') {
      this.mode = 'xml';
      this.reloadXmlText();
      this.main.classList.add('vb-hidden');
      this.xmlEditor.classList.add('vb-xml-open');
      this.btnXmlMode.classList.add('vb-btn-active');
      this._applyStaticTexts();
      this.xmlInput.focus();
    } else {
      if (!this.applyXmlText()) {
        this.xmlInput.focus();
        this._updateStatus();
        return;
      }
      this.mode = 'design';
      this.main.classList.remove('vb-hidden');
      this.xmlEditor.classList.remove('vb-xml-open');
      this.btnXmlMode.classList.remove('vb-btn-active');
      this._applyStaticTexts();
      this._render();
    }
    this._updateToolbar();
    this._updateStatus();
  }

  reloadXmlText() {
    clearTimeout(this._xmlTimer);
    this.xmlInput.value = this.getXml();
    this._xmlAppliedText = this.xmlInput.value;
    this._setXmlStatus('', this.t('xml.editing'));
  }

  applyXmlText() {
    if (this.readonly) return false;
    const text = this.xmlInput.value;
    if (text === this._xmlAppliedText) return true;
    let design;
    try {
      design = deserialize(text);
    } catch (error) {
      this._setXmlStatus('error', error && error.message ? error.message : String(error));
      return false;
    }
    this.design = design;
    this.selectedId = design.columns.length ? design.columns[0].id : null;
    this.tab = 'basics';
    this._collapsed.clear();
    this._xmlAppliedText = text;
    const count = design.columns.length;
    this._setXmlStatus('ok', count === 1 ? this.t('xml.appliedOne') : this.t('xml.appliedMany', { n: count }));
    this._updateToolbar();
    this._updateStatus();
    this._notify();
    return true;
  }

  formatXmlText() {
    try {
      const design = deserialize(this.xmlInput.value);
      this.xmlInput.value = serialize(design);
      this._setXmlStatus('ok', this.t('xml.formatted'));
    } catch (error) {
      this._setXmlStatus('error', error && error.message ? error.message : String(error));
    }
  }

  _setXmlStatus(kind, message) {
    this.xmlStatus.className = 'vb-xml-status' + (kind ? ' vb-xml-status-' + kind : '');
    this.xmlStatus.textContent = message || '';
  }

  // -- column operations ---------------------------------------------------

  addColumn() {
    if (this.readonly) return;
    const column = createColumn({ title: '' });
    const selected = this.getSelectedColumn();
    const index = selected ? this.design.columns.indexOf(selected) + 1 : this.design.columns.length;
    this.design.columns.splice(index, 0, column);
    this.selectedId = column.id;
    this.tab = 'basics';
    this._render();
    this._notify();
  }

  removeSelectedColumn() {
    if (this.readonly) return;
    const column = this.getSelectedColumn();
    if (!column) return;
    const index = this.design.columns.indexOf(column);
    this.design.columns.splice(index, 1);
    const next = this.design.columns[index] || this.design.columns[index - 1] || null;
    this.selectedId = next ? next.id : null;
    this._render();
    this._notify();
  }

  moveSelected(direction) {
    if (this.readonly) return;
    const column = this.getSelectedColumn();
    if (!column) return;
    const index = this.design.columns.indexOf(column);
    const target = index + direction;
    if (target < 0 || target >= this.design.columns.length) return;
    this.design.columns.splice(index, 1);
    this.design.columns.splice(target, 0, column);
    this._render();
    this._notify();
  }

  reorderColumns(dragId, targetId, before) {
    if (this.readonly) return;
    if (!dragId || dragId === targetId) return;
    const columns = this.design.columns;
    const from = columns.findIndex((c) => c.id === dragId);
    if (from < 0) return;
    const moved = columns.splice(from, 1)[0];
    let to = columns.findIndex((c) => c.id === targetId);
    if (to < 0) {
      columns.splice(from, 0, moved);
      return;
    }
    if (!before) to += 1;
    columns.splice(to, 0, moved);
    this.selectedId = moved.id;
    this._render();
    this._notify();
  }

  beginResize(event, column, headerCell) {
    if (this.readonly) return;
    if (column.autoWidth || column.widthUnit !== 'px' || !column.resizable) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = column.width;
    let lastWidth = startWidth;
    const colEl = this.canvasWrap.querySelector('col[data-id="' + column.id + '"]');
    const widthInput = this.panelWrap.querySelector('[data-prop="width"]');
    const table = this.canvasWrap.querySelector('.vb-view');
    headerCell.draggable = false;
    this.app.classList.add('vb-resizing');

    const onMove = (moveEvent) => {
      if (this.readonly) return;
      const width = Math.max(24, Math.round(startWidth + moveEvent.clientX - startX));
      column.width = width;
      if (colEl) colEl.style.width = width + 'px';
      headerCell.style.width = width + 'px';
      if (widthInput) widthInput.value = width;
      if (table) {
        const exactWidth = this.design.columns.every((c) => !c.autoWidth && c.widthUnit === 'px');
        if (exactWidth) {
          let total = 30;
          for (const c of this.design.columns) total += c.width;
          table.style.width = total + 'px';
        } else {
          table.style.width = '100%';
        }
      }
      if (width !== lastWidth) {
        this._emitPropertyChange(column, 'width', lastWidth, 'input');
        lastWidth = width;
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      headerCell.draggable = true;
      this.app.classList.remove('vb-resizing');
      if (!this.readonly) {
        this._notify();
        if (lastWidth !== startWidth) this._emitPropertyChange(column, 'width', startWidth, 'commit');
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // -- property updates ----------------------------------------------------

  update(mutator, options) {
    if (this.readonly) return;
    const column = this.getSelectedColumn();
    if (!column) return;
    const opts = options || {};
    const previous = opts.property ? this._readPath(column, opts.property) : undefined;
    mutator(column);
    this._renderCanvasOnly();
    if (opts.panel) renderPanel(this.panelWrap, this);
    else this._syncPanelSub();
    this._notify();
    if (opts.property) this._emitPropertyChange(column, opts.property, previous, opts.phase);
  }

  updateDesign(mutator, options) {
    if (this.readonly) return;
    const opts = options || {};
    const previous = opts.property ? this._readPath(this.design, opts.property) : undefined;
    mutator(this.design);
    this._renderCanvasOnly();
    if (opts.panel) renderPanel(this.panelWrap, this);
    this._notify();
    if (opts.property) this._emitPropertyChange(this.design, opts.property, previous, opts.phase);
  }

  // -- formulas ------------------------------------------------------------

  _openFormula(title, value, hint, onSave) {
    openFormulaDialog(this.root, {
      t: this.t,
      title: title,
      value: value,
      fields: SAMPLE_FIELDS,
      functions: FORMULA_FUNCTIONS,
      hint: hint,
      onSave: onSave,
    });
  }

  editFormula() {
    if (this.readonly) return;
    const column = this.getSelectedColumn();
    if (!column) return;
    const index = this.design.columns.indexOf(column);
    this._openFormula(
      this.t('formula.columnTitle', { n: index + 1 }),
      column.formula,
      this.t('formula.columnHint'),
      (value) => this.update((c) => { c.formula = value; }, { panel: true, property: 'formula', phase: 'commit' })
    );
  }

  editHideWhen() {
    if (this.readonly) return;
    const column = this.getSelectedColumn();
    if (!column) return;
    this._openFormula(
      this.t('formula.hideWhenTitle'),
      column.hideWhen,
      this.t('hint.hideWhen'),
      (value) => this.update((c) => { c.hideWhen = value; }, { panel: true, property: 'hideWhen', phase: 'commit' })
    );
  }

  editSelectionFormula() {
    if (this.readonly) return;
    this._openFormula(
      this.t('formula.selectionTitle'),
      this.design.selectionFormula,
      this.t('formula.selectionHint'),
      (value) => this.updateDesign((d) => { d.selectionFormula = value; }, { property: 'selectionFormula', phase: 'commit' })
    );
  }

  editFormFormula() {
    if (this.readonly) return;
    this._openFormula(
      this.t('formula.formTitle'),
      this.design.formFormula,
      this.t('formula.formHint'),
      (value) => this.updateDesign((d) => { d.formFormula = value; }, { property: 'formFormula', phase: 'commit' })
    );
  }

  // -- xml -----------------------------------------------------------------

  getXml() {
    return serialize(this.design);
  }

  setXml(xml) {
    this.setDesign(deserialize(xml));
  }

  exportXml() {
    openExportDialog(this.root, {
      t: this.t,
      xml: this.getXml(),
      filename: (this.design.name || 'view') + '.xml',
    });
  }

  importXml() {
    if (this.readonly) return;
    openImportDialog(this.root, {
      t: this.t,
      onLoad: (xml) => this.setXml(xml),
    });
  }

  // -- public state --------------------------------------------------------

  getDesign() {
    return cloneDesign(this.design);
  }

  getViewName() {
    return this.design.name;
  }

  getViewAlias() {
    return this.design.alias;
  }

  setViewName(name) {
    return this._setViewIdentity('name', name);
  }

  setViewAlias(alias) {
    return this._setViewIdentity('alias', alias);
  }

  _setViewIdentity(prop, value) {
    if (this.readonly) return this;
    const next = value == null ? '' : String(value);
    if (this.design[prop] === next) return this;
    const previous = this.design[prop];
    this.design[prop] = next;
    this._renderCanvasOnly();
    if (!this.selectedId) renderPanel(this.panelWrap, this);
    this._notify();
    this._emitPropertyChange(this.design, prop, previous, 'commit');
    return this;
  }

  setDesign(design) {
    if (this.readonly) return;
    this.design = cloneDesign(design);
    this.selectedId = this.design.columns.length ? this.design.columns[0].id : null;
    this._collapsed.clear();
    this._render();
    if (this.mode === 'xml') this.reloadXmlText();
    this._notify();
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._xmlTimer);
    clear(this.root);
    delete this.host.dataset.vbMounted;
    if (this.host.__vb === this) delete this.host.__vb;
  }
}
