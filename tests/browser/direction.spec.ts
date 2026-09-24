import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { idle, state, type ReaderApi } from './helpers';

test('offline reader switches layout direction and saves the chosen direction', async ({ page }) => {
  const html = resolve('artifacts/acceptance-order-flow-direction.html');
  execFileSync(process.execPath, ['system-flow/scripts/generate.mjs', 'examples/traditional-microservices-order-flow.diagram.json', '--output', html, '--overwrite']);
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(html).href);
  await idle(page, true);

  const initial = await state(page);
  expect(initial.graph.width).toBeGreaterThan(initial.graph.height);
  await expect(page.locator('#direction-right')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#direction-down')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-node-id="stock-ok"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toBeVisible();

  await page.locator('#direction-down').click();
  await idle(page);
  const vertical = await state(page);
  expect(vertical.graph.height).toBeGreaterThan(vertical.graph.width);
  expect(vertical.graph.nodes).toHaveLength(initial.graph.nodes.length);
  expect(vertical.graph.edges).toHaveLength(initial.graph.edges.length);
  expect(vertical.selected?.id).toBe('stock-ok');
  await expect(page.locator('#direction-down')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#details')).toBeVisible();
  const verticalSvg = await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg());
  const verticalSize = await page.evaluate(xml => {
    const svg = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
    return { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')) };
  }, verticalSvg);
  expect(verticalSize.height).toBeGreaterThan(verticalSize.width);

  const downloaded = page.waitForEvent('download');
  await page.locator('#download-data').click();
  const path = await (await downloaded).path();
  expect(path).toBeTruthy();
  expect(JSON.parse(await readFile(path!, 'utf8')).view.direction).toBe('DOWN');

  const revised = page.waitForEvent('download');
  await page.locator('#download-html').click();
  const revisedPath = await (await revised).path();
  expect(revisedPath).toBeTruthy();
  const revisedHtml = await readFile(revisedPath!, 'utf8');
  expect(revisedHtml).toContain('"direction":"DOWN"');
  const reopenedPath = resolve('artifacts/acceptance-direction-revised.html');
  await writeFile(reopenedPath, revisedHtml);

  await page.locator('#direction-right').click();
  await idle(page);
  const horizontal = await state(page);
  expect(horizontal.graph.width).toBeGreaterThan(horizontal.graph.height);
  expect(horizontal.selected?.id).toBe('stock-ok');
  await expect(page.locator('#direction-right')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#undo-edit').click();
  await idle(page);
  const undone = await state(page);
  expect(undone.graph.height).toBeGreaterThan(undone.graph.width);
  await expect(page.locator('#direction-down')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#redo-edit').click();
  await idle(page);
  const redone = await state(page);
  expect(redone.graph.width).toBeGreaterThan(redone.graph.height);
  await expect(page.locator('#direction-right')).toHaveAttribute('aria-pressed', 'true');

  const reopened = await page.context().newPage();
  reopened.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  reopened.on('pageerror', error => errors.push(error.message));
  await reopened.goto(pathToFileURL(reopenedPath).href);
  await idle(reopened, true);
  const saved = await state(reopened);
  expect(saved.graph.height).toBeGreaterThan(saved.graph.width);
  await expect(reopened.locator('#direction-down')).toHaveAttribute('aria-pressed', 'true');
  await reopened.close();

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
