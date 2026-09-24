import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { idle, type ReaderApi } from './helpers';

const completeRoute = /^M[\d.eE+\-]+ [\d.eE+\-]+(?: L[\d.eE+\-]+ [\d.eE+\-]+| C[\d.eE+\-]+ [\d.eE+\-]+ [\d.eE+\-]+ [\d.eE+\-]+ [\d.eE+\-]+ [\d.eE+\-]+)+$/;

test('full offline microservice model keeps continuous curves, straight fallbacks and source colours', async ({ page }) => {
  const html = resolve('artifacts/acceptance-traditional-microservices-full.html');
  execFileSync(process.execPath, ['system-blueprint/scripts/generate.mjs', 'tests/fixtures/traditional-microservices-full.diagram.json', '--output', html, '--overwrite']);
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(html).href);
  await idle(page, true);

  const edges = await page.evaluate(() => {
    const read = (id: string) => {
      const line = document.querySelector<SVGPathElement>(`#scene [data-edge-id="${id}"] .bp-edge-line`)!;
      const markerId = line.getAttribute('marker-end')?.match(/url\(#([^)]*)\)/)?.[1];
      return {
        d: line.getAttribute('d'), stroke: line.getAttribute('stroke'),
        markerFill: markerId ? document.getElementById(markerId)?.querySelector('path')?.getAttribute('fill') : undefined,
      };
    };
    const paths = [...document.querySelectorAll<SVGPathElement>('#scene .bp-edge-line')].map(line => line.getAttribute('d') ?? '');
    return {
      order: read('order-inventory'), orderData: read('order-order-db'),
      payment: read('payment-result'), paymentData: read('payment-payment-db'), paymentExternal: read('payment-provider'),
      exception: read('result-compensate'), feedback: read('compensate-inventory'),
      paths,
    };
  });
  expect(edges.paths.some(path => path.includes(' C'))).toBe(true);
  for (const path of edges.paths) expect(path).toMatch(completeRoute);
  expect(edges.order.stroke).toBe(edges.orderData.stroke);
  expect(edges.payment.stroke).toBe(edges.paymentData.stroke);
  expect(edges.payment.stroke).toBe(edges.paymentExternal.stroke);
  expect(edges.order.stroke).not.toBe(edges.payment.stroke);
  expect(edges.exception.stroke).not.toBe(edges.payment.stroke);
  expect(edges.feedback.stroke).not.toBe(edges.payment.stroke);
  await expect(page.locator('.legend')).toContainText('普通连线按来源着色');
  for (const edge of [edges.order, edges.orderData, edges.payment, edges.paymentData, edges.paymentExternal, edges.exception, edges.feedback]) {
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
  expect(exported.d).toBe(edges.paymentExternal.d);
  expect(exported.d).not.toMatch(/ Q/);
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

test('README overview and order flow default to horizontal compositions with only curves or single straight lines', async ({ page }) => {
  const html = resolve('artifacts/acceptance-traditional-microservices-overview.html');
  execFileSync(process.execPath, ['system-blueprint/scripts/generate.mjs', 'examples/traditional-microservices.diagram.json', '--output', html, '--overwrite']);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(html).href);
  await idle(page, true);

  const overview = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('#scene svg[data-diagram]')!;
    const paths = [...svg.querySelectorAll<SVGPathElement>('.bp-edge-line')].map(line => line.getAttribute('d') ?? '');
    return { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height, paths };
  });
  expect(overview.width).toBeGreaterThan(overview.height);
  expect(overview.paths.length).toBeGreaterThan(0);
  expect(overview.paths.some(path => path.includes(' C'))).toBe(true);
  for (const path of overview.paths) {
    expect(path).toMatch(completeRoute);
    const commands = path.match(/[MLCQ]/g) ?? [];
    expect(commands.join('') === 'ML' || commands.slice(1).every(command => command === 'C')).toBe(true);
  }
  const detailHtml = resolve('artifacts/acceptance-traditional-microservices-order-flow.html');
  execFileSync(process.execPath, ['system-blueprint/scripts/generate.mjs', 'examples/traditional-microservices-order-flow.diagram.json', '--output', detailHtml, '--overwrite']);
  await page.goto(pathToFileURL(detailHtml).href);
  await idle(page, true);
  const detail = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('#scene svg[data-diagram]')!;
    return {
      width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height,
      paths: [...svg.querySelectorAll<SVGPathElement>('.bp-edge-line')].map(line => line.getAttribute('d') ?? ''),
    };
  });
  expect(detail.width).toBeGreaterThan(detail.height);
  for (const path of detail.paths) {
    expect(path).toMatch(completeRoute);
    const commands = path.match(/[MLCQ]/g) ?? [];
    expect(commands.join('') === 'ML' || commands.slice(1).every(command => command === 'C')).toBe(true);
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
