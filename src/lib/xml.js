import { createColumn, createDesign, uid } from './model.js';

// Serializes the design to a Domino-DXL-flavoured XML document.
// The output is intentionally readable and can be round-tripped by deserialize().

function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bool(value) {
  return value ? 'true' : 'false';
}

function indent(level) {
  return '  '.repeat(level);
}

function fontXml(font, level) {
  const attrs = [
    'face="' + esc(font.face) + '"',
    'size="' + esc(font.size) + 'pt"',
    'color="' + esc(font.color) + '"',
    'bold="' + bool(font.bold) + '"',
    'italic="' + bool(font.italic) + '"',
    'underline="' + bool(font.underline) + '"',
  ];
  return indent(level) + '<font ' + attrs.join(' ') + '/>';
}

function columnXml(column, level) {
  const pad = indent(level);
  const attrs = [
    'width="' + esc(column.width) + '"',
    'resizable="' + bool(column.resizable) + '"',
    'align="' + esc(column.align) + '"',
    'showas="' + esc(column.type) + '"',
    'sort="' + esc(column.sort) + '"',
    'sorttype="' + esc(column.sortType) + '"',
    'clicktosort="' + bool(column.clickToSort) + '"',
    'totals="' + esc(column.totals) + '"',
    'hidedetailrows="' + bool(column.hideDetailRows) + '"',
    'multivalueseparator="' + esc(column.multiValueSeparator) + '"',
    'numberformat="' + esc(column.numberFormat) + '"',
    'dateformat="' + esc(column.dateFormat) + '"',
    'programmaticname="' + esc(column.programmaticName) + '"',
  ];
  const lines = [pad + '<column ' + attrs.join(' ') + '>'];

  const headerAttrs = [
    'hidden="' + bool(column.header.hidden) + '"',
    'align="' + esc(column.header.align) + '"',
    'usecolumnfont="' + bool(column.header.useColumnFont) + '"',
  ];
  lines.push(indent(level + 1) + '<columnheader ' + headerAttrs.join(' ') + '>');
  lines.push(fontXml(column.header, level + 2));
  lines.push(indent(level + 2) + '<code event="header">' + esc(column.title) + '</code>');
  lines.push(indent(level + 1) + '</columnheader>');

  lines.push(fontXml(column.font, level + 1));
  lines.push(indent(level + 1) + '<code event="value">' + esc(column.formula) + '</code>');
  if (column.hideWhen) {
    lines.push(indent(level + 1) + '<code event="hidewhen">' + esc(column.hideWhen) + '</code>');
  }
  lines.push(pad + '</column>');
  return lines.join('\n');
}

export function serialize(design) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<view name="' + esc(design.name) + '" alias="' + esc(design.alias) + '" style="' + esc(design.style) + '" alternaterows="' + bool(design.alternateRows) + '">');
  lines.push(indent(1) + '<code event="selection">' + esc(design.selectionFormula) + '</code>');
  if (design.formFormula) {
    lines.push(indent(1) + '<code event="form">' + esc(design.formFormula) + '</code>');
  }
  lines.push(indent(1) + '<columns>');
  for (const column of design.columns) lines.push(columnXml(column, 2));
  lines.push(indent(1) + '</columns>');
  lines.push('</view>');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

function attr(node, name, fallback) {
  const value = node.getAttribute(name);
  return value === null ? fallback : value;
}

function boolAttr(node, name, fallback) {
  const value = node.getAttribute(name);
  return value === null ? fallback : value === 'true';
}

function numAttr(node, name, fallback) {
  const value = parseFloat(node.getAttribute(name));
  return isNaN(value) ? fallback : value;
}

function directChildren(node, name) {
  const result = [];
  for (let i = 0; i < node.children.length; i += 1) {
    if (node.children[i].nodeName === name) result.push(node.children[i]);
  }
  return result;
}

function directChild(node, name) {
  return directChildren(node, name)[0] || null;
}

function codeEvent(node, event) {
  const codes = directChildren(node, 'code');
  for (const code of codes) {
    if (code.getAttribute('event') === event) return code;
  }
  return null;
}

function parseFont(node, fallback) {
  const font = Object.assign({}, fallback);
  if (!node) return font;
  font.face = attr(node, 'face', font.face);
  font.size = numAttr(node, 'size', font.size);
  font.color = attr(node, 'color', font.color);
  font.bold = boolAttr(node, 'bold', font.bold);
  font.italic = boolAttr(node, 'italic', font.italic);
  font.underline = boolAttr(node, 'underline', font.underline);
  return font;
}

function parseColumn(node) {
  const column = createColumn({ id: uid('col') });
  column.width = numAttr(node, 'width', column.width);
  column.resizable = boolAttr(node, 'resizable', column.resizable);
  column.align = attr(node, 'align', column.align);
  column.type = attr(node, 'showas', column.type);
  column.sort = attr(node, 'sort', column.sort);
  column.sortType = attr(node, 'sorttype', column.sortType);
  column.clickToSort = boolAttr(node, 'clicktosort', column.clickToSort);
  column.totals = attr(node, 'totals', column.totals);
  column.hideDetailRows = boolAttr(node, 'hidedetailrows', column.hideDetailRows);
  column.multiValueSeparator = attr(node, 'multivalueseparator', column.multiValueSeparator);
  column.numberFormat = attr(node, 'numberformat', column.numberFormat);
  column.dateFormat = attr(node, 'dateformat', column.dateFormat);
  column.programmaticName = attr(node, 'programmaticname', column.programmaticName);

  const header = directChild(node, 'columnheader');
  if (header) {
    const parsed = parseFont(directChild(header, 'font'), column.header);
    column.header = {
      hidden: boolAttr(header, 'hidden', column.header.hidden),
      align: attr(header, 'align', column.header.align),
      useColumnFont: boolAttr(header, 'usecolumnfont', column.header.useColumnFont),
      face: parsed.face,
      size: parsed.size,
      color: parsed.color,
      bold: parsed.bold,
      italic: parsed.italic,
      underline: parsed.underline,
    };
    const title = codeEvent(header, 'header');
    if (title) column.title = title.textContent;
  }

  column.font = parseFont(directChild(node, 'font'), column.font);
  const value = codeEvent(node, 'value');
  if (value) column.formula = value.textContent;
  const hideWhen = codeEvent(node, 'hidewhen');
  if (hideWhen) column.hideWhen = hideWhen.textContent;
  return column;
}

export function deserialize(xml) {
  if (typeof DOMParser === 'undefined') throw new Error('DOMParser is not available in this environment');
  const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) throw new Error('Invalid XML: ' + parserError.textContent.replace(/\s+/g, ' ').trim());
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'view') throw new Error('Root element must be <view>');

  const design = createDesign({ columns: [] });
  design.name = attr(root, 'name', design.name);
  design.alias = attr(root, 'alias', design.alias);
  design.style = attr(root, 'style', design.style);
  design.alternateRows = boolAttr(root, 'alternaterows', design.alternateRows);

  const selection = codeEvent(root, 'selection');
  if (selection) design.selectionFormula = selection.textContent;
  const form = codeEvent(root, 'form');
  if (form) design.formFormula = form.textContent;

  const columnsNode = directChild(root, 'columns') || root;
  const columnNodes = columnsNode.getElementsByTagName('column');
  for (let i = 0; i < columnNodes.length; i += 1) {
    design.columns.push(parseColumn(columnNodes[i]));
  }
  return design;
}
