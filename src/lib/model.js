// Design model for the view builder.
// The shape intentionally mirrors the properties Domino Designer exposes
// for view columns (Basics / Font / Header / Sort / Totals / Advanced).

let seq = 0;

export function uid(prefix = 'id') {
  seq += 1;
  return prefix + '_' + Date.now().toString(36) + seq.toString(36) + Math.floor(Math.random() * 46656).toString(36);
}

export const COLUMN_TYPES = [
  { value: 'text', labelKey: 'option.type.text' },
  { value: 'number', labelKey: 'option.type.number' },
  { value: 'datetime', labelKey: 'option.type.datetime' },
  { value: 'icon', labelKey: 'option.type.icon' },
];

export const ALIGN_OPTIONS = [
  { value: 'left', labelKey: 'option.align.left' },
  { value: 'center', labelKey: 'option.align.center' },
  { value: 'right', labelKey: 'option.align.right' },
];

export const FONT_FACES = [
  { value: 'default', labelKey: 'option.face.default' },
  { value: 'helvetica', labelKey: 'option.face.helvetica' },
  { value: 'arial', labelKey: 'option.face.arial' },
  { value: 'times', labelKey: 'option.face.times' },
  { value: 'courier', labelKey: 'option.face.courier' },
];

export const FONT_STACKS = {
  default: '"Segoe UI", Tahoma, Verdana, Arial, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};

export const SORT_MODES = [
  { value: 'none', labelKey: 'option.sort.none' },
  { value: 'ascending', labelKey: 'option.sort.ascending' },
  { value: 'descending', labelKey: 'option.sort.descending' },
];

export const SORT_TYPES = [
  { value: 'text', labelKey: 'option.sortType.text' },
  { value: 'number', labelKey: 'option.sortType.number' },
  { value: 'datetime', labelKey: 'option.sortType.datetime' },
];

export const TOTAL_MODES = [
  { value: 'none', labelKey: 'option.total.none' },
  { value: 'total', labelKey: 'option.total.total' },
  { value: 'average', labelKey: 'option.total.average' },
  { value: 'min', labelKey: 'option.total.min' },
  { value: 'max', labelKey: 'option.total.max' },
  { value: 'count', labelKey: 'option.total.count' },
];

export const NUMBER_FORMATS = [
  { value: 'general', labelKey: 'option.numberFormat.general' },
  { value: 'fixed', labelKey: 'option.numberFormat.fixed' },
  { value: 'currency', labelKey: 'option.numberFormat.currency' },
  { value: 'percent', labelKey: 'option.numberFormat.percent' },
];

export const DATE_FORMATS = [
  { value: 'default', labelKey: 'option.dateFormat.default' },
  { value: 'short', labelKey: 'option.dateFormat.short' },
  { value: 'long', labelKey: 'option.dateFormat.long' },
  { value: 'time', labelKey: 'option.dateFormat.time' },
];

export const VIEW_STYLES = [
  { value: 'standard', labelKey: 'option.viewStyle.standard' },
];

export const DEFAULT_FONT = {
  face: 'default',
  size: 9,
  color: '#111111',
  bold: false,
  italic: false,
  underline: false,
};

export const DEFAULT_HEADER = {
  hidden: false,
  align: 'left',
  useColumnFont: false,
  face: DEFAULT_FONT.face,
  size: DEFAULT_FONT.size,
  color: DEFAULT_FONT.color,
  bold: true,
  italic: false,
  underline: false,
};

const FONT_KEYS = ['face', 'size', 'color', 'bold', 'italic', 'underline'];
const HEADER_KEYS = ['hidden', 'align', 'useColumnFont'].concat(FONT_KEYS);

function sameValue(key, value, expected) {
  if (key === 'color') return String(value).toLowerCase() === String(expected).toLowerCase();
  return value === expected;
}

// True when every font property matches the base (DEFAULT_FONT unless given).
export function isDefaultFont(font, base) {
  const reference = base || DEFAULT_FONT;
  return FONT_KEYS.every((key) => sameValue(key, font ? font[key] : undefined, reference[key]));
}

// True when every header property matches DEFAULT_HEADER.
export function isDefaultHeader(header) {
  return HEADER_KEYS.every((key) => sameValue(key, header ? header[key] : undefined, DEFAULT_HEADER[key]));
}

function defaultFont() {
  return Object.assign({}, DEFAULT_FONT);
}

function defaultHeader() {
  return Object.assign({}, DEFAULT_HEADER);
}

export function createColumn(overrides) {
  const column = {
    id: uid('col'),
    title: '',
    formula: '',
    type: 'text',
    align: 'left',
    width: 110,
    resizable: true,
    multiValueSeparator: ', ',
    font: defaultFont(),
    header: defaultHeader(),
    sort: 'none',
    sortType: 'text',
    clickToSort: true,
    totals: 'none',
    hideDetailRows: false,
    numberFormat: 'general',
    dateFormat: 'default',
    hideWhen: '',
    programmaticName: '',
  };
  return Object.assign(column, overrides || {});
}

export function createDesign(overrides) {
  const design = {
    name: 'AllDocuments',
    alias: '',
    style: 'standard',
    alternateRows: true,
    selectionFormula: 'SELECT @All',
    formFormula: '',
    columns: [
      createColumn({ title: 'Subject', formula: 'Subject', width: 210, sort: 'ascending' }),
      createColumn({ title: 'From', formula: 'From', width: 150 }),
      createColumn({ title: 'Date', formula: 'Date', width: 100, type: 'datetime', align: 'center', sort: 'descending', sortType: 'datetime', dateFormat: 'short' }),
      createColumn({ title: 'Amount', formula: 'Amount', width: 100, type: 'number', align: 'right', numberFormat: 'currency', totals: 'total' }),
    ],
  };
  return Object.assign(design, overrides || {});
}

export function cloneDesign(design) {
  return JSON.parse(JSON.stringify(design));
}

// ---------------------------------------------------------------------------
// Sample document data used for the WYSIWYG preview.
// ---------------------------------------------------------------------------

export const SAMPLE_ROW_COUNT = 12;

export const SAMPLE_FIELDS = ['Subject', 'From', 'Date', 'Amount', 'Status'];

export const FORMULA_FUNCTIONS = ['@Text()', '@UpperCase()', '@Trim()', '@If(; ; )', '@Now', '@Today'];

export const SAMPLE_ROWS = [
  { Subject: 'Quarterly report', From: 'Anna Kowalski', Date: '2026-01-12', Amount: 12500.4, Status: 'Open' },
  { Subject: 'Budget review', From: 'Marek Nowak', Date: '2026-01-15', Amount: 4300.75, Status: 'Closed' },
  { Subject: 'Server maintenance', From: 'Piotr Wisniewski', Date: '2026-02-03', Amount: 980, Status: 'Open' },
  { Subject: 'New employee onboarding', From: 'Katarzyna Zielinska', Date: '2026-02-10', Amount: 1500, Status: 'Pending' },
  { Subject: 'Contract renewal', From: 'Tomasz Lewandowski', Date: '2026-02-18', Amount: 22000, Status: 'Open' },
  { Subject: 'Marketing campaign', From: 'Agnieszka Szymanska', Date: '2026-03-01', Amount: 8700.25, Status: 'Closed' },
  { Subject: 'Security audit', From: 'Pawel Wozniak', Date: '2026-03-09', Amount: 6400, Status: 'Pending' },
  { Subject: 'Software license', From: 'Ewa Dabrowska', Date: '2026-03-21', Amount: 3200, Status: 'Closed' },
  { Subject: 'Office supplies', From: 'Michal Kozlowski', Date: '2026-04-02', Amount: 450.9, Status: 'Open' },
  { Subject: 'Travel expenses', From: 'Joanna Jankowska', Date: '2026-04-14', Amount: 1875.6, Status: 'Pending' },
  { Subject: 'Customer meeting', From: 'Krzysztof Mazur', Date: '2026-05-06', Amount: 0, Status: 'Open' },
  { Subject: 'Annual report', From: 'Barbara Krawczyk', Date: '2026-05-19', Amount: 15300, Status: 'Closed' },
];

// Pull a field name (and a simple string transform) out of formulas like
// "Subject", "@UpperCase(Amount)" or "@Text(Amount)".
export function parseFormula(formula) {
  const text = String(formula || '').trim();
  if (!text) return null;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) return { field: text, transform: 'none' };
  const call = text.match(/^@(\w+)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/i);
  if (call) {
    const fn = call[1].toLowerCase();
    const transform = fn === 'uppercase' ? 'upper' : fn === 'lowercase' ? 'lower' : fn === 'trim' ? 'trim' : 'none';
    return { field: call[2], transform: transform };
  }
  const loose = text.match(/@\w+\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/);
  return loose ? { field: loose[1], transform: 'none' } : null;
}

