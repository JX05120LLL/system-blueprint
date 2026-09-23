import { test, expect } from '@playwright/test';
import { composeSvg } from '../../scripts/comparison.mjs';
test('V22 comparison preserves dimensions, scales and independent marker/gradient references', async ({ page }) => {
  const source = (width: number, height: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-theme="light" style="font-family:Arial"><defs><linearGradient id="fill"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#eeeeee"/></linearGradient><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker></defs><rect width="${width}" height="${height}" fill="url(#fill)"/><path d="M20 60H150" stroke="black" marker-end="url(#arrow)"/><text x="20" y="40" font-size="15">Same size</text></svg>`;
  const result = await page.evaluate(composeSvg, { before: source(220, 140), after: source(320, 210) });
  await page.setContent(result);
  await expect(page.locator('[data-side]')).toHaveCount(2);
  const info = await page.evaluate(() => {
    const root = document.querySelector('svg')!;
    return { width: root.getAttribute('width'), height: root.getAttribute('height'), ids: [...document.querySelectorAll('[id]')].map(el => el.id), sides: [...root.querySelectorAll('svg[data-side]')].map(el => ({ width: el.getAttribute('width'), height: el.getAttribute('height'), y: el.getAttribute('y'), transform: el.getAttribute('transform') })), refs: [...root.querySelectorAll('[marker-end]')].map(el => el.getAttribute('marker-end')), fonts: [...root.querySelectorAll('svg text')].map(el => getComputedStyle(el).fontSize) };
  });
  expect(info.width).toBe('636'); expect(info.height).toBe('306');
  expect(info.ids).toEqual(['before-fill', 'before-arrow', 'after-fill', 'after-arrow']);
  expect(info.sides.map(x => [x.width, x.height, x.y, x.transform])).toEqual([['220', '140', '64', null], ['320', '210', '64', null]]);
  expect(info.refs).toEqual(['url(#before-arrow)', 'url(#after-arrow)']);
  expect(info.fonts.filter(size => size === '15px')).toHaveLength(2);
  await page.screenshot({ path: 'artifacts/screenshots/comparison-id-regression.png' });
});
