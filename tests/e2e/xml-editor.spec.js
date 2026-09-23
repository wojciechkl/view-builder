import { test, expect } from '@playwright/test';
import { openHarness, selectColumn, toolbarButton, fieldInput } from './helpers.js';

const editor = (page) => page.locator('#host .vb-xml-editor');
const editorInput = (page) => page.locator('#host .vb-xml-editor-input');
const editorButton = (page, label) => page.locator('#host .vb-xml-editor .vb-btn').filter({ hasText: label });
const status = (page) => page.locator('#host .vb-xml-status');

async function enterXmlMode(page) {
  await toolbarButton(page, 'XML Editor').click();
  await expect(editor(page)).toBeVisible();
}

test.describe('XML editor mode', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('toolbar button switches between the visual and XML editor', async ({ page }) => {
    await expect(editor(page)).toBeHidden();
    await expect(page.locator('#host .vb-main')).toBeVisible();

    await enterXmlMode(page);
    await expect(page.locator('#host .vb-main')).toBeHidden();
    await expect(toolbarButton(page, 'Design View')).toBeVisible();
    await expect(editorInput(page)).toHaveValue(/<view/);

    await toolbarButton(page, 'Design View').click();
    await expect(editor(page)).toBeHidden();
    await expect(page.locator('#host .vb-main')).toBeVisible();
    await expect(toolbarButton(page, 'XML Editor')).toBeVisible();
  });

  test('the editor opens on the current design with defaults omitted', async ({ page }) => {
    await selectColumn(page, 0);
    await fieldInput(page, 'Title').fill('Custom');
    await enterXmlMode(page);

    const value = await editorInput(page).inputValue();
    expect(value).toContain('<title>Custom</title>');
    expect(value).toContain('<formula>Subject</formula>');
    expect(value).not.toContain('resizable=');
    expect(value).not.toContain('<font');
  });

  test('editing the XML applies to the design live', async ({ page }) => {
    await enterXmlMode(page);
    await editorInput(page).fill([
      '<viewTemplate>',
      '  <name>XmlView</name>',
      '  <column width="200">',
      '    <formula>Subject</formula>',
      '  </column>',
      '</viewTemplate>',
    ].join('\n'));

    await expect(status(page)).toHaveClass(/vb-xml-status-ok/);
    await expect.poll(() => page.evaluate(() => window.__builder.getDesign().name)).toBe('XmlView');

    await toolbarButton(page, 'Design View').click();
    await expect(page.locator('#host .vb-caption-name')).toHaveText('XmlView');
    await expect(page.locator('#host .vb-th')).toHaveCount(2);
    await expect(page.locator('#host tbody tr')).toHaveCount(12);
  });

  test('invalid XML shows a meaningful error and keeps the design', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await enterXmlMode(page);

    await editorInput(page).fill('<viewTemplate><column></viewTemplate>');
    await expect(status(page)).toHaveClass(/vb-xml-status-error/);
    await expect(status(page)).toContainText('Invalid XML');
    await expect(status(page)).toContainText('line 1');

    expect(await page.evaluate(() => window.__builder.getDesign().name)).toBe('AllDocuments');
    expect(await page.evaluate(() => window.__builder.getDesign().columns.length)).toBe(4);

    await toolbarButton(page, 'Design View').click();
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('#host .vb-main')).toBeHidden();
    expect(pageErrors).toEqual([]);
  });

  test('rejects a non-view root with a helpful message', async ({ page }) => {
    await enterXmlMode(page);
    await editorInput(page).fill('<database><columns/></database>');
    await expect(status(page)).toHaveClass(/vb-xml-status-error/);
    await expect(status(page)).toContainText('root element must be <viewTemplate>');
  });

  test('Apply, Format and Revert buttons work', async ({ page }) => {
    await enterXmlMode(page);
    await editorInput(page).fill('<viewTemplate><name>Applied</name></viewTemplate>');
    await editorButton(page, 'Apply XML').click();
    await expect(status(page)).toContainText('XML applied');
    expect(await page.evaluate(() => window.__builder.getDesign().name)).toBe('Applied');

    await editorButton(page, 'Format').click();
    const formatted = await editorInput(page).inputValue();
    expect(formatted).toContain('<viewTemplate>');
    expect(formatted).toContain('\n  <name>Applied</name>\n</viewTemplate>');

    await editorInput(page).fill('<viewTemplate><name>Discarded</name>');
    await expect(status(page)).toHaveClass(/vb-xml-status-error/);
    await editorButton(page, 'Revert').click();
    await expect(editorInput(page)).toHaveValue(/<name>Applied<\/name>/);
    expect(await page.evaluate(() => window.__builder.getDesign().name)).toBe('Applied');
  });

  test('Ctrl+S applies without leaving the XML editor', async ({ page }) => {
    await enterXmlMode(page);
    await editorInput(page).fill('<viewTemplate><name>Saved</name></viewTemplate>');
    await editorInput(page).press('Control+s');
    await expect(status(page)).toContainText('XML applied');
    expect(await page.evaluate(() => window.__builder.getDesign().name)).toBe('Saved');
    await expect(editor(page)).toBeVisible();
  });
});
