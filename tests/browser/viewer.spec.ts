import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
async function open(page: import('@playwright/test').Page, name: string) {
  const output = resolve(`artifacts/browser-${name}.html`);
  execFileSync(process.execPath, ['system-flow/scripts/generate.mjs', `tests/fixtures/${name}.diagram.json`, '--output', output, '--overwrite']);
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(output).href);
  await page.evaluate(() => (window as any).blueprint.ready);
}
test('V14 V16 offline node details, keyboard and theme', async ({ page }) => {
  await open(page, 'overview');
  await page.locator('[data-node-id="input"]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toBeVisible();
  await expect(page.locator('#details')).toContainText('仓库');
  await page.keyboard.press('Escape'); await expect(page.locator('#details')).toBeHidden();
  await expect(page.locator('[data-node-id="input"]')).toBeFocused();
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
});

test('V14 without JavaScript shows model summary without inactive reader controls', async ({ page, browser }) => {
  await open(page, 'overview');
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  try {
    const disabled = await context.newPage();
    await disabled.goto(pathToFileURL(resolve('artifacts/browser-overview.html')).href);
    await expect(disabled.locator('.noscript')).toContainText('diagram.json');
    await expect(disabled.locator('#workspace')).toBeHidden();
    await expect(disabled.locator('footer')).toBeHidden();
    await expect(disabled.locator('.actions')).toBeHidden();
  } finally { await context.close(); }
});
