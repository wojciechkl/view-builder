import { createColumn, createDesign, uid, DEFAULT_FONT, DEFAULT_HEADER } from './model.js';

// Serializes the design to the viewTemplate XML format (see docs/view_spec.xml
// and docs/view_full_spec.xml). Only values that differ from the model defaults
// are written, so the output stays compact and can be round-tripped by
// deserialize().

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

function element(tag, value, level) {
  return indent(level) + '<' + tag + '>' + esc(value) + '</' + tag + '>';
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

// A <font/> or <headerFont/> line, or null when the font matches the base font.
function fontLine(tag, font, level, base) {
  const attrs = fontAttrs(font, base);
  if (!attrs.length) return null;
  return indent(level) + '<' + tag + ' ' + attrs.join(' ') + '/>';
}

function columnXml(column, level) {
  const pad = indent(level);
  const attrs = [];
  if (!column.autoWidth && column.width !== COLUMN_DEFAULTS.width) attrs.push('width="' + esc(column.width) + '"');
  if (column.widthUnit !== COLUMN_DEFAULTS.widthUnit) attrs.push('widthUnit="' + esc(column.widthUnit) + '"');
  if (column.autoWidth !== COLUMN_DEFAULTS.autoWidth) attrs.push('autoWidth="' + bool(column.autoWidth) + '"');
  if (column.resizable !== COLUMN_DEFAULTS.resizable) attrs.push('resizable="' + bool(column.resizable) + '"');
  if (column.align !== COLUMN_DEFAULTS.align) attrs.push('align="' + esc(column.align) + '"');
  if (column.type !== COLUMN_DEFAULTS.type) attrs.push('showAs="' + esc(column.type) + '"');
  if (column.sort !== COLUMN_DEFAULTS.sort) attrs.push('sorted="true"');
  if (column.sort === 'descending') attrs.push('sortDescending="true"');
  if (column.sortType !== COLUMN_DEFAULTS.sortType) attrs.push('sortType="' + esc(column.sortType) + '"');
  if (column.clickToSort !== COLUMN_DEFAULTS.clickToSort) attrs.push('clickToSort="' + bool(column.clickToSort) + '"');
  if (column.categorized !== COLUMN_DEFAULTS.categorized) attrs.push('categorized="' + bool(column.categorized) + '"');
  if (column.totals !== COLUMN_DEFAULTS.totals) attrs.push('totals="' + esc(column.totals) + '"');
  if (column.hideDetailRows !== COLUMN_DEFAULTS.hideDetailRows) attrs.push('hideDetailRows="' + bool(column.hideDetailRows) + '"');
  if (column.multiValueSeparator !== COLUMN_DEFAULTS.multiValueSeparator) attrs.push('multiValueSeparator="' + esc(column.multiValueSeparator) + '"');
  if (column.multipleValuesAsSeparateEntries !== COLUMN_DEFAULTS.multipleValuesAsSeparateEntries) {
    attrs.push('multipleValuesAsSeparateEntries="' + bool(column.multipleValuesAsSeparateEntries) + '"');
  }
  if (column.numberFormat !== COLUMN_DEFAULTS.numberFormat) attrs.push('numberFormat="' + esc(column.numberFormat) + '"');
  if (column.dateFormat !== COLUMN_DEFAULTS.dateFormat) attrs.push('dateFormat="' + esc(column.dateFormat) + '"');
  if (column.header.hidden !== DEFAULT_HEADER.hidden) attrs.push('headerHidden="' + bool(column.header.hidden) + '"');
  if (column.header.align !== DEFAULT_HEADER.align) attrs.push('headerAlign="' + esc(column.header.align) + '"');
  if (column.header.useColumnFont !== DEFAULT_HEADER.useColumnFont) attrs.push('useColumnFont="' + bool(column.header.useColumnFont) + '"');

  const lines = [pad + '<column' + (attrs.length ? ' ' + attrs.join(' ') : '') + '>'];
  if (column.title) lines.push(element('title', column.title, level + 1));
  if (column.formula) lines.push(element('formula', column.formula, level + 1));
  if (column.programmaticName) lines.push(element('programmaticName', column.programmaticName, level + 1));
  if (column.hideWhen) lines.push(element('hideWhen', column.hideWhen, level + 1));
  const columnFont = fontLine('font', column.font, level + 1, DEFAULT_FONT);
  if (columnFont) lines.push(columnFont);
  const headerFont = fontLine('headerFont', column.header, level + 1, DEFAULT_HEADER);
  if (headerFont) lines.push(headerFont);
  lines.push(pad + '</column>');
  return lines.join('\n');
}

export function serialize(design) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  const attrs = [];
  if (design.style && design.style !== DESIGN_DEFAULTS.style) attrs.push('style="' + esc(design.style) + '"');
  if (design.alternateRows !== DESIGN_DEFAULTS.alternateRows) attrs.push('alternateRows="' + bool(design.alternateRows) + '"');
  lines.push('<viewTemplate' + (attrs.length ? ' ' + attrs.join(' ') : '') + '>');

  if (design.name && design.name !== DESIGN_DEFAULTS.name) lines.push(element('name', design.name, 1));
  if (design.alias) lines.push(element('alias', design.alias, 1));
  if (design.selectionFormula && design.selectionFormula !== DESIGN_DEFAULTS.selectionFormula) {
    lines.push(element('selectionFormula', design.selectionFormula, 1));
  }
  if (design.formFormula) lines.push(element('formFormula', design.formFormula, 1));
  for (const column of design.columns || []) lines.push(columnXml(column, 1));
  lines.push('</viewTemplate>');
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

// Text of a direct child element, or null when the element is not present.
function childText(node, name) {
  const child = directChild(node, name);
  return child ? String(child.textContent || '').trim() : null;
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
  column.widthUnit = attr(node, 'widthUnit', column.widthUnit);
  column.autoWidth = boolAttr(node, 'autoWidth', column.autoWidth);
  column.resizable = boolAttr(node, 'resizable', column.resizable);
  column.align = attr(node, 'align', column.align);
  column.type = attr(node, 'showAs', column.type);
  const sorted = boolAttr(node, 'sorted', false);
  const sortDescending = boolAttr(node, 'sortDescending', false);
  column.sort = !sorted ? 'none' : (sortDescending ? 'descending' : 'ascending');
  column.sortType = attr(node, 'sortType', column.sortType);
  column.clickToSort = boolAttr(node, 'clickToSort', column.clickToSort);
  column.categorized = boolAttr(node, 'categorized', column.categorized);
  column.totals = attr(node, 'totals', column.totals);
  column.hideDetailRows = boolAttr(node, 'hideDetailRows', column.hideDetailRows);
  column.multiValueSeparator = attr(node, 'multiValueSeparator', column.multiValueSeparator);
  column.multipleValuesAsSeparateEntries = boolAttr(node, 'multipleValuesAsSeparateEntries', column.multipleValuesAsSeparateEntries);
  column.numberFormat = attr(node, 'numberFormat', column.numberFormat);
  column.dateFormat = attr(node, 'dateFormat', column.dateFormat);
  column.header.hidden = boolAttr(node, 'headerHidden', column.header.hidden);
  column.header.align = attr(node, 'headerAlign', column.header.align);
  column.header.useColumnFont = boolAttr(node, 'useColumnFont', column.header.useColumnFont);

  const title = childText(node, 'title');
  if (title !== null) column.title = title;
  const formula = childText(node, 'formula');
  if (formula !== null) column.formula = formula;
  const programmaticName = childText(node, 'programmaticName');
  if (programmaticName !== null) column.programmaticName = programmaticName;
  const hideWhen = childText(node, 'hideWhen');
  if (hideWhen !== null) column.hideWhen = hideWhen;

  const font = directChild(node, 'font');
  if (font) Object.assign(column.font, parseFont(font, column.font));
  const headerFont = directChild(node, 'headerFont');
  if (headerFont) Object.assign(column.header, parseFont(headerFont, column.header));
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
  // An empty document simply means an empty view design.
  if (!text.trim()) return createDesign();

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) throw new Error('Invalid XML: ' + parseErrorMessage(parserError));
  const root = doc.documentElement;
  if (!root) throw new Error('Invalid XML: the document has no root element');
  if (root.nodeName !== 'viewTemplate') {
    throw new Error('Invalid XML: root element must be <viewTemplate> but found <' + root.nodeName + '>');
  }

  const design = createDesign({ columns: [] });
  design.style = attr(root, 'style', design.style);
  design.alternateRows = boolAttr(root, 'alternateRows', design.alternateRows);

  const name = childText(root, 'name');
  if (name !== null) design.name = name;
  const alias = childText(root, 'alias');
  if (alias !== null) design.alias = alias;
  const selection = childText(root, 'selectionFormula');
  if (selection !== null) design.selectionFormula = selection;
  const form = childText(root, 'formFormula');
  if (form !== null) design.formFormula = form;

  for (const node of directChildren(root, 'column')) design.columns.push(parseColumn(node));
  return design;
}
