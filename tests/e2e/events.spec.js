import { test, expect } from '@playwright/test';
import {
  openHarness, selectColumn, field, fieldInput, checkOption, segmentedOption,
  panelTab, seedColumn, dialog, dialogButton, formulaButton,
} from './helpers.js';

async function subscribe(page, selector = '#host') {
  await page.evaluate((sel) => {
    const builder = document.querySelector(sel).__vb;
    window.__propEvents = [];
    window.__domEvents = [];
    builder.on('propertychange', (detail) => {
      window.__propEvents.push({
        phase: detail.phase,
        property: detail.property,
        path: detail.path,
        value: detail.value,
        previous: detail.previous,
        columnId: detail.columnId,
        columnIndex: detail.columnIndex,
      });
    });
    document.querySelector(sel).addEventListener('viewbuilder:propertychange', (e) => {
      window.__domEvents.push({ phase: e.detail.phase, path: e.detail.path, value: e.detail.value });
    });
  }, selector);
}

const eventsFor = (page, property) => page.evaluate(
  (prop) => window.__propEvents.filter((e) => e.property === prop),
  property,
);

test.describe('property change events', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('typing emits input phases and one commit phase on blur', async ({ page }) => {
    await selectColumn(page, 0);
    await subscribe(page);
    const title = fieldInput(page, 'Title');
    await title.fill('');
    await title.pressSequentially('Doc');
    await title.blur();

    const events = await eventsFor(page, 'title');
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0]).toMatchObject({ phase: 'input', value: '', previous: 'Subject' });
    expect(events.at(-1)).toMatchObject({ phase: 'commit', value: 'Doc' });
    expect(events.at(-1).path).toBe('columns.0.title');
    expect(events.at(-1).columnIndex).toBe(0);

    const columnId = await page.evaluate(() => window.__builder.getDesign().columns[0].id);
    expect(events.at(-1).columnId).toBe(columnId);

    const phases = events.filter((e) => e.phase === 'commit');
    expect(phases).toHaveLength(1);
  });

  test('a saved formula dialog emits a single commit event', async ({ page }) => {
    await selectColumn(page, 1);
    await subscribe(page);
    await formulaButton(page, 0).click();
    await dialog(page).locator('.vb-formula-input').fill('@Text(From)');
    await dialogButton(page, 'OK').click();

    const events = await eventsFor(page, 'formula');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      phase: 'commit', value: '@Text(From)', previous: 'From', columnIndex: 1,
    });
  });

  test('selects, checkboxes and segmented buttons emit one commit event each', async ({ page }) => {
    await selectColumn(page, 0);
    await subscribe(page);

    await fieldInput(page, 'Show as').selectOption('number');
    await checkOption(page, 'Resizable').uncheck();
    await segmentedOption(page, 'Alignment', 'Center').click();

    const type = await eventsFor(page, 'type');
    expect(type).toEqual([expect.objectContaining({ phase: 'commit', value: 'number', previous: 'text' })]);

    const resizable = await eventsFor(page, 'resizable');
    expect(resizable).toEqual([expect.objectContaining({ phase: 'commit', value: false, previous: true })]);

    const align = await eventsFor(page, 'align');
    expect(align).toEqual([expect.objectContaining({ phase: 'commit', value: 'center', previous: 'left' })]);
  });

  test('font controls emit properties inside the font object', async ({ page }) => {
    await seedColumn(page, 0, { header: { useColumnFont: true } });
    await selectColumn(page, 0);
    await panelTab(page, 'Font').click();
    await subscribe(page);

    await segmentedOption(page, 'Style', 'B').click();
    const size = fieldInput(page, 'Size (pt)');
    await size.fill('12');
    await size.blur();

    const bold = await eventsFor(page, 'font.bold');
    expect(bold).toEqual([expect.objectContaining({
      phase: 'commit', value: true, previous: false, path: 'columns.0.font.bold',
    })]);

    const fontSize = await eventsFor(page, 'font.size');
    expect(fontSize.length).toBeGreaterThanOrEqual(2);
    expect(fontSize[0]).toMatchObject({ phase: 'input', value: 12, previous: 9 });
    expect(fontSize.at(-1)).toMatchObject({ phase: 'commit', value: 12 });
  });

  test('resizing emits intermediate width events and one final commit', async ({ page }) => {
    await subscribe(page);
    const handle = page.locator('#host .vb-th').first().locator('.vb-resize');
    const box = await handle.boundingBox();
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, y, { steps: 3 });
    await page.mouse.move(box.x + 60, y, { steps: 3 });
    await page.mouse.up();

    const events = await eventsFor(page, 'width');
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.at(-1)).toMatchObject({ phase: 'commit', previous: 210 });
    expect(events.at(-1).value).toBeGreaterThan(210);
    expect(events.filter((e) => e.phase === 'commit')).toHaveLength(1);
    const inputEvents = events.filter((e) => e.phase === 'input');
    expect(inputEvents.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < inputEvents.length; i += 1) {
      expect(inputEvents[i].value).toBeGreaterThanOrEqual(inputEvents[i - 1].value);
    }
  });

  test('view-level properties emit events and the DOM event bubbles on the host', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await subscribe(page);

    const name = fieldInput(page, 'View name');
    await name.fill('MyView');
    await name.blur();
    await page.evaluate(() => window.__builder.setViewName('ExternalView'));

    const events = await eventsFor(page, 'name');
    expect(events[0]).toMatchObject({ phase: 'input', value: 'MyView', columnId: null, columnIndex: -1, path: 'name' });
    expect(events.at(-1)).toMatchObject({ phase: 'commit', value: 'ExternalView', previous: 'MyView' });

    const domEvents = await page.evaluate(() => window.__domEvents);
    expect(domEvents.at(-1)).toEqual({ phase: 'commit', path: 'name', value: 'ExternalView' });
  });

  test('off() unsubscribes the handler but the DOM event keeps firing', async ({ page }) => {
    await page.locator('#host .vb-canvas').click({ position: { x: 760, y: 420 } });
    await subscribe(page);
    await page.evaluate(() => window.__builder.off('propertychange'));
    await page.evaluate(() => window.__builder.setViewAlias('vAlias'));

    expect(await page.evaluate(() => window.__propEvents.length)).toBe(0);
    expect(await page.evaluate(() => window.__domEvents.length)).toBe(1);
  });

  test('read-only mode emits no property events', async ({ page }) => {
    await page.evaluate(() => window.mountBuilderReadonly());
    await subscribe(page, '#roHost');

    const before = await page.evaluate(() => {
      const builder = document.querySelector('#roHost').__vb;
      builder.setViewName('Hacked');
      builder.setViewAlias('vHacked');
      builder.addColumn();
      builder.update((c) => { c.title = 'Hacked'; });
      return builder.getReadonly();
    });

    expect(before).toBe(true);
    expect(await page.evaluate(() => window.__propEvents.length)).toBe(0);
    expect(await page.evaluate(() => window.__domEvents.length)).toBe(0);
  });
});
