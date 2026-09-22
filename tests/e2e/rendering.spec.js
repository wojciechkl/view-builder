import { test, expect } from '@playwright/test';
import { openHarness, columnTitles, selectColumn, columnHeader, checkOption } from './helpers.js';

test.describe('WYSIWYG rendering', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('renders the default design as a real-looking view', async ({ page }) => {
    await expect(page.locator('#host .vb-view')).toBeVisible();
    expect(await columnTitles(page)).toEqual(['Subject', 'From', 'Date', 'Amount']);

    await expect(page.locator('#host .vb-caption-name')).toHaveText('AllDocuments');
    await expect(page.locator('#host .vb-caption-info')).toContainText('4 columns');

    const status = page.locator('#host .vb-status');
    await expect(status).toContainText('AllDocuments');
    await expect(status).toContainText('4 columns');
    await expect(status).toContainText('12 sample rows');

    await expect(page.locator('#host tbody .vb-row-even, #host tbody .vb-row-odd')).toHaveCount(12);
  });

  test('renders headers with the Domino-style beveled look and add cell', async ({ page }) => {
    await expect(page.locator('#host .vb-th-title')).toHaveCount(4);
    await expect(page.locator('#host .vb-th-add')).toHaveCount(1);
    await expect(columnHeader(page, 0)).toHaveClass(/vb-selected/);
    await expect(columnHeader(page, 0)).toHaveAttribute('title', /Column 1: Subject/);
  });

  test('shows sort arrows for ascending and descending columns', async ({ page }) => {
    const arrows = page.locator('#host .vb-sort-arrow');
    await expect(arrows).toHaveCount(2);
    expect(await arrows.allTextContents()).toEqual(['▲', '▼']);
  });

  test('formats cells WYSIWYG style: text, dates and currency aligned right', async ({ page }) => {
    const firstSubject = page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0);
    await expect(firstSubject.locator('.vb-cell-text')).toHaveText('Quarterly report');

    const firstDate = page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(2);
    await expect(firstDate.locator('.vb-cell-text')).toHaveText('01/12/26');
    expect(await firstDate.evaluate((el) => getComputedStyle(el).textAlign)).toBe('center');

    const firstAmount = page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(3);
    await expect(firstAmount.locator('.vb-cell-text')).toHaveText('$12500.40');
    expect(await firstAmount.evaluate((el) => getComputedStyle(el).textAlign)).toBe('right');
  });

  test('applies the column font (face, size, bold/italic) to cells', async ({ page }) => {
    const firstSubject = page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0);
    const font = await firstSubject.evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, size: parseFloat(s.fontSize) };
    });
    expect(font.family).toContain('Segoe UI');
    expect(font.size).toBeGreaterThan(11);
  });

  test('alternating row colors can be toggled from the view panel', async ({ page }) => {
    const table = page.locator('#host .vb-view');
    await expect(table).toHaveClass(/vb-alt-rows/);

    const oddBg = await page.locator('#host tbody tr.vb-row-odd td.vb-td').nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);
    const evenBg = await page.locator('#host tbody tr.vb-row-even td.vb-td').nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(oddBg).toBe('rgb(246, 246, 246)');
    expect(oddBg).not.toBe(evenBg);

    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await expect(page.locator('#host .vb-panel')).toContainText('View name');
    await checkOption(page, 'Alternating row colors').uncheck();
    await expect(table).not.toHaveClass(/vb-alt-rows/);
  });

  test('totals row is rendered from column totals and formatted', async ({ page }) => {
    const totals = page.locator('#host tfoot tr.vb-totals');
    await expect(totals).toHaveCount(1);
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('$77207.90');
  });

  test('selected column is highlighted in header and body', async ({ page }) => {
    await selectColumn(page, 1);
    await expect(columnHeader(page, 1)).toHaveClass(/vb-selected/);
    await expect(columnHeader(page, 0)).not.toHaveClass(/vb-selected/);
    const cell = page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(1);
    await expect(cell).toHaveClass(/vb-col-selected/);
  });

  test('hidden header removes the title but keeps the grid column', async ({ page }) => {
    await selectColumn(page, 0);
    await page.locator('#host .vb-tab').filter({ hasText: 'Header' }).click();
    await checkOption(page, 'Hide column header').check();
    await expect(columnHeader(page, 0)).toHaveClass(/vb-th-hidden/);
    await expect(page.locator('#host .vb-th').nth(0).locator('.vb-th-title')).toHaveCount(0);
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toBeVisible();
  });

  test('icon column type renders note icons', async ({ page }) => {
    await selectColumn(page, 1);
    await page.locator('#host .vb-field').filter({ hasText: 'Show as' }).locator('select').selectOption('icon');
    await expect(page.locator('#host tbody .vb-note-icon').first()).toBeVisible();
  });

  test('empty state offers to add the first column', async ({ page }) => {
    await selectColumn(page, 0);
    for (let i = 0; i < 4; i += 1) {
      await page.locator('#host .vb-toolbar .vb-btn').filter({ hasText: 'Delete' }).click();
    }
    await expect(page.locator('#host .vb-empty')).toBeVisible();
    await expect(page.locator('#host .vb-empty-title')).toHaveText('This view has no columns');
    await page.locator('#host .vb-empty .vb-btn').click();
    expect(await columnTitles(page)).toHaveLength(1);
    await expect(page.locator('#host .vb-empty')).toHaveCount(0);
  });

  test('caption and status react to design changes', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await page.locator('#host .vb-field').filter({ hasText: 'View name' }).locator('input').fill('MyCustomView');
    await expect(page.locator('#host .vb-caption-name')).toHaveText('MyCustomView');
    await expect(page.locator('#host .vb-status')).toContainText('MyCustomView');
  });
});
