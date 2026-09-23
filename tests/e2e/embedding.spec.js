import { test, expect } from '@playwright/test';
import { openHarness, HARNESS_URL, XPAGES_URL, columnTitles, selectColumn, seedColumn, fieldInput, toolbarButton, dialog } from './helpers.js';

test.describe('XPages embedding', () => {
  test('renders inside a form despite hostile global page styles', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(XPAGES_URL);
    await expect(page.locator('#vb .vb-view')).toBeVisible();

    const button = await page.locator('#vb .vb-btn').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, bgImage: s.backgroundImage, letterSpacing: s.letterSpacing };
    });
    expect(button.bg).not.toBe('rgb(255, 165, 0)');
    expect(button.bgImage).toBe('none');
    expect(button.letterSpacing).toBe('normal');

    const cell = await page.locator('#vb tbody .vb-td').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, lineHeight: s.lineHeight, borderWidth: s.borderTopWidth, borderColor: s.borderTopColor };
    });
    expect(cell.family).toContain('Roboto');
    expect(cell.family).not.toContain('Comic Sans');
    expect(cell.lineHeight).toBe('16.8px');
    expect(cell.borderWidth).not.toBe('3px');
    expect(cell.borderColor).not.toBe('rgb(255, 0, 0)');

    const input = await page.locator('#vb .vb-panel input').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(input).not.toBe('rgb(255, 192, 203)');
    expect(pageErrors).toEqual([]);
  });

  test('never submits the surrounding XPages form', async ({ page }) => {
    await page.goto(XPAGES_URL);
    await expect(page.locator('#vb .vb-view')).toBeVisible();

    await selectColumn(page, 0, '#vb');
    await fieldInput(page, 'Title', '#vb').fill('Hello');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__submitted)).toBe(0);

    const active = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(active).not.toBe('INPUT');

    await toolbarButton(page, '+ Add Column', '#vb').click();
    await toolbarButton(page, 'Delete', '#vb').click();
    await toolbarButton(page, 'Export XML', '#vb').click();
    await expect(dialog(page, '#vb')).toBeVisible();
    await page.locator('#vb .vb-dialog-close').click();
    expect(await page.evaluate(() => window.__submitted)).toBe(0);
  });

  test('auto-mounts data-view-builder elements in a host page', async ({ page }) => {
    await page.goto(XPAGES_URL);
    await expect(page.locator('#vb .vb-view')).toBeVisible();
    expect(await columnTitles(page, '#vb')).toEqual(['Subject', 'From', 'Date', 'Amount']);
    expect(await page.evaluate(() => !!document.getElementById('vb').shadowRoot)).toBe(true);
    expect(await page.evaluate(() => !!document.getElementById('vb').__vb)).toBe(true);
  });

  test('auto-mounts declarative elements and reads data-xml', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await expect(page.locator('#autoHost .vb-empty')).toBeVisible();
    await expect(page.locator('#autoXmlHost .vb-view')).toBeVisible();
    expect(await columnTitles(page, '#autoXmlHost')).toEqual(['DocSubject']);
    await expect(page.locator('#autoXmlHost .vb-caption-name')).toHaveText('AutoXmlView');
    await expect(page.locator('#autoXmlHost .vb-caption-alias')).toHaveText('(vAuto)');
    await expect(page.locator('#autoXmlHost .vb-view')).not.toHaveClass(/vb-alt-rows/);
  });

  test('auto-mounts nodes added later by an XPages partial refresh', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.evaluate(() => {
      const node = document.createElement('div');
      node.id = 'dynamic';
      node.setAttribute('data-view-builder', '');
      document.body.appendChild(node);
    });
    await expect
      .poll(() => page.evaluate(() => !!(document.getElementById('dynamic').shadowRoot && document.getElementById('dynamic').shadowRoot.querySelector('.vb-app'))))
      .toBe(true);
  });

  test('fires onChange and viewbuilder:change with the serialized design', async ({ page }) => {
    await openHarness(page);
    await toolbarButton(page, '+ Add Column').click();

    const result = await page.evaluate(() => ({
      count: window.__changes.length,
      columns: window.__changes[window.__changes.length - 1].columns.length,
      events: window.__events.length,
    }));
    expect(result.count).toBeGreaterThan(0);
    expect(result.columns).toBe(5);
    expect(result.events).toBeGreaterThan(0);
  });

  test('supports multiple independent instances', async ({ page }) => {
    await openHarness(page);
    await page.evaluate(() => window.mountBuilder2({ design: window.ViewBuilder.createSampleDesign() }));
    await expect(page.locator('#host2 .vb-view')).toBeVisible();

    await selectColumn(page, 0);
    await fieldInput(page, 'Title').fill('OnlyFirst');
    expect(await columnTitles(page)).toEqual(['OnlyFirst', 'From', 'Date', 'Amount']);
    expect(await columnTitles(page, '#host2')).toEqual(['Subject', 'From', 'Date', 'Amount']);
  });

  test('destroy removes the UI and allows remounting the same host', async ({ page }) => {
    await openHarness(page);
    await page.evaluate(() => window.__builder.destroy());
    await expect(page.locator('#host .vb-app')).toHaveCount(0);
    expect(await page.evaluate(() => document.getElementById('host').hasAttribute('data-vb-mounted'))).toBe(false);

    await page.evaluate(() => window.mountBuilder({}));
    await expect(page.locator('#host .vb-view')).toBeVisible();
    expect(await columnTitles(page)).toEqual(['Subject', 'From', 'Date', 'Amount']);
  });

  test('works without shadow DOM when useShadow is false', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.evaluate(() => window.mountBuilder({ useShadow: false }));
    await expect(page.locator('#host .vb-view')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('host').shadowRoot)).toBeNull();

    await toolbarButton(page, '+ Add Column').click();
    expect(await columnTitles(page)).toHaveLength(5);
    await selectColumn(page, 0);
    await fieldInput(page, 'Title').fill('LightDomTitle');
    expect(await columnTitles(page)).toEqual(['LightDomTitle', 'Column 2', 'From', 'Date', 'Amount']);
  });

  test('throws a clear error when the mount target is missing', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const message = await page.evaluate(() => {
      try {
        window.ViewBuilder.mount('#does-not-exist');
        return 'NO_ERROR';
      } catch (e) {
        return e.message;
      }
    });
    expect(message).toContain('mount target not found');
  });

  test('exposes the documented public API', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const api = await page.evaluate(() => ({
      keys: Object.keys(window.ViewBuilder).sort(),
      version: window.ViewBuilder.version,
    }));
    expect(api.keys).toEqual(
      expect.arrayContaining(['create', 'createColumn', 'createDesign', 'default', 'deserialize', 'mount', 'serialize', 'version', 'ViewBuilder'])
    );
    expect(api.version).toBe('1.0.0');
  });

  test('produces no console errors during a full editing session', async ({ page }) => {
    const messages = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') messages.push(msg.text());
    });
    page.on('pageerror', (e) => messages.push(String(e)));

    await openHarness(page);
    await toolbarButton(page, '+ Add Column').click();
    await selectColumn(page, 1);
    await fieldInput(page, 'Title').fill('Edited');
    await seedColumn(page, 1, { header: { useColumnFont: true } });
    await selectColumn(page, 1);
    await page.locator('#host .vb-tab').filter({ hasText: 'Font' }).click();
    await fieldInput(page, 'Size (pt)').fill('11');
    await toolbarButton(page, 'Export XML').click();
    await page.locator('#host .vb-dialog-close').click();
    await toolbarButton(page, 'Delete').click();

    expect(messages).toEqual([]);
  });
});
