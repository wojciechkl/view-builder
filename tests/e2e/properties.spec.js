import { test, expect } from '@playwright/test';
import { openHarness, selectColumn, seedColumn, columnHeader, panelTab, field, fieldInput, checkOption, segmentedOption, setColor } from './helpers.js';

test.describe('Column properties panel', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('Basics: title edits the header, width edits the grid', async ({ page }) => {
    await selectColumn(page, 0);
    await expect(fieldInput(page, 'Title')).toHaveValue('Subject');

    await fieldInput(page, 'Title').fill('Document subject');
    await expect(columnHeader(page, 0)).toHaveAttribute('title', /Column 1: Document subject/);
    await expect(page.locator('#host .vb-th').nth(0).locator('.vb-th-title')).toHaveText('Document subject');

    await fieldInput(page, 'Title').fill('');
    await expect(page.locator('#host .vb-th').nth(0).locator('.vb-th-title')).toHaveClass(/vb-th-placeholder/);

    await fieldInput(page, 'Width').fill('300');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].width)).toBe(300);
    const colWidth = await page.evaluate(() => {
      const scope = document.querySelector('#host').shadowRoot;
      return scope.querySelectorAll('col')[0].style.width;
    });
    expect(colWidth).toBe('300px');
  });

  test('Basics: width supports units and an automatic mode', async ({ page }) => {
    await selectColumn(page, 0);
    const widthField = field(page, 'Width');
    const unitField = field(page, 'Unit');
    await expect(widthField.locator('input')).toBeEnabled();
    await expect(unitField.locator('select')).toHaveValue('px');

    await unitField.locator('select').selectOption('%');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].widthUnit)).toBe('%');
    let colWidth = await page.evaluate(() => document.querySelector('#host').shadowRoot.querySelectorAll('col')[0].style.width);
    expect(colWidth).toBe('210%');
    expect(await page.evaluate(() => document.querySelector('#host').shadowRoot.querySelector('.vb-view').style.width)).toBe('100%');

    await checkOption(page, 'Automatic width (fit to content)').check();
    await expect(widthField.locator('input')).toBeDisabled();
    await expect(unitField.locator('select')).toBeDisabled();
    await expect(columnHeader(page, 0).locator('.vb-resize')).toHaveCount(0);
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].autoWidth)).toBe(true);
    colWidth = await page.evaluate(() => document.querySelector('#host').shadowRoot.querySelectorAll('col')[0].style.width);
    expect(colWidth).toBe('');

    const xml = await page.evaluate(() => window.__builder.getXml());
    expect(xml).toContain('autoWidth="true"');
    expect(xml).toContain('widthUnit="%"');
    expect(xml).not.toContain('width="210"');

    const roundTrip = await page.evaluate(() => {
      const back = window.ViewBuilder.deserialize(window.__builder.getXml());
      return { unit: back.columns[0].widthUnit, auto: back.columns[0].autoWidth };
    });
    expect(roundTrip.unit).toBe('%');
    expect(roundTrip.auto).toBe(true);

    await checkOption(page, 'Automatic width (fit to content)').uncheck();
    await expect(widthField.locator('input')).toBeEnabled();
    await expect(unitField.locator('select')).toBeEnabled();
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].autoWidth)).toBe(false);

    await unitField.locator('select').selectOption('px');
    await expect(columnHeader(page, 0).locator('.vb-resize')).toHaveCount(1);
  });

  test('Basics: multiple values as separate entries is a design property', async ({ page }) => {
    await selectColumn(page, 0);
    const option = checkOption(page, 'Show multiple values as separate entries');
    await expect(option).not.toBeChecked();
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].multipleValuesAsSeparateEntries)).toBe(false);
    expect(await page.evaluate(() => window.__builder.getXml())).not.toContain('multipleValuesAsSeparateEntries');

    await option.check();
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].multipleValuesAsSeparateEntries)).toBe(true);
    expect(await page.evaluate(() => window.__builder.getXml())).toContain('multipleValuesAsSeparateEntries="true"');
    expect(await page.evaluate(() => window.ViewBuilder.deserialize(window.__builder.getXml()).columns[0].multipleValuesAsSeparateEntries)).toBe(true);

    await option.uncheck();
    expect(await page.evaluate(() => window.__builder.getXml())).not.toContain('multipleValuesAsSeparateEntries');
  });

  test('Basics: alignment segmented control aligns the cells', async ({ page }) => {
    await selectColumn(page, 0);
    await segmentedOption(page, 'Alignment', 'Center').click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveClass(/vb-align-center/);

    await segmentedOption(page, 'Alignment', 'Right').click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveClass(/vb-align-right/);
  });

  test('Basics: number and date formats only show for the matching column type', async ({ page }) => {
    await selectColumn(page, 0);
    await expect(field(page, 'Number format')).toHaveCount(0);
    await expect(field(page, 'Date format')).toHaveCount(0);

    await fieldInput(page, 'Show as').selectOption('number');
    await expect(field(page, 'Number format')).toBeVisible();

    await fieldInput(page, 'Show as').selectOption('datetime');
    await expect(field(page, 'Date format')).toBeVisible();
    await expect(field(page, 'Number format')).toHaveCount(0);
  });

  test('Basics: number format applies to the preview cells', async ({ page }) => {
    await selectColumn(page, 3);
    await expect(fieldInput(page, 'Number format')).toHaveValue('currency');
    await fieldInput(page, 'Number format').selectOption('percent');
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(3).locator('.vb-cell-text')).toHaveText('125.0%');
  });

  test('Basics: resizable option is stored in the design', async ({ page }) => {
    await selectColumn(page, 0);
    await checkOption(page, 'Resizable').uncheck();
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].resizable)).toBe(false);
  });

  test('Header, Font and Advanced tabs only appear once their properties are set', async ({ page }) => {
    await selectColumn(page, 0);
    await expect(panelTab(page, 'Header')).toHaveCount(0);
    await expect(panelTab(page, 'Font')).toHaveCount(0);
    await expect(panelTab(page, 'Advanced')).toHaveCount(0);
    await expect(panelTab(page, 'Basics')).toBeVisible();
    await expect(panelTab(page, 'Sort')).toBeVisible();
    await expect(panelTab(page, 'Totals')).toBeVisible();

    await seedColumn(page, 0, { header: { align: 'center' } });
    await selectColumn(page, 0);
    await expect(panelTab(page, 'Header')).toBeVisible();

    await panelTab(page, 'Header').click();
    await checkOption(page, 'Use column font').check();
    await expect(panelTab(page, 'Font')).toBeVisible();

    await seedColumn(page, 0, { programmaticName: 'seed' });
    await selectColumn(page, 0);
    await expect(panelTab(page, 'Advanced')).toBeVisible();

    await panelTab(page, 'Advanced').click();
    await fieldInput(page, 'Programmatic name').fill('');
    await expect(panelTab(page, 'Advanced')).toHaveCount(0);
    await expect(page.locator('#host .vb-tab-active')).toHaveText('Basics');
  });

  test('Font tab: face, size, color and style affect the cells', async ({ page }) => {
    await seedColumn(page, 0, { header: { useColumnFont: true } });
    await selectColumn(page, 0);
    await panelTab(page, 'Font').click();

    await fieldInput(page, 'Face').selectOption('courier');
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveCSS('font-family', /Courier New/);

    await fieldInput(page, 'Size (pt)').fill('14');
    const size = await page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThan(18);

    await setColor(field(page, 'Color').locator('input[type=color]'), '#cc0000');
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveCSS('color', 'rgb(204, 0, 0)');

    await field(page, 'Style').locator('.vb-radio').filter({ hasText: /^I$/ }).click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveCSS('font-style', 'italic');

    await field(page, 'Style').locator('.vb-radio').filter({ hasText: /^B$/ }).click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveCSS('font-weight', '700');

    await field(page, 'Style').locator('.vb-radio').filter({ hasText: /^U$/ }).click();
    await expect(page.locator('#host tbody tr').nth(0).locator('.vb-td').nth(0)).toHaveCSS('text-decoration-line', 'underline');

    await expect(page.locator('#host .vb-panel .vb-preview-line')).toHaveText('Sample text 123');
  });

  test('Header tab: font, alignment and visibility of the header', async ({ page }) => {
    await seedColumn(page, 0, { header: { italic: true } });
    await selectColumn(page, 0);
    await panelTab(page, 'Header').click();

    await expect(checkOption(page, 'Use column font')).not.toBeChecked();
    await fieldInput(page, 'Face').selectOption('courier');
    await expect(columnHeader(page, 0)).toHaveCSS('font-family', /Courier New/);

    await setColor(field(page, 'Color').locator('input[type=color]'), '#ff0000');
    await expect(columnHeader(page, 0)).toHaveCSS('color', 'rgb(255, 0, 0)');

    await field(page, 'Style').locator('.vb-radio').filter({ hasText: /^B$/ }).click();
    await expect(columnHeader(page, 0)).toHaveCSS('font-weight', '400');

    await segmentedOption(page, 'Header alignment', 'Center').click();
    await expect(columnHeader(page, 0)).toHaveCSS('text-align', 'center');

    await checkOption(page, 'Use column font').check();
    await expect(field(page, 'Face')).toHaveCount(0);

    await checkOption(page, 'Hide column header').check();
    await expect(columnHeader(page, 0)).toHaveClass(/vb-th-hidden/);
  });

  test('Sort tab: sort mode drives the header arrow', async ({ page }) => {
    await selectColumn(page, 0);
    await panelTab(page, 'Sort').click();

    await expect(fieldInput(page, 'Sort')).toHaveValue('ascending');
    await fieldInput(page, 'Sort').selectOption('descending');
    expect(await page.locator('#host .vb-sort-arrow').nth(0).textContent()).toBe('▼');

    await fieldInput(page, 'Sort').selectOption('none');
    expect(await page.locator('#host .vb-sort-arrow').allTextContents()).toEqual(['▼']);

    await fieldInput(page, 'Sort type').selectOption('number');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].sortType)).toBe('number');

    await checkOption(page, 'Click on column header to sort').uncheck();
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].clickToSort)).toBe(false);
  });

  test('Sort tab: categorized can be set from any sort mode and forces ascending', async ({ page }) => {
    await selectColumn(page, 1);
    await panelTab(page, 'Sort').click();
    await expect(checkOption(page, 'Categorized')).toBeEnabled();
    await checkOption(page, 'Categorized').check();

    expect(await page.evaluate(() => {
      const c = window.__builder.getDesign().columns[1];
      return { categorized: c.categorized, sort: c.sort, clickToSort: c.clickToSort };
    })).toEqual({ categorized: true, sort: 'ascending', clickToSort: false });
    await expect(checkOption(page, 'Click on column header to sort')).toBeDisabled();
    await expect(page.locator('#host .vb-panel')).toContainText('categorized column groups documents');

    const xml = await page.evaluate(() => window.__builder.getXml());
    expect(xml).toContain('categorized="true"');
    expect(await page.evaluate((value) => window.ViewBuilder.deserialize(value).columns[1].categorized, xml)).toBe(true);

    await fieldInput(page, 'Sort').selectOption('none');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[1].categorized)).toBe(false);
    await expect(checkOption(page, 'Categorized')).toBeEnabled();
  });

  test('Totals tab: every total mode computes the right value', async ({ page }) => {
    await selectColumn(page, 3);
    await panelTab(page, 'Totals').click();
    await expect(fieldInput(page, 'Show totals')).toHaveValue('total');
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('$77207.90');

    await fieldInput(page, 'Show totals').selectOption('count');
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('12');

    await fieldInput(page, 'Show totals').selectOption('average');
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('$6433.99');

    await fieldInput(page, 'Show totals').selectOption('min');
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('$0.00');

    await fieldInput(page, 'Show totals').selectOption('max');
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('$22000.00');

    await checkOption(page, 'Hide detail rows').check();
    await expect(page.locator('#host tbody tr')).toHaveCount(0);
    await expect(page.locator('#host tfoot .vb-total-value')).toHaveText('$22000.00');

    await fieldInput(page, 'Show totals').selectOption('none');
    await expect(page.locator('#host tfoot tr.vb-totals')).toHaveCount(0);
    await expect(page.locator('#host tbody tr')).toHaveCount(12);
  });

  test('Advanced tab: programmatic name and hide-when formula', async ({ page }) => {
    await page.evaluate(() => {
      const design = window.__builder.getDesign();
      design.columns[0].programmaticName = 'seed';
      window.__builder.setDesign(design);
    });
    await selectColumn(page, 0);
    await panelTab(page, 'Advanced').click();

    await fieldInput(page, 'Programmatic name').fill('colSubject');
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].programmaticName)).toBe('colSubject');

    await page.locator('#host .vb-formula-row .vb-btn').click();
    await expect(page.locator('#host .vb-dialog-header span').first()).toHaveText('Hide-when formula');
    await page.locator('#host .vb-formula-input').fill('Status = "Closed"');
    await page.locator('#host .vb-dialog-footer .vb-btn').filter({ hasText: 'OK' }).click();

    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].hideWhen)).toBe('Status = "Closed"');
    await expect(page.locator('#host .vb-formula-preview')).toHaveValue('Status = "Closed"');
  });

  test('View panel: identity and display options', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await expect(page.locator('#host .vb-panel')).toContainText('View name');

    expect(await page.evaluate(() => window.__builder.getViewName())).toBe('AllDocuments');
    expect(await page.evaluate(() => window.__builder.getViewAlias())).toBe('');

    await fieldInput(page, 'View name').fill('ByStatus');
    await fieldInput(page, 'Alias').fill('vByStatus');
    await expect(page.locator('#host .vb-caption-name')).toHaveText('ByStatus');
    await expect(page.locator('#host .vb-caption-alias')).toHaveText('(vByStatus)');
    expect(await page.evaluate(() => window.__builder.getViewName())).toBe('ByStatus');
    expect(await page.evaluate(() => window.__builder.getViewAlias())).toBe('vByStatus');
    expect(await page.evaluate(() => window.__builder.getDesign().name)).toBe('ByStatus');
    expect(await page.evaluate(() => window.__changes[window.__changes.length - 1].alias)).toBe('vByStatus');

    await page.evaluate(() => window.__builder.setViewName('ExternalName').setViewAlias('vExternal'));
    await expect(page.locator('#host .vb-caption-name')).toHaveText('ExternalName');
    await expect(page.locator('#host .vb-caption-alias')).toHaveText('(vExternal)');
    await expect(page.locator('#host .vb-status')).toContainText('ExternalName');
    await expect(fieldInput(page, 'View name')).toHaveValue('ExternalName');
    await expect(fieldInput(page, 'Alias')).toHaveValue('vExternal');
    expect(await page.evaluate(() => window.__builder.getViewName())).toBe('ExternalName');
    expect(await page.evaluate(() => window.__builder.getViewAlias())).toBe('vExternal');
    const externalXml = await page.evaluate(() => window.__builder.getXml());
    expect(externalXml).toContain('<name>ExternalName</name>');
    expect(externalXml).toContain('<alias>vExternal</alias>');

    await fieldInput(page, 'View style').selectOption('standard');
    await expect(page.locator('#host .vb-caption-info')).toContainText('4 columns');
    await expect(page.locator('#host .vb-panel')).toContainText('View selection formula');
    await expect(page.locator('#host .vb-panel')).not.toContainText('Form formula');
  });

  test('active tab persists when another column is selected', async ({ page }) => {
    await selectColumn(page, 0);
    await panelTab(page, 'Sort').click();
    await expect(fieldInput(page, 'Sort')).toHaveValue('ascending');
    await selectColumn(page, 1);
    await expect(page.locator('#host .vb-tab-active')).toHaveText('Sort');
    await expect(fieldInput(page, 'Sort')).toHaveValue('none');
  });
});
