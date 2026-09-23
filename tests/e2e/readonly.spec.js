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
  dragColumn,
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
      builder.setDesign(window.ViewBuilder.deserialize('<viewTemplate><name>Injected</name></viewTemplate>'));
      builder.setXml('<viewTemplate><name>Injected</name></viewTemplate>');
      builder.xmlInput.value = '<viewTemplate><name>Injected</name></viewTemplate>';
      builder.applyXmlText();
      builder.toggleXmlMode();
      builder.setViewName('HackedName');
      builder.setViewAlias('vHacked');
      const design = builder.getDesign();
      return {
        columns: design.columns.length,
        name: design.name,
        alias: design.alias,
        viewName: builder.getViewName(),
        viewAlias: builder.getViewAlias(),
        title: design.columns[0].title,
        mode: builder.mode,
        readonly: builder.getReadonly(),
      };
    });
    expect(result.columns).toBe(4);
    expect(result.name).toBe('AllDocuments');
    expect(result.alias).toBe('');
    expect(result.viewName).toBe('AllDocuments');
    expect(result.viewAlias).toBe('');
    expect(result.title).toBe('Subject');
    expect(result.mode).toBe('design');
    expect(result.readonly).toBe(true);

    const before = await columnTitles(page, '#roHost');
    await dragColumn(page, 0, 2, false, '#roHost');
    expect(await columnTitles(page, '#roHost')).toEqual(before);
    await expect(columnHeader(page, 0, '#roHost')).toHaveAttribute('draggable', 'false');

    await columnHeader(page, 0, '#roHost').dblclick();
    await expect(dialog(page, '#roHost')).toHaveCount(0);
    await expect(page.locator('#roHost .vb-xml-editor')).toBeHidden();
  });

  test('read-only mode disables every panel control except tabs and Export XML', async ({ page }) => {
    await page.evaluate(() => window.mountBuilderReadonly());
    await selectColumn(page, 0, '#roHost');

    const enabledPanelControls = () => {
      const root = document.querySelector('#roHost').shadowRoot;
      const out = [];
      root.querySelectorAll('.vb-panel input, .vb-panel select, .vb-panel textarea, .vb-panel button').forEach((node) => {
        if (!node.disabled && node.dataset.vbAllow !== '1') out.push(node.tagName + ':' + node.className);
      });
      return out;
    };
    expect(await page.evaluate(enabledPanelControls)).toEqual([]);

    await page.locator('#roHost .vb-canvas').click({ position: { x: 700, y: 400 } });
    expect(await page.evaluate(enabledPanelControls)).toEqual([]);
    await expect(page.locator('#roHost .vb-panel .vb-btn').filter({ hasText: 'Export XML' })).toBeEnabled();
    await expect(page.locator('#roHost .vb-panel .vb-btn').filter({ hasText: 'Import XML' })).toBeDisabled();
  });

  test('a read-only instance with no columns cannot create the first column', async ({ page }) => {
    await page.evaluate(() => { window.__host2 = window.mountBuilder2({ readonly: true }); });

    await expect(page.locator('#host2 .vb-empty')).toBeVisible();
    await expect(page.locator('#host2 .vb-empty .vb-btn')).toHaveCount(0);
    await expect(toolbarButton(page, 'Add Column', '#host2')).toBeDisabled();
    await expect(page.locator('#host2 .vb-status-hint')).toContainText('Read-only');

    await page.evaluate(() => window.__host2.setReadonly(false));
    await expect(page.locator('#host2 .vb-empty .vb-btn')).toBeVisible();
    await page.locator('#host2 .vb-empty .vb-btn').click();
    await expect(page.locator('#host2 .vb-th-title')).toHaveCount(1);
  });

  test('switching to read-only during a resize stops further changes', async ({ page }) => {
    const handle = page.locator('#host .vb-resize').first();
    const box = await handle.boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 1, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 39, y);
    const mid = await page.evaluate(() => window.__builder.getDesign().columns[0].width);

    await page.evaluate(() => window.__builder.setReadonly(true));
    await page.mouse.move(box.x + box.width + 139, y);
    await page.mouse.up();

    const after = await page.evaluate(() => window.__builder.getDesign().columns[0].width);
    expect(after).toBe(mid);
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
