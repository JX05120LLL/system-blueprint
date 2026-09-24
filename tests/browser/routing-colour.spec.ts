import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { idle, type ReaderApi } from './helpers';

test('complex offline diagram keeps rounded routes and source colours in reader and export', async ({ page }) => {
  const html = resolve('artifacts/acceptance-traditional-microservices.html');
  execFileSync(process.execPath, ['system-blueprint/scripts/generate.mjs', 'examples/traditional-microservices.diagram.json', '--output', html, '--overwrite']);
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(html).href);
  await idle(page, true);

  const edges = await page.evaluate(() => {
    const read = (id: string) => {
      const line = document.querySelector<SVGPathElement>(`#scene [data-edge-id="${id}"] .bp-edge-line`)!;
      const markerId = line.getAttribute('marker-end')?.match(/url\(#([^)]*)\)/)?.[1];
      return { stroke: line.getAttribute('stroke'), markerFill: markerId ? document.getElementById(markerId)?.querySelector('path')?.getAttribute('fill') : undefined };
    };
    return {
      order: read('order-inventory'), orderData: read('order-order-db'),
      payment: read('payment-result'), paymentData: read('payment-payment-db'), paymentExternal: read('payment-provider'),
      exception: read('result-compensate'), feedback: read('compensate-inventory'),
      rounded: [...document.querySelectorAll<SVGPathElement>('#scene .bp-edge-line')].some(line => /Q[\d.-]/.test(line.getAttribute('d') ?? '')),
    };
  });
  expect(edges.rounded).toBe(true);
  expect(edges.order.stroke).toBe(edges.orderData.stroke);
  expect(edges.payment.stroke).toBe(edges.paymentData.stroke);
  expect(edges.payment.stroke).toBe(edges.paymentExternal.stroke);
  expect(edges.order.stroke).not.toBe(edges.payment.stroke);
  expect(edges.exception.stroke).not.toBe(edges.payment.stroke);
  expect(edges.feedback.stroke).not.toBe(edges.payment.stroke);
  await expect(page.locator('.legend')).toContainText('普通连线按来源着色');
  for (const edge of Object.values(edges).filter((value): value is { stroke: string | null; markerFill: string | undefined } => typeof value === 'object')) {
    expect(edge.markerFill).toBe(edge.stroke);
  }

  await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.toggleGroup('data'));
  await idle(page);
  expect(await page.locator('#scene [data-edge-id="order-inventory"] .bp-edge-line').getAttribute('stroke')).toBe(edges.order.stroke);
  await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.toggleGroup('data'));
  await idle(page);

  const selectedLine = page.locator('#scene [data-edge-id="payment-provider"] .bp-edge-line');
  const before = await selectedLine.evaluate(element => getComputedStyle(element).stroke);
  await page.locator('#scene [data-edge-id="payment-provider"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scene [data-edge-id="payment-provider"]')).toHaveClass(/bp-related/);
  expect(await selectedLine.evaluate(element => getComputedStyle(element).stroke)).toBe(before);

  const exported = await page.evaluate(async () => {
    const xml = await (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg();
    const svg = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const line = svg.querySelector<SVGPathElement>('[data-edge-id="payment-provider"] .bp-edge-line')!;
    const markerId = line.getAttribute('marker-end')!.match(/url\(#([^)]*)\)/)![1]!;
    return { d: line.getAttribute('d'), stroke: line.getAttribute('stroke'), markerFill: svg.getElementById(markerId)?.querySelector('path')?.getAttribute('fill'), legend: svg.documentElement.textContent };
  });
  expect(exported.d).toMatch(/Q[\d.-]/);
  expect(exported.markerFill).toBe(exported.stroke);
  expect(exported.legend).toContain('普通连线按来源节点着色');

  await page.getByRole('button', { name: '切换深浅主题' }).click();
  const dark = await page.evaluate(() => {
    const colour = (id: string) => document.querySelector<SVGPathElement>(`#scene [data-edge-id="${id}"] .bp-edge-line`)?.getAttribute('stroke');
    return { order: colour('order-inventory'), payment: colour('payment-result') };
  });
  expect(dark.order).not.toBe(dark.payment);
  expect(dark.order).not.toBe(edges.order.stroke);
  expect(requests).toEqual([]);
});
