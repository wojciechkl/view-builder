import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { openHarness, selectColumn, columnTitles, toolbarButton, dialog, dialogButton, xmlInput, fieldInput } from './helpers.js';

async function openExport(page) {
  await toolbarButton(page, 'Export XML').click();
  await expect(dialog(page)).toBeVisible();
}

async function openImport(page) {
  await toolbarButton(page, 'Import XML').click();
  await expect(dialog(page)).toBeVisible();
}

test.describe('XML serialization', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('export dialog shows a complete viewTemplate document', async ({ page }) => {
    await openExport(page);
    const xml = await xmlInput(page).inputValue();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<viewTemplate>');
    expect(xml.match(/<column[ >]/g)).toHaveLength(4);
    expect(xml).toContain('<title>Subject</title>');
    expect(xml).toContain('<formula>Amount</formula>');
    expect(xml).toContain('numberFormat="currency"');
    expect(xml).toContain('totals="total"');
    expect(xml).toContain('dateFormat="short"');
    expect(xml).toContain('sorted="true"');
    expect(xml).toContain('sortDescending="true"');
    await expect(dialog(page).locator('.vb-hint').first()).toContainText('serialized design');
  });

  test('default values are omitted from the serialized XML', async ({ page }) => {
    const xml = await page.evaluate(() => window.__builder.getXml());

    expect(xml).toContain('<viewTemplate>');
    expect(xml).not.toContain('<name>');
    expect(xml).not.toContain('style="standard"');
    expect(xml).not.toContain('alternateRows=');
    expect(xml).not.toContain('<selectionFormula>');
    expect(xml).not.toContain('<font');
    expect(xml).not.toContain('resizable=');
    expect(xml).not.toContain('clickToSort=');
    expect(xml).not.toContain('categorized=');
    expect(xml).not.toContain('hideDetailRows=');
    expect(xml).not.toContain('multiValueSeparator=');
    expect(xml).not.toContain('multipleValuesAsSeparateEntries=');
    expect(xml).not.toContain('numberFormat="general"');
    expect(xml).not.toContain('dateFormat="default"');
    expect(xml).not.toContain('sortType="text"');
    expect(xml).not.toContain('showAs="text"');
    expect(xml).not.toContain('widthUnit=');
    expect(xml).not.toContain('autoWidth=');
    expect(xml).not.toContain('headerHidden=');
    expect(xml).not.toContain('headerAlign=');
    expect(xml).not.toContain('useColumnFont=');
  });

  test('non-default fonts and advanced values are serialized partially', async ({ page }) => {
    const result = await page.evaluate(() => {
      const design = window.ViewBuilder.createSampleDesign();
      design.columns[0].font.bold = true;
      design.columns[0].header.useColumnFont = true;
      design.columns[0].programmaticName = 'colOne';
      design.columns[0].hideWhen = 'Status = "Closed"';
      const xml = window.ViewBuilder.serialize(design);
      const back = window.ViewBuilder.deserialize(xml);
      return {
        xml: xml,
        fontBold: back.columns[0].font.bold,
        fontFace: back.columns[0].font.face,
        useColumnFont: back.columns[0].header.useColumnFont,
        hideWhen: back.columns[0].hideWhen,
        programmaticName: back.columns[0].programmaticName,
      };
    });

    expect(result.xml).toContain('<font bold="true"/>');
    expect(result.xml).toContain('useColumnFont="true"');
    expect(result.xml).toContain('<programmaticName>colOne</programmaticName>');
    expect(result.xml).toContain('<hideWhen>Status = &quot;Closed&quot;</hideWhen>');
    expect(result.fontBold).toBe(true);
    expect(result.fontFace).toBe('default');
    expect(result.useColumnFont).toBe(true);
    expect(result.hideWhen).toBe('Status = "Closed"');
    expect(result.programmaticName).toBe('colOne');
  });

  test('view panel export and import buttons open the same dialogs', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    const panel = page.locator('#host .vb-panel');

    await panel.locator('.vb-btn').filter({ hasText: 'Export XML' }).click();
    await expect(xmlInput(page)).toHaveValue(/<viewTemplate>/);
    await dialogButton(page, 'Close').click();

    await panel.locator('.vb-btn').filter({ hasText: 'Import XML' }).click();
    await expect(xmlInput(page)).toBeVisible();
    await dialogButton(page, 'Cancel').click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('exported XML tracks every panel edit', async ({ page }) => {
    await page.evaluate(() => {
      const design = window.__builder.getDesign();
      design.columns[0].programmaticName = 'seed';
      window.__builder.setDesign(design);
    });
    await selectColumn(page, 0);
    await fieldInput(page, 'Title').fill('Doc & Subject');
    await fieldInput(page, 'Width').fill('321');
    await page.locator('#host .vb-tab').filter({ hasText: 'Sort' }).click();
    await fieldInput(page, 'Sort type').selectOption('number');
    await page.locator('#host .vb-tab').filter({ hasText: 'Advanced' }).click();
    await fieldInput(page, 'Programmatic name').fill('colOne');

    const xml = await page.evaluate(() => window.__builder.getXml());
    expect(xml).toContain('width="321"');
    expect(xml).toContain('sortType="number"');
    expect(xml).toContain('<programmaticName>colOne</programmaticName>');
    expect(xml).toContain('<title>Doc &amp; Subject</title>');
  });

  test('download produces a .xml file with the design', async ({ page }) => {
    await openExport(page);
    const downloadPromise = page.waitForEvent('download');
    await dialogButton(page, 'Download .xml').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('AllDocuments.xml');
    const path = await download.path();
    const content = await fs.readFile(path, 'utf8');
    expect(content).toContain('<viewTemplate>');
    expect(content.match(/<column[ >]/g)).toHaveLength(4);
  });

  test('copy to clipboard reports success or offers manual copy', async ({ page }) => {
    await openExport(page);
    await dialogButton(page, 'Copy to clipboard').click();
    const status = dialog(page).locator('.vb-hint').first();
    await expect(status).toHaveText(/Copied to clipboard\.|Selection ready - press Ctrl\+C to copy\./);
  });

  test('import replaces the whole design and re-renders the canvas', async ({ page }) => {
    const xml = await page.evaluate(() => window.__builder.getXml());
    const modified = xml.replace('<viewTemplate>', '<viewTemplate>\n  <name>ImportedView</name>').replace('>Subject<', '>ImportedSubject<');

    await openImport(page);
    await xmlInput(page).fill(modified);
    await dialogButton(page, 'Load design').click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(page.locator('#host .vb-caption-name')).toHaveText('ImportedView');
    expect(await columnTitles(page)).toEqual(['ImportedSubject', 'From', 'Date', 'Amount']);
    expect(await page.evaluate(() => window.__builder.getDesign().name)).toBe('ImportedView');
  });

  test('invalid XML shows an error and keeps the current design', async ({ page }) => {
    await openImport(page);
    await xmlInput(page).fill('this is definitely not xml');
    await dialogButton(page, 'Load design').click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('.vb-error')).toContainText(/Invalid XML/);
    await dialogButton(page, 'Cancel').click();
    await expect(page.locator('#host .vb-caption-name')).toHaveText('AllDocuments');
  });

  test('non-view XML root is rejected', async ({ page }) => {
    await openImport(page);
    await xmlInput(page).fill('<database><viewTemplate/></database>');
    await dialogButton(page, 'Load design').click();
    await expect(dialog(page).locator('.vb-error')).toContainText(/viewTemplate/);
  });

  test('special characters survive an export/import round trip', async ({ page }) => {
    await selectColumn(page, 0);
    await fieldInput(page, 'Title').fill('A<&>"B');
    const xml = await page.evaluate(() => window.__builder.getXml());
    expect(xml).toContain('A&lt;&amp;&gt;&quot;B');

    await page.evaluate((value) => window.__builder.setXml(value), xml);
    expect(await page.evaluate(() => window.__builder.getDesign().columns[0].title)).toBe('A<&>"B');
    await expect(page.locator('#host .vb-th').nth(0).locator('.vb-th-title')).toHaveText('A<&>"B');
  });

  test('setXml throws a helpful error for malformed input', async ({ page }) => {
    const message = await page.evaluate(() => {
      try {
        window.__builder.setXml('<viewTemplate><column></viewTemplate>');
        return 'NO_ERROR';
      } catch (e) {
        return e.message;
      }
    });
    expect(message).toContain('Invalid XML');
  });

  test('setDesign replaces columns and resets selection', async ({ page }) => {
    const ok = await page.evaluate(() => {
      const design = window.ViewBuilder.createSampleDesign({ name: 'Fresh' });
      window.__builder.setDesign(design);
      return window.__builder.getDesign().name;
    });
    expect(ok).toBe('Fresh');
    await expect(page.locator('#host .vb-caption-name')).toHaveText('Fresh');
    await expect(page.locator('#host .vb-th').nth(0)).toHaveClass(/vb-selected/);
  });

  test('empty design serializes and deserializes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const design = window.ViewBuilder.createDesign({ name: 'Empty', columns: [] });
      const xml = window.ViewBuilder.serialize(design);
      const back = window.ViewBuilder.deserialize(xml);
      return { xml: xml, name: back.name, columns: back.columns.length };
    });
    expect(result.name).toBe('Empty');
    expect(result.columns).toBe(0);
    expect(result.xml).toContain('<viewTemplate>');
    expect(result.xml).toContain('<name>Empty</name>');
  });

  test('parses the target view_spec.xml format', async ({ page }) => {
    const xml = await fs.readFile(new URL('../../docs/view_spec.xml', import.meta.url), 'utf8');
    const result = await page.evaluate((value) => {
      const design = window.ViewBuilder.deserialize(value);
      return {
        name: design.name,
        alias: design.alias,
        selectionFormula: design.selectionFormula,
        columns: design.columns.map((column) => ({
          title: column.title,
          formula: column.formula,
          programmaticName: column.programmaticName,
          categorized: column.categorized,
          sort: column.sort,
          multipleValuesAsSeparateEntries: column.multipleValuesAsSeparateEntries,
        })),
      };
    }, xml);

    expect(result.name).toBe('Example generated view');
    expect(result.alias).toBe('vw.exampleGeneratedView');
    expect(result.selectionFormula).toBe('$docSettings != ""');
    expect(result.columns).toEqual([
      { title: 'Ustawienia', formula: '@GetField("$docSettings")', programmaticName: 'colDocSettings', categorized: true, sort: 'ascending', multipleValuesAsSeparateEntries: true },
      { title: 'Utworzono', formula: '@Created', programmaticName: 'colCreated', categorized: false, sort: 'descending', multipleValuesAsSeparateEntries: false },
      { title: 'Autor', formula: '@Name([CN]; $docAuthor)', programmaticName: 'colDocAuthor', categorized: false, sort: 'none', multipleValuesAsSeparateEntries: false },
    ]);
  });

  test('the full reference document round-trips', async ({ page }) => {
    const xml = await fs.readFile(new URL('../../docs/view_full_spec.xml', import.meta.url), 'utf8');
    const result = await page.evaluate((value) => {
      const design = window.ViewBuilder.deserialize(value);
      const again = window.ViewBuilder.serialize(design);
      const back = window.ViewBuilder.deserialize(again);
      return {
        count: design.columns.length,
        titles: design.columns.map((column) => column.title),
        again: again,
        back: back.columns.map((column) => ({
          font: column.font,
          header: column.header,
          hideWhen: column.hideWhen,
        })),
      };
    }, xml);

    expect(result.count).toBe(3);
    expect(result.titles).toEqual(['Amount', 'Status', '']);
    expect(result.again).toContain('<viewTemplate alternateRows="false">');
    expect(result.again).toContain('multipleValuesAsSeparateEntries="true"');
    expect(result.again).toContain('headerFont face="times" size="11pt" color="#663300" bold="false" italic="true"/>');
    expect(result.back[0].font.face).toBe('arial');
    expect(result.back[0].header.align).toBe('center');
    expect(result.back[0].hideWhen).toBe('Status = "Closed"');
    expect(result.back[1].header.bold).toBe(true);
  });
});
