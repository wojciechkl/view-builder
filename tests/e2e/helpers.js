import { expect } from '@playwright/test';

export const HARNESS_URL = new URL('../fixtures/harness.html', import.meta.url).href;
export const XPAGES_URL = new URL('../fixtures/xpages.html', import.meta.url).href;

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function openHarness(page, options = {}) {
  await page.goto(HARNESS_URL);
  await page.evaluate((opts) => window.mountBuilder(opts), options);
  await expect(page.locator('#host .vb-view')).toBeVisible();
}

export function host(page, selector = '#host') {
  return page.locator(selector);
}

export function columnHeader(page, index, selector = '#host') {
  return page.locator(`${selector} .vb-th`).nth(index);
}

export async function columnTitles(page, selector = '#host') {
  return page.locator(`${selector} .vb-th-title`).allTextContents();
}

export async function selectColumn(page, index, selector = '#host') {
  await columnHeader(page, index, selector).click();
}

// Mutates a column through the public API, e.g. to reveal conditionally
// hidden tabs (Header / Font / Advanced) that hold no UI entry point.
export async function seedColumn(page, index, patch) {
  await page.evaluate(({ index, patch }) => {
    const design = window.__builder.getDesign();
    const column = design.columns[index];
    if (patch.header) Object.assign(column.header, patch.header);
    if (patch.font) Object.assign(column.font, patch.font);
    for (const key of Object.keys(patch)) {
      if (key !== 'header' && key !== 'font') column[key] = patch[key];
    }
    window.__builder.setDesign(design);
  }, { index, patch });
}

export function panelTab(page, name, selector = '#host') {
  return page.locator(`${selector} .vb-tab`).filter({ hasText: new RegExp(`^${escRe(name)}$`) });
}

export function field(page, label, selector = '#host') {
  return page
    .locator(`${selector} .vb-field`)
    .filter({ has: page.locator('.vb-label').filter({ hasText: new RegExp(`^${escRe(label)}$`) }) })
    .first();
}

export function fieldInput(page, label, selector = '#host') {
  return field(page, label, selector).locator('input, select, textarea').first();
}

export function checkOption(page, label, selector = '#host') {
  return page
    .locator(`${selector} .vb-check`)
    .filter({ hasText: label })
    .first()
    .locator('input[type=checkbox]');
}

export function segmentedOption(page, fieldLabel, optionText, selector = '#host') {
  return field(page, fieldLabel, selector)
    .locator('.vb-radio')
    .filter({ hasText: new RegExp(`^${escRe(optionText)}$`) });
}

export function dialog(page, selector = '#host') {
  return page.locator(`${selector} .vb-overlay .vb-dialog`);
}

export function dialogButton(page, label, selector = '#host') {
  return dialog(page, selector)
    .locator('.vb-dialog-footer .vb-btn')
    .filter({ hasText: new RegExp(`^${escRe(label)}$`) });
}

export function toolbarButton(page, label, selector = '#host') {
  return page.locator(`${selector} .vb-toolbar .vb-btn`).filter({ hasText: label });
}

export function formulaButton(page, index = 0, selector = '#host') {
  return page.locator(`${selector} .vb-formula-row .vb-btn`).nth(index);
}

export function xmlInput(page, selector = '#host') {
  return page.locator(`${selector} .vb-xml-input`);
}

export async function setColor(locator, value) {
  await locator.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

export async function dragColumn(page, fromIndex, toIndex, before, selector = '#host') {
  await page.evaluate(
    ([sel, from, to, isBefore]) => {
      const root = document.querySelector(sel);
      const scope = root.shadowRoot || root;
      const ths = scope.querySelectorAll('.vb-th');
      const source = ths[from];
      const target = ths[to];
      const dt = new DataTransfer();
      const fire = (node, type, x) =>
        node.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
          })
        );
      const rect = target.getBoundingClientRect();
      const x = isBefore ? rect.left + 2 : rect.right - 2;
      fire(source, 'dragstart', rect.left);
      fire(target, 'dragover', x);
      fire(target, 'drop', x);
      fire(source, 'dragend', x);
    },
    [selector, fromIndex, toIndex, before]
  );
}

export async function shadowQuery(page, selector, innerSelector, selector2 = '#host') {
  return page.evaluate(
    ([sel, inner]) => {
      const root = document.querySelector(sel);
      const scope = root.shadowRoot || root;
      return !!scope.querySelector(inner);
    },
    [selector2, innerSelector]
  );
}
