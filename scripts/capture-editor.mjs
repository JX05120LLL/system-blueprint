import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
try {
  await mkdir('artifacts/screenshots', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('examples/overview.html')).href);
  await page.evaluate(() => window.blueprint.ready);
  await page.locator('[data-node-id="document"]').click();
  await page.screenshot({ path: 'artifacts/screenshots/overview-review-details.png' });
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.screenshot({ path: 'artifacts/screenshots/overview-review-edit.png' });
  await page.getByRole('textbox', { name: '名称' }).fill('已审核的 diagram.json');
  await page.getByRole('textbox', { name: '摘要' }).fill('可检查、可修改、可再次导出');
  await page.getByRole('button', { name: '保存修改' }).click();
  await page.evaluate(() => window.blueprint.whenIdle());
  await page.screenshot({ path: 'artifacts/screenshots/overview-review-saved.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.screenshot({ path: 'artifacts/screenshots/overview-review-narrow.png' });
  await context.close();
} finally { await browser.close(); }
