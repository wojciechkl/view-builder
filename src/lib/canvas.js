import { el, clear, applyFont } from './dom.js';
import { SAMPLE_ROWS, SAMPLE_ROW_COUNT, formatCell, computeTotal } from './model.js';

const ADD_COL_WIDTH = 30;

function clearDropClasses(root) {
  if (!root) return;
  const marked = root.querySelectorAll('.vb-drop-before, .vb-drop-after');
  for (let i = 0; i < marked.length; i += 1) {
    marked[i].classList.remove('vb-drop-before', 'vb-drop-after');
  }
}

function renderCaption(design) {
  return el('div', { class: 'vb-caption' }, [
    el('span', { class: 'vb-caption-name', text: design.name || 'UntitledView' }),
    design.alias ? el('span', { class: 'vb-caption-alias', text: '(' + design.alias + ')' }) : null,
    el('span', {
      class: 'vb-caption-info',
      text: design.columns.length + (design.columns.length === 1 ? ' column' : ' columns'),
    }),
  ]);
}

function renderHeaderCell(column, index, ctx) {
  const selected = column.id === ctx.selectedId;
  const th = el('th', {
    class: 'vb-th' + (selected ? ' vb-selected' : ''),
    draggable: 'true',
    dataset: { id: column.id },
    title: 'Column ' + (index + 1) + (column.title ? ': ' + column.title : '') + '\nClick to select, double-click to edit the formula, drag to reorder.',
  });
  th.style.textAlign = column.header.align;

  const headerFont = column.header.useColumnFont ? column.font : column.header;
  applyFont(th, headerFont);

  if (!column.header.hidden) {
    th.appendChild(el('span', {
      class: 'vb-th-title' + (column.title ? '' : ' vb-th-placeholder'),
      text: column.title || 'Column ' + (index + 1),
    }));
    if (column.sort !== 'none') {
      th.appendChild(el('span', {
        class: 'vb-sort-arrow',
        text: column.sort === 'ascending' ? '\u25B2' : '\u25BC',
        title: column.sort === 'ascending' ? 'Sorted ascending' : 'Sorted descending',
      }));
    }
  } else {
    th.classList.add('vb-th-hidden');
  }

  const handle = el('div', { class: 'vb-resize', title: 'Drag to resize' });
  handle.addEventListener('mousedown', (e) => ctx.beginResize(e, column, th));
  th.appendChild(handle);

  th.addEventListener('click', () => ctx.select(column.id));
  th.addEventListener('dblclick', () => ctx.editFormula());
  th.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', column.id);
    e.dataTransfer.effectAllowed = 'move';
    th.classList.add('vb-dragging');
    ctx._dragId = column.id;
  });
  th.addEventListener('dragover', (e) => {
    if (!ctx._dragId || ctx._dragId === column.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = th.getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    clearDropClasses(ctx.canvasWrap);
    th.classList.add(before ? 'vb-drop-before' : 'vb-drop-after');
  });
  th.addEventListener('dragleave', () => {
    th.classList.remove('vb-drop-before', 'vb-drop-after');
  });
  th.addEventListener('drop', (e) => {
    e.preventDefault();
    const before = th.classList.contains('vb-drop-before');
    const dragId = ctx._dragId;
    clearDropClasses(ctx.canvasWrap);
    if (dragId && dragId !== column.id) ctx.reorderColumns(dragId, column.id, before);
  });
  th.addEventListener('dragend', () => {
    th.classList.remove('vb-dragging');
    clearDropClasses(ctx.canvasWrap);
    ctx._dragId = null;
  });

  return th;
}

function renderRow(design, rowIndex, ctx) {
  const row = SAMPLE_ROWS[rowIndex % SAMPLE_ROWS.length];
  const tr = el('tr', { class: rowIndex % 2 ? 'vb-row-odd' : 'vb-row-even' });
  for (const column of design.columns) {
    const cell = formatCell(column, row, rowIndex);
    const selected = column.id === ctx.selectedId;
    const td = el('td', { class: 'vb-td vb-align-' + column.align + (selected ? ' vb-col-selected' : '') });
    applyFont(td, column.font);
    if (cell.icon) td.appendChild(el('span', { class: 'vb-note-icon vb-note-icon-' + cell.icon }));
    td.appendChild(el('span', { class: 'vb-cell-text', text: cell.text }));
    td.addEventListener('click', () => ctx.select(column.id));
    tr.appendChild(td);
  }
  tr.appendChild(el('td', { class: 'vb-td vb-td-add' }));
  return tr;
}

function renderTotalsRow(design, ctx) {
  const tr = el('tr', { class: 'vb-totals' });
  for (const column of design.columns) {
    const selected = column.id === ctx.selectedId;
    const td = el('td', { class: 'vb-td vb-align-' + column.align + (selected ? ' vb-col-selected' : '') });
    applyFont(td, column.font);
    if (column.totals !== 'none') {
      const value = computeTotal(column);
      if (value) td.appendChild(el('span', { class: 'vb-total-value', text: value }));
    }
    tr.appendChild(td);
  }
  tr.appendChild(el('td', { class: 'vb-td vb-td-add' }));
  return tr;
}

export function renderCanvas(host, ctx) {
  clear(host);
  const design = ctx.design;
  host.appendChild(renderCaption(design));

  const scroll = el('div', { class: 'vb-canvas' });
  scroll.addEventListener('mousedown', (e) => {
    if (e.target === scroll) ctx.select(null);
  });
  host.appendChild(scroll);

  if (!design.columns.length) {
    scroll.appendChild(el('div', { class: 'vb-empty' }, [
      el('div', { class: 'vb-empty-title', text: 'This view has no columns' }),
      el('div', { class: 'vb-empty-text', text: 'Add a column to start designing the view.' }),
      el('button', { type: 'button', class: 'vb-btn vb-btn-primary', text: '+ Add Column', onclick: () => ctx.addColumn() }),
    ]));
    return;
  }

  const table = el('table', { class: 'vb-view' + (design.alternateRows ? ' vb-alt-rows' : '') });
  let totalWidth = ADD_COL_WIDTH;
  const colgroup = el('colgroup');
  for (const column of design.columns) {
    colgroup.appendChild(el('col', { dataset: { id: column.id }, style: { width: column.width + 'px' } }));
    totalWidth += column.width;
  }
  colgroup.appendChild(el('col', { style: { width: ADD_COL_WIDTH + 'px' } }));
  table.appendChild(colgroup);
  table.style.width = totalWidth + 'px';

  const headRow = el('tr');
  design.columns.forEach((column, index) => headRow.appendChild(renderHeaderCell(column, index, ctx)));
  headRow.appendChild(el('th', {
    class: 'vb-th vb-th-add',
    text: '+',
    title: 'Add column',
    onclick: () => ctx.addColumn(),
  }));
  const thead = el('thead');
  thead.appendChild(headRow);
  table.appendChild(thead);

  const hideDetails = design.columns.some((c) => c.totals !== 'none' && c.hideDetailRows);
  const tbody = el('tbody');
  if (!hideDetails) {
    for (let r = 0; r < SAMPLE_ROW_COUNT; r += 1) tbody.appendChild(renderRow(design, r, ctx));
  }
  table.appendChild(tbody);

  if (design.columns.some((c) => c.totals !== 'none')) {
    const tfoot = el('tfoot');
    tfoot.appendChild(renderTotalsRow(design, ctx));
    table.appendChild(tfoot);
  }

  scroll.appendChild(table);
}
