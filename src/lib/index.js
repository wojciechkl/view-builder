/**
 * ViewBuilder - pure-JS Domino Designer style view editor.
 *
 * XPages / Notes embedding (after building, deploy only dist/view-builder.js):
 *
 *   <script src="view-builder.js"></script>
 *   <div id="viewBuilder" style="height:600px"></div>
 *   <script>
 *     var builder = ViewBuilder.mount('#viewBuilder', {
 *       // optional: start from an existing design (a new instance is empty)
 *       design: ViewBuilder.deserialize('<viewTemplate>...</viewTemplate>'),
 *       // optional: preview-only, no edit is possible
 *       // (every mutating API call is ignored while readonly)
 *       readonly: false,
 *       // optional: UI language, defaults to English
 *       language: 'pl',
 *       // optional: react to any change
 *       onChange: function (design) { console.log(builder.getXml()); }
 *     });
 *     builder.getXml();          // serialized design
 *     builder.getViewName();     // current view name
 *     builder.getViewAlias();    // current view alias ('' when not set)
 *     // set identity from the host UI (ignored in readonly mode):
 *     builder.setViewName('AllDocuments');
 *     builder.setViewAlias('vAll');
 *     builder.setReadonly(true); // switch to preview mode at runtime
 *     ViewBuilder.createSampleDesign(); // example 4-column design
 *   </script>
 *
 * Translations live in separate language files (dist/lang/<code>.js). Load the
 * one you need before or after the bundle, then mount with that language:
 *
 *   <script src="lang/pl.js"></script>
 *   <script src="view-builder.js"></script>
 *   <div data-view-builder data-language="pl"></div>
 *
 * The app can also register its own pack and switch languages at runtime:
 *
 *   ViewBuilder.addLanguage('de', { 'toolbar.addColumn': '+ Spalte' });
 *   ViewBuilder.setLanguage('de');          // default for new instances
 *   builder.setLanguage('de');              // live instance
 *
 * Declarative auto-mount is also supported (also works after XPages partial refresh):
 *
 *   <script type="text/xml" id="viewXml"><viewTemplate>...</viewTemplate></script>
 *   <div data-view-builder data-xml="viewXml" data-language="pl" data-readonly="true"></div>
 *
 * The component is dependency free, attaches a Shadow DOM (falling back to the
 * host element when Shadow DOM is unavailable), prefixes every CSS class with
 * "vb-" and uses only type="button" controls so it is safe inside a big XPages
 * form.
 */

import { ViewBuilder } from './builder.js';
import { serialize, deserialize } from './xml.js';
import { createDesign, createColumn, createSampleDesign } from './model.js';
import { registerLanguage, setDefaultLanguage, getDefaultLanguage, getLanguages } from './i18n.js';

export function mount(target, options) {
  return new ViewBuilder(target, options);
}

export function create(target, options) {
  return new ViewBuilder(target, options);
}

export function addLanguage(code, pack) {
  return registerLanguage(code, pack);
}

export function setLanguage(code) {
  return setDefaultLanguage(code);
}

export function getLanguage() {
  return getDefaultLanguage();
}

export function languages() {
  return getLanguages();
}

export { ViewBuilder, serialize, deserialize, createDesign, createSampleDesign, createColumn };

export const version = '1.0.0';

const api = {
  version: version,
  mount: mount,
  create: create,
  serialize: serialize,
  deserialize: deserialize,
  createDesign: createDesign,
  createSampleDesign: createSampleDesign,
  createColumn: createColumn,
  addLanguage: addLanguage,
  setLanguage: setLanguage,
  getLanguage: getLanguage,
  languages: languages,
  ViewBuilder: ViewBuilder,
};

export default api;

// Language files may be loaded before this bundle - drain their queue.
function drainLanguageQueue() {
  if (typeof window === 'undefined') return;
  const queue = window.__viewBuilderLanguages;
  if (!queue || !queue.length) return;
  for (let i = 0; i < queue.length; i += 1) {
    const entry = queue[i];
    if (entry && entry.length === 2) registerLanguage(entry[0], entry[1]);
  }
  window.__viewBuilderLanguages = [];
}

drainLanguageQueue();

// ---------------------------------------------------------------------------
// Auto mounting
// ---------------------------------------------------------------------------

function autoMountOne(node) {
  if (!node || node.dataset.vbMounted) return;
  let design = null;
  let xml = null;

  if (node.dataset.design) {
    try {
      design = JSON.parse(node.dataset.design);
    } catch (error) {
      design = null;
    }
  }
  if (node.dataset.xml) {
    const source = document.getElementById(node.dataset.xml);
    if (source) xml = source.textContent;
  }
  if (xml) {
    try {
      design = deserialize(xml);
    } catch (error) {
      design = null;
    }
  }

  try {
    const options = {};
    if (design) options.design = design;
    if (node.dataset.language) options.language = node.dataset.language;
    if (node.dataset.readonly !== undefined) options.readonly = node.dataset.readonly !== 'false';
    new ViewBuilder(node, options);
  } catch (error) {
    // never break the host page because of auto-mount
  }
}

function autoMount() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const nodes = document.querySelectorAll('[data-view-builder]');
  for (let i = 0; i < nodes.length; i += 1) autoMountOne(nodes[i]);
}

function observePartialRefreshes() {
  if (typeof MutationObserver === 'undefined' || !document.body) return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!node || node.nodeType !== 1) continue;
        if (node.matches && node.matches('[data-view-builder]')) autoMountOne(node);
        if (node.querySelectorAll) {
          const nested = node.querySelectorAll('[data-view-builder]');
          for (let i = 0; i < nested.length; i += 1) autoMountOne(nested[i]);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      autoMount();
      observePartialRefreshes();
    });
  } else {
    autoMount();
    observePartialRefreshes();
  }
}

if (typeof window !== 'undefined') {
  window.ViewBuilder = api;
}
