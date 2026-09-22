import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { openHarness, toolbarButton } from './helpers.js';

const PL_PATH = fileURLToPath(new URL('../../dist/lang/pl.js', import.meta.url));
const LANG_FIRST_URL = new URL('../fixtures/lang-first.html', import.meta.url).href;

const addButton = (page, selector = '#host') => page.locator(selector + ' .vb-toolbar .vb-btn-primary');
const statusHint = (page, selector = '#host') => page.locator(selector + ' .vb-status-hint');

test.describe('language awareness', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('defaults to English', async ({ page }) => {
    await expect(addButton(page)).toHaveText('+ Add Column');
    await expect(statusHint(page)).toContainText('Selected: column 1');
    await expect(page.locator('#host .vb-caption')).toContainText('4 columns');
  });

  test('a language file loaded after the bundle is selected per instance', async ({ page }) => {
    await page.addScriptTag({ path: PL_PATH });
    await page.evaluate(() => window.mountBuilder2({ language: 'pl' }));

    await expect(page.locator('#host2 .vb-view')).toBeVisible();
    await expect(addButton(page, '#host2')).toHaveText('+ Dodaj kolumnę');
    await expect(page.locator('#host2 .vb-tab').first()).toHaveText('Podstawowe');
    await expect(statusHint(page, '#host2')).toContainText('Wybrano: kolumna 1');
    await expect(page.locator('#host2 .vb-btn').filter({ hasText: 'Usuń' })).toBeVisible();

    await expect(addButton(page)).toHaveText('+ Add Column');
    await expect(page.locator('#host .vb-tab').first()).toHaveText('Basics');
  });

  test('a language file loaded before the bundle is queued and applied', async ({ page }) => {
    await page.goto(LANG_FIRST_URL);

    await expect(addButton(page)).toHaveText('+ Dodaj kolumnę');
    await expect(statusHint(page)).toContainText('Wybrano: kolumna 1');
    await expect(addButton(page, '#autoHost')).toHaveText('+ Dodaj kolumnę');
    expect(await page.evaluate(() => window.ViewBuilder.languages())).toContain('pl');
  });

  test('unknown language falls back to English', async ({ page }) => {
    await page.evaluate(() => window.mountBuilder2({ language: 'xx' }));
    await expect(addButton(page, '#host2')).toHaveText('+ Add Column');
  });

  test('a partial custom pack falls back key by key to English', async ({ page }) => {
    await page.evaluate(() => {
      window.ViewBuilder.addLanguage('test', { 'toolbar.addColumn': '+ Add!' });
      window.mountBuilder2({ language: 'test' });
    });

    await expect(addButton(page, '#host2')).toHaveText('+ Add!');
    await expect(page.locator('#host2 .vb-tab').first()).toHaveText('Basics');
    await expect(page.locator('#host2 .vb-btn').filter({ hasText: 'Delete' })).toBeVisible();
  });

  test('ViewBuilder.setLanguage changes the default for new instances', async ({ page }) => {
    await page.addScriptTag({ path: PL_PATH });
    await page.evaluate(() => {
      window.ViewBuilder.setLanguage('pl');
      window.mountBuilder2();
    });

    await expect(addButton(page, '#host2')).toHaveText('+ Dodaj kolumnę');
    expect(await page.evaluate(() => window.ViewBuilder.getLanguage())).toBe('pl');
    await expect(addButton(page)).toHaveText('+ Add Column');
  });

  test('an instance can switch language at runtime', async ({ page }) => {
    await page.addScriptTag({ path: PL_PATH });

    await page.evaluate(() => window.__builder.setLanguage('pl'));
    await expect(addButton(page)).toHaveText('+ Dodaj kolumnę');
    await expect(statusHint(page)).toContainText('Wybrano: kolumna 1');
    await expect(page.locator('#host .vb-caption')).toContainText('Liczba kolumn: 4');

    await page.evaluate(() => window.__builder.setLanguage('en'));
    await expect(addButton(page)).toHaveText('+ Add Column');
    await expect(page.locator('#host .vb-caption')).toContainText('4 columns');
  });

  test('the Polish UI still works end to end', async ({ page }) => {
    await page.addScriptTag({ path: PL_PATH });
    await page.evaluate(() => window.__builder.setLanguage('pl'));

    await addButton(page).click();
    await expect(page.locator('#host .vb-th')).toHaveCount(6);
    await expect(statusHint(page)).toContainText('Wybrano: kolumna 2');

    await page.locator('#host .vb-th').first().dblclick();
    await expect(page.locator('.vb-dialog-header')).toContainText('Formuła kolumny - kolumna 1');
    await page.locator('.vb-dialog .vb-btn').filter({ hasText: 'Anuluj' }).click();
    await expect(page.locator('.vb-dialog')).toHaveCount(0);

    await expect(toolbarButton(page, 'Edytor XML')).toBeVisible();
    await expect(page.locator('#host .vb-toolbar .vb-btn').filter({ hasText: 'Eksportuj XML' })).toBeVisible();
  });
});
