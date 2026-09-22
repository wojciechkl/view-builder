import { el, clear } from './dom.js';
import { createDesign, createColumn, cloneDesign, SAMPLE_FIELDS, FORMULA_FUNCTIONS, SAMPLE_ROW_COUNT } from './model.js';
import { renderCanvas } from './canvas.js';
import { renderPanel } from './panel.js';
import { openFormulaDialog, openExportDialog, openImportDialog } from './dialog.js';
import { serialize, deserialize } from './xml.js';
import css from './styles.css?inline';

export class ViewBuilder {
  constructor(target, options) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('ViewBuilder: mount target not found');
    if (!host.dataset.vbMounted) host.dataset.vbMounted = '1';

    this.host = host;
    host.__vb = this;
    this.options = options || {};
    this.design = this.options.design ? cloneDesign(this.options.design) : createDesign();
    this.selectedId = this.design.columns.length ? this.design.columns[0].id : null;
    this.tab = 'basics';
    this._dragId = null;
    this._destroyed = false;

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
    this.app = el('div', { class: 'vb-app' });

    const toolbar = el('div', { class: 'vb-toolbar' });
    const columnGroup = el('div', { class: 'vb-toolbar-group' });
    this.btnAdd = el('button', { type: 'button', class: 'vb-btn vb-btn-primary', text: '+ Add Column', onclick: () => this.addColumn() });
    this.btnDelete = el('button', { type: 'button', class: 'vb-btn', text: 'Delete', title: 'Delete selected column', onclick: () => this.removeSelectedColumn() });
    this.btnLeft = el('button', { type: 'button', class: 'vb-btn', text: '\u2190', title: 'Move column left', onclick: () => this.moveSelected(-1) });
    this.btnRight = el('button', { type: 'button', class: 'vb-btn', text: '\u2192', title: 'Move column right', onclick: () => this.moveSelected(1) });
    columnGroup.appendChild(this.btnAdd);
    columnGroup.appendChild(this.btnDelete);
    columnGroup.appendChild(this.btnLeft);
    columnGroup.appendChild(this.btnRight);

    const xmlGroup = el('div', { class: 'vb-toolbar-group vb-toolbar-right' });
    xmlGroup.appendChild(el('button', { type: 'button', class: 'vb-btn', text: 'Export XML', onclick: () => this.exportXml() }));
    xmlGroup.appendChild(el('button', { type: 'button', class: 'vb-btn', text: 'Import XML', onclick: () => this.importXml() }));

    toolbar.appendChild(columnGroup);
    toolbar.appendChild(xmlGroup);

    const main = el('div', { class: 'vb-main' });
    this.canvasWrap = el('div', { class: 'vb-canvas-wrap' });
    this.panelWrap = el('div', { class: 'vb-panel' });
    main.appendChild(this.canvasWrap);
    main.appendChild(this.panelWrap);

    this.status = el('div', { class: 'vb-status' });