export function resolveField(formula) {
  const parsed = parseFormula(formula);
  return parsed ? parsed.field : null;
}

function applyTransform(value, transform) {
  if (typeof value !== 'string') return value;
  if (transform === 'upper') return value.toUpperCase();
  if (transform === 'lower') return value.toLowerCase();
  if (transform === 'trim') return value.trim();
  return value;
}

function parseDate(value) {
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return new Date(value);
}

const pad = (n) => (n < 10 ? '0' + n : String(n));

export function formatNumber(value, format) {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  switch (format) {
    case 'fixed': return n.toFixed(2);
    case 'currency': return '$' + n.toFixed(2);
    case 'percent': return (n / 100).toFixed(1) + '%';
    default: return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

export function formatDate(value, format) {
  const d = parseDate(value);
  if (isNaN(d.getTime())) return String(value);
  switch (format) {
    case 'short': return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + String(d.getFullYear()).slice(2);
    case 'long': return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    case 'time': return d.toLocaleString();
    default: return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
}

function iconClass(text) {
  const key = String(text || '').toLowerCase();
  if (key.indexOf('open') === 0) return 'open';
  if (key.indexOf('closed') === 0) return 'closed';
  if (key.indexOf('pending') === 0) return 'pending';
  return 'default';
}

function placeholder(column, index) {
  switch (column.type) {
    case 'number': return formatNumber(1000 + index * 137.5, column.numberFormat);
    case 'datetime': return formatDate(new Date(2026, 0, 1 + index * 3), column.dateFormat);
    case 'icon': return { text: 'Sample', icon: 'default' };
    default: return { text: 'Sample value ' + (index + 1), icon: null };
  }
}

// Returns { text, icon } for one column/row pair.
export function formatCell(column, row, index) {
  const parsed = parseFormula(column.formula);
  const hasValue = parsed && row && Object.prototype.hasOwnProperty.call(row, parsed.field);
  if (!hasValue) return placeholder(column, index);
  const value = applyTransform(row[parsed.field], parsed.transform);
  if (column.type === 'number') return { text: formatNumber(value, column.numberFormat), icon: null };
  if (column.type === 'datetime') return { text: formatDate(value, column.dateFormat), icon: null };
  const text = String(value);
  if (column.type === 'icon') return { text: text, icon: iconClass(text) };
  return { text: text, icon: null };
}

export function computeTotal(column) {
  if (column.totals === 'none') return '';
  const field = resolveField(column.formula);
  const values = [];
  for (const row of SAMPLE_ROWS) {
    if (!field || !Object.prototype.hasOwnProperty.call(row, field)) continue;
    const n = Number(row[field]);
    if (!isNaN(n)) values.push(n);
  }
  if (column.totals === 'count') return String(values.length);
  if (!values.length) return '';
  let result = 0;
  switch (column.totals) {
    case 'total': result = values.reduce((a, b) => a + b, 0); break;
    case 'average': result = values.reduce((a, b) => a + b, 0) / values.length; break;
    case 'min': result = Math.min.apply(null, values); break;
    case 'max': result = Math.max.apply(null, values); break;
  }
  return formatNumber(result, column.type === 'number' ? column.numberFormat : 'general');
}
