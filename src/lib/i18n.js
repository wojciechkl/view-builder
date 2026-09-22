import en from './lang/en.js';

export const DEFAULT_LANGUAGE = 'en';

const packs = Object.create(null);
packs[DEFAULT_LANGUAGE] = en;

let defaultLanguage = DEFAULT_LANGUAGE;

function normalizeCode(code) {
  return code === null || code === undefined ? '' : String(code).toLowerCase();
}

export function registerLanguage(code, pack) {
  const key = normalizeCode(code);
  if (!key || !pack || typeof pack !== 'object') return false;
  const base = packs[key] || {};
  const merged = Object.assign({}, base);
  for (const name of Object.keys(pack)) {
    const value = pack[name];
    if (value !== null && value !== undefined) merged[name] = String(value);
  }
  packs[key] = merged;
  return true;
}

export function hasLanguage(code) {
  const key = normalizeCode(code);
  return !!key && Object.prototype.hasOwnProperty.call(packs, key);
}

export function getLanguages() {
  return Object.keys(packs);
}

export function setDefaultLanguage(code) {
  const key = normalizeCode(code);
  if (!hasLanguage(key)) return false;
  defaultLanguage = key;
  return true;
}

export function getDefaultLanguage() {
  return defaultLanguage;
}

export function resolveLanguage(code) {
  const key = normalizeCode(code);
  return hasLanguage(key) ? key : defaultLanguage;
}

export function createTranslator(code) {
  const language = resolveLanguage(code);
  function t(key, vars) {
    const name = key === null || key === undefined ? '' : String(key);
    let text = packs[language] ? packs[language][name] : undefined;
    if (text === undefined) text = packs[DEFAULT_LANGUAGE][name];
    if (text === undefined) return name;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (match, token) => (
        vars[token] === null || vars[token] === undefined ? match : String(vars[token])
      ));
    }
    return text;
  }
  t.language = language;
  return t;
}
