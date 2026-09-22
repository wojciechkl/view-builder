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

function renderCaption(design, t) {
  return el('div', { class: 'vb-caption' }, [
    el('span', { class: 'vb-caption-name', text: design.name || t('caption.untitled') }),
    design.alias ? el('span', { class: 'vb-caption-alias', text: '(' + design.alias + ')' }) : null,
    el('span', {
      class: 'vb-caption-info',
      text: design.columns.length === 1 ? t('caption.columnCountOne') : t('caption.columnCountMany', { n: design.columns.length }),
    }),
  ]);
}

function renderHeaderCell(column, index, ctx) {
  const t = ctx.t;
  const selected = column.id === ctx.selectedId;
  const name = t('canvas.columnName', { n: index + 1 });
  const th = el('th', {
    class: 'vb-th' + (selected ? ' vb-selected' : '') + ' vb-align-' + column.header.align,
    draggable: 'true',
    dataset: { id: column.id },
    title: name + (column.title ? ': ' + column.title : '') + '\n' + t('canvas.headerHint'),
  });

  const headerFont = column.header.useColumnFont ? column.font : column.header;
  applyFont(th, headerFont);

  if (!column.header.hidden) {
    th.appendChild(el('span', {
      class: 'vb-th-title' + (column.title ? '' : ' vb-th-placeholder'),
      text: column.title || name,
    }));
    if (column.sort !== 'none') {
      th.appendChild(el('span', {
        class: 'vb-sort-arrow',
        text: column.sort === 'ascending' ? '\u25B2' : '\u25BC',
        title: column.sort === 'ascending' ? t('canvas.sortedAscending') : t('canvas.sortedDescending'),
      }));
    }
  } else {
    th.classList.add('vb-th-hidden');
  }

  const handle = el('div', { class: 'vb-resize', title: t('canvas.resizeTitle') });
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
  const t = ctx.t;
  host.appendChild(renderCaption(design, t));

  const scroll = el('div', { class: 'vb-canvas' });
  scroll.addEventListener('mousedown', (e) => {
    if (e.target === scroll) ctx.select(null);
  });
  host.appendChild(scroll);

  if (!design.columns.length) {
    scroll.appendChild(el('div', { class: 'vb-empty' }, [
      el('div', { class: 'vb-empty-title', text: t('canvas.emptyTitle') }),
      el('div', { class: 'vb-empty-text', text: t('canvas.emptyText') }),
      el('button', { type: 'button', class: 'vb-btn vb-btn-primary', text: t('toolbar.addColumn'), onclick: () => ctx.addColumn() }),
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
    title: t('canvas.addColumnTitle'),
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
