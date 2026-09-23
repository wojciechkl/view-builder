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
    draggable: ctx.readonly ? 'false' : 'true',
    dataset: { id: column.id },
    title: name + (column.title ? ': ' + column.title : '') + (ctx.readonly ? '' : '\n' + t('canvas.headerHint')),
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

  if (!ctx.readonly && column.resizable && !column.autoWidth && column.widthUnit === 'px') {
    const handle = el('div', { class: 'vb-resize', title: t('canvas.resizeTitle') });
    handle.addEventListener('mousedown', (e) => ctx.beginResize(e, column, th));
    th.appendChild(handle);
  }

  th.addEventListener('click', () => ctx.select(column.id));
  th.addEventListener('dblclick', () => {
    if (!ctx.readonly) ctx.editFormula();
  });
  th.addEventListener('dragstart', (e) => {
    if (ctx.readonly) {
      e.preventDefault();
      return;
    }
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

function renderRow(design, rowIndex, ctx, blankIndexes) {
  const row = SAMPLE_ROWS[rowIndex % SAMPLE_ROWS.length];
  const tr = el('tr', { class: rowIndex % 2 ? 'vb-row-odd' : 'vb-row-even' });
  for (let index = 0; index < design.columns.length; index += 1) {
    const column = design.columns[index];
    const selected = column.id === ctx.selectedId;
    const td = el('td', { class: 'vb-td vb-align-' + column.align + (selected ? ' vb-col-selected' : '') });
    applyFont(td, column.font);
    if (!blankIndexes || blankIndexes.indexOf(index) < 0) {
      const cell = formatCell(column, row, rowIndex);
      if (cell.icon) td.appendChild(el('span', { class: 'vb-note-icon vb-note-icon-' + cell.icon }));
      td.appendChild(el('span', { class: 'vb-cell-text', text: cell.text }));
    }
    td.addEventListener('click', () => ctx.select(column.id));
    tr.appendChild(td);
  }
  if (!ctx.readonly) tr.appendChild(el('td', { class: 'vb-td vb-td-add' }));
  return tr;
}

function compareCategoryValues(a, b, column) {
  if (column.sortType === 'number') {
    const na = parseFloat(String(a).replace(/[^0-9.eE+-]/g, ''));
    const nb = parseFloat(String(b).replace(/[^0-9.eE+-]/g, ''));
    if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
  }
  return String(a).localeCompare(String(b));
}

function buildCategoryTree(entries, design, indexes, level, prefix) {
  const column = design.columns[indexes[level]];
  const groups = [];
  const byValue = new Map();
  for (const entry of entries) {
    const value = formatCell(column, entry.row, entry.index).text;
    let group = byValue.get(value);
    if (!group) {
      group = { value: value, key: prefix + '\u0001' + value, rows: [] };
      byValue.set(value, group);
      groups.push(group);
    }
    group.rows.push(entry);
  }
  groups.sort((a, b) => compareCategoryValues(a.value, b.value, column));
  for (const group of groups) {
    group.children = level + 1 < indexes.length
      ? buildCategoryTree(group.rows, design, indexes, level + 1, group.key)
      : null;
  }
  return groups;
}

function renderCategoryRow(design, group, level, index, ctx) {
  const t = ctx.t;
  const column = design.columns[index];
  const selected = column.id === ctx.selectedId;
  const collapsed = ctx.isCategoryCollapsed(group.key);
  const tr = el('tr', { class: 'vb-category-row' });
  for (let c = 0; c < index; c += 1) tr.appendChild(el('td', { class: 'vb-td' }));
  const td = el('td', { class: 'vb-td vb-align-' + column.align + ' vb-category-cell' + (selected ? ' vb-col-selected' : '') });
  td.style.setProperty('--vb-cat-level', String(level));
  applyFont(td, column.font);
  const twistie = el('span', {
    class: 'vb-twistie',
    text: collapsed ? '\u25B6' : '\u25BC',
    title: collapsed ? t('canvas.expand') : t('canvas.collapse'),
  });
  twistie.addEventListener('click', (e) => {
    e.stopPropagation();
    ctx.toggleCategory(group.key);
  });
  td.appendChild(twistie);
  td.appendChild(el('span', { class: 'vb-category-value', text: group.value }));
  td.addEventListener('click', () => ctx.select(column.id));
  tr.appendChild(td);
  for (let c = index + 1; c < design.columns.length; c += 1) tr.appendChild(el('td', { class: 'vb-td' }));
  if (!ctx.readonly) tr.appendChild(el('td', { class: 'vb-td vb-td-add' }));
  return tr;
}

function renderCategoryGroups(tbody, design, groups, level, indexes, ctx) {
  for (const group of groups) {
    tbody.appendChild(renderCategoryRow(design, group, level, indexes[level], ctx));
    if (ctx.isCategoryCollapsed(group.key)) continue;
    if (group.children) renderCategoryGroups(tbody, design, group.children, level + 1, indexes, ctx);
    else for (const entry of group.rows) tbody.appendChild(renderRow(design, entry.index, ctx, indexes));
  }
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
  if (!ctx.readonly) tr.appendChild(el('td', { class: 'vb-td vb-td-add' }));
  return tr;
}

export function renderCanvas(host, ctx) {
  clear(host);
  const design = ctx.design;
  const t = ctx.t;
  const showAdd = !ctx.readonly;
  host.appendChild(renderCaption(design, t));

  const scroll = el('div', { class: 'vb-canvas' });
  scroll.addEventListener('mousedown', (e) => {
    if (e.target === scroll) ctx.select(null);
  });
  host.appendChild(scroll);

  if (!design.columns.length) {
    const empty = el('div', { class: 'vb-empty' }, [
      el('div', { class: 'vb-empty-title', text: t('canvas.emptyTitle') }),
      el('div', { class: 'vb-empty-text', text: t('canvas.emptyText') }),
    ]);
    if (showAdd) {
      empty.appendChild(el('button', { type: 'button', class: 'vb-btn vb-btn-primary', text: t('toolbar.addColumn'), onclick: () => ctx.addColumn() }));
    }
    scroll.appendChild(empty);
    return;
  }

  const table = el('table', { class: 'vb-view' + (design.alternateRows ? ' vb-alt-rows' : '') });
  const exactWidth = design.columns.every((c) => !c.autoWidth && c.widthUnit === 'px');
  let totalWidth = showAdd ? ADD_COL_WIDTH : 0;
  const colgroup = el('colgroup');
  for (const column of design.columns) {
    const col = el('col', { dataset: { id: column.id } });
    if (!column.autoWidth) col.style.width = column.width + column.widthUnit;
    colgroup.appendChild(col);
    totalWidth += column.width;
  }
  if (showAdd) colgroup.appendChild(el('col', { style: { width: ADD_COL_WIDTH + 'px' } }));
  table.appendChild(colgroup);
  table.style.width = exactWidth ? totalWidth + 'px' : '100%';

  const headRow = el('tr');
  design.columns.forEach((column, index) => headRow.appendChild(renderHeaderCell(column, index, ctx)));
  if (showAdd) {
    headRow.appendChild(el('th', {
      class: 'vb-th vb-th-add',
      text: '+',
      title: t('canvas.addColumnTitle'),
      onclick: () => ctx.addColumn(),
    }));
  }
  const thead = el('thead');
  thead.appendChild(headRow);
  table.appendChild(thead);

  const hideDetails = design.columns.some((c) => c.totals !== 'none' && c.hideDetailRows);
  const categoryIndexes = [];
  design.columns.forEach((column, index) => {
    if (column.categorized) categoryIndexes.push(index);
  });
  const tbody = el('tbody');
  if (!hideDetails) {
    if (categoryIndexes.length) {
      const entries = [];
      for (let r = 0; r < SAMPLE_ROW_COUNT; r += 1) entries.push({ row: SAMPLE_ROWS[r % SAMPLE_ROWS.length], index: r });
      const groups = buildCategoryTree(entries, design, categoryIndexes, 0, '');
      renderCategoryGroups(tbody, design, groups, 0, categoryIndexes, ctx);
    } else {
      for (let r = 0; r < SAMPLE_ROW_COUNT; r += 1) tbody.appendChild(renderRow(design, r, ctx));
    }
  }
  table.appendChild(tbody);

  if (design.columns.some((c) => c.totals !== 'none')) {
    const tfoot = el('tfoot');
    tfoot.appendChild(renderTotalsRow(design, ctx));
    table.appendChild(tfoot);
  }

  scroll.appendChild(table);
}