    this.app.appendChild(toolbar);
    this.app.appendChild(main);
    this.app.appendChild(this.status);
    this.root.appendChild(this.app);
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
    const column = this.getSelectedColumn();
    const index = column ? this.design.columns.indexOf(column) : -1;
    this.btnDelete.disabled = !column;
    this.btnLeft.disabled = index <= 0;
    this.btnRight.disabled = index < 0 || index >= this.design.columns.length - 1;
  }

  _updateStatus() {
    clear(this.status);
    const column = this.getSelectedColumn();
    const index = column ? this.design.columns.indexOf(column) : -1;
    this.status.appendChild(el('span', { text: this.design.name || 'UntitledView' }));
    this.status.appendChild(el('span', { text: this.design.columns.length + ' columns' }));
    this.status.appendChild(el('span', { text: SAMPLE_ROW_COUNT + ' sample rows' }));
    this.status.appendChild(el('span', {
      class: 'vb-status-hint',
      text: column
        ? 'Selected: column ' + (index + 1) + (column.title ? ' (' + column.title + ')' : '')
        : 'Select a column header to edit its properties',
    }));
  }

  _syncPanelSub() {
    const column = this.getSelectedColumn();
    const sub = this.panelWrap.querySelector('[data-role="column-sub"]');
    if (sub && column) sub.textContent = column.title || '(no title)';
  }

  _notify() {
    if (this._destroyed) return;
    const design = this.getDesign();
    if (this.options.onChange) this.options.onChange(design);
    if (typeof CustomEvent === 'function') {
      this.host.dispatchEvent(new CustomEvent('viewbuilder:change', { detail: { design: design }, bubbles: true }));
    }
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

  setTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    renderPanel(this.panelWrap, this);
  }

  // -- column operations ---------------------------------------------------

  addColumn() {
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
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = column.width;
    const colEl = this.canvasWrap.querySelector('col[data-id="' + column.id + '"]');
    const widthInput = this.panelWrap.querySelector('[data-prop="width"]');
    const table = this.canvasWrap.querySelector('.vb-view');
    headerCell.draggable = false;
    this.app.classList.add('vb-resizing');

    const onMove = (moveEvent) => {
      const width = Math.max(24, Math.round(startWidth + moveEvent.clientX - startX));
      column.width = width;
      if (colEl) colEl.style.width = width + 'px';
      headerCell.style.width = width + 'px';
      if (widthInput) widthInput.value = width;
      if (table) {
        let total = 30;
        for (const c of this.design.columns) total += c.width;
        table.style.width = total + 'px';
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      headerCell.draggable = true;
      this.app.classList.remove('vb-resizing');
      this._notify();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // -- property updates ----------------------------------------------------

  update(mutator, options) {
    const column = this.getSelectedColumn();
    if (!column) return;
    mutator(column);
    this._renderCanvasOnly();
    if (options && options.panel) renderPanel(this.panelWrap, this);
    else this._syncPanelSub();
    this._notify();
  }

  updateDesign(mutator, options) {
    mutator(this.design);
    this._renderCanvasOnly();
    if (options && options.panel) renderPanel(this.panelWrap, this);
    this._notify();
  }

  // -- formulas ------------------------------------------------------------

  _openFormula(title, value, hint, onSave) {
    openFormulaDialog(this.root, {
      title: title,
      value: value,
      fields: SAMPLE_FIELDS,
      functions: FORMULA_FUNCTIONS,
      hint: hint,
      onSave: onSave,
    });
  }

  editFormula() {
    const column = this.getSelectedColumn();
    if (!column) return;
    const index = this.design.columns.indexOf(column);
    this._openFormula(
      'Column formula - column ' + (index + 1),
      column.formula,
      'Formula that computes the column value, e.g. Subject or @Text(Amount).',
      (value) => this.update((c) => { c.formula = value; }, { panel: true })
    );
  }

  editHideWhen() {
    const column = this.getSelectedColumn();
    if (!column) return;
    this._openFormula(
      'Hide-when formula',
      column.hideWhen,
      'The column is hidden when this formula evaluates to True.',
      (value) => this.update((c) => { c.hideWhen = value; }, { panel: true })
    );
  }

  editSelectionFormula() {
    this._openFormula(
      'View selection formula',
      this.design.selectionFormula,
      'View selection formula, e.g. SELECT @All or SELECT Form = "Memo".',
      (value) => this.updateDesign((d) => { d.selectionFormula = value; })
    );
  }

  editFormFormula() {
    this._openFormula(
      'Form formula',
      this.design.formFormula,
      'Formula returning the form used to open documents from this view.',
      (value) => this.updateDesign((d) => { d.formFormula = value; })
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
      xml: this.getXml(),
      filename: (this.design.name || 'view') + '.xml',
    });
  }

  importXml() {
    openImportDialog(this.root, {
      onLoad: (xml) => this.setXml(xml),
    });
  }

  // -- public state --------------------------------------------------------

  getDesign() {
    return cloneDesign(this.design);
  }

  setDesign(design) {
    this.design = cloneDesign(design);
    this.selectedId = this.design.columns.length ? this.design.columns[0].id : null;
    this._render();
    this._notify();
  }

  destroy() {
    this._destroyed = true;
    clear(this.root);
    delete this.host.dataset.vbMounted;
    if (this.host.__vb === this) delete this.host.__vb;
  }
}
