import { test, expect } from '@playwright/test';
import { openHarness, columnTitles, selectColumn, columnHeader, toolbarButton, fieldInput, dragColumn } from './helpers.js';

test.describe('Column operations', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('adds a column after the selected one and selects it', async ({ page }) => {
    await selectColumn(page, 0);
    await toolbarButton(page, '+ Add Column').click();

    expect(await columnTitles(page)).toEqual(['Subject', 'Column 2', 'From', 'Date', 'Amount']);
    await expect(columnHeader(page, 1)).toHaveClass(/vb-selected/);
    await expect(page.locator('#host .vb-panel')).toContainText('Column 2');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[1].width)).toBe(110);
  });

  test('adds a column from the header + cell at the end', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await page.locator('#host .vb-th-add').click();
    expect(await columnTitles(page)).toEqual(['Subject', 'From', 'Date', 'Amount', 'Column 5']);
    await expect(columnHeader(page, 4)).toHaveClass(/vb-selected/);
  });

  test('deletes the selected column and selects the neighbour', async ({ page }) => {
    await selectColumn(page, 1);
    await toolbarButton(page, 'Delete').click();
    expect(await columnTitles(page)).toEqual(['Subject', 'Date', 'Amount']);
    await expect(columnHeader(page, 1)).toHaveClass(/vb-selected/);
  });

  test('delete is disabled when no column is selected', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await expect(toolbarButton(page, 'Delete')).toBeDisabled();
    await expect(toolbarButton(page, '\u2190')).toBeDisabled();
    await expect(toolbarButton(page, '\u2192')).toBeDisabled();
    await expect(page.locator('#host .vb-panel')).toContainText('View name');
  });

  test('moves the selected column left and right with bounds disabled', async ({ page }) => {
    await selectColumn(page, 0);
    await expect(toolbarButton(page, '\u2190')).toBeDisabled();
    await toolbarButton(page, '\u2192').click();
    expect(await columnTitles(page)).toEqual(['From', 'Subject', 'Date', 'Amount']);
    await expect(toolbarButton(page, '\u2192')).not.toBeDisabled();

    await selectColumn(page, 3);
    await expect(toolbarButton(page, '\u2192')).toBeDisabled();
    await toolbarButton(page, '\u2190').click();
    expect(await columnTitles(page)).toEqual(['From', 'Subject', 'Amount', 'Date']);
  });

  test('reorders columns by dragging a header (drop after)', async ({ page }) => {
    await dragColumn(page, 0, 2, false);
    expect(await columnTitles(page)).toEqual(['From', 'Date', 'Subject', 'Amount']);
  });

  test('reorders columns by dragging a header (drop before)', async ({ page }) => {
    await dragColumn(page, 0, 2, true);
    expect(await columnTitles(page)).toEqual(['From', 'Subject', 'Date', 'Amount']);
  });

  test('dragging a header before another reorders correctly', async ({ page }) => {
    await dragColumn(page, 3, 0, true);
    expect(await columnTitles(page)).toEqual(['Amount', 'Subject', 'From', 'Date']);
  });

  test('reorders columns with a real mouse drag', async ({ page }) => {
    await columnHeader(page, 0).dragTo(columnHeader(page, 3));
    expect(await columnTitles(page)).toHaveLength(4);
    expect(await columnTitles(page)).toContain('Subject');
    expect((await columnTitles(page))[0]).not.toBe('Subject');
  });

  test('resizes a column by dragging its resize handle and syncs the panel', async ({ page }) => {
    await selectColumn(page, 0);
    await expect(fieldInput(page, 'Width')).toHaveValue('210');

    const handle = columnHeader(page, 0).locator('.vb-resize');
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();

    await expect(fieldInput(page, 'Width')).toHaveValue('270');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].width)).toBe(270);
  });

  test('resize respects the minimum column width', async ({ page }) => {
    await selectColumn(page, 0);
    const handle = columnHeader(page, 0).locator('.vb-resize');
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 400, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].width)).toBe(24);
  });

  test('clicking a body cell selects its column', async ({ page }) => {
    await page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(2).click();
    await expect(columnHeader(page, 2)).toHaveClass(/vb-selected/);
    await expect(page.locator('#host .vb-panel')).toContainText('Column 3');
  });
});
