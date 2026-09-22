import { createColumn, createDesign, uid, DEFAULT_FONT, DEFAULT_HEADER } from './model.js';

// Serializes the design to a Domino-DXL-flavoured XML document.
// Only values that differ from the model defaults are written, so the output
// stays compact and can be round-tripped by deserialize().

const COLUMN_DEFAULTS = createColumn();
const DESIGN_DEFAULTS = createDesign();

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

function sameColor(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

// Attributes of a font that differ from the base font.
function fontAttrs(font, base) {
  const reference = base || DEFAULT_FONT;
  const attrs = [];
  if (font.face !== reference.face) attrs.push('face="' + esc(font.face) + '"');
  if (Number(font.size) !== Number(reference.size)) attrs.push('size="' + esc(font.size) + 'pt"');
  if (!sameColor(font.color, reference.color)) attrs.push('color="' + esc(font.color) + '"');
  if (!!font.bold !== !!reference.bold) attrs.push('bold="' + bool(font.bold) + '"');
  if (!!font.italic !== !!reference.italic) attrs.push('italic="' + bool(font.italic) + '"');
  if (!!font.underline !== !!reference.underline) attrs.push('underline="' + bool(font.underline) + '"');
  return attrs;
}

// The <font/> line, or null when the font matches the base font.
function fontXml(font, level, base) {
  const attrs = fontAttrs(font, base);
  if (!attrs.length) return null;
  return indent(level) + '<font ' + attrs.join(' ') + '/>';
}

function columnXml(column, level) {
  const pad = indent(level);
  const attrs = [];
  if (!column.autoWidth && column.width !== COLUMN_DEFAULTS.width) attrs.push('width="' + esc(column.width) + '"');
  if (column.widthUnit !== COLUMN_DEFAULTS.widthUnit) attrs.push('widthunit="' + esc(column.widthUnit) + '"');
  if (column.autoWidth !== COLUMN_DEFAULTS.autoWidth) attrs.push('autowidth="' + bool(column.autoWidth) + '"');
  if (column.resizable !== COLUMN_DEFAULTS.resizable) attrs.push('resizable="' + bool(column.resizable) + '"');
  if (column.align !== COLUMN_DEFAULTS.align) attrs.push('align="' + esc(column.align) + '"');
  if (column.type !== COLUMN_DEFAULTS.type) attrs.push('showas="' + esc(column.type) + '"');
  if (column.sort !== COLUMN_DEFAULTS.sort) attrs.push('sort="' + esc(column.sort) + '"');
  if (column.sortType !== COLUMN_DEFAULTS.sortType) attrs.push('sorttype="' + esc(column.sortType) + '"');
  if (column.clickToSort !== COLUMN_DEFAULTS.clickToSort) attrs.push('clicktosort="' + bool(column.clickToSort) + '"');
  if (column.categorized !== COLUMN_DEFAULTS.categorized) attrs.push('categorized="' + bool(column.categorized) + '"');
  if (column.totals !== COLUMN_DEFAULTS.totals) attrs.push('totals="' + esc(column.totals) + '"');
  if (column.hideDetailRows !== COLUMN_DEFAULTS.hideDetailRows) attrs.push('hidedetailrows="' + bool(column.hideDetailRows) + '"');
  if (column.multiValueSeparator !== COLUMN_DEFAULTS.multiValueSeparator) attrs.push('multivalueseparator="' + esc(column.multiValueSeparator) + '"');
  if (column.numberFormat !== COLUMN_DEFAULTS.numberFormat) attrs.push('numberformat="' + esc(column.numberFormat) + '"');
  if (column.dateFormat !== COLUMN_DEFAULTS.dateFormat) attrs.push('dateformat="' + esc(column.dateFormat) + '"');
  if (column.programmaticName) attrs.push('programmaticname="' + esc(column.programmaticName) + '"');

  const lines = [pad + '<column' + (attrs.length ? ' ' + attrs.join(' ') : '') + '>'];

  const headerAttrs = [];
  if (column.header.hidden) headerAttrs.push('hidden="' + bool(column.header.hidden) + '"');
  if (column.header.align !== DEFAULT_HEADER.align) headerAttrs.push('align="' + esc(column.header.align) + '"');
  if (column.header.useColumnFont) headerAttrs.push('usecolumnfont="' + bool(column.header.useColumnFont) + '"');
  const headerFont = fontXml(column.header, level + 2, DEFAULT_HEADER);
  if (headerAttrs.length || headerFont || column.title) {
    lines.push(indent(level + 1) + '<columnheader' + (headerAttrs.length ? ' ' + headerAttrs.join(' ') : '') + '>');
    if (headerFont) lines.push(headerFont);
    if (column.title) lines.push(indent(level + 2) + '<code event="header">' + esc(column.title) + '</code>');
    lines.push(indent(level + 1) + '</columnheader>');
  }

  const columnFont = fontXml(column.font, level + 1, DEFAULT_FONT);
  if (columnFont) lines.push(columnFont);
  if (column.formula) lines.push(indent(level + 1) + '<code event="value">' + esc(column.formula) + '</code>');
  if (column.hideWhen) lines.push(indent(level + 1) + '<code event="hidewhen">' + esc(column.hideWhen) + '</code>');
  lines.push(pad + '</column>');
  return lines.join('\n');
}

export function serialize(design) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  const viewAttrs = [];
  if (design.name && design.name !== DESIGN_DEFAULTS.name) viewAttrs.push('name="' + esc(design.name) + '"');
  if (design.alias) viewAttrs.push('alias="' + esc(design.alias) + '"');
  if (design.style && design.style !== DESIGN_DEFAULTS.style) viewAttrs.push('style="' + esc(design.style) + '"');
  if (design.alternateRows !== DESIGN_DEFAULTS.alternateRows) viewAttrs.push('alternaterows="' + bool(design.alternateRows) + '"');
  lines.push('<view' + (viewAttrs.length ? ' ' + viewAttrs.join(' ') : '') + '>');

  if (design.selectionFormula && design.selectionFormula !== DESIGN_DEFAULTS.selectionFormula) {
    lines.push(indent(1) + '<code event="selection">' + esc(design.selectionFormula) + '</code>');
  }
  if (design.formFormula) {
    lines.push(indent(1) + '<code event="form">' + esc(design.formFormula) + '</code>');
  }
  lines.push(indent(1) + '<columns>');
  for (const column of design.columns || []) lines.push(columnXml(column, 2));
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
  column.widthUnit = attr(node, 'widthunit', column.widthUnit);
  column.autoWidth = boolAttr(node, 'autowidth', column.autoWidth);
  column.resizable = boolAttr(node, 'resizable', column.resizable);
  column.align = attr(node, 'align', column.align);
  column.type = attr(node, 'showas', column.type);
  column.sort = attr(node, 'sort', column.sort);
  column.sortType = attr(node, 'sorttype', column.sortType);
  column.clickToSort = boolAttr(node, 'clicktosort', column.clickToSort);
  column.categorized = boolAttr(node, 'categorized', column.categorized);
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

// Turns a <parsererror> element into a short "line X, column Y: message" text.
function parseErrorMessage(parserError) {
  let text = String(parserError.textContent || '').replace(/\s+/g, ' ').trim();
  text = text.replace(/Below is a rendering of the page up to the first error\.?/i, '').trim();
  let match = text.match(/error on line (\d+) at column (\d+):?\s*(.*)$/i);
  if (match) return 'line ' + match[1] + ', column ' + match[2] + ': ' + match[3].trim();
  match = text.match(/Line number (\d+), Column (\d+):?\s*(.*)$/i);
  if (match) return 'line ' + match[1] + ', column ' + match[2] + ': ' + match[3].trim();
  return text || 'unknown parse error';
}

export function deserialize(xml) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Cannot parse XML: DOMParser is not available in this environment');
  }
  const text = String(xml === null || xml === undefined ? '' : xml);
  if (!text.trim()) throw new Error('Invalid XML: the document is empty');

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) throw new Error('Invalid XML: ' + parseErrorMessage(parserError));
  const root = doc.documentElement;
  if (!root) throw new Error('Invalid XML: the document has no root element');
  if (root.nodeName !== 'view') {
    throw new Error('Invalid XML: root element must be <view> but found <' + root.nodeName + '>');
  }

  const design = createDesign({ columns: [] });
  design.name = attr(root, 'name', design.name);
  design.alias = attr(root, 'alias', design.alias);
  design.style = attr(root, 'style', design.style);
  design.alternateRows = boolAttr(root, 'alternaterows', design.alternateRows);

  const selection = codeEvent(root, 'selection');
  if (selection) design.selectionFormula = selection.textContent;
  const form = codeEvent(root, 'form');
  if (form) design.formFormula = form.textContent;

  const columnsNode = directChild(root, 'columns');
  const columnNodes = columnsNode ? directChildren(columnsNode, 'column') : directChildren(root, 'column');
  for (const node of columnNodes) design.columns.push(parseColumn(node));
  return design;
}
