import { test, expect } from '@playwright/test';
import { openHarness, selectColumn, columnHeader, panelTab, formulaButton } from './helpers.js';

test.describe('Formula editing', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('column formula dialog opens from the Basics tab with the current formula', async ({ page }) => {
    await selectColumn(page, 0);
    await formulaButton(page, 0).click();

    await expect(page.locator('#host .vb-dialog-header span').first()).toHaveText('Column formula - column 1');
    await expect(page.locator('#host .vb-formula-input')).toHaveValue('Subject');
    await expect(page.locator('#host .vb-chip').filter({ hasText: 'Amount' })).toBeVisible();
    await expect(page.locator('#host .vb-chip-fn').filter({ hasText: '@UpperCase()' })).toBeVisible();
  });

  test('formula dialog opens by double-clicking the column header', async ({ page }) => {
    await columnHeader(page, 2).dblclick();
    await expect(page.locator('#host .vb-dialog-header span').first()).toHaveText('Column formula - column 3');
    await expect(page.locator('#host .vb-formula-input')).toHaveValue('Date');
  });

  test('chips insert fields and functions at the cursor', async ({ page }) => {
    await selectColumn(page, 0);
    await formulaButton(page, 0).click();

    const input = page.locator('#host .vb-formula-input');
    await input.fill('');
    await page.locator('#host .vb-chip').filter({ hasText: 'Amount' }).click();
    await expect(input).toHaveValue('Amount');

    await input.press('End');
    await page.locator('#host .vb-chip-fn').filter({ hasText: '@UpperCase()' }).click();
    await expect(input).toHaveValue(/@UpperCase\(\)$/);

    await input.fill('');
    await page.locator('#host .vb-chip-fn').filter({ hasText: '@Trim()' }).click();
    await expect(input).toHaveValue('@Trim()');
  });

  test('saving a formula updates the preview textarea and the canvas', async ({ page }) => {
    await selectColumn(page, 0);
    await formulaButton(page, 0).click();
    await page.locator('#host .vb-formula-input').fill('@UpperCase(Subject)');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'OK' }).click();

    await expect(page.locator('#host .vb-dialog')).toHaveCount(0);
    await expect(page.locator('#host .vb-formula-preview')).toHaveValue('@UpperCase(Subject)');
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0).locator('.vb-cell-text')).toHaveText('QUARTERLY REPORT');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].formula)).toBe('@UpperCase(Subject)');
  });

  test('@Trim and @Text transforms are previewed', async ({ page }) => {
    await selectColumn(page, 1);
    await formulaButton(page, 0).click();
    await page.locator('#host .vb-formula-input').fill('@Text(From)');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'OK' }).click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(1).locator('.vb-cell-text')).toHaveText('Anna Kowalski');
  });

  test('unknown fields fall back to sample placeholders', async ({ page }) => {
    await selectColumn(page, 0);
    await formulaButton(page, 0).click();
    await page.locator('#host .vb-formula-input').fill('NoSuchField');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'OK' }).click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0).locator('.vb-cell-text')).toHaveText('Sample value 1');
  });

  test('Cancel and Escape discard formula changes', async ({ page }) => {
    await selectColumn(page, 0);
    await formulaButton(page, 0).click();
    await page.locator('#host .vb-formula-input').fill('SomethingElse');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'Cancel' }).click();
    await expect(page.locator('#host .vb-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].formula)).toBe('Subject');

    await formulaButton(page, 0).click();
    await page.locator('#host .vb-formula-input').fill('Discarded');
    await page.keyboard.press('Escape');
    await expect(page.locator('#host .vb-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].formula)).toBe('Subject');
  });

  test('view selection formula is editable from the view panel', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await expect(page.locator('#host .vb-panel')).toContainText('View selection formula');
    await expect(page.locator('#host .vb-panel')).not.toContainText('Form formula');

    await formulaButton(page, 0).click();
    await expect(page.locator('#host .vb-dialog-header span').first()).toHaveText('View selection formula');
    await page.locator('#host .vb-formula-input').fill('SELECT Form = "Memo"');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'OK' }).click();
    expect(await page.evaluate(() => window.__builder.getDesign().selectionFormula)).toBe('SELECT Form = "Memo"');
  });

  test('hide-when formula is stored and exported', async ({ page }) => {
    await page.evaluate(() => {
      const design = window.__builder.getDesign();
      design.columns[1].programmaticName = 'seed';
      window.__builder.setDesign(design);
    });
    await selectColumn(page, 1);
    await panelTab(page, 'Advanced').click();
    await page.locator('#host .vb-formula-row .vb-btn').click();
    await page.locator('#host .vb-formula-input').fill('Status = "Closed"');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'OK' }).click();

    const xml = await page.evaluate(() => window.__builder.getXml());
    expect(xml).toContain('<hideWhen>Status = &quot;Closed&quot;</hideWhen>');
  });
});
