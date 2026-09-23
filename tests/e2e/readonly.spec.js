import { test, expect } from '@playwright/test';
import {
  openHarness,
  columnTitles,
  columnHeader,
  selectColumn,
  toolbarButton,
  dialog,
  dialogButton,
  fieldInput,
  checkOption,
  panelTab,
} from './helpers.js';

test.describe('empty designs and read-only mode', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('a new instance starts empty and can grow from scratch', async ({ page }) => {
    await page.evaluate(() => window.mountBuilder2({}));

    await expect(page.locator('#host2 .vb-empty')).toBeVisible();
    await expect(page.locator('#host2 .vb-view')).toHaveCount(0);
    await expect(page.locator('#host2 .vb-caption-name')).toHaveText('AllDocuments');
    await expect(page.locator('#host2 .vb-status')).toContainText('0 columns');
    await expect(toolbarButton(page, 'Add Column', '#host2')).toBeEnabled();
    await expect(toolbarButton(page, 'Delete', '#host2')).toBeDisabled();
    await expect(page.locator('#host2 .vb-panel-title')).toHaveText('View properties');
    await expect(fieldInput(page, 'View name', '#host2')).toHaveValue('AllDocuments');

    await page.locator('#host2 .vb-empty .vb-btn').click();
    await expect(page.locator('#host2 .vb-view')).toBeVisible();
    await expect(page.locator('#host2 .vb-th-title')).toHaveCount(1);
    await expect(page.locator('#host2 .vb-caption-info')).toContainText('1 column');
  });

  test('empty or blank XML deserializes to an empty design', async ({ page }) => {
    const result = await page.evaluate(() => {
      const blank = window.ViewBuilder.deserialize('   \n  ');
      window.__builder.setXml('');
      const after = window.__builder.getDesign();
      return {
        blankColumns: blank.columns.length,
        blankName: blank.name,
        afterColumns: after.columns.length,
        xml: window.__builder.getXml(),
      };
    });
    expect(result.blankColumns).toBe(0);
    expect(result.blankName).toBe('AllDocuments');
    expect(result.afterColumns).toBe(0);
    expect(result.xml).toContain('<viewTemplate>');
    expect(result.xml).not.toContain('<column');
    await expect(page.locator('#host .vb-empty')).toBeVisible();
    await expect(page.locator('#host .vb-status')).toContainText('0 columns');
  });

  test('read-only mode hides every edit affordance', async ({ page }) => {
    await page.evaluate(() => window.mountBuilderReadonly());

    await expect(page.locator('#roHost .vb-view')).toBeVisible();
    expect(await columnTitles(page, '#roHost')).toEqual(['Subject', 'From', 'Date', 'Amount']);
    await expect(page.locator('#roHost tbody tr')).toHaveCount(12);

    await expect(page.locator('#roHost .vb-th-add')).toHaveCount(0);
    await expect(page.locator('#roHost .vb-td-add')).toHaveCount(0);
    await expect(page.locator('#roHost .vb-resize')).toHaveCount(0);
    await expect(toolbarButton(page, 'Add Column', '#roHost')).toBeDisabled();
    await expect(toolbarButton(page, 'Delete', '#roHost')).toBeDisabled();
    await expect(toolbarButton(page, 'XML Editor', '#roHost')).toBeDisabled();
    await expect(toolbarButton(page, 'Import XML', '#roHost')).toBeDisabled();
    await expect(toolbarButton(page, 'Export XML', '#roHost')).toBeEnabled();
    await expect(page.locator('#roHost .vb-status-hint')).toContainText('Read-only');

    await selectColumn(page, 0, '#roHost');
    await expect(page.locator('#roHost .vb-th').nth(0)).toHaveClass(/vb-selected/);
    await expect(fieldInput(page, 'Title', '#roHost')).toBeDisabled();
    await expect(fieldInput(page, 'Show as', '#roHost')).toBeDisabled();
    await expect(fieldInput(page, 'Width', '#roHost')).toBeDisabled();
    await expect(checkOption(page, 'Automatic width (fit to content)', '#roHost')).toBeDisabled();
    await expect(checkOption(page, 'Resizable', '#roHost')).toBeDisabled();
    await expect(page.locator('#roHost .vb-formula-preview')).toBeDisabled();
    await expect(page.locator('#roHost .vb-formula-row .vb-btn')).toBeDisabled();
    await expect(panelTab(page, 'Basics', '#roHost')).toBeEnabled();
    await expect(panelTab(page, 'Sort', '#roHost')).toBeEnabled();
  });

  test('read-only mode blocks dialogs, dragging and API edits', async ({ page }) => {
    const result = await page.evaluate(() => {
      const builder = window.mountBuilderReadonly();
      builder.addColumn();
      builder.removeSelectedColumn();
      builder.moveSelected(1);
      builder.updateDesign((d) => { d.name = 'Hacked'; });
      builder.update((c) => { c.title = 'Hacked'; });
      const columns = builder.getDesign().columns;
      builder.reorderColumns(columns[0].id, columns[1].id, true);
      builder.setMode('xml');
      const design = builder.getDesign();
      return {
        columns: design.columns.length,
        name: design.name,
        title: design.columns[0].title,
        mode: builder.mode,
        readonly: builder.getReadonly(),
      };
    });
    expect(result.columns).toBe(4);
    expect(result.name).toBe('AllDocuments');
    expect(result.title).toBe('Subject');
    expect(result.mode).toBe('design');
    expect(result.readonly).toBe(true);

    await columnHeader(page, 0, '#roHost').dblclick();
    await expect(dialog(page, '#roHost')).toHaveCount(0);
    await expect(page.locator('#roHost .vb-xml-editor')).toBeHidden();
  });

  test('Export XML still works in read-only mode', async ({ page }) => {
    await page.evaluate(() => window.mountBuilderReadonly());

    await toolbarButton(page, 'Export XML', '#roHost').click();
    await expect(dialog(page, '#roHost')).toBeVisible();
    await expect(page.locator('#roHost .vb-xml-input')).toHaveValue(/<viewTemplate>/);
    await dialogButton(page, 'Close', '#roHost').click();
    await expect(dialog(page, '#roHost')).toHaveCount(0);
  });

  test('setReadonly switches at runtime in both directions', async ({ page }) => {
    await page.evaluate(() => window.__builder.setReadonly(true));
    await expect(toolbarButton(page, 'Add Column')).toBeDisabled();
    await expect(page.locator('#host .vb-th-add')).toHaveCount(0);
    await expect(page.locator('#host .vb-status-hint')).toContainText('Read-only');

    await page.evaluate(() => window.__builder.setReadonly(false));
    await expect(toolbarButton(page, 'Add Column')).toBeEnabled();
    await expect(page.locator('#host .vb-th-add')).toHaveCount(1);
    await toolbarButton(page, 'Add Column').click();
    await expect(page.locator('#host .vb-th')).toHaveCount(6);
  });

  test('data-readonly auto-mounts in read-only mode', async ({ page }) => {
    await expect(page.locator('#autoReadonlyHost .vb-view')).toBeVisible();
    await expect(page.locator('#autoReadonlyHost .vb-th-add')).toHaveCount(0);
    await expect(page.locator('#autoReadonlyHost .vb-resize')).toHaveCount(0);
    await expect(toolbarButton(page, 'Add Column', '#autoReadonlyHost')).toBeDisabled();
    await expect(page.locator('#autoReadonlyHost .vb-status-hint')).toContainText('Read-only');
    expect(await columnTitles(page, '#autoReadonlyHost')).toEqual(['DocSubject']);
  });
});
